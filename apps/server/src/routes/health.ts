/**
 * Health, with enough detail to answer "is it us or them?".
 *
 * During the real-use week a user saying "it's broken" needs a one-URL answer:
 * hippo is up but the relayer is refusing, or the database is unreachable, or
 * everything is fine and the problem is elsewhere. A health check that only
 * says `ok: true` cannot tell anyone that, and hippo depends on two services it
 * does not control.
 *
 * Returns 200 while hippo itself can serve, even when a dependency is down, so
 * Railway does not restart a container that is working. `status` carries the
 * real answer: `ok`, or `degraded` with which dependency is at fault.
 */
import { sql } from "@remora/db";
import { Hono } from "hono";
import { db } from "../context.ts";
import { env } from "../env/load.ts";

interface Probe {
  ok: boolean;
  ms: number;
  detail?: string;
}

async function timed(fn: () => Promise<unknown>): Promise<Probe> {
  const started = Date.now();
  try {
    await fn();
    return { ok: true, ms: Date.now() - started };
  } catch (e) {
    return {
      ok: false,
      ms: Date.now() - started,
      detail: e instanceof Error ? e.message.slice(0, 120) : String(e).slice(0, 120),
    };
  }
}

export const healthRoutes = new Hono()
  /** Cheap, for the platform's health check. */
  .get("/api/health", (c) =>
    c.json({ ok: true, model: env.LLM_MODEL, relayer: env.MEMWAL_SERVER_URL }),
  )

  /** Fuller, for a human deciding where a problem is. */
  .get("/api/health/deep", async (c) => {
    const [database, relayer] = await Promise.all([
      timed(() => db.execute(sql`select 1`)),
      timed(async () => {
        const res = await fetch(`${env.MEMWAL_SERVER_URL}/health`, {
          signal: AbortSignal.timeout(8_000),
        });
        if (!res.ok) throw new Error(`relayer /health returned ${res.status}`);
      }),
    ]);

    const failing = [database.ok ? null : "database", relayer.ok ? null : "relayer"].filter(
      (x): x is string => x !== null,
    );

    return c.json({
      status: failing.length === 0 ? "ok" : "degraded",
      failing,
      checks: { database, relayer },
      model: env.LLM_MODEL,
      channels: {
        telegram: Boolean(env.TELEGRAM_BOT_TOKEN),
        discord: Boolean(env.DISCORD_TOKEN),
        slack: Boolean(env.SLACK_BOT_TOKEN),
      },
      network: env.SUI_NETWORK,
      // Handy when a deploy looks like it did not take.
      startedAt: STARTED_AT,
    });
  });

const STARTED_AT = new Date().toISOString();
