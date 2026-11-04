import { describe, expect, it } from "vitest";
import { cursorLink, httpLine, mcpJson, vscodeLink } from "./api";

const URL_ = "https://getremora.vercel.app/api/mcp";
const SECRET = "rmcp_test_secret";

describe("one-click MCP installs (ADR-0111, C1)", () => {
  it("gives every client the same server: the URL and the token as a bearer header", () => {
    expect(JSON.parse(mcpJson(URL_, SECRET))).toEqual({
      mcpServers: {
        remora: { type: "http", url: URL_, headers: { Authorization: `Bearer ${SECRET}` } },
      },
    });
    const cursor = new URL(cursorLink(URL_, SECRET));
    expect(cursor.protocol).toBe("cursor:");
    expect(cursor.searchParams.get("name")).toBe("remora");
    expect(JSON.parse(atob(cursor.searchParams.get("config") ?? ""))).toEqual({
      type: "http",
      url: URL_,
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    const vscode = vscodeLink(URL_, SECRET);
    expect(vscode.startsWith("vscode:mcp/install?")).toBe(true);
    expect(JSON.parse(decodeURIComponent(vscode.split("?")[1] ?? ""))).toEqual({
      name: "remora",
      type: "http",
      url: URL_,
      headers: { Authorization: `Bearer ${SECRET}` },
    });
    expect(httpLine(URL_, SECRET)).toContain(`--header "Authorization: Bearer ${SECRET}"`);
  });

  it("keeps the token out of anything a web page would load: only app links carry it", () => {
    expect(cursorLink(URL_, SECRET).startsWith("http")).toBe(false);
    expect(vscodeLink(URL_, SECRET).startsWith("http")).toBe(false);
  });
});
