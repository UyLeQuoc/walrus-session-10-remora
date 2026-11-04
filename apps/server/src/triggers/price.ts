/**
 * D1 price trigger (ADR-0121): which side of its thresholds a price is on, with hysteresis. It fires
 * once when the price crosses a threshold, and can fire again only after the price has come back past
 * that threshold by `BAND`, so a price wobbling around it wakes the remora once, not every poll. The
 * first reading only records the side: adding a trigger never wakes a remora on its own.
 */
export type Side = "above" | "below" | "inside";

export interface Thresholds {
  above?: number;
  below?: number;
}

/** How far back past a threshold the price must come before the trigger can fire again. */
export const BAND = 0.01;

/** What the poll keeps per trigger, in the remora's config. */
export interface PriceState {
  side: Side;
  usd: number;
  at: string;
}

export function sideOf(t: Thresholds, usd: number, previous: Side | null): Side {
  if (
    t.above !== undefined &&
    (usd > t.above || (previous === "above" && usd > t.above * (1 - BAND)))
  )
    return "above";
  if (
    t.below !== undefined &&
    (usd < t.below || (previous === "below" && usd < t.below * (1 + BAND)))
  )
    return "below";
  return "inside";
}

/** The new side, and which threshold this reading crossed (null: no wake). */
export function crossing(
  t: Thresholds,
  previous: Side | null,
  usd: number,
): { side: Side; fired: "above" | "below" | null } {
  const side = sideOf(t, usd, previous);
  const fired = previous !== null && side !== previous && side !== "inside" ? side : null;
  return { side, fired };
}

/** A sentence for an invalid pair of thresholds, or null when they're usable. */
export function thresholdProblem(t: Thresholds): string | null {
  const ok = (n: number | undefined) => n === undefined || (Number.isFinite(n) && n > 0);
  if (t.above === undefined && t.below === undefined) return "Set a price above or below.";
  if (!ok(t.above) || !ok(t.below)) return "A threshold is a price in USD above zero.";
  if (t.above !== undefined && t.below !== undefined && t.above <= t.below)
    return "The upper threshold must be higher than the lower one.";
  return null;
}

/** The question a crossing asks the remora: the price is data the server read, unpaid. */
export function priceQuestion(o: {
  symbol: string;
  fired: "above" | "below";
  threshold: number;
  usd: number;
  pricedAt: string;
}): string {
  const at = o.pricedAt.slice(11, 16);
  return `${o.symbol} went ${o.fired} ${o.threshold}: it's ${o.usd} now (CoinGecko, ${at} UTC). Tell me briefly what that means for me.`;
}
