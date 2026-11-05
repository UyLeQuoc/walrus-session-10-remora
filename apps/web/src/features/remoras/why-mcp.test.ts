import { describe, expect, it } from "vitest";
import { mcpCitations } from "./why-mcp";

describe("Why? cites MCP tools (ADR-0143)", () => {
  it("lists each tool an answer called once, and marks failures", () => {
    expect(
      mcpCitations({
        mcp: [
          { host: "mcp.context7.com", tool: "query-docs", ok: true },
          { host: "mcp.context7.com", tool: "query-docs", ok: true },
          { host: "learn.microsoft.com", tool: "microsoft_docs_search", ok: false },
        ],
      }),
    ).toEqual([
      "mcp:mcp.context7.com/query-docs",
      "mcp:learn.microsoft.com/microsoft_docs_search (failed)",
    ]);
    expect(mcpCitations({})).toEqual([]);
    expect(mcpCitations({ mcp: "nope" })).toEqual([]);
  });
});
