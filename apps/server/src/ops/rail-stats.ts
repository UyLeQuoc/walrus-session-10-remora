/**
 * U17 D3 (ADR-0111): the payment rails' numbers for `/stats`, from the database only, per network.
 * Plus the latest dated load run (`docs/spikes/<date>-u17-load.json`), as it was measured.
 */
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { type Db, receipts, remoraEvents, remoras, sql } from "@remora/db";

export interface NetworkRails {
  remoras: number;
  activeRemoras: number;
  paidCalls: number;
  /** Smallest USDC units, summed from each paid receipt's decision. */
  usdcMoved: string;
  /** Receipts whose `Paid.intent` the indexer matched onchain (G2). */
  anchored: number;
  blocked: number;
  sales: number;
}

export async function railStats(db: Db): Promise<Record<string, NetworkRails>> {
  const people = await db
    .select({
      network: remoras.network,
      remoras: sql<number>`count(*) filter (where not ${remoras.playground})::int`,
      active: sql<number>`count(*) filter (where not ${remoras.playground} and ${remoras.status} = 'active')::int`,
    })
    .from(remoras)
    .groupBy(remoras.network);
  const paid = await db
    .select({
      network: receipts.network,
      paid: sql<number>`count(*) filter (where ${receipts.txDigest} is not null)::int`,
      anchored: sql<number>`count(*) filter (where ${receipts.anchored})::int`,
      moved: sql<string>`coalesce(sum((${receipts.wake}->'intent'->'decision'->>'amount')::numeric) filter (where ${receipts.txDigest} is not null), 0)::text`,
    })
    .from(receipts)
    .groupBy(receipts.network);
  const events = await db
    .select({
      network: remoraEvents.network,
      blocked: sql<number>`count(*) filter (where ${remoraEvents.type} = 'blocked')::int`,
      sales: sql<number>`count(*) filter (where ${remoraEvents.type} = 'action' and ${remoraEvents.payload}->>'kind' = 'sale')::int`,
    })
    .from(remoraEvents)
    .groupBy(remoraEvents.network);
  const out: Record<string, NetworkRails> = {};
  for (const n of ["testnet", "mainnet"]) {
    const p = people.find((x) => x.network === n);
    const r = paid.find((x) => x.network === n);
    const e = events.find((x) => x.network === n);
    out[n] = {
      remoras: p?.remoras ?? 0,
      activeRemoras: p?.active ?? 0,
      paidCalls: r?.paid ?? 0,
      usdcMoved: (r?.moved ?? "0").split(".")[0] ?? "0",
      anchored: r?.anchored ?? 0,
      blocked: e?.blocked ?? 0,
      sales: e?.sales ?? 0,
    };
  }
  return out;
}

/** The newest load run's summary, as measured; null when none has run. */
export function latestLoadRun(dir = resolve(import.meta.dirname, "../../../../docs/spikes")) {
  try {
    const name = readdirSync(dir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}-u17-load\.json$/.test(f))
      .sort()
      .at(-1);
    if (!name) return null;
    const run = JSON.parse(readFileSync(resolve(dir, name), "utf8")) as Record<string, unknown>;
    const pick = [
      "at",
      "network",
      "label",
      "node",
      "remoras",
      "steps",
      "paidCalls",
      "paidUsdc",
      "allPaid",
      "mustFail",
      "overspends",
      "sponsorMistPerPayment",
    ];
    return Object.fromEntries(pick.filter((k) => k in run).map((k) => [k, run[k]]));
  } catch {
    return null;
  }
}
