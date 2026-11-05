/**
 * C3 (ADR-0148): the Treasurer's HTTP surface.
 * - `POST /api/treasury`: create one (no Disc, so nothing to sign), names resolved before anything
 *   is written;
 * - `/api/remoras/:id/treasury…`: its card, its setup, "Report now" and the owner's own requests;
 * - `/api/treasury/reports/:eventId/share`: share or stop sharing a report;
 * - `GET /api/public/treasury/:token`: the redacted report, no session (the token is the capability).
 * Webhook requests arrive on U18's signed door (`/api/hooks/:remoraId/:id`, hooks.ts).
 */
import type { Context } from "hono";
import { Hono } from "hono";
import { NETWORK_HEADER, NetworkUnavailableError, resolveNetwork } from "../money/networks.ts";
import type { RuntimeDeps } from "./deps.ts";
import { type Remora, RemoraError, type RemoraService } from "./remoras.ts";
import { humanError } from "./routes.ts";
import {
  isTreasurer,
  publicReport,
  queueTreasuryReport,
  resolveSetup,
  saveSetup,
  setupTreasury,
  shareReport,
  spendRequest,
  type TreasurySetup,
  treasuryView,
  unshareReport,
  writeTreasuryReport,
} from "./treasury.ts";

export interface TreasuryRouteDeps {
  service: RemoraService;
  runtime: RuntimeDeps;
  /** The signed-in wallet address, or null. */
  owner: (c: Context) => Promise<string | null>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "cache-control": "no-store" };

const serialize = (v: unknown): unknown =>
  JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)));

const setupOf = (b: Record<string, unknown>): TreasurySetup => ({
  watch: Array.isArray(b.watch)
    ? b.watch.map((w: unknown) =>
        typeof w === "string"
          ? { address: w }
          : {
              address: String((w as { address?: unknown })?.address ?? ""),
              label: String((w as { label?: unknown })?.label ?? ""),
            },
      )
    : [],
  ...(Array.isArray(b.contacts)
    ? {
        contacts: b.contacts.map((x: unknown) => ({
          name: String((x as { name?: unknown })?.name ?? ""),
          address: String((x as { address?: unknown })?.address ?? ""),
        })),
      }
    : {}),
  ...(b.perRequestCap !== undefined ? { perRequestCap: String(b.perRequestCap) } : {}),
  ...(b.monthlyCap !== undefined ? { monthlyCap: String(b.monthlyCap) } : {}),
});

export function createTreasuryRoutes(d: TreasuryRouteDeps) {
  const app = new Hono<{ Variables: { owner: string } }>();
  const rt = d.runtime;

  app.onError((err, c) => {
    if (err instanceof RemoraError)
      return c.json(
        { error: { code: err.code, message: humanError(err.code, err.message) } },
        err.status,
      );
    if (err instanceof NetworkUnavailableError)
      return c.json({ error: { code: err.code, message: err.message } }, 400);
    rt.log.error("api.treasury_failed", { path: c.req.path, error: err });
    return c.json({ error: { code: "unknown", message: "Something went wrong." } }, 500);
  });

  // No session: the token is the capability, and the view is allow-listed (treasury.ts).
  app.get("/api/public/treasury/:token", async (c) => {
    const view = await publicReport(rt, c.req.param("token"));
    return view
      ? c.json(view)
      : c.json(
          {
            error: {
              code: "treasury.not_shared",
              message: "This link was revoked or never existed.",
            },
          },
          404,
        );
  });

  for (const path of [
    "/api/treasury",
    "/api/treasury/*",
    "/api/remoras/:id/treasury",
    "/api/remoras/:id/treasury/*",
  ]) {
    app.use(path, async (c, next) => {
      const owner = await d.owner(c);
      if (!owner)
        return c.json(
          { error: { code: "auth.required", message: "Sign in with your wallet first." } },
          401,
        );
      const id = c.req.param("id");
      if (id !== undefined && !UUID.test(id))
        return c.json({ error: { code: "not_found", message: "Not found." } }, 404);
      c.set("owner", owner);
      await next();
    });
  }

  const body = async (c: Context) =>
    ((await c.req.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  const view = (r: Remora) => ({ ...(serialize(r) as object), config: d.service.config(r) });
  const treasurer = async (c: Context<{ Variables: { owner: string } }>) => {
    const r = await d.service.get(c.req.param("id") ?? "", c.get("owner"));
    if (!isTreasurer(r)) throw new RemoraError("treasury.only", `${r.name} isn't a Treasurer.`);
    return r;
  };

  /** A Treasurer has no Disc: it's ready at once, with its watch list, contacts and limits. */
  app.post("/api/treasury", async (c) => {
    const b = await body(c);
    const network = resolveNetwork(rt.networks, c.req.header(NETWORK_HEADER));
    const resolved = await resolveSetup(rt.networks.client(network).core, setupOf(b));
    const made = await d.service.create({
      owner: c.get("owner"),
      network,
      template: "treasurer",
      budget: null,
      ...(typeof b.name === "string" && b.name.trim() ? { name: b.name.trim() } : {}),
    });
    const r = await saveSetup(rt, made.remora, resolved);
    await queueTreasuryReport(rt, r).catch((err) =>
      rt.log.warn("treasury.queue_failed", { remora: r.id, error: err }),
    );
    return c.json({ remora: view(r), transaction: null }, 201);
  });

  app.get("/api/remoras/:id/treasury", async (c) =>
    c.json(await treasuryView(rt, await treasurer(c))),
  );

  app.put("/api/remoras/:id/treasury", async (c) => {
    const r = await setupTreasury(rt, await treasurer(c), setupOf(await body(c)));
    return c.json({ remora: view(r), ...(await treasuryView(rt, r)) });
  });

  /** "Report now": the same report the Monday job writes, three an hour at most. */
  app.post("/api/remoras/:id/treasury/report", async (c) => {
    const r = await treasurer(c);
    if (!rt.limiter.take(`treasury-report:${r.id}`, { limit: 3, ms: 3_600_000 }).allowed)
      throw new RemoraError("review.busy", "Three reports an hour is enough; try later.", 409);
    await writeTreasuryReport(rt, r);
    return c.json(await treasuryView(rt, r));
  });

  /** The owner's own request: it still becomes an approval, never a payment. */
  app.post("/api/remoras/:id/treasury/request", async (c) => {
    const { text } = await body(c);
    if (typeof text !== "string" || !text.trim())
      throw new RemoraError("ask.empty", 'Say who and how much, e.g. "pay 0.30 to huy.sui".');
    const r = await treasurer(c);
    return c.json(await spendRequest(rt, r, text, { kind: "owner", channel: "web" }));
  });

  app.post("/api/treasury/reports/:eventId/share", async (c) => {
    const id = c.req.param("eventId");
    if (!UUID.test(id)) throw new RemoraError("treasury.report_not_found", "No such report.", 404);
    return c.json(await shareReport(rt, c.get("owner"), id), 200, NO_STORE);
  });

  app.delete("/api/treasury/reports/:eventId/share", async (c) => {
    const id = c.req.param("eventId");
    if (!UUID.test(id)) throw new RemoraError("treasury.report_not_found", "No such report.", 404);
    return c.json(await unshareReport(rt, c.get("owner"), id));
  });

  // Mounted beside the other groups, which carry no typed variables.
  return app as unknown as Hono;
}
