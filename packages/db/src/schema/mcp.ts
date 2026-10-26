/**
 * F14 (ADR-0066): MCP tokens an owner makes for an agent, and every call made with one. The secret
 * itself is never stored, only its SHA-256.
 */
import { bigint, boolean, index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { remoras } from "./runtime.ts";

export const mcpTokens = pgTable(
  "mcp_tokens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    remoraId: uuid("remora_id")
      .notNull()
      .references(() => remoras.id, { onDelete: "cascade" }),
    ownerAddress: text("owner_address").notNull(),
    name: text("name").notNull(),
    /** The client slug in a Wake's `via` (`mcp:<client>`). */
    client: text("client").notNull(),
    /** `memory:read`, `memory:write`, `pay`, `approve:request`. */
    scopes: text("scopes").array().notNull(),
    /** The secret's first characters, shown so the owner can tell tokens apart. */
    prefix: text("prefix").notNull(),
    secretSha256: text("secret_sha256").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("mcp_tokens_owner_idx").on(t.ownerAddress, t.createdAt)],
);

export const mcpCalls = pgTable(
  "mcp_calls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tokenId: uuid("token_id")
      .notNull()
      .references(() => mcpTokens.id, { onDelete: "cascade" }),
    tool: text("tool").notNull(),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    ok: boolean("ok").notNull(),
    /** A short reason, never a secret or third-party text. */
    error: text("error"),
    /** The Wake (`receipts.id`) the call produced, if any. */
    wakeId: uuid("wake_id"),
    /** USDC moved by the call, in smallest units. */
    spend: bigint("spend", { mode: "bigint" }),
    /** The remora memory index row a `remora_remember` call wrote. */
    memoryId: uuid("memory_id"),
  },
  (t) => [index("mcp_calls_token_idx").on(t.tokenId, t.at)],
);
