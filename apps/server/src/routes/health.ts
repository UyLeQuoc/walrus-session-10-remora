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
import { Hono } from "hono";
import { env } from "../env/load.ts";
import { liveHealth } from "../ops/index.ts";

export const healthRoutes = new Hono()
  /** Cheap, for the platform's health check. */
  .get("/api/health", (c) =>
    c.json({ ok: true, model: env.LLM_MODEL, relayer: env.MEMWAL_SERVER_URL }),
  )

  /**
   * K2 (ADR-0052): the full report, for a human deciding where a problem is and for `/lab/health`.
   * It names no address, key or id, and never spends the relayer budget.
   */
  .get("/api/health/deep", async (c) => {
    return c.json({ ...(await deepReport()), startedAt: STARTED_AT, model: env.LLM_MODEL });
  });

const STARTED_AT = new Date().toISOString();

/**
 * One report per 30 s, shared by every caller. Each report costs several Tatum calls per network,
 * and the public status page polls it for every open tab (ADR-0058).
 */
const REPORT_TTL_MS = 30_000;
let cached: { at: number; report: Promise<Awaited<ReturnType<typeof liveHealth>>> } | null = null;

function deepReport() {
  if (cached && Date.now() - cached.at < REPORT_TTL_MS) return cached.report;
  const report = (async () => {
    const { playgroundDeps } = await import("../playground/index.ts");
    return liveHealth(playgroundDeps.funder ? () => playgroundDeps.balances() : undefined);
  })();
  cached = { at: Date.now(), report };
  // A failed report isn't kept.
  report.catch(() => {
    if (cached?.report === report) cached = null;
  });
  return report;
}
