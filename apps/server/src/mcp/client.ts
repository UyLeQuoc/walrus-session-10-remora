/**
 * ADR-0143 (D10): a Streamable HTTP MCP client, written without the SDK like `packages/mcp`:
 * `initialize` (then `notifications/initialized`), `tools/list` and `tools/call`. Every request goes
 * through `safeFetch` (https only, public addresses only, no redirects). A call has 20 s for all of
 * its requests. An answer is JSON or an SSE stream, read only until the response with our id.
 */
import { FetchRefused, safeFetch } from "@remora/merchant";
import { z } from "zod";

export const MCP_TIMEOUT_MS = 20_000;
export const MCP_PROTOCOL = "2025-06-18";
const MAX_BYTES = 1_000_000;
const MAX_PAGES = 5;
const MAX_TEXT = 20_000;

/** How the client reaches servers; tests swap the network, development may allow localhost. */
export interface McpNet {
  fetch?: typeof fetch;
  resolve?: (host: string) => Promise<string[]>;
  /** Development only, never in production: localhost servers too, over http or https. */
  allowLocal?: boolean;
  timeoutMs?: number;
}

export interface McpClientOptions extends McpNet {
  url: string;
  /** Sent as `Authorization: Bearer …`. */
  token?: string;
}

export type McpFailure = "refused" | "timeout" | "unauthorized" | "unreachable" | "protocol";

/** `message` is ours and safe to show; `detail` is the server's own text, which is untrusted. */
export class McpError extends Error {
  constructor(
    readonly code: McpFailure,
    message: string,
    readonly detail?: string,
  ) {
    super(message);
  }
}

/** The server forgot our session (404 on a request that carried it). */
class SessionGone extends McpError {}

const ToolInfo = z.object({
  name: z.string().min(1).max(120),
  title: z.string().optional(),
  description: z.string().optional(),
  inputSchema: z.record(z.string(), z.unknown()).optional(),
  annotations: z
    .object({ readOnlyHint: z.unknown(), destructiveHint: z.unknown() })
    .partial()
    .nullable()
    .optional(),
});
export type McpToolInfo = z.infer<typeof ToolInfo>;

const ListResult = z.object({
  tools: z.array(z.unknown()),
  nextCursor: z.string().optional().nullable(),
});

const CallResult = z.object({
  content: z
    .array(
      z.object({
        type: z.string(),
        text: z.string().optional(),
        resource: z.object({ text: z.string().optional() }).optional(),
      }),
    )
    .default([]),
  structuredContent: z.unknown().optional(),
  isError: z.boolean().optional(),
});

const Message = z.object({
  jsonrpc: z.literal("2.0").optional(),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  result: z.unknown().optional(),
  error: z.object({ code: z.number().optional(), message: z.string().optional() }).optional(),
});
type Message = z.infer<typeof Message>;

/** ADR-0143: the only tools a remora is offered: marked read-only and not marked destructive. */
export const isReadOnly = (t: Pick<McpToolInfo, "annotations">) =>
  t.annotations?.readOnlyHint === true && t.annotations?.destructiveHint !== true;

export interface McpCallResult {
  /** The tool's text output (the server's own, so untrusted). */
  text: string;
  isError: boolean;
}

/** Rejects with a timeout when `signal` aborts first, even if the fetch ignores the signal. */
function within<T>(signal: AbortSignal, work: Promise<T>): Promise<T> {
  const timedOut = () =>
    new McpError("timeout", `The server didn't answer within ${MCP_TIMEOUT_MS / 1000} s.`);
  if (signal.aborted) return Promise.reject(timedOut());
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(timedOut());
    signal.addEventListener("abort", onAbort, { once: true });
    work.then(
      (v) => {
        signal.removeEventListener("abort", onAbort);
        resolve(v);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(signal.aborted ? timedOut() : err);
      },
    );
  });
}

const parseJson = (s: string): unknown => {
  try {
    return JSON.parse(s);
  } catch {
    return undefined;
  }
};

/** The response to `id` in a JSON body (one message or a batch). */
function answerIn(body: unknown, id: number): Message | null {
  for (const item of Array.isArray(body) ? body : [body]) {
    const m = Message.safeParse(item);
    if (m.success && m.data.id === id && (m.data.result !== undefined || m.data.error))
      return m.data;
  }
  return null;
}

async function readCapped(res: Response): Promise<string> {
  const reader = res.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder();
  let text = "";
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new McpError("protocol", "The server's answer is too large.");
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return text + decoder.decode();
}

/** Reads an SSE stream until the event carrying the response to `id`, then stops. */
async function readSse(res: Response, id: number): Promise<Message> {
  const reader = res.body?.getReader();
  if (!reader) throw new McpError("protocol", "The server sent an empty stream.");
  const decoder = new TextDecoder();
  let buffer = "";
  let total = 0;
  const eventIn = (block: string): Message | null => {
    const data = block
      .split(/\r?\n/)
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).replace(/^ /, ""))
      .join("\n");
    return data ? answerIn(parseJson(data), id) : null;
  };
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (value) {
        total += value.byteLength;
        if (total > MAX_BYTES) throw new McpError("protocol", "The server's answer is too large.");
        buffer += decoder.decode(value, { stream: true });
      }
      for (let end = /\r?\n\r?\n/.exec(buffer); end; end = /\r?\n\r?\n/.exec(buffer)) {
        const found = eventIn(buffer.slice(0, end.index));
        buffer = buffer.slice(end.index + end[0].length);
        if (found) return found;
      }
      if (done) break;
    }
    const last = eventIn(buffer);
    if (last) return last;
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  throw new McpError("protocol", "The server closed the stream without an answer.");
}

/** A line for a tool's arguments: `repoName (string, required), question (string)`. */
export function argsLine(schema: Record<string, unknown> | undefined): string {
  const props = schema?.properties;
  if (!props || typeof props !== "object") return "none";
  const required = new Set(Array.isArray(schema?.required) ? schema.required.map(String) : []);
  const line = Object.entries(props as Record<string, unknown>)
    .map(([name, p]) => {
      const type =
        p && typeof p === "object" && typeof (p as { type?: unknown }).type === "string"
          ? (p as { type: string }).type
          : "any";
      return `${name} (${type}${required.has(name) ? ", required" : ""})`;
    })
    .join(", ");
  return (line || "none").slice(0, 300);
}

export function createMcpClient(o: McpClientOptions) {
  const timeoutMs = o.timeoutMs ?? MCP_TIMEOUT_MS;
  let session: string | null = null;
  let protocol: string | null = null;
  let ready = false;
  let seq = 0;

  const send = async (message: Record<string, unknown>, signal: AbortSignal) => {
    const headers: Record<string, string> = {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      ...(o.token ? { authorization: `Bearer ${o.token}` } : {}),
      ...(session ? { "mcp-session-id": session } : {}),
      ...(protocol ? { "mcp-protocol-version": protocol } : {}),
    };
    try {
      return await safeFetch(
        o.url,
        { method: "POST", headers, body: JSON.stringify(message), signal },
        o,
      );
    } catch (err) {
      if (err instanceof McpError) throw err;
      if (err instanceof FetchRefused) throw new McpError("refused", err.message);
      if (signal.aborted) throw err;
      throw new McpError("unreachable", "The server can't be reached.");
    }
  };

  const fail = (res: Response) => {
    if (res.status === 401 || res.status === 403)
      return new McpError(
        "unauthorized",
        o.token ? "The server refused the token." : "The server asks for a token.",
      );
    if (res.status >= 300 && res.status < 400)
      return new McpError("refused", "The server redirects; give its final URL.");
    if (res.status === 404 && session)
      return new SessionGone("unreachable", "The server ended the session.");
    return new McpError("unreachable", `The server answered ${res.status}.`);
  };

  async function request(
    method: string,
    params: Record<string, unknown>,
    signal: AbortSignal,
  ): Promise<{ result: unknown; res: Response }> {
    const id = ++seq;
    const res = await send({ jsonrpc: "2.0", id, method, params }, signal);
    if (!res.ok) {
      await res.body?.cancel().catch(() => undefined);
      throw fail(res);
    }
    const sse = (res.headers.get("content-type") ?? "").includes("text/event-stream");
    const msg = sse ? await readSse(res, id) : answerIn(parseJson(await readCapped(res)), id);
    if (!msg) throw new McpError("protocol", `The server's answer to ${method} isn't JSON-RPC.`);
    if (msg.error)
      throw new McpError(
        "protocol",
        `The server refused ${method} (${msg.error.code ?? "error"}).`,
        msg.error.message?.slice(0, 500),
      );
    return { result: msg.result, res };
  }

  async function initialize(signal: AbortSignal) {
    const { result, res } = await request(
      "initialize",
      {
        protocolVersion: MCP_PROTOCOL,
        capabilities: {},
        clientInfo: { name: "remora", version: "0.1.0" },
      },
      signal,
    );
    session = res.headers.get("mcp-session-id");
    const asked = (result as { protocolVersion?: unknown } | null)?.protocolVersion;
    protocol = typeof asked === "string" ? asked : MCP_PROTOCOL;
    const note = await send({ jsonrpc: "2.0", method: "notifications/initialized" }, signal);
    await note.body?.cancel().catch(() => undefined);
    ready = true;
  }

  /** A request after `initialize`; a session the server forgot (404) is started again once. */
  async function rpc(method: string, params: Record<string, unknown>, signal: AbortSignal) {
    if (!ready) await initialize(signal);
    try {
      return (await request(method, params, signal)).result;
    } catch (err) {
      if (!(err instanceof SessionGone)) throw err;
      session = null;
      protocol = null;
      ready = false;
      await initialize(signal);
      return (await request(method, params, signal)).result;
    }
  }

  const signalFor = (signal?: AbortSignal) => signal ?? AbortSignal.timeout(timeoutMs);

  return {
    /** Every tool the server lists (up to five pages). Filter with `isReadOnly`. */
    async listTools(signal?: AbortSignal): Promise<McpToolInfo[]> {
      const s = signalFor(signal);
      return within(
        s,
        (async () => {
          const tools: McpToolInfo[] = [];
          let cursor: string | undefined;
          for (let page = 0; page < MAX_PAGES; page++) {
            const out = ListResult.safeParse(await rpc("tools/list", cursor ? { cursor } : {}, s));
            if (!out.success) throw new McpError("protocol", "The server's tool list isn't valid.");
            for (const t of out.data.tools) {
              const parsed = ToolInfo.safeParse(t);
              if (parsed.success) tools.push(parsed.data);
            }
            cursor = out.data.nextCursor ?? undefined;
            if (!cursor) break;
          }
          return tools;
        })(),
      );
    },

    /** Calls one tool. A tool's own failure is a result with `isError`, not a throw. */
    async callTool(
      name: string,
      args: Record<string, unknown>,
      signal?: AbortSignal,
    ): Promise<McpCallResult> {
      const s = signalFor(signal);
      return within(
        s,
        (async () => {
          const out = CallResult.safeParse(await rpc("tools/call", { name, arguments: args }, s));
          if (!out.success) throw new McpError("protocol", "The server's tool result isn't valid.");
          const parts = out.data.content.flatMap((c) =>
            c.type === "text" && c.text !== undefined
              ? [c.text]
              : c.resource?.text !== undefined
                ? [c.resource.text]
                : [`[${c.type} left out]`],
          );
          const text =
            parts.join("\n") ||
            (out.data.structuredContent === undefined
              ? ""
              : JSON.stringify(out.data.structuredContent));
          return { text: text.slice(0, MAX_TEXT), isError: out.data.isError === true };
        })(),
      );
    },
  };
}

export type McpClient = ReturnType<typeof createMcpClient>;
