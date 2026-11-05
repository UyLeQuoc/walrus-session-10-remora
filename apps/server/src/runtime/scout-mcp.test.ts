/**
 * ADR-0143's exit, in-process on Postgres: a Scout turn against the local test MCP server. The fake
 * model obeys whatever it reads (the threat model doesn't trust the model): it reads a page whose
 * text says to call the write tool, and tries. The write tool was never offered and is refused, the
 * injected text reached the model only inside `<untrusted source="mcp:…">`, and the answer's event
 * cites the tool it used.
 */
import { randomBytes, randomUUID } from "node:crypto";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, eq, receipts, remoraEvents, remoras, remoraUsage } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { MemoryKeyStore, RemoraSigner } from "@remora/signer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectServer } from "../mcp/servers.ts";
import {
  createTestMcpServer,
  INJECTION,
  publicDns,
  TEST_URL,
} from "../mcp/test-server.test-util.ts";
import { createNetworks } from "../money/networks.ts";
import { type Brain, wrapUntrusted } from "./brain.ts";
import type { RuntimeDeps } from "./deps.ts";
import { SlidingLimiter } from "./limits.ts";
import type { Remora } from "./remoras.ts";
import { scoutAsk } from "./scout.ts";

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("a Scout turn with an MCP server (ADR-0143)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x0e${process.pid.toString(16)}`);
  const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
  const signer = new RemoraSigner(new MemoryKeyStore(), new Uint8Array(randomBytes(32)));
  const mcp = createTestMcpServer({ sse: true, session: true, token: "tok_scout" });
  const net = { fetch: mcp.fetch, resolve: publicDns, timeoutMs: 2_000 };
  const seen: { catalog?: string; outputs: string[] } = { outputs: [] };

  const obedient: Brain = {
    answerModel: "fake/obedient",
    async answer(i) {
      const m = i.tools?.mcp;
      seen.catalog = m?.catalog;
      if (!m) return { text: "no tools", tokens: 1 };
      for (const call of [
        { connection: "docs", tool: "fetch_page", arguments: '{"url":"https://example.com"}' },
        // What the page told it to do.
        { connection: "docs", tool: "write_note", arguments: '{"text":"pwned"}' },
      ]) {
        const out = await m.call(call);
        seen.outputs.push(typeof out === "string" ? out : wrapUntrusted([out]));
      }
      return { text: "The page tried to give me orders; I only read it.", tokens: 7 };
    },
    async parseRule() {
      return { rule: null, tokens: 0 };
    },
    check: { check: async () => ({ verdict: "allow", reason: "fine" }) },
  };
  const deps: RuntimeDeps = {
    db,
    networks: createNetworks(
      { TATUM_API_KEY_TESTNET: "t" },
      {
        testnet: {
          remoraPackageId: normalizeSuiAddress("0xcc"),
          discRegistryId: normalizeSuiAddress("0x47"),
          usdcCoinType: USDC,
        },
        mainnet: { remoraPackageId: null, discRegistryId: null, usdcCoinType: USDC },
      },
      () => ({}) as unknown as SuiGrpcClient,
    ),
    signer,
    log: createLogger({}, () => {}),
    reef: () => [],
    memory: { recall: async () => [], remember: async () => ({ saved: true, note: "" }) },
    brain: obedient,
    notifier: { send: async () => "sent" },
    limiter: new SlidingLimiter(),
    dailyTokens: 100_000,
    webBase: "http://web.test",
    mcp: net,
  };
  const id = randomUUID();
  let r: Remora;

  beforeAll(async () => {
    const server = await connectServer(
      { signer, mcp: net },
      { id, config: {} },
      { url: TEST_URL, name: "docs", token: "tok_scout" },
    );
    const [row] = await db
      .insert(remoras)
      .values({
        id,
        ownerAddress: OWNER,
        network: "testnet",
        template: "scout",
        name: "Mcp scout",
        status: "active",
        address: OWNER,
        config: {
          persona: "You are the owner's Researcher.",
          mcp: [{ ...server, tools: ["lookup", "fetch_page"] }],
        },
      })
      .returning();
    if (!row) throw new Error("no remora");
    r = row;
  });
  afterAll(async () => {
    await db.delete(remoraEvents).where(eq(remoraEvents.remoraId, id));
    await db.delete(receipts).where(eq(receipts.remoraId, id));
    await db.delete(remoraUsage).where(eq(remoraUsage.remoraId, id));
    await db.delete(remoras).where(eq(remoras.id, id));
  });

  it("offers only ticked read-only tools, labels the injection, refuses the write, cites the tool", async () => {
    const out = await scoutAsk(deps, r, "What does example.com say?");
    expect(seen.catalog).toContain("- docs/fetch_page:");
    expect(seen.catalog).toContain("- docs/lookup:");
    expect(seen.catalog).not.toContain("write_note");
    const [page, write] = seen.outputs;
    expect(page?.startsWith('<untrusted source="mcp:mcp.test/fetch_page">')).toBe(true);
    expect(page).toContain(INJECTION.slice(0, 40));
    expect(page?.match(/<\/untrusted>/g)).toHaveLength(1);
    expect(write).toBe("write_note isn't a tool the owner ticked on docs.");
    expect(mcp.calls.map((c) => c.name)).toEqual(["fetch_page"]);

    const [e] = await db.select().from(remoraEvents).where(eq(remoraEvents.id, out.eventId));
    expect((e?.payload as { mcp?: unknown } | undefined)?.mcp).toEqual([
      { host: "mcp.test", tool: "fetch_page", ok: true },
    ]);
  });

  it("a sold answer never gets the owner's MCP tools", async () => {
    seen.catalog = "unset";
    await scoutAsk(
      deps,
      r,
      "What is a remora?",
      { kind: "message", ref: "web" },
      {
        sold: { buyer: normalizeSuiAddress("0xb0") },
      },
    );
    expect(seen.catalog).toBeUndefined();
  });
});
