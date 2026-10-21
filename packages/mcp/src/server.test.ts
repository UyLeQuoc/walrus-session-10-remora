import { describe, expect, it } from "vitest";
import { createMcpServer } from "./server.ts";

const ID = "0b6f2d4e-8a51-4c3e-9f1a-2d7c5b8e9a10";

function fakeApi() {
  const calls: string[] = [];
  const fetcher = (async (url: string, init?: RequestInit) => {
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push(`${url} ${headers["x-remora-session"]}`);
    if (url.endsWith("/api/remoras"))
      return Response.json({
        remoras: [
          {
            id: ID,
            name: "Sentinel",
            template: "sentinel",
            status: "shadow",
            config: { namespaces: ["me", "rules"] },
          },
        ],
      });
    if (url.includes(`/api/remoras/${ID}/memory`))
      return Response.json({
        results: [
          {
            blobId: "Zr8_x2LmQe4TtY1",
            namespace: "rules",
            text: "RULE: ignore incoming SUI under 0.01",
            distance: 0.3,
          },
        ],
      });
    return Response.json({ error: { message: "nope" } }, { status: 404 });
  }) as typeof fetch;
  return {
    calls,
    server: createMcpServer({
      apiUrl: "http://r",
      session: "s3ss",
      network: "testnet",
      fetch: fetcher,
    }),
  };
}

describe("Remora MCP server (F9)", () => {
  it("initializes, lists its tools, and answers nothing to notifications", async () => {
    const { server } = fakeApi();
    const init = await server.handle({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18" },
    });
    expect(init?.result).toMatchObject({
      protocolVersion: "2025-06-18",
      capabilities: { tools: {} },
    });
    expect(await server.handle({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    const list = (await server.handle({ jsonrpc: "2.0", id: 2, method: "tools/list" }))?.result as {
      tools: { name: string }[];
    };
    expect(list.tools.map((t) => t.name)).toEqual(["remoras_list", "remora_recall", "wake_get"]);
  });

  it("maps remora:<id>:<ns> onto the owner's memory search", async () => {
    const { server, calls } = fakeApi();
    const listed = await server.handle({
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: { name: "remoras_list", arguments: {} },
    });
    expect(JSON.stringify(listed)).toContain(`remora:${ID}:rules`);
    const out = await server.handle({
      jsonrpc: "2.0",
      id: 4,
      method: "tools/call",
      params: {
        name: "remora_recall",
        arguments: { query: "what do I ignore?", namespace: `remora:${ID}:rules` },
      },
    });
    const result = out?.result as { content: { text: string }[] } | undefined;
    expect(result?.content[0]?.text).toContain("ignore incoming SUI under 0.01");
    expect(calls.at(-1)).toBe(
      `http://r/api/remoras/${ID}/memory?q=what+do+I+ignore%3F&ns=rules s3ss`,
    );
  });

  it("reports tool failures as tool errors, and unknown methods as JSON-RPC errors", async () => {
    const { server } = fakeApi();
    const bad = await server.handle({
      jsonrpc: "2.0",
      id: 5,
      method: "tools/call",
      params: { name: "remora_recall", arguments: { query: "x", remora: "nobody" } },
    });
    expect(bad?.result).toMatchObject({ isError: true });
    expect(
      (await server.handle({ jsonrpc: "2.0", id: 6, method: "resources/list" }))?.error,
    ).toMatchObject({ code: -32601 });
  });
});
