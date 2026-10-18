import { createDb, eq, jobs, sql } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { backoffMs, claim, enqueue, fail, runOnce } from "./jobs.ts";

describe("backoff", () => {
  it("doubles from 1 s and caps at 10 min", () => {
    expect([1, 2, 3, 4].map((n) => backoffMs(n))).toEqual([1_000, 2_000, 4_000, 8_000]);
    expect(backoffMs(30)).toBe(600_000);
  });
});

// Runs against local Docker Postgres (docker-compose.yml); skipped where there's no database (CI).
loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("job queue on Postgres (D2)", () => {
  const db = createDb(local as string);
  const kind = `test.${process.pid}`;

  beforeEach(async () => {
    await db.delete(jobs).where(eq(jobs.kind, kind));
  });
  afterAll(async () => {
    await db.delete(jobs).where(eq(jobs.kind, kind));
  });

  it("dedupes enqueues by idempotency key", async () => {
    const a = await enqueue(db, { kind, payload: { n: 1 }, idempotencyKey: `${kind}:a` });
    const b = await enqueue(db, { kind, payload: { n: 2 }, idempotencyKey: `${kind}:a` });
    expect(a.created).toBe(true);
    expect(b).toEqual({ id: a.id, created: false });
  });

  it("never hands the same job to two claimers", async () => {
    await enqueue(db, { kind, payload: {}, idempotencyKey: `${kind}:one` });
    const [x, y] = await Promise.all([claim(db, [kind]), claim(db, [kind])]);
    expect([x, y].filter(Boolean)).toHaveLength(1);
  });

  it("runs a handler and marks the job done", async () => {
    const seen: unknown[] = [];
    await enqueue(db, { kind, payload: { hi: 1 }, idempotencyKey: `${kind}:run` });
    expect(await runOnce(db, { [kind]: async (p) => void seen.push(p) })).toBe("done");
    expect(seen).toEqual([{ hi: 1 }]);
    const [row] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.idempotencyKey, `${kind}:run`));
    expect(row?.status).toBe("done");
    expect(await runOnce(db, { [kind]: async () => {} })).toBe("idle");
  });

  it("backs off on failure, then dead-letters after max attempts", async () => {
    await enqueue(db, { kind, payload: {}, idempotencyKey: `${kind}:flaky`, maxAttempts: 2 });
    const boom = async () => {
      throw new Error("tatum down");
    };
    expect(await runOnce(db, { [kind]: boom })).toBe("retry");
    let [row] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.idempotencyKey, `${kind}:flaky`));
    expect(row?.status).toBe("queued");
    expect(row?.lastError).toBe("tatum down");
    expect((row?.runAt.getTime() ?? 0) - Date.now()).toBeGreaterThan(500);

    // Make it due again, fail once more: out of attempts.
    await db.execute(
      sql`update ${jobs} set run_at = now() where idempotency_key = ${`${kind}:flaky`}`,
    );
    expect(await runOnce(db, { [kind]: boom })).toBe("dead");
    [row] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.idempotencyKey, `${kind}:flaky`));
    expect(row?.status).toBe("dead");
    expect(row?.attempts).toBe(2);
  });

  it("fail() reports retry vs dead from the attempt count", async () => {
    await enqueue(db, { kind, payload: {}, idempotencyKey: `${kind}:f`, maxAttempts: 1 });
    const job = await claim(db, [kind]);
    if (!job) throw new Error("no job");
    expect(await fail(db, job, new Error("x"))).toBe("dead");
  });
});
