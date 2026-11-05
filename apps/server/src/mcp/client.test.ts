/** ADR-0143: the hand-written Streamable HTTP MCP client against the local test server. */
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { serve } from "@hono/node-server";
import { describe, expect, it } from "vitest";
import { argsLine, createMcpClient, isReadOnly, McpError } from "./client.ts";
import { createTestMcpServer, publicDns, TEST_URL } from "./test-server.test-util.ts";

const clientFor = (
  server: ReturnType<typeof createTestMcpServer>,
  extra: Partial<Parameters<typeof createMcpClient>[0]> = {},
) => createMcpClient({ url: TEST_URL, fetch: server.fetch, resolve: publicDns, ...extra });

const failure = async (p: Promise<unknown>) => {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(McpError);
  return err as McpError;
};

describe("MCP client (ADR-0143)", () => {
  it("initializes, then lists tools; only read-only, non-destructive ones pass the filter", async () => {
    const server = createTestMcpServer();
    const tools = await clientFor(server).listTools();
    expect(tools.map((t) => t.name)).toEqual([
      "lookup",
      "write_note",
      "drop_table",
      "unmarked",
      "fetch_page",
      "slow",
    ]);
    expect(tools.filter(isReadOnly).map((t) => t.name)).toEqual(["lookup", "fetch_page", "slow"]);
    expect(server.seen.map((s) => s.method)).toEqual([
      "initialize",
      "notifications/initialized",
      "tools/list",
    ]);
    expect(argsLine(tools[0]?.inputSchema)).toBe("q (string, required)");
  });

  it("a hint that isn't exactly true doesn't count as read-only", () => {
    expect(isReadOnly({ annotations: { readOnlyHint: "true" } })).toBe(false);
    expect(isReadOnly({ annotations: null })).toBe(false);
    expect(isReadOnly({})).toBe(false);
    expect(isReadOnly({ annotations: { readOnlyHint: true, destructiveHint: true } })).toBe(false);
  });

  it("reads SSE answers past a notification, and doesn't wait for the stream to close", async () => {
    const server = createTestMcpServer({ sse: true, holdOpen: true });
    const client = clientFor(server, { timeoutMs: 2_000 });
    expect((await client.listTools()).length).toBe(6);
    expect(await client.callTool("lookup", { q: "remora" })).toEqual({
      text: "remora: a fish that rides on sharks.",
      isError: false,
    });
  });

  it("echoes the session id and protocol version, and starts a forgotten session again", async () => {
    const server = createTestMcpServer({ session: true });
    const client = clientFor(server);
    await client.listTools();
    const [init, note, list] = server.seen;
    expect(init?.session).toBeNull();
    expect(note?.session).toMatch(/^[0-9a-f-]{36}$/);
    expect(list?.session).toBe(note?.session);
    expect(list?.protocol).toBe("2025-06-18");
    server.endSessions();
    expect((await client.callTool("lookup", { q: "x" })).isError).toBe(false);
    expect(server.seen.filter((s) => s.method === "initialize")).toHaveLength(2);
  });

  it("sends the bearer token, and says when the server refuses it", async () => {
    const server = createTestMcpServer({ token: "tok_123" });
    expect((await clientFor(server, { token: "tok_123" }).listTools()).length).toBe(6);
    const wrong = await failure(clientFor(server, { token: "nope" }).listTools());
    expect(wrong.code).toBe("unauthorized");
    expect(wrong.message).toBe("The server refused the token.");
    expect((await failure(clientFor(server).listTools())).message).toBe(
      "The server asks for a token.",
    );
  });

  it("times a call out", async () => {
    const server = createTestMcpServer({ delayMs: 500 });
    const client = clientFor(server, { timeoutMs: 50 });
    const err = await failure(client.callTool("slow", {}));
    expect(err.code).toBe("timeout");
    expect(err.message).toMatch(/within 20 s/);
  });

  it("refuses private addresses, plain http and credentials in the URL before any request", async () => {
    const server = createTestMcpServer();
    const tries = [
      { url: TEST_URL, resolve: async () => ["10.0.0.5"] },
      { url: "https://169.254.169.254/mcp", resolve: publicDns },
      { url: "https://127.0.0.1/mcp", resolve: publicDns },
      { url: "https://[::1]/mcp", resolve: publicDns },
      { url: "http://mcp.test/mcp", resolve: publicDns },
      { url: "https://user:pw@mcp.test/mcp", resolve: publicDns },
      { url: "file:///etc/passwd", resolve: publicDns },
    ];
    for (const t of tries) {
      const err = await failure(createMcpClient({ ...t, fetch: server.fetch }).listTools());
      expect(err.code, t.url).toBe("refused");
    }
    // allowLocal is development's: localhost only, never another private address.
    const lan = await failure(
      createMcpClient({
        url: "http://10.0.0.5/mcp",
        allowLocal: true,
        fetch: server.fetch,
      }).listTools(),
    );
    expect(lan.code).toBe("refused");
    expect(server.seen).toHaveLength(0);
  });

  it("over a real socket in development: http://localhost, SSE left open", async () => {
    const server = createTestMcpServer({ sse: true, holdOpen: true, session: true });
    const http = serve({ fetch: server.app.fetch, port: 0, hostname: "127.0.0.1" }) as Server;
    await new Promise((r) => http.once("listening", r));
    const { port } = http.address() as AddressInfo;
    try {
      const client = createMcpClient({
        url: `http://localhost:${port}/mcp`,
        allowLocal: true,
        timeoutMs: 3_000,
      });
      expect((await client.listTools()).filter(isReadOnly)).toHaveLength(3);
      expect((await client.callTool("lookup", { q: "pilot" })).text).toBe(
        "pilot: a fish that rides on sharks.",
      );
      const strict = await failure(
        createMcpClient({ url: `http://localhost:${port}/mcp` }).listTools(),
      );
      expect(strict.code).toBe("refused");
    } finally {
      http.closeAllConnections();
      await new Promise((r) => http.close(r));
    }
  });
});
