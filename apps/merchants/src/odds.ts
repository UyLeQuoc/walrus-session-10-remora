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

export const SNAPSHOT = {
  takenAt: "2026-10-18T12:00:00Z",
  note: "Demo snapshot for Remora; not live odds.",
  fixtures: [
    {
      league: "Premier League",
      home: "Arsenal",
      away: "Chelsea",
      kickoff: "2026-10-24T16:30:00Z",
      odds: { home: 1.95, draw: 3.6, away: 3.9 },
    },
    {
      league: "Premier League",
      home: "Liverpool",
      away: "Manchester City",
      kickoff: "2026-10-25T15:30:00Z",
      odds: { home: 2.4, draw: 3.5, away: 2.8 },
    },
    {
      league: "La Liga",
      home: "Real Madrid",
      away: "Barcelona",
      kickoff: "2026-10-25T19:00:00Z",
      odds: { home: 2.2, draw: 3.7, away: 3.1 },
    },
    {
      league: "Serie A",
      home: "Inter",
      away: "Juventus",
      kickoff: "2026-10-26T19:45:00Z",
      odds: { home: 2.0, draw: 3.3, away: 3.9 },
    },
    {
      league: "NBA",
      home: "Lakers",
      away: "Celtics",
      kickoff: "2026-10-27T02:30:00Z",
      odds: { home: 2.1, draw: 0, away: 1.75 },
    },
  ] satisfies Fixture[],
};

const words = (s: string) => s.toLowerCase().match(/[a-z]{3,}/g) ?? [];

/** Fixtures that name a team in the query; all of them when nothing matches. */
export function oddsFor(query: string, fixtures: Fixture[] = SNAPSHOT.fixtures): Fixture[] {
  const q = new Set(words(query));
  const hit = fixtures.filter((f) => [...words(f.home), ...words(f.away)].some((w) => q.has(w)));
  return hit.length ? hit : fixtures;
}

export function createOddsApp(o: { pay: X402Options }) {
  const app = new Hono<{ Variables: { x402: PaidContext } }>();
  app.get("/odds", x402(o.pay), (c) =>
    c.json({
      takenAt: SNAPSHOT.takenAt,
      note: SNAPSHOT.note,
      fixtures: oddsFor(c.req.query("q") ?? ""),
      paid: c.get("x402"),
    }),
  );
  return app;
}
