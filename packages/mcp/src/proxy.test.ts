import { describe, expect, it } from "vitest";
import { createProxy } from "./proxy.ts";

function fakeServer() {
  const seen: { headers: Record<string, string>; body: { method?: string } }[] = [];
  const f = (async (_url: string, init?: RequestInit) => {
    const headers = init?.headers as Record<string, string>;
    const body = JSON.parse(String(init?.body)) as { id?: number; method?: string };
    seen.push({ headers, body });
    if (headers.authorization !== "Bearer rmcp_good")
      return Response.json(
        { jsonrpc: "2.0", id: null, error: { code: -32001, message: "revoked" } },
        { status: 401 },
      );
    if (body.id === undefined) return new Response(null, { status: 202 });
    if (body.method === "initialize")
      return Response.json(
        { jsonrpc: "2.0", id: body.id, result: { protocolVersion: "2025-06-18" } },
        { headers: { "mcp-session-id": "sess-1" } },
      );
    if (body.method === "tools/call")
      return Response.json(
        { jsonrpc: "2.0", id: body.id, error: { code: -32003, message: "lacks pay" } },
        { status: 403 },
      );
    return Response.json({ jsonrpc: "2.0", id: body.id, result: { tools: [] } });
  }) as typeof fetch;
  return { seen, f };
}

describe("the stdio proxy (F14)", () => {
  it("carries the session and protocol from initialize on later messages", async () => {
    const s = fakeServer();
    const p = createProxy({ apiUrl: "http://r/", token: "rmcp_good", fetch: s.f });
    await p.send({ jsonrpc: "2.0", id: 1, method: "initialize" });
    expect(await p.send({ jsonrpc: "2.0", method: "notifications/initialized" })).toBeNull();
    const list = await p.send({ jsonrpc: "2.0", id: 2, method: "tools/list" });
    expect(list).toEqual({ jsonrpc: "2.0", id: 2, result: { tools: [] } });
    expect(s.seen[2]?.headers["mcp-session-id"]).toBe("sess-1");
    expect(s.seen[2]?.headers["mcp-protocol-version"]).toBe("2025-06-18");
  });

  it("passes a 403 through as a JSON-RPC error for the same request", async () => {
    const s = fakeServer();
    const p = createProxy({ apiUrl: "http://r", token: "rmcp_good", fetch: s.f });
    const out = await p.send({ jsonrpc: "2.0", id: 7, method: "tools/call" });
    expect(out).toEqual({ jsonrpc: "2.0", id: 7, error: { code: -32003, message: "lacks pay" } });
  });

  it("puts the request id back on a 401", async () => {
    const s = fakeServer();
    const p = createProxy({ apiUrl: "http://r", token: "rmcp_revoked", fetch: s.f });
    const out = await p.send({ jsonrpc: "2.0", id: 9, method: "tools/list" });
    expect(out).toMatchObject({ id: 9, error: { code: -32001 } });
  });

  it("says so when the server is unreachable", async () => {
    const p = createProxy({
      apiUrl: "http://down",
      token: "rmcp_good",
      fetch: (async () => {
        throw new Error("ECONNREFUSED");
      }) as typeof fetch,
    });
    expect(await p.send({ jsonrpc: "2.0", id: 1, method: "ping" })).toMatchObject({
      id: 1,
      error: { code: -32000 },
    });
  });
});
