/**
 * D1 chain trigger: one checkpoint stream per network, filtered to the addresses Sentinels watch
 * (`affectedAddress` terms, OR-ed, up to the filter's 10 literals; unfiltered past that). Balance changes of a watched address become `ChainEvent`s and go
 * to every Sentinel watching it. The watched set is re-read periodically; a change re-subscribes.
 * The stream starts at the tip, so after a reconnect the checkpoints in between are fetched with
 * `GetCheckpoint` (up to `maxBackfill`), as the indexer does: a ping is never lost to a reconnect.
 */
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { Logger, SuiNetwork } from "@remora/chain";
import { and, type Db, eq, inArray, remoras } from "@remora/db";
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

/** Balance changes of watched addresses, as events. */
export function eventsFrom(cp: WatchCheckpoint, watched: Set<string>): ChainEvent[] {
  const out: ChainEvent[] = [];
  for (const tx of cp.transactions) {
    for (const b of tx.balanceChanges ?? []) {
      if (!b.address || !b.coinType || !b.amount) continue;
      const address = normalizeSuiAddress(b.address);
      if (!watched.has(address)) continue;
      const amount = BigInt(b.amount);
      if (amount === 0n) continue;
      out.push({
        address,
        direction: amount > 0n ? "in" : "out",
        coinType: b.coinType,
        amount: amount < 0n ? -amount : amount,
        decimals: decimalsOf(b.coinType),
        digest: tx.digest ?? "",
      });
    }
  }
  return out;
}

export interface Watched {
  remoraId: string;
  addresses: string[];
}

/** Sentinels on a network that should be listening, with the addresses they watch. */
export async function watchedOn(db: Db, network: SuiNetwork): Promise<Watched[]> {
  const rows = await db
    .select()
    .from(remoras)
    .where(
      and(
        eq(remoras.network, network),
        eq(remoras.template, "sentinel"),
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
 * `affectedAddress` terms, OR-ed. Past the literal limit there's no filter: the stream carries every
 * checkpoint and `eventsFrom` keeps the watched addresses' changes.
 */
export function filterFor(addresses: string[]) {
  if (addresses.length > MAX_FILTER_LITERALS) return undefined;
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
    for (const e of eventsFrom(cp, new Set(byAddress.keys()))) {
      for (const remoraId of byAddress.get(e.address) ?? []) {
        await o
          .onEvent(remoraId, e, checkpoint)
          .catch((err) => log.warn("watcher.event_failed", { remoraId, error: err }));
      }
    }
  };

  const loop = async () => {
    let delay = o.reconnectMs ?? 1_000;
    while (!stopped) {
      const watched = await load().catch(() => [] as Watched[]);
      const byAddress = new Map<string, string[]>();
      for (const w of watched)
        for (const a of w.addresses) byAddress.set(a, [...(byAddress.get(a) ?? []), w.remoraId]);
      key = [...byAddress.keys()].sort().join(",");
      if (!byAddress.size) {
        await new Promise((r) => setTimeout(r, o.refreshMs ?? 30_000));
        continue;
      }
      abort = new AbortController();
      const refresh = setInterval(async () => {
        const next = await load().catch(() => null);
        const nextKey = next
          ? [...new Set(next.flatMap((w) => w.addresses))].sort().join(",")
          : key;
        if (nextKey !== key) abort?.abort();
      }, o.refreshMs ?? 30_000);
      try {
        const call = o.client.subscriptionService.subscribeCheckpoints(
          {
            readMask: READ_MASK,
            filter: filterFor([...byAddress.keys()]),
          },
          { abort: abort.signal },
        );
        log.info("watcher.subscribed", {
          addresses: byAddress.size,
          filtered: byAddress.size <= MAX_FILTER_LITERALS,
        });
        let first = true;
        for await (const frame of call.responses) {
          if (stopped) continue;
          const cursor = frame.cursor ?? 0n;
          if (first && last !== null && cursor > last + 1n)
            await backfill(last + 1n, cursor - 1n, byAddress);
          first = false;
          if (frame.checkpoint) {
            await deliver(
              frame.checkpoint as unknown as WatchCheckpoint,
              byAddress,
              Number(cursor),
            );
          }
          if (last === null || cursor > last) last = cursor;
          delay = o.reconnectMs ?? 1_000;
        }
      } catch (err) {
        if (stopped) break;
        if (!abort.signal.aborted) {
          log.warn("watcher.reconnect", { error: err, inMs: delay });
          await new Promise((r) => setTimeout(r, delay));
          delay = Math.min(delay * 2, 60_000);
        }
      } finally {
        clearInterval(refresh);
      }
    }
  };
  void loop();
  return () => {
    stopped = true;
    abort?.abort();
  };
}
