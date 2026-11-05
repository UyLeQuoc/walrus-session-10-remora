/**
 * D1 chain trigger: checkpoint streams per network, filtered to the addresses Sentinels watch
 * (`affectedAddress` terms, OR-ed, at most the filter's 10 literals per stream, so more addresses
 * open more streams; never an unfiltered one, ADR-0058). Balance changes of a watched address
 * become `ChainEvent`s and go to every Sentinel watching it. The watched set is re-read
 * periodically; a change re-subscribes. A stream starts at the tip, so after a reconnect the
 * checkpoints in between are fetched with `GetCheckpoint` (up to `maxBackfill`), as the indexer
 * does: a ping is never lost to a reconnect.
 */
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { Logger, SuiNetwork } from "@remora/chain";
import { and, type Db, eq, inArray, remoras } from "@remora/db";
import { noteWatcher } from "../ops/signals.ts";
import type { ChainEvent } from "../runtime/rules.ts";

export interface WatchCheckpoint {
  sequenceNumber?: bigint;
  transactions: {
    digest?: string;
    balanceChanges?: { address?: string; coinType?: string; amount?: string }[];
  }[];
}

const DECIMALS: Record<string, number> = { SUI: 9, USDC: 6 };
export const decimalsOf = (coinType: string) =>
  DECIMALS[coinType.split("::").pop()?.toUpperCase() ?? ""] ?? 9;

/**
 * Balance changes of watched addresses, as events. With `counterparty`, each event also names the
 * other side: the largest opposite change of the same coin in that transaction (C3, ADR-0148).
 */
export function eventsFrom(
  cp: WatchCheckpoint,
  watched: Set<string>,
  o: { counterparty?: boolean } = {},
): ChainEvent[] {
  const out: ChainEvent[] = [];
  for (const tx of cp.transactions) {
    const changes = (tx.balanceChanges ?? []).flatMap((b) =>
      b.address && b.coinType && b.amount
        ? [
            {
              address: normalizeSuiAddress(b.address),
              coinType: b.coinType,
              amount: BigInt(b.amount),
            },
          ]
        : [],
    );
    for (const { address, coinType, amount } of changes) {
      if (!watched.has(address)) continue;
      if (amount === 0n) continue;
      const other = o.counterparty
        ? changes
            .filter(
              (x) =>
                x.coinType === coinType &&
                x.address !== address &&
                x.amount !== 0n &&
                x.amount > 0n !== amount > 0n,
            )
            .sort((x, y) => {
              const ax = x.amount < 0n ? -x.amount : x.amount;
              const ay = y.amount < 0n ? -y.amount : y.amount;
              return ay > ax ? 1 : ay < ax ? -1 : 0;
            })[0]
        : undefined;
      out.push({
        address,
        direction: amount > 0n ? "in" : "out",
        coinType,
        amount: amount < 0n ? -amount : amount,
        decimals: decimalsOf(coinType),
        digest: tx.digest ?? "",
        ...(other ? { counterparty: other.address } : {}),
      });
    }
  }
  return out;
}

export interface Watched {
  remoraId: string;
  addresses: string[];
}

/**
 * Sentinels and Treasurers (C3, ADR-0148) on a network that should be listening, with the addresses
 * they watch. Both keep their addresses in a `chain` trigger, so one set of streams serves both.
 */
export async function watchedOn(db: Db, network: SuiNetwork): Promise<Watched[]> {
  const rows = await db
    .select()
    .from(remoras)
    .where(
      and(
        eq(remoras.network, network),
        inArray(remoras.template, ["sentinel", "treasurer"]),
        inArray(remoras.status, ["shadow", "active"]),
      ),
    );
  return rows.map((r) => {
    const triggers =
      (r.config as { triggers?: { kind: string; addresses?: string[] }[] }).triggers ?? [];
    const addresses = triggers.flatMap((t) => (t.kind === "chain" ? (t.addresses ?? []) : []));
    return { remoraId: r.id, addresses: addresses.map((a) => normalizeSuiAddress(a)) };
  });
}

/** A checkpoint filter takes at most 10 literals (the fullnode rejects more). */
export const MAX_FILTER_LITERALS = 10;
/**
 * Streams per network. An unfiltered stream carried every checkpoint with every transaction's balance
 * changes, about 15,000 frames an hour, and spent the Tatum key's monthly credits; a filtered one
 * sends a cursor every few seconds and a checkpoint only when it matches (ADR-0058).
 */
export const MAX_STREAMS = 5;

/** `affectedAddress` terms, OR-ed: one stream's filter, for at most `MAX_FILTER_LITERALS` addresses. */
export function filterFor(addresses: string[]) {
  if (addresses.length > MAX_FILTER_LITERALS)
    throw new Error(`a filter takes at most ${MAX_FILTER_LITERALS} addresses`);
  return {
    terms: addresses.map((address) => ({
      literals: [
        {
          negated: false,
          predicate: { oneofKind: "affectedAddress" as const, affectedAddress: { address } },
        },
      ],
    })),
  };
}

/** The watched addresses in groups a filter can take, at most `MAX_STREAMS` of them. */
export function groupsOf(addresses: string[]): { groups: string[][]; dropped: number } {
  const groups: string[][] = [];
  for (let i = 0; i < addresses.length; i += MAX_FILTER_LITERALS)
    groups.push(addresses.slice(i, i + MAX_FILTER_LITERALS));
  const kept = groups.slice(0, MAX_STREAMS);
  return { groups: kept, dropped: addresses.length - kept.flat().length };
}

export function startWatcher(o: {
  network: SuiNetwork;
  client: SuiGrpcClient;
  db: Db;
  log: Logger;
  onEvent: (remoraId: string, e: ChainEvent, checkpoint: number) => Promise<unknown>;
  refreshMs?: number;
  maxBackfill?: number;
  /** Who watches what; defaults to the Sentinels in the database. */
  watched?: () => Promise<Watched[]>;
  /** Wait before reconnecting (tests shorten it). */
  reconnectMs?: number;
}): () => void {
  let stopped = false;
  /** The highest checkpoint this watcher has seen; frames carry it even without a match. */
  let last: bigint | null = null;
  const READ_MASK = {
    paths: ["sequence_number", "transactions.digest", "transactions.balance_changes"],
  };
  let abort: AbortController | null = null;
  let key = "";
  const log = o.log.child({ watcher: o.network });
  const load = o.watched ?? (() => watchedOn(o.db, o.network));

  const backfill = async (from: bigint, to: bigint, byAddress: Map<string, string[]>) => {
    if (to - from >= BigInt(o.maxBackfill ?? 200)) {
      log.warn("watcher.gap", { from, to, reason: "too large to backfill" });
      return;
    }
    for (let s = from; s <= to && !stopped; s++) {
      const { response } = await o.client.ledgerService.getCheckpoint({
        checkpointId: { oneofKind: "sequenceNumber", sequenceNumber: s },
        readMask: READ_MASK,
      });
      if (!response.checkpoint) continue;
      await deliver(response.checkpoint as unknown as WatchCheckpoint, byAddress, Number(s));
    }
    log.info("watcher.backfilled", { from, to });
  };

  const deliver = async (
    cp: WatchCheckpoint,
    byAddress: Map<string, string[]>,
    checkpoint: number,
  ) => {
    for (const e of eventsFrom(cp, new Set(byAddress.keys()), { counterparty: true })) {
      for (const remoraId of byAddress.get(e.address) ?? []) {
        await o
          .onEvent(remoraId, e, checkpoint)
          .catch((err) => log.warn("watcher.event_failed", { remoraId, error: err }));
      }
    }
  };

  const loop = async () => {
    let delay = o.reconnectMs ?? 1_000;
    // ADR-0080: a re-subscribe because the watched set changed skips the backfill. Its gap is the few
    // checkpoints of the switch, and the e2e changes the set often enough to make it add up.
    let setChanged = false;
    while (!stopped) {
      const watched = await load().catch(() => [] as Watched[]);
      const byAddress = new Map<string, string[]>();
      for (const w of watched)
        for (const a of w.addresses) byAddress.set(a, [...(byAddress.get(a) ?? []), w.remoraId]);
      key = [...byAddress.keys()].sort().join(",");
      if (!byAddress.size) {
        noteWatcher(o.network, { subscriptions: 0 });
        await new Promise((r) => setTimeout(r, o.refreshMs ?? 30_000));
        continue;
      }
      const session = new AbortController();
      abort = session;
      const refresh = setInterval(async () => {
        const next = await load().catch(() => null);
        const nextKey = next
          ? [...new Set(next.flatMap((w) => w.addresses))].sort().join(",")
          : key;
        if (nextKey !== key) {
          setChanged = true;
          session.abort();
        }
      }, o.refreshMs ?? 30_000);
      const { groups, dropped } = groupsOf([...byAddress.keys()]);
      const skipGap = setChanged;
      setChanged = false;
      // One stream per group; they share `last`, so the first frame after a gap backfills it once.
      const stream = async (addresses: string[]) => {
        const call = o.client.subscriptionService.subscribeCheckpoints(
          { readMask: READ_MASK, filter: filterFor(addresses) },
          { abort: session.signal },
        );
        let first = true;
        for await (const frame of call.responses) {
          if (stopped) continue;
          const cursor = frame.cursor ?? 0n;
          if (first && last !== null && cursor > last + 1n) {
            // Claim the gap before awaiting, so a sibling stream doesn't backfill it too.
            const from = last + 1n;
            last = cursor - 1n;
            if (skipGap) log.info("watcher.resubscribed", { skipped: Number(cursor - from) });
            else await backfill(from, cursor - 1n, byAddress);
          }
          first = false;
          if (frame.checkpoint) {
            await deliver(
              frame.checkpoint as unknown as WatchCheckpoint,
              byAddress,
              Number(cursor),
            );
          }
          if (last === null || cursor > last) last = cursor;
          noteWatcher(o.network, { checkpoint: Number(cursor) });
          delay = o.reconnectMs ?? 1_000;
        }
        if (!session.signal.aborted) throw new Error("the checkpoint stream ended");
      };
      let failure: unknown = null;
      try {
        noteWatcher(o.network, { subscriptions: byAddress.size });
        log.info("watcher.subscribed", { addresses: byAddress.size, streams: groups.length });
        if (dropped) log.warn("watcher.capped", { dropped, streams: MAX_STREAMS });
        await Promise.all(
          groups.map((g) =>
            stream(g).catch((err) => {
              // One stream failing restarts them all, after the backoff.
              if (!session.signal.aborted) {
                failure = err;
                session.abort();
              }
            }),
          ),
        );
      } finally {
        clearInterval(refresh);
      }
      if (stopped) break;
      if (failure) {
        log.warn("watcher.reconnect", { error: failure, inMs: delay });
        await new Promise((r) => setTimeout(r, delay));
        delay = Math.min(delay * 2, 60_000);
      }
    }
  };
  void loop();
  return () => {
    stopped = true;
    abort?.abort();
  };
}
