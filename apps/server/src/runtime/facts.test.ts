/**
 * F15 (ADR-0074) against real Postgres: the ledger's writes, authority, disputes, corrections, scope
 * and the slot lock, and admission over what recall returns. Memory is faked (no relayer); the
 * extractor is a parser, so the tests don't depend on a model.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, eq, memoryFacts, remoraMemories, remoras } from "@remora/db";
import { loadEnv, type MemoryType } from "@remora/memory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  admitMemories,
  createFactLedger,
  type ExtractedFact,
  type FactExtractor,
  withFacts,
} from "./facts.ts";
import type { Recalled, RemoraMemory, RemoraRef } from "./memory.ts";

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

/** `reply_language=English; employer=B@2026-12-01` → one explicit fact per pair about the owner. */
const parseFacts: FactExtractor = async ({ text }) => ({
  facts: text
    .split(";")
    .map((p) => p.split("="))
    .filter((kv): kv is [string, string] => kv.length === 2)
    .map(([k, v]): ExtractedFact => {
      const [value, from] = v.split("@");
      return {
        subject: "owner",
        predicate: k.trim(),
        qualifier: null,
        value: (value ?? "").trim(),
        cardinality: "one",
        validFrom: from ? `${from.trim()}T00:00:00.000Z` : null,
        validUntil: null,
        expiresAt: null,
        verification: "explicit",
        confidence: 1,
      };
    }),
  tokens: 7,
  model: "test/parser",
});

describe.skipIf(!local)("facts ledger + admission (F15, ADR-0074)", () => {
  const db = createDb(local as string);
  const log = createLogger({}, () => {});
  const OWNER = normalizeSuiAddress(`0x0fac${process.pid.toString(16)}`);
  const OTHER = normalizeSuiAddress(`0x0fad${process.pid.toString(16)}`);
  const tokens: number[] = [];
  let clock = Date.parse("2026-10-31T00:00:00Z");
  const ledger = createFactLedger(db, {
    log,
    extract: parseFacts,
    onTokens: async (_r, t) => {
      tokens.push(t);
    },
    now: () => new Date(clock),
  });

  /** What the relayer holds, per full namespace; recall returns all of it, closest first. */
  const blobs: { blobId: string; ns: string; text: string; remoraId: string }[] = [];
  let n = 0;
  const memory: RemoraMemory = {
    async recall(r, _q, namespaces) {
      return blobs
        .filter((b) => namespaces.includes(b.ns) && (b.ns === "me" || b.remoraId === r.id))
        .map(
          (b, i): Recalled => ({
            blobId: b.blobId,
            namespace: b.ns,
            text: b.text,
            distance: 0.3 + i / 100,
          }),
        );
    },
    async remember(r, ns, type: MemoryType, text) {
      const blobId = `blob-${process.pid}-${++n}`;
      const [row] = await db
        .insert(remoraMemories)
        .values({ remoraId: r.id, namespace: ns, type, blobId, status: "stored" })
        .returning({ id: remoraMemories.id });
      blobs.push({ blobId, ns, text, remoraId: r.id });
      return { saved: true, note: "", ...(row ? { indexId: row.id } : {}) };
    },
  };
  const mem = withFacts(memory, ledger);
  const NS = ["me", "sources", "feedback", "receipts"];
  let scout: RemoraRef;
  let sibling: RemoraRef;
  let stranger: RemoraRef;
  const ids: string[] = [];

  const make = async (owner: string, name: string) => {
    const [row] = await db
      .insert(remoras)
      .values({
        ownerAddress: owner,
        network: "testnet",
        template: "scout",
        name,
        config: { namespaces: NS },
        status: "active",
        address: normalizeSuiAddress(`0x${ids.length + 1}e${process.pid.toString(16)}`),
      })
      .returning();
    if (!row) throw new Error("no remora");
    ids.push(row.id);
    return { id: row.id, name: row.name, ownerAddress: row.ownerAddress };
  };
  const write = async (
    r: RemoraRef,
    ns: string,
    type: MemoryType,
    text: string,
    o?: Parameters<RemoraMemory["remember"]>[4],
  ) => {
    clock += 60_000;
    await mem.remember(r, ns, type, text, o);
    await ledger.idle();
    return blobs.at(-1)?.blobId as string;
  };
  const slot = async (r: RemoraRef, s: string) =>
    (await ledger.list(r, NS)).filter((f) => f.slot === s).map((f) => [f.value, f.status]);

  beforeAll(async () => {
    scout = await make(OWNER, "scout-f15");
    sibling = await make(OWNER, "sentinel-f15");
    stranger = await make(OTHER, "scout-other");
  });
  afterAll(async () => {
    for (const id of ids) {
      await db.delete(memoryFacts).where(eq(memoryFacts.remoraId, id));
      await db.delete(remoras).where(eq(remoras.id, id));
    }
  });

  it("a newer track record supersedes the last; admission keeps only the one that holds", async () => {
    const old = await write(
      scout,
      "sources",
      "source",
      "SOURCE reef:brief · 3 calls · 3 useful · as_of 2026-10-30",
    );
    const now = await write(
      scout,
      "sources",
      "source",
      "SOURCE reef:brief · 9 calls · 2 useful · 7 noise · as_of 2026-10-31",
    );
    expect(await slot(scout, "reef:brief.track_record")).toEqual([
      ["3 calls · 3 useful", "superseded"],
      ["9 calls · 2 useful · 7 noise", "active"],
    ]);
    const recalled = await memory.recall(scout, "brief", ["sources"]);
    const a = await admitMemories(
      { facts: ledger, log },
      scout,
      "is brief worth it?",
      recalled,
      NS,
    );
    expect(a.memories.map((m) => m.blobId)).toEqual([now]);
    expect(a.report.rejected).toEqual([
      { blobId: old, namespace: "sources", reason: "superseded" },
    ]);
    // The current value is already in an admitted memory: no extra line.
    expect(a.facts).toEqual([]);
    // Parsed, not interpreted: no model tokens.
    expect(tokens).toEqual([]);
  });

  it("asOf answers what held then", async () => {
    const before = await ledger.list(scout, NS, { asOf: new Date("2026-10-31T00:01:30Z") });
    expect(before.filter((f) => f.slot === "reef:brief.track_record").map((f) => f.value)).toEqual([
      "3 calls · 3 useful",
    ]);
  });

  it("an agent can't overwrite the owner: its claim is disputed until the owner settles it", async () => {
    const owners = await write(scout, "me", "correction", "reply_language=Vietnamese", {
      asserted: "owner",
    });
    const agents = await write(scout, "me", "episode", "reply_language=English", {
      by: "mcp:claude-code",
    });
    expect(await slot(scout, "owner.reply_language")).toEqual([
      ["Vietnamese", "active"],
      ["English", "disputed"],
    ]);
    const recalled = (await memory.recall(scout, "language", ["me"])).filter((m) =>
      [owners, agents].includes(m.blobId),
    );
    const a = await admitMemories({ facts: ledger, log }, scout, "which language?", recalled, NS);
    expect(a.memories.map((m) => m.blobId)).toEqual([owners]);
    expect(a.report.rejected).toEqual([{ blobId: agents, namespace: "me", reason: "disputed" }]);

    const disputed = (await ledger.list(scout, NS)).find((f) => f.status === "disputed");
    clock += 60_000;
    const settled = await ledger.resolve(scout, NS, disputed?.id as string, true);
    expect([settled.value, settled.status, settled.assertedBy]).toEqual([
      "English",
      "active",
      "owner",
    ]);
    expect(await slot(scout, "owner.reply_language")).toEqual([
      ["Vietnamese", "superseded"],
      ["English", "active"],
    ]);
    const after = await admitMemories(
      { facts: ledger, log },
      scout,
      "which language?",
      recalled,
      NS,
    );
    expect(after.memories.map((m) => m.blobId)).toEqual([agents]);
    await expect(ledger.resolve(scout, NS, settled.id, false)).rejects.toThrow(/disputed/);
  });

  it("`me` is the owner's: a sibling remora reads the same facts, and the stale line gets the current value", async () => {
    const recalled = await memory.recall(sibling, "language", ["me"]);
    const a = await admitMemories({ facts: ledger, log }, sibling, "which language?", recalled, NS);
    expect(a.report.rejected.map((x) => x.reason)).toContain("superseded");
    expect(a.memories.some((m) => m.text.includes("English"))).toBe(true);
  });

  it("a change set for next month keeps both lines live: today's value, and the plan", async () => {
    const today = await write(scout, "me", "profile", "employer=Company A@2026-01-01");
    const plan = await write(scout, "me", "profile", "employer=Company B@2026-12-01");
    expect(await slot(scout, "owner.employer")).toEqual([
      ["Company A", "superseded"],
      ["Company B", "active"],
    ]);
    const recalled = (await memory.recall(scout, "work", ["me"])).filter((m) =>
      [today, plan].includes(m.blobId),
    );
    const a = await admitMemories({ facts: ledger, log }, scout, "where do I work?", recalled, NS);
    expect(a.memories.map((m) => m.blobId).sort()).toEqual([today, plan].sort());
    const dec = await ledger.list(scout, NS, { asOf: new Date("2026-12-15T00:00:00Z") });
    expect(dec.filter((f) => f.slot === "owner.employer").map((f) => f.value)).toEqual([
      "Company B",
    ]);
  });

  it("an owner's correction supersedes what the corrected memory said, including slots it didn't restate", async () => {
    const wrong = await write(scout, "me", "profile", "timezone=Asia/Bangkok; city=Bangkok");
    await write(scout, "me", "correction", "timezone=Asia/Ho_Chi_Minh", {
      asserted: "owner",
      replaces: wrong,
    });
    expect(await slot(scout, "owner.timezone")).toEqual([
      ["Asia/Bangkok", "superseded"],
      ["Asia/Ho_Chi_Minh", "active"],
    ]);
    expect(await slot(scout, "owner.city")).toEqual([["Bangkok", "superseded"]]);
    // Another remora still recalls the corrected line from the shared `me`: admission drops it and
    // hands the model what holds now.
    const recalled = (await memory.recall(sibling, "timezone", ["me"])).filter(
      (m) => m.blobId === wrong,
    );
    const a = await admitMemories(
      { facts: ledger, log },
      sibling,
      "what time is it for me?",
      recalled,
      NS,
    );
    expect(a.memories).toEqual([]);
    expect(a.facts).toHaveLength(1);
    expect(a.facts[0]).toMatch(
      /owner · timezone: Asia\/Ho_Chi_Minh \(since 2026-10-31, said by the owner\)/,
    );
    expect(tokens.length).toBeGreaterThan(0);
  });

  it("scope: another owner's remora sees none of it", async () => {
    expect(await ledger.list(stranger, NS)).toEqual([]);
    const recalled = await memory.recall(scout, "anything", ["me", "sources"]);
    const v = await ledger.validity(
      stranger,
      NS,
      recalled.map((m) => m.blobId),
    );
    expect(v.stale.size).toBe(0);
    expect(v.current).toEqual([]);
  });

  it("two writers racing on one empty slot leave exactly one active value", async () => {
    clock += 60_000;
    const [a, b] = await Promise.all([
      mem.remember(scout, "me", "profile", "max_price=0.05"),
      mem.remember(scout, "me", "profile", "max_price=0.10"),
    ]);
    await ledger.idle();
    expect(a.saved && b.saved).toBe(true);
    const rows = await slot(scout, "owner.max_price");
    expect(rows).toHaveLength(2);
    expect(rows.filter(([, s]) => s === "active")).toHaveLength(1);
  });

  it("without a ledger, admission still drops repeats and never adds anything", async () => {
    const twice: Recalled[] = [
      {
        blobId: "x1",
        namespace: "me",
        text: "[profile] [by:@a] [2026-10-30] Likes tea.",
        distance: 0.2,
      },
      { blobId: "x2", namespace: "me", text: "likes tea", distance: 0.3 },
    ];
    const a = await admitMemories({ log }, scout, "tea?", twice, NS);
    expect(a.memories.map((m) => m.blobId)).toEqual(["x1"]);
    expect(a.facts).toEqual([]);
  });
});
