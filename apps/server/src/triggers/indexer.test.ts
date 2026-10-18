import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createDb, discEvents, eq, indexerCursors, receipts } from "@remora/db";
import { DiscRevokedBcs, PaidBcs } from "@remora/disc-sdk";
import { loadEnv } from "@remora/memory";
import { afterAll, describe, expect, it } from "vitest";
import { type CheckpointLike, decodeDiscEvents, readCursor, storeCheckpoint } from "./indexer.ts";

const PKG = normalizeSuiAddress("0xcc");
const DISC = normalizeSuiAddress("0xd1");
const PAYEE = normalizeSuiAddress("0x3e");
const INTENT = "ab".repeat(32);

const checkpoint = (seq: bigint, digest: string): CheckpointLike => ({
  sequenceNumber: seq,
  summary: { timestamp: { seconds: 1_800_000_000n, nanos: 500_000_000 } },
  transactions: [
    {
      digest,
      events: {
        events: [
          { eventType: "0x2::coin::Other", contents: { value: new Uint8Array([1]) } },
          {
            eventType: `${PKG}::disc::Paid`,
            contents: {
              value: PaidBcs.serialize({
                disc: DISC,
                payee: PAYEE,
                amount: 10_000n,
                intent: Array.from(Buffer.from(INTENT, "hex")),
                ts_ms: 7n,
              }).toBytes(),
            },
          },
          // Same module name, another package: ignored.
          { eventType: "0xbad::disc::Paid", contents: { value: new Uint8Array([0]) } },
          {
            eventType: `0xcc::disc::DiscRevoked`,
            contents: { value: DiscRevokedBcs.serialize({ disc: DISC }).toBytes() },
          },
        ],
      },
    },
  ],
});

describe("decodeDiscEvents (D1)", () => {
  it("keeps only this package's Disc events, decoded", () => {
    const rows = decodeDiscEvents("testnet", PKG, checkpoint(42n, "Dg1"));
    expect(rows.map((r) => [r.type, r.eventSeq])).toEqual([
      ["Paid", 1],
      ["DiscRevoked", 3],
    ]);
    expect(rows[0]).toMatchObject({
      checkpoint: 42n,
      txDigest: "Dg1",
      discId: DISC,
      timestampMs: 1_800_000_000_500n,
      payload: { payee: PAYEE, amount: "10000", intent: INTENT, ts_ms: "7" },
    });
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("storeCheckpoint on Postgres (D1, G2)", () => {
  const db = createDb(local as string);
  const digest = `Dg-${process.pid}`;
  const remoraId = `test-idx-${process.pid}`;
  afterAll(async () => {
    await db.delete(discEvents).where(eq(discEvents.txDigest, digest));
    await db.delete(receipts).where(eq(receipts.remoraId, remoraId));
    await db.delete(indexerCursors).where(eq(indexerCursors.network, "testnet"));
  });

  it("stores events once, anchors the matching Wake, and only moves the cursor forward", async () => {
    await db.delete(indexerCursors).where(eq(indexerCursors.network, "testnet"));
    const [receipt] = await db
      .insert(receipts)
      .values({
        network: "testnet",
        remoraId,
        agent: PAYEE,
        wake: {},
        intentHash: INTENT,
        txDigest: digest,
      })
      .returning();
    const rows = decodeDiscEvents("testnet", PKG, checkpoint(100n, digest));
    await storeCheckpoint(db, "testnet", 100n, rows);
    await storeCheckpoint(db, "testnet", 100n, rows); // a replayed frame
    const stored = await db.select().from(discEvents).where(eq(discEvents.txDigest, digest));
    expect(stored).toHaveLength(2);
    const [r] = await db
      .select()
      .from(receipts)
      .where(eq(receipts.id, receipt?.id ?? ""));
    expect(r?.anchored).toBe(true);
    await storeCheckpoint(db, "testnet", 90n, []);
    expect(await readCursor(db, "testnet")).toBe(100n);
  });
});
