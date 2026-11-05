/**
 * A4 (ADR-0146): up to 20 lines in one `remember_bulk` call, with a caller's idempotency key, then a
 * background settle per line. Like `rememberWithDedupe`, the caller gets job ids at once and the blob
 * ids later; a line whose job failed is resubmitted once on its own (the relayer's Seal step gets
 * throttled, docs/tech-reference.md §1.11). There is no semantic dedupe here: the owner ticked each
 * line, and the idempotency key makes a retried call land on the same jobs.
 */
import type { MemWal } from "@mysten-incubation/memwal";
import { type RateLimiter, runLimited } from "./limiter.ts";
import type { SettledWrite } from "./policy.ts";

/** The relayer's cap per bulk request (the SDK checks it too). */
export const BULK_MAX = 20;

export interface BulkAccepted {
  jobIds: string[];
  /** One per text, in order. Never rejects. */
  settled: Promise<SettledWrite[]>;
}

export async function rememberBulkAccepted(
  client: MemWal,
  opts: {
    texts: string[];
    namespace: string;
    idempotencyKey: string;
    limiter?: RateLimiter;
    timeoutMs?: number;
  },
): Promise<BulkAccepted> {
  const { texts, namespace, idempotencyKey, limiter, timeoutMs = 180_000 } = opts;
  if (!texts.length) throw new Error("rememberBulk needs at least one line");
  if (texts.length > BULK_MAX)
    throw new Error(`rememberBulk takes at most ${BULK_MAX} lines a call (got ${texts.length})`);
  const run = <T>(fn: () => Promise<T>) => (limiter ? runLimited(limiter, fn) : fn());
  const accepted = await run(() =>
    client.rememberBulk(
      texts.map((text) => ({ text, namespace })),
      { idempotencyKey },
    ),
  );
  const jobIds = accepted.job_ids;
  if (jobIds.length !== texts.length)
    throw new Error(`rememberBulk returned ${jobIds.length} jobs for ${texts.length} lines`);

  const once = async (text: string, i: number): Promise<SettledWrite> => {
    try {
      const again = await run(() =>
        client.remember(text, namespace, { idempotencyKey: `${idempotencyKey}-r${i}` }),
      );
      const done = await run(() =>
        client.waitForRememberJob(again.job_id, { timeoutMs, pollIntervalMs: 2_000 }),
      );
      return done.blob_id
        ? { status: "stored", blobId: done.blob_id, attempts: 2 }
        : { status: "failed", blobId: null, error: "job completed without a blob id", attempts: 2 };
    } catch (err) {
      return {
        status: "failed",
        blobId: null,
        error: err instanceof Error ? err.message : String(err),
        attempts: 2,
      };
    }
  };

  const settled = (async (): Promise<SettledWrite[]> => {
    let results: { status: string; blob_id: string; error?: string }[];
    try {
      results = (
        await run(() =>
          client.waitForRememberJobs(
            jobIds,
            jobIds.map(() => namespace),
            { timeoutMs, pollIntervalMs: 2_000 },
          ),
        )
      ).results;
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      results = jobIds.map(() => ({ status: "failed", blob_id: "", error }));
    }
    const out: SettledWrite[] = [];
    for (let i = 0; i < texts.length; i++) {
      const res = results[i];
      if (res?.status === "done" && res.blob_id) {
        out.push({ status: "stored", blobId: res.blob_id, attempts: 1 });
        continue;
      }
      out.push(await once(texts[i] as string, i));
    }
    return out;
  })();
  settled.catch(() => {});
  return { jobIds, settled };
}
