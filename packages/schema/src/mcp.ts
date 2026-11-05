/**
 * F14 (ADR-0066): an agent uses a remora through MCP with a token its owner made in the web.
 * The secret is shown once (`McpTokenCreated`) and never again: the server keeps only its SHA-256.
 */
import { z } from "zod";
import { Amount, IsoDateTime } from "./common.ts";

/** What a token may do. Money still moves only inside the Disc; above it, the owner decides. */
export const MCP_SCOPES = ["memory:read", "memory:write", "pay", "approve:request"] as const;
export const McpScope = z.enum(MCP_SCOPES);

/** The client's slug as it appears in a Wake's `via` (`mcp:<client>`). */
export const McpClient = z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/, "not a client slug");

/** A token as the owner sees it in the Connections page. Never carries the secret. */
export const McpToken = z.object({
  id: z.uuid(),
  remora: z.uuid(),
  remoraName: z.string().min(1),
  /** The owner's label, e.g. "Claude Code on my laptop". */
  name: z.string().min(1).max(60),
  client: McpClient,
  scopes: z.array(McpScope).min(1),
  /** The secret's first characters, so the owner can tell tokens apart. */
  prefix: z.string().min(4).max(16),
  createdAt: IsoDateTime,
  expiresAt: IsoDateTime,
  lastUsedAt: IsoDateTime.nullable(),
  revokedAt: IsoDateTime.nullable(),
  /** Totals over the token's life. */
  calls: z.number().int().nonnegative(),
  spend: Amount,
  memories: z.number().int().nonnegative(),
});

/** `POST /api/mcp/tokens`: the token, and its secret this one time, with ready-to-paste setup. */
export const McpTokenCreated = z.object({
  token: McpToken,
  secret: z.string().min(24),
  /** `claude mcp add …` for the stdio server. */
  stdio: z.string().min(1),
  /** The Streamable HTTP endpoint (bearer token). */
  httpUrl: z.url(),
});

/** One tool call made with a token. */
export const McpCall = z.object({
  id: z.uuid(),
  token: z.uuid(),
  tool: z.string().min(1),
  at: IsoDateTime,
  ok: z.boolean(),
  /** A short reason when it failed (no secrets, no third-party text). */
  error: z.string().nullable(),
  /** The Wake the call produced, if any. */
  wakeId: z.string().nullable(),
  /** USDC moved by this call, in smallest units, if any. */
  spend: Amount.nullable(),
});

export type McpScope = z.infer<typeof McpScope>;
export type McpToken = z.infer<typeof McpToken>;
export type McpTokenCreated = z.infer<typeof McpTokenCreated>;
export type McpCall = z.infer<typeof McpCall>;

/**
 * ADR-0143: a read-only tool on an MCP server a remora's owner connected (the other direction from
 * the tokens above: the remora is the client). `args` is the tool's input schema in a line.
 */
export const McpServerTool = z.object({
  name: z.string().min(1).max(120),
  title: z.string().max(120).optional(),
  description: z.string().max(400),
  args: z.string().max(300),
});

/**
 * ADR-0143: one MCP server in a remora's config: its URL, the label the model calls it by, and the
 * tools the owner ticked. The bearer token, sealed at rest, and the cached tool list are kept beside
 * it on the server and never parsed into a view.
 */
export const McpServerEntry = z.object({
  id: z.string().min(1).max(40),
  url: z.url(),
  name: z.string().min(1).max(40),
  tools: z.array(z.string().min(1).max(120)).max(20).default([]),
});

/** `GET /api/remoras/:id/mcp`: one server as its owner sees it. Never carries the token. */
export const McpServerView = McpServerEntry.extend({
  /** Host and port, as `mcp:<host>/<tool>` cites it. */
  host: z.string().min(1),
  /** The tools marked read-only (and not destructive), which are the only ones it may tick. */
  offered: z.array(McpServerTool),
  /** How many of the server's tools aren't offered because they aren't marked read-only. */
  hidden: z.number().int().nonnegative(),
  hasToken: z.boolean(),
  addedAt: IsoDateTime,
});

export type McpServerTool = z.infer<typeof McpServerTool>;
export type McpServerEntry = z.infer<typeof McpServerEntry>;
export type McpServerView = z.infer<typeof McpServerView>;
