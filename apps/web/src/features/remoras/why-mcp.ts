/** ADR-0143: the MCP tools an answer used, as Why? cites them (`mcp:<host>/<tool>`). */
import { z } from "zod";

const Used = z.array(z.object({ host: z.string(), tool: z.string(), ok: z.boolean().optional() }));

export function mcpCitations(payload: Record<string, unknown>): string[] {
  const used = Used.safeParse(payload.mcp);
  if (!used.success) return [];
  return [
    ...new Set(used.data.map((u) => `mcp:${u.host}/${u.tool}${u.ok === false ? " (failed)" : ""}`)),
  ];
}
