/**
 * F14 (ADR-0066): the MCP tokens an owner makes in the web for an agent. A token is bound to one
 * remora, scoped, expiring and revocable. Its secret is shown once; only the SHA-256 is stored, so a
 * leaked database can't be replayed against `/mcp`.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import {
  and,
  count,
  type Db,
  desc,
  eq,
  inArray,
  mcpCalls,
  mcpTokens,
  remoras,
  sql,
} from "@remora/db";
import { MCP_SCOPES, type McpCall, type McpScope, type McpToken } from "@remora/schema";

export const SECRET_PREFIX = "rmcp_";
const PREFIX_LENGTH = SECRET_PREFIX.length + 4;
export const DEFAULT_DAYS = 30;
export const MAX_DAYS = 90;

export type TokenRow = typeof mcpTokens.$inferSelect;

/** 30 random bytes, base64url: 40 characters after the prefix. */
export const newSecret = () => `${SECRET_PREFIX}${randomBytes(30).toString("base64url")}`;
export const secretHash = (secret: string) => createHash("sha256").update(secret).digest("hex");

/** "Claude Code on my laptop" → `claude-code-on-my-laptop` (the `via` slug, ≤ 40 characters). */
export function clientSlug(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
  return slug || "agent";
}

export function parseScopes(raw: unknown): McpScope[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const out = [...new Set(raw.map(String))];
  return out.every((s) => (MCP_SCOPES as readonly string[]).includes(s))
    ? (out as McpScope[])
    : null;
}

export type AuthResult =
  | { ok: true; token: TokenRow }
  | { ok: false; reason: "missing" | "unknown" | "revoked" | "expired" };

/** The bearer's token, if it's live. Unknown, revoked and expired all answer 401. */
export async function authenticate(
  db: Db,
  secret: string | undefined,
  now = new Date(),
): Promise<AuthResult> {
  if (!secret?.startsWith(SECRET_PREFIX) || secret.length > 200)
    return { ok: false, reason: secret ? "unknown" : "missing" };
  const hash = secretHash(secret);
  const [row] = await db.select().from(mcpTokens).where(eq(mcpTokens.secretSha256, hash));
  // The lookup is by hash; compare again in constant time so a timing difference can't leak.
  if (!row || !timingSafeEqual(Buffer.from(row.secretSha256), Buffer.from(hash)))
    return { ok: false, reason: "unknown" };
  if (row.revokedAt) return { ok: false, reason: "revoked" };
  if (row.expiresAt.getTime() <= now.getTime()) return { ok: false, reason: "expired" };
  await db.update(mcpTokens).set({ lastUsedAt: now }).where(eq(mcpTokens.id, row.id));
  return { ok: true, token: { ...row, lastUsedAt: now } };
}

export async function createToken(
  db: Db,
  input: { remoraId: string; owner: string; name: string; scopes: McpScope[]; days?: number },
): Promise<{ row: TokenRow; secret: string }> {
  const secret = newSecret();
  const days = Math.min(Math.max(Math.round(input.days ?? DEFAULT_DAYS), 1), MAX_DAYS);
  const [row] = await db
    .insert(mcpTokens)
    .values({
      remoraId: input.remoraId,
      ownerAddress: normalizeSuiAddress(input.owner),
      name: input.name.trim().slice(0, 60),
      client: clientSlug(input.name),
      scopes: input.scopes,
      prefix: secret.slice(0, PREFIX_LENGTH),
      secretSha256: secretHash(secret),
      expiresAt: new Date(Date.now() + days * 86_400_000),
    })
    .returning();
  if (!row) throw new Error("token insert returned nothing");
  return { row, secret };
}

export async function revokeToken(db: Db, owner: string, id: string): Promise<TokenRow | null> {
  const [row] = await db
    .update(mcpTokens)
    .set({ revokedAt: new Date() })
    .where(and(eq(mcpTokens.id, id), eq(mcpTokens.ownerAddress, normalizeSuiAddress(owner))))
    .returning();
  return row ?? null;
}

/** The owner's tokens on one network, newest first, with their totals. Never the secret. */
export async function listTokens(db: Db, owner: string, network: string): Promise<McpToken[]> {
  const rows = await db
    .select({ t: mcpTokens, remoraName: remoras.name })
    .from(mcpTokens)
    .innerJoin(remoras, eq(remoras.id, mcpTokens.remoraId))
    .where(
      and(
        eq(mcpTokens.ownerAddress, normalizeSuiAddress(owner)),
        eq(remoras.network, network as "testnet"),
      ),
    )
    .orderBy(desc(mcpTokens.createdAt));
  if (!rows.length) return [];
  const totals = await db
    .select({
      tokenId: mcpCalls.tokenId,
      calls: count(),
      spend: sql<string>`coalesce(sum(${mcpCalls.spend}), 0)::text`,
      memories: sql<number>`count(*) filter (where ${mcpCalls.memoryId} is not null)::int`,
    })
    .from(mcpCalls)
    .where(
      inArray(
        mcpCalls.tokenId,
        rows.map((r) => r.t.id),
      ),
    )
    .groupBy(mcpCalls.tokenId);
  const by = new Map(totals.map((t) => [t.tokenId, t]));
  return rows.map(({ t, remoraName }) => tokenView(t, remoraName, by.get(t.id)));
}

export function tokenView(
  t: TokenRow,
  remoraName: string,
  totals?: { calls: number; spend: string; memories: number },
): McpToken {
  return {
    id: t.id,
    remora: t.remoraId,
    remoraName,
    name: t.name,
    client: t.client,
    scopes: t.scopes as McpScope[],
    prefix: t.prefix,
    createdAt: t.createdAt.toISOString(),
    expiresAt: t.expiresAt.toISOString(),
    lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
    revokedAt: t.revokedAt?.toISOString() ?? null,
    calls: Number(totals?.calls ?? 0),
    spend: String(totals?.spend ?? "0"),
    memories: Number(totals?.memories ?? 0),
  };
}

export interface CallRecord {
  tool: string;
  ok: boolean;
  error?: string | null;
  wakeId?: string | null;
  spend?: bigint | null;
  memoryId?: string | null;
}

export async function recordCall(db: Db, tokenId: string, c: CallRecord): Promise<void> {
  await db.insert(mcpCalls).values({
    tokenId,
    tool: c.tool,
    ok: c.ok,
    error: c.error ? c.error.slice(0, 200) : null,
    wakeId: c.wakeId ?? null,
    spend: c.spend ?? null,
    memoryId: c.memoryId ?? null,
  });
}

/** A token's recent calls, for its owner only. */
export async function callsOf(
  db: Db,
  owner: string,
  tokenId: string,
  limit = 50,
): Promise<McpCall[] | null> {
  const [t] = await db
    .select({ id: mcpTokens.id })
    .from(mcpTokens)
    .where(and(eq(mcpTokens.id, tokenId), eq(mcpTokens.ownerAddress, normalizeSuiAddress(owner))));
  if (!t) return null;
  const rows = await db
    .select()
    .from(mcpCalls)
    .where(eq(mcpCalls.tokenId, tokenId))
    .orderBy(desc(mcpCalls.at))
    .limit(limit);
  return rows.map((r) => ({
    id: r.id,
    token: r.tokenId,
    tool: r.tool,
    at: r.at.toISOString(),
    ok: r.ok,
    error: r.error,
    wakeId: r.wakeId,
    spend: r.spend === null ? null : r.spend.toString(),
  }));
}
