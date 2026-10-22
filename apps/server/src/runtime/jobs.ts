/**
 * D2: durable jobs on Postgres. Enqueue is idempotent (unique `idempotency_key`), claim uses
 * `FOR UPDATE SKIP LOCKED` so several workers never take the same job, failures back off
 * exponentially, and a job that runs out of attempts is dead (the dead-letter state).
 */

import type { Logger } from "@remora/chain";
import { withLogContext } from "@remora/chain";
import { type Db, eq, jobs, sql } from "@remora/db";

export type Job = typeof jobs.$inferSelect;
export type JobHandler = (payload: unknown, job: Job) => Promise<void>;

export interface EnqueueOptions {
  kind: string;
  payload: unknown;
  /** Same key, same job: a second enqueue is a no-op. */
  idempotencyKey: string;
  runAt?: Date;
  maxAttempts?: number;
}

export async function enqueue(
  db: Db,
  o: EnqueueOptions,
): Promise<{ id: string; created: boolean }> {
  const inserted = await db
    .insert(jobs)
    .values({
      kind: o.kind,
      payload: o.payload,
      idempotencyKey: o.idempotencyKey,
      ...(o.runAt ? { runAt: o.runAt } : {}),
      ...(o.maxAttempts ? { maxAttempts: o.maxAttempts } : {}),
    })
    .onConflictDoNothing({ target: jobs.idempotencyKey })
    .returning({ id: jobs.id });
  if (inserted[0]) return { id: inserted[0].id, created: true };
  const [existing] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.idempotencyKey, o.idempotencyKey));
  if (!existing) throw new Error(`enqueue raced on ${o.idempotencyKey}`);
  return { id: existing.id, created: false };
}

/** Takes the next due job of these kinds, or null. Bumps `attempts` as it claims. */
export async function claim(db: Db, kinds: string[]): Promise<Job | null> {
  if (!kinds.length) return null;
  const rows = await db.execute<Job>(sql`
    update ${jobs} set status = 'running', locked_at = now(), attempts = ${jobs.attempts} + 1, updated_at = now()
    where ${jobs.id} = (
      select ${jobs.id} from ${jobs}
      where ${jobs.status} = 'queued' and ${jobs.runAt} <= now()
        and ${jobs.kind} in (${sql.join(
          kinds.map((k) => sql`${k}`),
          sql`, `,
        )})
      order by ${jobs.runAt}
      for update skip locked
      limit 1
    )
    returning id`);
  const id = (rows as unknown as { id: string }[])[0]?.id;
  if (!id) return null;
  // Re-read through the query builder so timestamps come back as Dates.
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  return job ?? null;
}

export async function complete(db: Db, id: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status: "done", lockedAt: null, updatedAt: new Date() })
    .where(eq(jobs.id, id));
}

/** Backoff after the n-th failed attempt: 1 s, 2 s, 4 s … capped at 10 min. */
export function backoffMs(attempts: number, baseMs = 1_000, capMs = 600_000): number {
  return Math.min(capMs, baseMs * 2 ** Math.max(0, attempts - 1));
}

export async function fail(
  db: Db,
  job: Job,
  err: unknown,
  now = new Date(),
): Promise<"retry" | "dead"> {
  const message = err instanceof Error ? err.message : String(err);
  const dead = job.attempts >= job.maxAttempts;
  await db
    .update(jobs)
    .set({
      status: dead ? "dead" : "queued",
      lockedAt: null,
      lastError: message.slice(0, 2_000),
      runAt: dead ? job.runAt : new Date(now.getTime() + backoffMs(job.attempts)),
      updatedAt: now,
    })
    .where(eq(jobs.id, job.id));
  return dead ? "dead" : "retry";
}

/** Puts `running` jobs whose worker died back in the queue. */
export async function recoverStale(db: Db, olderThanMs = 5 * 60_000): Promise<number> {
  const rows = await db.execute(sql`
    update ${jobs} set status = 'queued', locked_at = null, updated_at = now()
    where ${jobs.status} = 'running' and ${jobs.lockedAt} < now() - (${olderThanMs} * interval '1 millisecond')
    returning id`);
  return (rows as unknown as unknown[]).length;
}

/** Runs one due job if there is one. Returns what happened, for tests and the worker loop. */
export async function runOnce(
  db: Db,
  handlers: Record<string, JobHandler>,
  log?: Logger,
): Promise<"idle" | "done" | "retry" | "dead"> {
  const job = await claim(db, Object.keys(handlers));
  if (!job) return "idle";
  const handler = handlers[job.kind];
  try {
    if (!handler) throw new Error(`no handler for ${job.kind}`);
    // K1 (ADR-0052): every log line the job writes carries its id.
    await withLogContext({ jobId: job.id, job: job.kind }, () => handler(job.payload, job));
    await complete(db, job.id);
    log?.info("job.done", { kind: job.kind, job: job.id, attempts: job.attempts });
    return "done";
  } catch (err) {
    const outcome = await fail(db, job, err);
    log?.[outcome === "dead" ? "error" : "warn"](`job.${outcome}`, {
      kind: job.kind,
      job: job.id,
      attempts: job.attempts,
      error: err,
    });
    return outcome;
  }
}

/** The worker loop. Returns a stop function that resolves once the current job finishes. */
export function startWorker(
  db: Db,
  handlers: Record<string, JobHandler>,
  opts: { pollMs?: number; log?: Logger } = {},
): () => Promise<void> {
  let stopped = false;
  const loop = (async () => {
    await recoverStale(db).catch(() => 0);
    while (!stopped) {
      const outcome = await runOnce(db, handlers, opts.log).catch((err) => {
        opts.log?.error("job.loop", { error: err });
        return "idle" as const;
      });
      if (outcome === "idle") await new Promise((r) => setTimeout(r, opts.pollMs ?? 1_000));
    }
  })();
  return async () => {
    stopped = true;
    await loop;
  };
}
