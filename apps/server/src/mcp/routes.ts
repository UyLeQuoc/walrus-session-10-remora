/**
 * F14 (ADR-0066): the owner's token API (`/api/mcp/tokens*`, signed-in wallet only) and the Streamable
 * HTTP endpoint agents call (`/mcp`, bearer token only).
 */
import type { Logger, SuiNetwork } from "@remora/chain";
import type { Db } from "@remora/db";
import type { McpTokenCreated } from "@remora/schema";
import type { Context } from "hono";
import { Hono } from "hono";
import type { SlidingLimiter } from "../runtime/limits.ts";
import type { Remora } from "../runtime/remoras.ts";
import { ERR, handleRpc, rpcError } from "./rpc.ts";
import {
  type AuthResult,
  type CallRecord,
  callsOf,
  createToken,
  listTokens,
  parseScopes,
  revokeToken,
  type TokenRow,
  tokenView,
} from "./tokens.ts";
import type { McpTool } from "./tools.ts";

export interface McpRouteDeps {
  db: Db;
  log: Logger;
  limiter: SlidingLimiter;
  tools: McpTool[];
  /** The signed-in wallet, or null. */
  owner(c: Context): Promise<string | null>;
  network(c: Context): SuiNetwork;
  /** The owner's remora, or a RemoraError. */
  remoraFor(id: string, owner: string): Promise<Remora>;
  remoraById(id: string): Promise<Remora | null>;
  /** Where agents reach `/mcp` and the API (`API_BASE_URL`, else the request's origin). */
  apiBase(c: Context): string;
  /** The stdio server's entry point, for the ready-to-paste `claude mcp add` line. */
  stdioBin: string;
  /** Browser origins allowed to call `/mcp` (agents send none). */
  allowedOrigins: string[];
  /** The bearer's live token (tokens.ts `authenticate`). */
  authenticate(secret: string | undefined): Promise<AuthResult>;
  /** Logs one tool call (tokens.ts `recordCall`). */
  record(tokenId: string, call: CallRecord): Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (c: Context, status: number, code: string, message: string) =>
  c.json({ error: { code, message } }, status as 400);

/** The ready-to-paste stdio setup. The secret is in it, so it's shown once, like the secret. */
export const stdioLine = (bin: string, apiBase: string, secret: string) =>
  `claude mcp add remora -e REMORA_MCP_TOKEN=${secret} -e REMORA_API_URL=${apiBase} -- bun ${bin}`;

export function createMcpRoutes(d: McpRouteDeps) {
  const app = new Hono<{ Variables: { owner: string } }>();

  app.use("/api/mcp/*", async (c, next) => {
    const owner = await d.owner(c);
    if (!owner) return fail(c, 401, "auth.required", "Sign in with your wallet first.");
    c.set("owner", owner);
    await next();
  });

  app.get("/api/mcp/tokens", async (c) =>
    c.json({ tokens: await listTokens(d.db, c.get("owner"), d.network(c)) }),
  );

  app.post("/api/mcp/tokens", async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as {
      remora?: string;
      name?: string;
      scopes?: unknown;
      days?: number;
    };
    if (!b.remora || !UUID.test(b.remora))
      return fail(c, 400, "mcp.bad_remora", "Choose a remora.");
    const name = String(b.name ?? "").trim();
    if (!name || name.length > 60)
      return fail(c, 400, "mcp.bad_name", "Name the connection (up to 60 characters).");
    const scopes = parseScopes(b.scopes);
    if (!scopes) return fail(c, 400, "mcp.bad_scopes", "Pick at least one permission.");
    const r = await d.remoraFor(b.remora, c.get("owner"));
    if (r.network !== d.network(c))
      return fail(c, 400, "mcp.bad_remora", `${r.name} is on ${r.network}.`);
    if (r.status === "retired" || r.playground)
      return fail(c, 409, "mcp.bad_remora", `${r.name} can't take connections.`);
    const { row, secret } = await createToken(d.db, {
      remoraId: r.id,
      owner: c.get("owner"),
      name,
      scopes,
      ...(typeof b.days === "number" ? { days: b.days } : {}),
    });
    d.log.info("mcp.token_created", { token: row.id, remora: r.id, scopes });
    const base = d.apiBase(c);
    const out: McpTokenCreated = {
      token: tokenView(row, r.name),
      secret,
      stdio: stdioLine(d.stdioBin, base, secret),
      httpUrl: `${base}/mcp`,
    };
    return c.json(out, 201);
  });

  app.post("/api/mcp/tokens/:id/revoke", async (c) => {
    const id = c.req.param("id");
    if (!UUID.test(id)) return fail(c, 404, "not_found", "No such connection.");
    const row = await revokeToken(d.db, c.get("owner"), id);
    if (!row) return fail(c, 404, "not_found", "No such connection.");
    d.log.info("mcp.token_revoked", { token: id });
    const r = await d.remoraById(row.remoraId);
    return c.json({ token: tokenView(row, r?.name ?? "remora") });
  });

  app.get("/api/mcp/tokens/:id/calls", async (c) => {
    const id = c.req.param("id");
    if (!UUID.test(id)) return fail(c, 404, "not_found", "No such connection.");
    const calls = await callsOf(d.db, c.get("owner"), id);
    return calls ? c.json({ calls }) : fail(c, 404, "not_found", "No such connection.");
  });

  // ── Streamable HTTP (MCP 2025-06-18): one endpoint, POST in, JSON out. ──
  const rpcDeps = {
    tools: d.tools,
    limiter: d.limiter,
    log: d.log,
    remora: (t: TokenRow) => d.remoraById(t.remoraId),
    record: d.record,
  };

  const bearer = (c: Context) => /^Bearer\s+(\S+)$/i.exec(c.req.header("authorization") ?? "")?.[1];

  app.post("/mcp", async (c) => {
    // DNS rebinding: a browser page may call /mcp only from an origin we serve.
    const origin = c.req.header("origin");
    if (origin && !d.allowedOrigins.includes(origin))
      return c.json(rpcError(null, ERR.forbidden, "Origin not allowed."), 403);
    const auth = await d.authenticate(bearer(c));
    if (!auth.ok) {
      c.header("WWW-Authenticate", 'Bearer realm="remora", error="invalid_token"');
      const why =
        auth.reason === "revoked"
          ? "This token was revoked by its owner."
          : auth.reason === "expired"
            ? "This token has expired."
            : "A valid MCP token is required (Authorization: Bearer rmcp_…).";
      return c.json(rpcError(null, ERR.unauthorized, why), 401);
    }
    const body = await c.req.json().catch(() => undefined);
    const out = await handleRpc(rpcDeps, auth.token, body);
    if (out.sessionId) c.header("Mcp-Session-Id", out.sessionId);
    if (out.status === 202 || !out.body) return c.body(null, 202);
    return c.json(out.body, out.status as 200);
  });

  // No server-initiated stream, and sessions are stateless: both are allowed by the spec.
  app.get("/mcp", (c) => c.body(null, 405, { Allow: "POST" }));
  app.delete("/mcp", (c) => c.body(null, 405, { Allow: "POST" }));

  // Mounted beside the other groups, which carry no typed variables.
  return app as unknown as Hono;
}
