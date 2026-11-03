/**
 * E9 `odds`: a paid read of a cached sports-odds snapshot (spec §12.5). The snapshot ships with the
 * merchant and says so in every answer: it is demo data, not a live feed.
 */
import { type PaidContext, type X402Options, x402 } from "@remora/merchant";
import { Hono } from "hono";

export interface Fixture {
  league: string;
  home: string;
  away: string;
  kickoff: string;
  /** Decimal odds: home win, draw, away win. */
  odds: { home: number; draw: number; away: number };
}

/**
 * The demo's fixtures, dated from the request so the snapshot never goes stale: `day` 0 is the next
 * evening (UTC), so "tonight's match" always finds one, and `at` is the kickoff in UTC.
 */
const FIXTURES: Array<Omit<Fixture, "kickoff"> & { day: number; at: string }> = [
  {
    league: "Premier League",
    home: "Arsenal",
    away: "Chelsea",
    day: 0,
    at: "19:00",
    odds: { home: 1.95, draw: 3.6, away: 3.9 },
  },
  {
    league: "Premier League",
    home: "Liverpool",
    away: "Manchester City",
    day: 0,
    at: "21:00",
    odds: { home: 2.4, draw: 3.5, away: 2.8 },
  },
  {
    league: "La Liga",
    home: "Real Madrid",
    away: "Barcelona",
    day: 1,
    at: "20:00",
    odds: { home: 2.2, draw: 3.7, away: 3.1 },
  },
  {
    league: "Serie A",
    home: "Inter",
    away: "Juventus",
    day: 1,
    at: "19:45",
    odds: { home: 2.0, draw: 3.3, away: 3.9 },
  },
  {
    league: "NBA",
    home: "Lakers",
    away: "Celtics",
    day: 2,
    at: "00:30",
    odds: { home: 2.1, draw: 0, away: 1.75 },
  },
];

const HOUR = 3_600_000;

/** The snapshot as of `now`. The first evening is today's, or tomorrow's once it's past 18:30 UTC. */
export function snapshot(now = Date.now()) {
  const evening = new Date(now);
  evening.setUTCHours(0, 0, 0, 0);
  if (now > evening.getTime() + 18.5 * HOUR) evening.setUTCDate(evening.getUTCDate() + 1);
  return {
    now: new Date(now).toISOString(),
    takenAt: new Date(now - 10 * 60_000).toISOString(),
    note: "Demo snapshot for Remora: sample prices, not live odds. Kickoff times are UTC.",
    fixtures: FIXTURES.map(({ day, at, ...f }) => {
      const [h = 0, m = 0] = at.split(":").map(Number);
      const kickoff = evening.getTime() + (day * 24 + h + m / 60) * HOUR;
      return { ...f, kickoff: new Date(kickoff).toISOString() };
    }) satisfies Fixture[],
  };
}

const words = (s: string) => s.toLowerCase().match(/[a-z]{3,}/g) ?? [];

/** Fixtures that name a team in the query; all of them when nothing matches. */
export function oddsFor(query: string, fixtures: Fixture[] = snapshot().fixtures): Fixture[] {
  const q = new Set(words(query));
  const hit = fixtures.filter((f) => [...words(f.home), ...words(f.away)].some((w) => q.has(w)));
  return hit.length ? hit : fixtures;
}

export function createOddsApp(o: { pay: X402Options }) {
  const app = new Hono<{ Variables: { x402: PaidContext } }>();
  app.get("/odds", x402(o.pay), (c) => {
    const { fixtures, ...about } = snapshot();
    return c.json({
      ...about,
      fixtures: oddsFor(c.req.query("q") ?? "", fixtures),
      paid: c.get("x402"),
    });
  });
  return app;
}
