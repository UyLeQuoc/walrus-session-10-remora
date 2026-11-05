import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { and, createDb, eq, receipts, remoraEvents, remoraMemories, remoras } from "@remora/db";
import { loadEnv } from "@remora/memory";
import {
  merkleProof,
  merkleRoot,
  verifyMerkleProof,
  type Wake,
  WakesAnchored,
  wakeLeaf,
} from "@remora/schema";
import { afterAll, describe, expect, it } from "vitest";
import {
  ANCHOR_EVENT,
  type AnchorChain,
  anchorBatch,
  anchorGas,
  type Candidate,
  configLeaf,
  findAnchor,
  memoryLeaf,
  nextHour,
  pickBatch,
  poolFloor,
  unpaidWakeCandidates,
} from "./anchors.ts";

const AGENT = normalizeSuiAddress("0x5c");
const PAYTO = normalizeSuiAddress("0x6d");

const wake = (i: number, decision: Wake["intent"]["decision"]): Wake => ({
  v: 1,
  remora: "8f0c2a50-4c1d-4d6e-9a43-2b2d9b0f7a11",
  agent: AGENT,
  ts: new Date(Date.UTC(2026, 10, 5, i)).toISOString(),
  intent: {
    trigger: { kind: "message", ref: "web" },
    inputs: { via: "tatum", objects: [], sha256: "1".repeat(64) },
    memories: [],
    model: { id: "google/gemini-2.5-flash", promptSha256: "2".repeat(64) },
    decision,
    sonar: { verdict: "allow", reasons: [] },
  },
  result: {},
});
const answer = (i: number) => wake(i, { action: "answer", reason: `answered ${i}` });
const pay = (i: number) =>
  wake(i, {
    action: "pay",
    payee: "reef:sui-risk",
    payTo: PAYTO,
    amount: "10000",
    coinType: "0x2::usdc::USDC",
    reason: "a risk check",
  });
const at = (i: number) => new Date(Date.UTC(2026, 10, 5, i));
const cand = (kind: Candidate["kind"], ref: string, i: number): Candidate => ({
  kind,
  ref,
  leaf: String(i).repeat(64).slice(0, 64),
  at: at(i),
});

describe("Merkle anchors: which records a batch takes (B2, ADR-0139)", () => {
  it("takes every Wake but a payment that settled, which Paid.intent anchors", () => {
    const got = unpaidWakeCandidates([
      { id: "a", wake: answer(1), txDigest: null, createdAt: at(1) },
      { id: "paid", wake: pay(2), txDigest: "D1", createdAt: at(2) },
      { id: "refused", wake: pay(3), txDigest: null, createdAt: at(3) },
      // An answer after an owner-approved payment carries the payment's digest; it didn't pay itself.
      { id: "approved-answer", wake: answer(4), txDigest: "D2", createdAt: at(4) },
      { id: "broken", wake: { v: 2 }, txDigest: null, createdAt: at(5) },
    ]);
    expect(got.map((c) => c.ref)).toEqual(["a", "refused", "approved-answer"]);
    expect(got[0]?.leaf).toBe(wakeLeaf(answer(1)));
  });

  it("skips what's anchored, oldest first, at most the cap", () => {
    const all = [
      cand("memory", "m1", 3),
      cand("wake", "w1", 1),
      cand("config", "c1", 2),
      cand("wake", "w2", 4),
    ];
    expect(pickBatch(all, new Set(["wake:w1"])).map((c) => c.ref)).toEqual(["c1", "m1", "w2"]);
    expect(pickBatch(all, new Set(), 2).map((c) => c.ref)).toEqual(["w1", "c1"]);
    expect(pickBatch(all, new Set(["wake:w1", "config:c1", "memory:m1", "wake:w2"]))).toEqual([]);
  });

  it("hashes config changes and memory writes from their stored fields, never memory text", () => {
    const e = {
      id: "e1",
      remoraId: "r1",
      createdAt: at(1),
      payload: { revision: 2, fields: ["persona"] },
    };
    expect(configLeaf(e)).toBe(configLeaf({ ...e, payload: { fields: ["persona"], revision: 2 } }));
    expect(configLeaf(e)).not.toBe(configLeaf({ ...e, payload: { revision: 3 } }));
    const m = {
      id: "m1",
      remoraId: "r1",
      namespace: "sources",
      type: "fact",
      textSha256: "a".repeat(64),
      blobId: "blob-1",
      createdAt: at(1),
    };
    expect(memoryLeaf(m)).not.toBe(memoryLeaf({ ...m, textSha256: "b".repeat(64) }));
  });

  it("a tampered Wake no longer reaches the anchored root", () => {
    const wakes = [1, 2, 3, 4, 5, 6].map(answer);
    const leaves = wakes.map(wakeLeaf);
    const root = merkleRoot(leaves);
    const proof = merkleProof(leaves, 4);
    expect(verifyMerkleProof(wakeLeaf(wakes[4] as Wake), proof, root)).toBe(true);
    const tampered = answer(5);
    tampered.intent.memories = [{ blobId: "Injected_blob1", namespace: "sources", distance: 0 }];
    expect(verifyMerkleProof(wakeLeaf(tampered), proof, root)).toBe(false);
  });
});

describe("anchor gas and timing", () => {
  const coin = (id: string, balance: number) => ({
    objectId: normalizeSuiAddress(id),
    version: "1",
    digest: "d",
    balance: String(balance),
  });

  it("pays only with sponsor coins under the facilitator pool's floor", () => {
    const floor = poolFloor(50_000_000n);
    expect(floor).toBe(20_000_000n);
    expect(poolFloor(8_000_000n)).toBe(8_000_000n);
    const got = anchorGas(
      [coin("0x1", 2_000_000_000), coin("0x2", 4_000_000), coin("0x3", 3_000_000)],
      floor,
    );
    expect(got?.map((c) => c.objectId)).toEqual([
      normalizeSuiAddress("0x2"),
      normalizeSuiAddress("0x3"),
    ]);
    // Only big coins (the pool's): none of them, so the caller splits small ones off first.
    expect(anchorGas([coin("0x1", 2_000_000_000)], floor)).toBeNull();
    expect(anchorGas([coin("0x2", 1_000_000)], floor)).toBeNull();
  });

  it("runs on the hour", () => {
    expect(nextHour(new Date("2026-11-05T06:59:59Z")).toISOString()).toBe(
      "2026-11-05T07:00:00.000Z",
    );
    expect(nextHour(new Date("2026-11-05T07:00:00Z")).toISOString()).toBe(
      "2026-11-05T08:00:00.000Z",
    );
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("Merkle anchors in Postgres (B2)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0xa9c${process.pid.toString(16)}`);
  const anchoredRoots: string[] = [];
  const chain: AnchorChain = {
    packageId: (n) => (n === "testnet" ? normalizeSuiAddress("0x609c") : null),
    anchor: async (signer, a) => {
      anchoredRoots.push(a.root);
      return { digest: `Digest${anchoredRoots.length}`.padEnd(43, "x"), anchorer: signer.address };
    },
  };
  const deps = { db, log: createLogger({}, () => {}), chain };
  let rid = "";
  afterAll(async () => {
    // Receipts name their remora as text, with no cascade.
    if (rid) await db.delete(receipts).where(eq(receipts.remoraId, rid));
    await db.delete(remoras).where(eq(remoras.ownerAddress, OWNER));
  });

  it("anchors the unpaid Wakes, memory writes and config changes once, and proves each", async () => {
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "scout",
        name: "Researcher",
        config: {},
        status: "active",
        address: AGENT,
      })
      .returning();
    if (!r) throw new Error("no remora");
    rid = r.id;
    const rows = await db
      .insert(receipts)
      .values([
        { network: "testnet", remoraId: r.id, agent: AGENT, wake: answer(1), intentHash: "h1" },
        {
          network: "testnet",
          remoraId: r.id,
          agent: AGENT,
          wake: pay(2),
          intentHash: "h2",
          txDigest: `Paid${process.pid}`.padEnd(43, "y"),
        },
        { network: "testnet", remoraId: r.id, agent: AGENT, wake: answer(3), intentHash: "h3" },
      ] as never)
      .returning();
    await db.insert(remoraMemories).values({
      remoraId: r.id,
      namespace: "sources",
      type: "fact",
      blobId: "blob-anchor-1",
      status: "stored",
    });
    await db.insert(remoraEvents).values({
      remoraId: r.id,
      network: "testnet",
      type: "config_changed",
      summary: "Edited",
      payload: { revision: 1 },
    });

    const first = await anchorBatch(deps, r);
    expect(first.ok && first.count).toBe(4);
    const [event] = await db
      .select()
      .from(remoraEvents)
      .where(and(eq(remoraEvents.type, ANCHOR_EVENT), eq(remoraEvents.remoraId, r.id)));
    const batch = WakesAnchored.parse(event?.payload);
    expect(batch.leaves.map((l) => l.kind).sort()).toEqual(["config", "memory", "wake", "wake"]);
    expect(batch.root).toBe(anchoredRoots[0]);

    const answerId = rows[0]?.id as string;
    const found = await findAnchor(db, r.id, "wake", answerId);
    expect(found && verifyMerkleProof(wakeLeaf(answer(1)), found.proof, found.batch.root)).toBe(
      true,
    );
    const [marked] = await db.select().from(receipts).where(eq(receipts.id, answerId));
    expect(marked?.anchored).toBe(true);
    expect(await findAnchor(db, r.id, "wake", rows[1]?.id as string)).toBeNull();

    // Nothing new: no second transaction. Then too soon for an owner's "anchor now".
    expect((await anchorBatch(deps, r)).ok).toBe(false);
    expect(anchoredRoots).toHaveLength(1);
    await db.insert(receipts).values({
      network: "testnet",
      remoraId: r.id,
      agent: AGENT,
      wake: answer(4),
      intentHash: "h4",
    } as never);
    const soon = await anchorBatch(deps, r, { minGapMs: 60_000 });
    expect(!soon.ok && soon.reason).toBe("too_soon");
    const next = await anchorBatch(deps, r);
    expect(next.ok && next.count).toBe(1);
  });
});
