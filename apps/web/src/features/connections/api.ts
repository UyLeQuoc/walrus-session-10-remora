/** F14 (ADR-0066): the owner's MCP token API, parsed with its `packages/schema` contract. */
import { McpCall, type McpScope, McpToken, McpTokenCreated } from "@remora/schema";
import { z } from "zod";
import type { Result } from "@/features/remoras/api";
import { apiFetch, errorMessage } from "@/lib/api";

async function call<T>(method: string, path: string, schema: z.ZodType<T>, body?: unknown) {
  try {
    const res = await apiFetch(path, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (!res.ok)
      return { ok: false, error: await errorMessage(res, "Something went wrong.") } as Result<T>;
    const parsed = schema.safeParse(await res.json().catch(() => null));
    return (
      parsed.success
        ? { ok: true, data: parsed.data }
        : { ok: false, error: "The server answered in a shape this page doesn't know." }
    ) as Result<T>;
  } catch {
    return { ok: false, error: "Can't reach the server." } as Result<T>;
  }
}

export const connections = {
  list: () => call("GET", "/api/mcp/tokens", z.object({ tokens: z.array(McpToken) })),
  create: (b: { remora: string; name: string; scopes: McpScope[]; days: number }) =>
    call("POST", "/api/mcp/tokens", McpTokenCreated, b),
  revoke: (id: string) =>
    call("POST", `/api/mcp/tokens/${id}/revoke`, z.object({ token: McpToken })),
  calls: (id: string) =>
    call("GET", `/api/mcp/tokens/${id}/calls`, z.object({ calls: z.array(McpCall) })),
};

/** The Claude Code line for the HTTP transport: works from anywhere the server is reachable. */
export const httpLine = (url: string, secret: string) =>
  `claude mcp add --transport http remora ${url} --header "Authorization: Bearer ${secret}"`;
