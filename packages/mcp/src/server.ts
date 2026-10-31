/**
 * F9 (ADR-0048): Remora as an MCP server, so Claude Code (or any MCP client) can read a remora's
 * memory. Remora memories live in Remora's own Walrus Memory account under `remora:<id>:<ns>`
 * (ADR-0030), so the Walrus Memory MCP plugin can't reach them directly: this server maps those
 * namespaces onto the Remora API, signed in as the owner (their `x-remora-session`).
 *
 * The protocol is JSON-RPC 2.0 over stdio, one message per line (MCP "stdio" transport). It's small
 * enough to speak directly, so there's no SDK dependency.
 */

export const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"] as const;

export interface McpOptions {
  /** The Remora server, e.g. http://localhost:8787. */
  apiUrl: string;
  /** The owner's session token (`x-remora-session`), from the dashboard. */
  session: string;
  network: "testnet" | "mainnet";
  fetch?: typeof fetch;
}

interface Rpc {
  jsonrpc: "2.0";
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

type Remora = {
  id: string;
  name: string;
  template: string;
  status: string;
  config?: { namespaces?: string[] };
};

const NAMESPACE = /^remora:([0-9a-f-]{36}):([a-z]+)$/i;

export const TOOLS = [
  {
    name: "remoras_list",
    description:
      "List your remoras and their memory namespaces (remora:<id>:<namespace>), so you can recall from them.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "remora_recall",
    description:
      "Search one remora's memory. Give `namespace` as remora:<id>:<namespace> (from remoras_list), or `remora` (id or name) with an optional short namespace such as rules or sources.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "What to look for." },
        namespace: { type: "string", description: "remora:<id>:<namespace>" },
        remora: { type: "string", description: "A remora id or name." },
      },
      required: ["query"],
      additionalProperties: false,
    },
  },
  {
    name: "wake_get",
    description:
      "Check a Wake (a remora's receipt for a decision or payment) by its id or transaction digest.",
    inputSchema: {
      type: "object",
      properties: { ref: { type: "string" } },
      required: ["ref"],
      additionalProperties: false,
    },
  },
] as const;

export function createMcpServer(o: McpOptions) {
  const f = o.fetch ?? fetch;
  const api = async <T>(path: string): Promise<T> => {
    const res = await f(`${o.apiUrl.replace(/\/$/, "")}${path}`, {
      headers: { "x-remora-session": o.session, "x-remora-network": o.network },
    });
    const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) throw new Error(body.error?.message ?? `Remora answered ${res.status}.`);
    return body;
  };
  const remoras = async () => (await api<{ remoras: Remora[] }>("/api/remoras")).remoras;

  const tools: Record<string, (args: Record<string, unknown>) => Promise<string>> = {
    async remoras_list() {
      const rows = (await remoras()).filter((r) => r.status !== "retired");
      if (!rows.length) return "You have no remoras on this network yet.";
      return rows
        .map(
          (r) =>
            `${r.name} (${r.template}, ${r.status})\n${(r.config?.namespaces ?? [])
              .map((ns) => `  remora:${r.id}:${ns}`)
              .join("\n")}`,
        )
        .join("\n");
    },
    async remora_recall(args) {
      const query = String(args.query ?? "").trim();
      if (!query) throw new Error("Say what to look for.");
      let id: string | undefined;
      let ns: string | undefined;
      const mapped = NAMESPACE.exec(String(args.namespace ?? ""));
      if (mapped) {
        id = mapped[1];
        ns = mapped[2];
      } else if (args.remora) {
        const want = String(args.remora).toLowerCase();
        const r = (await remoras()).find((x) => x.id === want || x.name.toLowerCase() === want);
        if (!r) throw new Error(`No remora called ${args.remora}.`);
        id = r.id;
        ns = args.namespace ? String(args.namespace) : undefined;
      } else {
        throw new Error("Give namespace (remora:<id>:<namespace>) or remora.");
      }
      const q = new URLSearchParams({ q: query, ...(ns ? { ns } : {}) });
      const out = await api<{
        results: { blobId: string; namespace: string; text: string; distance: number }[];
      }>(`/api/remoras/${id}/memory?${q}`);
      if (!out.results.length) return "Nothing in that remora's memory matches.";
      return out.results
        .map(
          (m) =>
            `[remora:${id}:${m.namespace}] ${m.text} (blob ${m.blobId}, distance ${m.distance.toFixed(2)})`,
        )
        .join("\n");
    },
    async wake_get(args) {
      const ref = String(args.ref ?? "").trim();
      if (!ref) throw new Error("Give a Wake id or transaction digest.");
      const v = await api<{
        anchored: boolean;
        checks: { name: string; ok: boolean | null; detail: string }[];
      }>(`/api/verify/${encodeURIComponent(ref)}`);
      return [
        v.anchored ? "Saved onchain." : "Not saved onchain.",
        ...v.checks.map((c) => `${c.ok === null ? "–" : c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}`),
      ].join("\n");
    },
  };

  /** One JSON-RPC message in, at most one out (notifications get no answer). */
  async function handle(msg: Rpc): Promise<Record<string, unknown> | null> {
    const reply = (result: unknown) => ({ jsonrpc: "2.0", id: msg.id ?? null, result });
    const fail = (code: number, message: string) => ({
      jsonrpc: "2.0",
      id: msg.id ?? null,
      error: { code, message },
    });
    if (msg.id === undefined) return null;
    switch (msg.method) {
      case "initialize": {
        const asked = String(msg.params?.protocolVersion ?? "");
        return reply({
          protocolVersion: (PROTOCOL_VERSIONS as readonly string[]).includes(asked)
            ? asked
            : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "remora", version: "0.1.0" },
          instructions:
            "Remora's memories are in namespaces remora:<id>:<namespace>. Call remoras_list first, then remora_recall.",
        });
      }
      case "ping":
        return reply({});
      case "tools/list":
        return reply({ tools: TOOLS });
      case "tools/call": {
        const name = String(msg.params?.name ?? "");
        const tool = tools[name];
        if (!tool) return fail(-32602, `Unknown tool ${name}.`);
        try {
          const text = await tool((msg.params?.arguments as Record<string, unknown>) ?? {});
          return reply({ content: [{ type: "text", text }] });
        } catch (err) {
          return reply({
            content: [{ type: "text", text: (err as Error).message }],
            isError: true,
          });
        }
      }
      default:
        return fail(-32601, `Method not found: ${msg.method}`);
    }
  }

  return { handle };
}

/** Runs the server on stdio: newline-delimited JSON-RPC in, the same out. */
export function runStdio(o: McpOptions, input = process.stdin, output = process.stdout) {
  const server = createMcpServer(o);
  let buffer = "";
  input.setEncoding("utf8");
  input.on("data", (chunk: string) => {
    buffer += chunk;
    let nl = buffer.indexOf("\n");
    while (nl >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      nl = buffer.indexOf("\n");
      if (!line) continue;
      let msg: Rpc;
      try {
        msg = JSON.parse(line) as Rpc;
      } catch {
        output.write(
          `${JSON.stringify({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } })}\n`,
        );
        continue;
      }
      void server.handle(msg).then((out) => {
        if (out) output.write(`${JSON.stringify(out)}\n`);
      });
    }
  });
}
