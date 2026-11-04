/**
 * E13 (ADR-0111): our facilitator, public on testnet. Any Sui x402 merchant can verify and settle
 * through `<api>/api/facilitator`, and its buyers get sponsored gas from `/api/facilitator/gas`. The
 * facilitator itself stays on 127.0.0.1 (ADR-0099); this forwards to it.
 *
 * Testnet only. On top of the server's per-IP ceiling:
 * - settlements per `payTo` per UTC day: that's the cap on the gas we sponsor for one merchant;
 * - gas-station calls per IP per minute, since each one holds a sponsor coin for up to 90 s.
 */
import { Hono } from "hono";
import { clientAddress } from "../iplimit.ts";

export const PUBLIC_LIMITS = { settlesPerPayToPerDay: 200, gasPerIpPerMinute: 10 } as const;
const TESTNET = ["sui:testnet", "testnet"];
const DOCS =
  "https://github.com/UyLeQuoc/walrus-session-10-remora/blob/main/apps/facilitator/README.md#public-facilitator-testnet";

export function createFacilitatorRoutes(o: {
  /** Read on each request, so the server's env has loaded by then. */
  upstream: () => string | undefined;
  fetch?: typeof fetch;
  now?: () => number;
  limits?: { settlesPerPayToPerDay: number; gasPerIpPerMinute: number };
}) {
  const http = o.fetch ?? fetch;
  const now = o.now ?? Date.now;
  const limits = o.limits ?? PUBLIC_LIMITS;
  const settles = new Map<string, number>();
  const gas = new Map<string, number[]>();
  const app = new Hono();

  const refuse = (code: string, message: string, status: 400 | 429 | 503 = 400) =>
    Response.json({ error: { code, message } }, { status });
  const forward = async (path: string, body: unknown) => {
    const res = await http(`${(o.upstream() ?? "").replace(/\/$/, "")}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    return new Response(await res.text(), {
      status: res.status,
      headers: { "content-type": "application/json" },
    });
  };

  app.use("/api/facilitator/*", async (_c, next) => {
    if (!o.upstream())
      return refuse("facilitator.unavailable", "The facilitator isn't running here.", 503);
    await next();
  });

  app.get("/api/facilitator", (c) =>
    c.json({
      network: "sui:testnet",
      scheme: "exact",
      endpoints: {
        supported: "GET /api/facilitator/supported",
        verify: "POST /api/facilitator/verify",
        settle: "POST /api/facilitator/settle",
        gas: "POST /api/facilitator/gas",
      },
      limits,
      docs: DOCS,
    }),
  );

  app.get("/api/facilitator/supported", () => forward("/supported", undefined));

  for (const path of ["verify", "settle"] as const) {
    app.post(`/api/facilitator/${path}`, async (c) => {
      const body = (await c.req.json().catch(() => null)) as {
        paymentPayload?: { network?: string };
        paymentRequirements?: { network?: string; payTo?: string };
      } | null;
      const req = body?.paymentRequirements;
      if (
        !body?.paymentPayload ||
        !req?.payTo ||
        !TESTNET.includes(String(body.paymentPayload.network)) ||
        !TESTNET.includes(String(req.network))
      )
        return refuse(
          "facilitator.testnet_only",
          "Send a paymentPayload and paymentRequirements for sui:testnet.",
        );
      if (path === "settle") {
        const key = `${new Date(now()).toISOString().slice(0, 10)}:${req.payTo.toLowerCase()}`;
        const used = (settles.get(key) ?? 0) + 1;
        if (used > limits.settlesPerPayToPerDay)
          return refuse(
            "facilitator.daily_cap",
            `${req.payTo} settled ${limits.settlesPerPayToPerDay} payments through us today; that's the daily cap.`,
            429,
          );
        settles.set(key, used);
      }
      return forward(`/${path}`, body);
    });
  }

  app.post("/api/facilitator/gas", async (c) => {
    const body = (await c.req.json().catch(() => null)) as { network?: string } | null;
    if (!body || !TESTNET.includes(String(body.network)))
      return refuse("facilitator.testnet_only", "The gas station sponsors sui:testnet only.");
    const ip = clientAddress(c.req.raw.headers);
    const t = now();
    const hits = (gas.get(ip) ?? []).filter((x) => t - x < 60_000);
    if (hits.length >= limits.gasPerIpPerMinute)
      return refuse(
        "facilitator.busy",
        "Too many gas requests from this address; wait a minute.",
        429,
      );
    gas.set(ip, [...hits, t]);
    return forward("/gas", body);
  });

  return app;
}

export const facilitatorRoutes = createFacilitatorRoutes({
  upstream: () => process.env.FACILITATOR_URL_TESTNET,
});
