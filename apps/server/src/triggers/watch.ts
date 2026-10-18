/**
 * D1 chain trigger: one checkpoint stream per network, filtered to the addresses Sentinels watch
 * (`affectedAddress` terms, OR-ed). Balance changes of a watched address become `ChainEvent`s and go
 * to every Sentinel watching it. The watched set is re-read periodically; a change re-subscribes.
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

export function startWatcher(o: {
  network: SuiNetwork;
  client: SuiGrpcClient;
  db: Db;
  log: Logger;
  onEvent: (remoraId: string, e: ChainEvent, checkpoint: number) => Promise<unknown>;
  refreshMs?: number;
}): () => void {
  let stopped = false;
  let abort: AbortController | null = null;
  let key = "";
  const log = o.log.child({ watcher: o.network });

  const loop = async () => {
    let delay = 1_000;
    while (!stopped) {
      const watched = await watchedOn(o.db, o.network).catch(() => [] as Watched[]);
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
        const next = await watchedOn(o.db, o.network).catch(() => null);
        const nextKey = next
          ? [...new Set(next.flatMap((w) => w.addresses))].sort().join(",")
          : key;
        if (nextKey !== key) abort?.abort();
      }, o.refreshMs ?? 30_000);
      try {
        const call = o.client.subscriptionService.subscribeCheckpoints(
          {
            readMask: {
              paths: ["sequence_number", "transactions.digest", "transactions.balance_changes"],
            },
            filter: {
              terms: [...byAddress.keys()].map((address) => ({
                literals: [
                  {
                    negated: false,
                    predicate: {
                      oneofKind: "affectedAddress" as const,
                      affectedAddress: { address },
                    },
                  },
                ],
              })),
            },
          },
          { abort: abort.signal },
        );
        log.info("watcher.subscribed", { addresses: byAddress.size });
        for await (const frame of call.responses) {
          if (stopped || !frame.checkpoint) continue;
          const cp = frame.checkpoint as unknown as WatchCheckpoint;
          for (const e of eventsFrom(cp, new Set(byAddress.keys()))) {
            for (const remoraId of byAddress.get(e.address) ?? []) {
              await o
                .onEvent(remoraId, e, Number(frame.cursor ?? 0n))
                .catch((err) => log.warn("watcher.event_failed", { remoraId, error: err }));
            }
          }
          delay = 1_000;
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
