/**
 * I4 rate limits per remora (sliding windows, in memory; the per-person chat limits stay in
 * chat/ratelimit.ts) and D9 caps: a daily token budget per remora, counted in Postgres.
 */
import { and, type Db, eq, remoraUsage, sql } from "@remora/db";

export interface Window {
  limit: number;
  ms: number;
}

export class SlidingLimiter {
  readonly #hits = new Map<string, number[]>();
  constructor(private readonly now: () => number = Date.now) {}

  /** Records a hit and says whether it was allowed. */
  take(key: string, w: Window): { allowed: boolean; retryAfterMs: number } {
    const t = this.now();
    const hits = (this.#hits.get(key) ?? []).filter((h) => t - h < w.ms);
    if (hits.length >= w.limit) {
      this.#hits.set(key, hits);
      return { allowed: false, retryAfterMs: w.ms - (t - (hits[0] ?? t)) };
    }
    hits.push(t);
    this.#hits.set(key, hits);
    return { allowed: true, retryAfterMs: 0 };
  }
}

export const REMORA_LIMITS = {
  turns: { limit: 20, ms: 60_000 },
  payments: { limit: 30, ms: 3_600_000 },
} as const;

const day = (d: Date) => d.toISOString().slice(0, 10);

export async function tokensToday(db: Db, remoraId: string, now = new Date()): Promise<number> {
  const [row] = await db
    .select({ tokens: remoraUsage.tokens })
    .from(remoraUsage)
    .where(and(eq(remoraUsage.remoraId, remoraId), eq(remoraUsage.day, day(now))));
  return row?.tokens ?? 0;
}

export async function addUsage(
  db: Db,
  remoraId: string,
  tokens: number,
  now = new Date(),
): Promise<void> {
  await db
    .insert(remoraUsage)
    .values({ remoraId, day: day(now), tokens, calls: 1 })
    .onConflictDoUpdate({
      target: [remoraUsage.remoraId, remoraUsage.day],
      set: { tokens: sql`${remoraUsage.tokens} + ${tokens}`, calls: sql`${remoraUsage.calls} + 1` },
    });
}
