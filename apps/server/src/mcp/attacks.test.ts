/**
 * The deterministic part of the MCP red team (F14, ADR-0066): every attack in evals/mcp-attacks.json,
 * sent to /mcp the way an agent would. Each must be stopped at its named layer, and nothing is paid.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { harness, ORIGIN, tokenRow } from "./harness.test-util.ts";

interface Attack {
  id: string;
  name: string;
  token: { scopes: string[]; state?: "revoked" | "expired" };
  remora?: "scout" | "sentinel";
  origin?: string;
  service402?: { payTo: string };
  call: { name: string; arguments: Record<string, unknown> };
  expect: { status: number; layer: string; isError?: boolean; approval?: string };
}

const suite = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../../../evals/mcp-attacks.json"), "utf8"),
) as { attacks: Attack[] };

describe(`MCP attacks (${suite.attacks.length})`, () => {
  const paid: string[] = [];

  it.each(suite.attacks.map((a) => [`${a.id}: ${a.name}`, a] as const))("%s", async (_n, a) => {
    const h = harness({
      token: tokenRow(a.token.scopes, a.remora === "sentinel" ? { remoraId: "sentinel" } : {}),
      ...(a.token.state ? { auth: a.token.state } : {}),
      ...(a.remora ? { template: a.remora } : {}),
      ...(a.service402
        ? { payTo: `0x${a.service402.payTo.replace(/^0x/, "").padStart(64, "0")}` }
        : {}),
    });
    const res = await h.call(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: a.call },
      { origin: a.origin ?? ORIGIN },
    );
    expect(res.status, a.expect.layer).toBe(a.expect.status);
    const result = res.json?.result as {
      isError?: boolean;
      structuredContent?: { paid?: boolean };
    };
    if (a.expect.isError) expect(result?.isError, a.expect.layer).toBe(true);
    if (a.expect.approval) {
      expect(h.inserts.map((i) => i.values.kind)).toContain(a.expect.approval);
      expect(h.remembered, "a rule is never written by the agent").toEqual([]);
    }
    if (result?.structuredContent?.paid || h.calls.some((c) => c.spend)) paid.push(a.id);
  });

  it("paid nothing", () => {
    expect(paid).toEqual([]);
    console.log(`${suite.attacks.length} MCP attacks, 0 paid`);
  });
});
