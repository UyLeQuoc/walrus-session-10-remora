/**
 * D1 (chain part): the checkpoint indexer, one per network. It streams `SubscribeCheckpoints` through
 * Tatum, filtered to checkpoints where `remora::disc` emitted, and stores those events in
 * `disc_events`. It also marks a Wake anchored once its `Paid.intent` shows up (G2).
 *
 * gRPC has no event query and the stream starts at the tip (ADR-0021). On restart, gaps up to
 * `maxBackfill` checkpoints are filled with `GetCheckpoint`; bigger gaps are logged, and payments
 * we made are still confirmed by digest (`wake.anchor` jobs).
 */
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { Logger, SuiNetwork } from "@remora/chain";
import { and, type Db, discEvents, eq, indexerCursors, receipts, sql } from "@remora/db";
import { DISC_EVENT_BCS, type DiscEventName } from "@remora/disc-sdk";

/** The slice of a gRPC `Checkpoint` the indexer reads. */
export interface CheckpointLike {
  sequenceNumber?: bigint;
  summary?: { timestamp?: { seconds: bigint; nanos: number } };
  transactions: {
    digest?: string;
    events?: { events: { eventType?: string; contents?: { value?: Uint8Array } }[] };
  }[];
}

export interface DiscEventRow {
  network: SuiNetwork;
  checkpoint: bigint;
  txDigest: string;
  eventSeq: number;
  type: DiscEventName;
  discId: string;
  payload: Record<string, unknown>;
  timestampMs: bigint | null;
}

const READ_MASK = {
  paths: [
    "sequence_number",
    "summary.timestamp",
    "transactions.digest",
    "transactions.events.events.event_type",
    "transactions.events.events.contents",
  ],
};

const jsonSafe = (v: unknown): unknown => {
  if (typeof v === "bigint") return v.toString();
  if (Array.isArray(v) && v.every((x) => typeof x === "number")) {
    return Buffer.from(v as number[]).toString("hex");
  }
  if (Array.isArray(v)) return v.map(jsonSafe);
  if (v && typeof v === "object")
    return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, jsonSafe(x)]));
  return v;
};

/** Pulls this package's Disc events out of a checkpoint. */
export function decodeDiscEvents(
  network: SuiNetwork,
  packageId: string,
  cp: CheckpointLike,
): DiscEventRow[] {
  const prefix = `${normalizeSuiAddress(packageId)}::disc::`;
  const seq = cp.sequenceNumber ?? 0n;
  const ts = cp.summary?.timestamp;
  const timestampMs = ts ? ts.seconds * 1000n + BigInt(Math.floor(ts.nanos / 1e6)) : null;
  const rows: DiscEventRow[] = [];
  for (const tx of cp.transactions) {
    tx.events?.events.forEach((e, i) => {
      const type = e.eventType ?? "";
      const [addr, rest] = type.split(/::(.*)/s);
      if (!addr || !rest || !`${normalizeSuiAddress(addr)}::${rest}`.startsWith(prefix)) return;
      const name = rest.replace(/^disc::/, "") as DiscEventName;
      const layout = DISC_EVENT_BCS[name];
      if (!layout || !e.contents?.value) return;
      const parsed = layout.parse(e.contents.value) as { disc: string };
      rows.push({
        network,
        checkpoint: seq,
        txDigest: tx.digest ?? "",
        eventSeq: i,
        type: name,
        discId: normalizeSuiAddress(parsed.disc),
        payload: jsonSafe(parsed) as Record<string, unknown>,
        timestampMs,
      });
    });
  }
  return rows;
}

/** Stores rows (idempotent), anchors matching Wakes, then advances the cursor. */
export async function storeCheckpoint(
  db: Db,
  network: SuiNetwork,
  cursor: bigint,
  rows: DiscEventRow[],
) {
  await db.transaction(async (tx) => {
    if (rows.length) await tx.insert(discEvents).values(rows).onConflictDoNothing();
    for (const r of rows) {
      if (r.type !== "Paid") continue;
      await tx
        .update(receipts)
        .set({ anchored: true })
        .where(
          and(
            eq(receipts.network, network),
            eq(receipts.txDigest, r.txDigest),
            eq(receipts.intentHash, String(r.payload.intent)),
          ),
        );
    }
    await tx
      .insert(indexerCursors)
      .values({ network, checkpoint: cursor })
      .onConflictDoUpdate({
        target: indexerCursors.network,
        set: {
          checkpoint: sql`greatest(${indexerCursors.checkpoint}, ${cursor})`,
          updatedAt: new Date(),
        },
      });
  });
}

export async function readCursor(db: Db, network: SuiNetwork): Promise<bigint | null> {
  const [row] = await db.select().from(indexerCursors).where(eq(indexerCursors.network, network));
  return row?.checkpoint ?? null;
}

export interface IndexerOptions {
  network: SuiNetwork;
  packageId: string;
  client: SuiGrpcClient;
  db: Db;
  log: Logger;
  maxBackfill?: number;
  /** Called after each stored frame (tests and the e2e wait on it). */
  onFrame?: (cursor: bigint, rows: DiscEventRow[]) => void;
}

/** Starts the stream with reconnects. Returns a stop function. */
export function startIndexer(o: IndexerOptions): () => void {
  let stopped = false;
  let abort: AbortController | null = null;
  const log = o.log.child({ indexer: o.network });
  const filter = {
    terms: [
      {
        literals: [
          {
            negated: false,
            predicate: {
              oneofKind: "emitModule" as const,
              emitModule: { module: `${normalizeSuiAddress(o.packageId)}::disc` },
            },
          },
        ],
      },
    ],
  };

  const backfill = async (from: bigint, to: bigint) => {
    const max = BigInt(o.maxBackfill ?? 120);
    if (to - from > max) {
      log.warn("indexer.gap", {
        from,
        to,
        reason: "too large to backfill; payments still confirm by digest",
      });
      return;
    }
    for (let s = from; s <= to && !stopped; s++) {
      const { response } = await o.client.ledgerService.getCheckpoint({
        checkpointId: { oneofKind: "sequenceNumber", sequenceNumber: s },
        readMask: READ_MASK,
      });
      if (!response.checkpoint) continue;
      const rows = decodeDiscEvents(o.network, o.packageId, response.checkpoint as CheckpointLike);
      await storeCheckpoint(o.db, o.network, s, rows);
    }
    log.info("indexer.backfilled", { from, to });
  };

  void (async () => {
    let delay = 1_000;
    while (!stopped) {
      abort = new AbortController();
      try {
        const last = await readCursor(o.db, o.network);
        const call = o.client.subscriptionService.subscribeCheckpoints(
          { readMask: READ_MASK, filter },
          { abort: abort.signal },
        );
        let first = true;
        for await (const frame of call.responses) {
          if (stopped) break;
          const cursor = frame.cursor ?? 0n;
          if (first && last !== null && cursor > last + 1n) {
            first = false;
            await backfill(last + 1n, cursor - 1n);
          }
          first = false;
          const rows = frame.checkpoint
            ? decodeDiscEvents(o.network, o.packageId, frame.checkpoint as CheckpointLike)
            : [];
          await storeCheckpoint(o.db, o.network, cursor, rows);
          if (rows.length) log.info("indexer.events", { cursor, events: rows.map((r) => r.type) });
          o.onFrame?.(cursor, rows);
          delay = 1_000;
        }
      } catch (err) {
        if (stopped) break;
        log.warn("indexer.reconnect", { error: err, inMs: delay });
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 60_000);
      }
    }
  })();

  return () => {
    stopped = true;
    abort?.abort();
  };
}
