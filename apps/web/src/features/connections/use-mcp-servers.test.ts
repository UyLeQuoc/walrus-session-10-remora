import { describe, expect, it } from "vitest";
import { withTool } from "./use-mcp-servers";

describe("ticking MCP tools (ADR-0143)", () => {
  it("adds a tool once and removes it", () => {
    expect(withTool(["a"], "b", true)).toEqual(["a", "b"]);
    expect(withTool(["a", "b"], "b", true)).toEqual(["a", "b"]);
    expect(withTool(["a", "b"], "a", false)).toEqual(["b"]);
  });
});
