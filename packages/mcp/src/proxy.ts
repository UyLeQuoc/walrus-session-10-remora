/**
 * F14 (ADR-0066): the stdio transport for MCP v2. Each JSON-RPC line goes to the server's Streamable
 * HTTP endpoint (`<REMORA_API_URL>/mcp`) with the owner-made token, so both transports run the same
 * tools and the same checks. Messages are sent in order, one at a time: `initialize` sets the session
 * and protocol headers the later ones carry.
 */
import type { Writable } from "node:stream";

export interface ProxyOptions {
  /** The Remora server, e.g. http://localhost:8787. */
  apiUrl: string;
  /** `rmcp_…`, from the web's Connections page. */
  token: string;
  fetch?: typeof fetch;
}

type Message = { jsonrpc?: string; id?: string | number | null; method?: string };

const error = (id: Message["id"], code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

export function createProxy(o: ProxyOptions) {
  const f = o.fetch ?? fetch;
  const endpoint = `${o.apiUrl.replace(/\/$/, "")}/mcp`;
  let session: string | null = null;
  let protocol: string | null = null;

  /** One message in, the answer out (null for notifications, which get 202). */
  async function send(msg: Message): Promise<Record<string, unknown> | null> {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${o.token}`,
      ...(session ? { "mcp-session-id": session } : {}),
      ...(protocol ? { "mcp-protocol-version": protocol } : {}),
    };
    let res: Response;
    try {
      res = await f(endpoint, { method: "POST", headers, body: JSON.stringify(msg) });
    } catch {
      return msg.id === undefined
        ? null
        : error(msg.id, -32000, `Remora at ${o.apiUrl} is unreachable.`);
    }
    if (res.status === 202 || msg.id === undefined) return null;
    const text = await res.text();
    let body: Record<string, unknown> | null = null;
    if ((res.headers.get("content-type") ?? "").includes("text/event-stream")) {
      const data = text
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .find(Boolean);
      body = data ? (JSON.parse(data) as Record<string, unknown>) : null;
    } else {
      body = (() => {
        try {
          return JSON.parse(text) as Record<string, unknown>;
        } catch {
          return null;
        }
      })();
    }
    if (!body) return error(msg.id, -32000, `Remora answered ${res.status}.`);
    // A 401 is decided before the message is read, so the server can't echo the id: put it back.
    if (body.id === null || body.id === undefined) body = { ...body, id: msg.id ?? null };
    if (msg.method === "initialize" && res.ok) {
      session = res.headers.get("mcp-session-id");
      const result = body.result as { protocolVersion?: string } | undefined;
      protocol = result?.protocolVersion ?? null;
    }
    return body;
  }

  return { send };
}

/** Runs the proxy on stdio: newline-delimited JSON-RPC in, the same out, in order. */
export function runProxyStdio(
  o: ProxyOptions,
  input: NodeJS.ReadableStream = process.stdin,
  output: Writable = process.stdout,
) {
  const proxy = createProxy(o);
  let buffer = "";
  let chain: Promise<void> = Promise.resolve();
  input.setEncoding("utf8");
  input.on("data", (chunk: string) => {
    buffer += chunk;
    let nl = buffer.indexOf("\n");
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf("\n");
      if (!line) continue;
      chain = chain.then(async () => {
        let msg: Message;
        try {
          msg = JSON.parse(line) as Message;
        } catch {
          output.write(`${JSON.stringify(error(null, -32700, "Parse error"))}\n`);
          return;
        }
        const out = await proxy.send(msg);
        if (out) output.write(`${JSON.stringify(out)}\n`);
      });
    }
  });
}
