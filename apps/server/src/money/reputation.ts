/**
 * E10 (ADR-0127): Reef reputation from real outcomes. For each service, over the last 7 days and only
 * from remoras whose owners share counts (`config.share.stats`):
 * - paid calls, and the owners behind them;
 * - how many were refused after the 402 (the merchant didn't settle);
 * - thumbs up and down on answers that used it;
 * - the median time from the 402 to the settled response.
 *
 * Counts only: never a question, an answer or an amount per owner. Under 3 owners and 20 calls a
 * service is "new". The planner skips a service under 40% useful after 20 rated calls, and says so.
 */
import type { Logger, SuiNetwork } from "@remora/chain";
import { type Db, sql } from "@remora/db";

export const REPUTATION_DAYS = 7;
/** Enough to say something: this many owners, or this many paid calls. */
export const SCORED_AT = { owners: 3, calls: 20 } as const;
/** The planner's floor: under this share of useful answers, after this many rated calls. */
export const SKIP_UNDER = { usefulPct: 40, rated: 20 } as const;

export interface ReefScore {
  ref: string;
  calls: number;
  owners: number;
  failed: number;
  useful: number;
  noise: number;
  medianMs: number | null;
  /** Of the calls that reached a 402, the share that settled. */
  settledPct: number | null;
  /** Of the rated answers that used it, the share marked useful. */
  usefulPct: number | null;
  status: "new" | "scored";
  days: number;
}

export interface ScoreRow {
  ref: string;
  calls: number;
  owners: number;
  failed: number;
  useful: number;
  noise: number;
  medianMs: number | null;
}

const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part * 100) / whole) : null);

export function scoreOf(r: ScoreRow): ReefScore {
  return {
    ...r,
    settledPct: pct(r.calls, r.calls + r.failed),
    usefulPct: pct(r.useful, r.useful + r.noise),
    status: r.owners >= SCORED_AT.owners || r.calls >= SCORED_AT.calls ? "scored" : "new",
    days: REPUTATION_DAYS,
  };
}

/** Why the planner won't buy it, or null. */
export function skipReason(s: ReefScore | undefined, label: string): string | null {
  if (!s || s.usefulPct === null || s.useful + s.noise < SKIP_UNDER.rated) return null;
  if (s.usefulPct >= SKIP_UNDER.usefulPct) return null;
  return `skipped ${label}: ${s.usefulPct}% useful over ${s.useful + s.noise} rated answers from ${s.owners} owner${s.owners === 1 ? "" : "s"} (last ${s.days} days)`;
}

/** "92% useful · 214 paid calls · 6 owners · last 7 days", or "new". */
export function scoreLine(s: ReefScore | undefined): string {
  if (!s || s.status === "new") return "new";
  const parts = [
    ...(s.usefulPct !== null ? [`${s.usefulPct}% useful`] : []),
    `${s.calls} paid call${s.calls === 1 ? "" : "s"}`,
    `${s.owners} owner${s.owners === 1 ? "" : "s"}`,
    `last ${s.days} days`,
  ];
  return parts.join(" · ");
}

/** The 7-day counts per payee ref, from shared remoras only. */
export async function readScores(db: Db, network: SuiNetwork, now = new Date()) {
  const since = new Date(now.getTime() - REPUTATION_DAYS * 86_400_000);
  const shared = sql`r.config->'share'->>'stats' = 'true'`;
  const paid = await db.execute<{ ref: string; calls: string; owners: string; median: string }>(sql`
    select e.payload->>'payee' as ref, count(*) as calls, count(distinct r.owner_address) as owners,
      percentile_cont(0.5) within group (order by (e.payload->>'ms')::numeric) as median
    from remora_events e join remoras r on r.id = e.remora_id
    where e.type = 'payment' and e.network = ${network} and e.created_at > ${since.toISOString()}::timestamptz
      and e.payload->>'approvedBy' is null and e.payload->>'payee' like 'reef:%' and ${shared}
    group by 1`);
  const failed = await db.execute<{ ref: string; n: string }>(sql`
    select e.payload->>'payee' as ref, count(*) as n
    from remora_events e join remoras r on r.id = e.remora_id
    where e.type = 'blocked' and e.network = ${network} and e.created_at > ${since.toISOString()}::timestamptz
      and e.payload->>'code' = 'x402.unsettled' and e.payload->>'payee' like 'reef:%' and ${shared}
    group by 1`);
  const rated = await db.execute<{ ref: string; useful: string; noise: string }>(sql`
    select p.ref, count(*) filter (where e.feedback = 'useful') as useful,
      count(*) filter (where e.feedback = 'noise') as noise
    from remora_events e join remoras r on r.id = e.remora_id,
      jsonb_array_elements_text(coalesce(e.payload->'paidPayees', '[]'::jsonb)) as p(ref)
    where e.type = 'answer' and e.network = ${network} and e.created_at > ${since.toISOString()}::timestamptz
      and e.feedback is not null and ${shared}
    group by 1`);
  const rows = new Map<string, ScoreRow>();
  const row = (ref: string) => {
    let x = rows.get(ref);
    if (!x) {
      x = { ref, calls: 0, owners: 0, failed: 0, useful: 0, noise: 0, medianMs: null };
      rows.set(ref, x);
    }
    return x;
  };
  for (const p of paid) {
    const x = row(p.ref);
    x.calls = Number(p.calls);
    x.owners = Number(p.owners);
    x.medianMs = p.median === null ? null : Math.round(Number(p.median));
  }
  for (const f of failed) row(f.ref).failed = Number(f.n);
  for (const r of rated) {
    const x = row(r.ref);
    x.useful = Number(r.useful);
    x.noise = Number(r.noise);
  }
  return new Map([...rows].map(([k, v]) => [k, scoreOf(v)]));
}

export interface Reputation {
  scores(network: SuiNetwork): Map<string, ReefScore>;
  refresh(): Promise<void>;
  start(ms?: number): () => void;
}

/** Scores kept in memory and refreshed every few minutes; a failed read keeps the last ones. */
export function createReputation(o: { db: Db; log: Logger; networks: SuiNetwork[] }): Reputation {
  const cache = new Map<SuiNetwork, Map<string, ReefScore>>();
  const refresh = async () => {
    for (const n of o.networks) {
      try {
        cache.set(n, await readScores(o.db, n));
      } catch (err) {
        o.log.warn("reputation.refresh_failed", { network: n, error: err });
      }
    }
  };
  return {
    scores: (n) => cache.get(n) ?? new Map(),
    refresh,
    start(ms = 5 * 60_000) {
      void refresh();
      const t = setInterval(() => void refresh(), ms);
      t.unref?.();
      return () => clearInterval(t);
    },
  };
}
