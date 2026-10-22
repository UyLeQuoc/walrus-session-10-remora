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
    const { playgroundDeps } = await import("../playground/index.ts");
    const report = await liveHealth(
      playgroundDeps.funder ? () => playgroundDeps.balances() : undefined,
    );
    return c.json({ ...report, startedAt: STARTED_AT, model: env.LLM_MODEL });
  });

const STARTED_AT = new Date().toISOString();
