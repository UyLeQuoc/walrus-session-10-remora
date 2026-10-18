/** A9·be + A4·be routes. Built from injected deps so tests run without env, DB or chain. */
import type { Logger } from "@remora/chain";
import type { Context } from "hono";
import { Hono } from "hono";
import {
  buildMoveToAddressBalance,
  buildWithdrawToCoin,
  detectFunds,
  FundsError,
  type FundsRole,
} from "./funds.ts";
import {
  NETWORK_HEADER,
  type Networks,
  NetworkUnavailableError,
  resolveNetwork,
} from "./networks.ts";

const ADDRESS = /^0x[0-9a-fA-F]{1,64}$/;

export function createMoneyRoutes(deps: { networks: Networks; log: Logger }) {
  const app = new Hono();

  const fail = (c: Context, status: 400 | 404, code: string, message: string) =>
    c.json({ error: { code, message } }, status);

  /** Resolves the session's network or answers a typed refusal (ADR-0026). */
  const withNetwork = (c: Context) => {
    try {
      const network = resolveNetwork(deps.networks, c.req.header(NETWORK_HEADER));
      // K1: every log line of this request carries its ID and network.
      const requestId = c.req.header("x-request-id") ?? crypto.randomUUID();
      c.header("x-request-id", requestId);
      return { network, log: deps.log.child({ requestId, network }) };
    } catch (err) {
      if (err instanceof NetworkUnavailableError) {
        return { refusal: fail(c, 400, err.code, err.message) };
      }
      throw err;
    }
  };

  app.get("/api/networks", (c) =>
    c.json({
      default: deps.networks.default,
      networks: deps.networks.list().map((n) => ({
        network: n.network,
        available: n.available,
        ...(n.reason ? { reason: n.reason } : {}),
        packageId: n.packageId,
        usdcCoinType: n.usdcCoinType,
      })),
    }),
  );

  // Balances are public chain data, so this needs no session; the UI passes the owner and remoras.
  app.get("/api/funds", async (c) => {
    const r = withNetwork(c);
    if (r.refusal) return r.refusal;
    const owner = c.req.query("owner") ?? "";
    const remoras = (c.req.query("remoras") ?? "").split(",").filter(Boolean);
    const merchants = (c.req.query("merchants") ?? "").split(",").filter(Boolean);
    const rows: { address: string; role: FundsRole }[] = [
      { address: owner, role: "owner" as const },
      ...remoras.map((address) => ({ address, role: "remora" as const })),
      ...merchants.map((address) => ({ address, role: "merchant" as const })),
    ];
    if (rows.some((x) => !ADDRESS.test(x.address))) {
      return fail(c, 400, "funds.bad_address", "Every address must be 0x + hex.");
    }
    const cfg = deps.networks.config(r.network);
    const result = await detectFunds(deps.networks.client(r.network), cfg.usdcCoinType, rows);
    r.log.info("funds.detect", { addresses: rows.length });
    return c.json({ network: r.network, ...result });
  });

  // Unsigned transactions: the owner's wallet resolves gas, signs and executes them.
  app.post("/api/funds/move", async (c) => {
    const r = withNetwork(c);
    if (r.refusal) return r.refusal;
    const body = await c.req.json<{ owner?: string; amount?: string }>().catch(() => ({}) as never);
    if (!body.owner || !ADDRESS.test(body.owner)) {
      return fail(c, 400, "funds.bad_address", "owner must be 0x + hex.");
    }
    try {
      const cfg = deps.networks.config(r.network);
      const tx = await buildMoveToAddressBalance(
        deps.networks.client(r.network),
        body.owner,
        cfg.usdcCoinType,
        body.amount ? BigInt(body.amount) : undefined,
      );
      return c.json({ network: r.network, transaction: await tx.toJSON() });
    } catch (err) {
      if (err instanceof FundsError) return fail(c, 400, err.code, err.message);
      throw err;
    }
  });

  app.post("/api/funds/withdraw", async (c) => {
    const r = withNetwork(c);
    if (r.refusal) return r.refusal;
    const body = await c.req.json<{ owner?: string; amount?: string }>().catch(() => ({}) as never);
    if (!body.owner || !ADDRESS.test(body.owner) || !body.amount || !/^\d+$/.test(body.amount)) {
      return fail(
        c,
        400,
        "funds.bad_request",
        "owner (0x…) and amount (integer string) are required.",
      );
    }
    try {
      const cfg = deps.networks.config(r.network);
      const tx = buildWithdrawToCoin(body.owner, cfg.usdcCoinType, BigInt(body.amount));
      return c.json({ network: r.network, transaction: await tx.toJSON() });
    } catch (err) {
      if (err instanceof FundsError) return fail(c, 400, err.code, err.message);
      throw err;
    }
  });

  return app;
}
