import { describe, expect, it } from "vitest";
import { BAND, crossing, priceQuestion, type Side, thresholdProblem } from "./price.ts";

/** Feeds readings through `crossing` the way the poll does, and returns which ones fired. */
function run(t: { above?: number; below?: number }, readings: number[]) {
  let side: Side | null = null;
  return readings.map((usd) => {
    const c = crossing(t, side, usd);
    side = c.side;
    return c.fired;
  });
}

describe("price trigger crossings (ADR-0121)", () => {
  it("the first reading only records the side, even past the threshold", () => {
    expect(run({ below: 0.85 }, [0.8])).toEqual([null]);
    expect(run({ above: 3 }, [3.5])).toEqual([null]);
  });

  it("fires once per crossing, not on every poll below", () => {
    expect(run({ below: 0.85 }, [0.93, 0.84, 0.83, 0.8, 0.84])).toEqual([
      null,
      "below",
      null,
      null,
      null,
    ]);
  });

  it("a wobble around the threshold doesn't re-arm it; coming back past the band does", () => {
    const back = 0.85 * (1 + BAND);
    expect(run({ below: 0.85 }, [0.9, 0.84, 0.851, 0.849, back + 0.001, 0.84])).toEqual([
      null,
      "below",
      null,
      null,
      null,
      "below",
    ]);
  });

  it("an upper threshold works the same way, with its band below it", () => {
    expect(run({ above: 3 }, [2.9, 3.01, 2.99, 3.02, 2.9, 3.1])).toEqual([
      null,
      "above",
      null,
      null,
      null,
      "above",
    ]);
  });

  it("with both thresholds, a crash from above straight through the lower one fires below", () => {
    expect(run({ above: 1.2, below: 0.8 }, [1, 1.3, 0.7])).toEqual([null, "above", "below"]);
  });

  it("refuses thresholds it can't use", () => {
    expect(thresholdProblem({})).toBe("Set a price above or below.");
    expect(thresholdProblem({ below: 0 })).toBe("A threshold is a price in USD above zero.");
    expect(thresholdProblem({ above: Number.NaN })).toBe(
      "A threshold is a price in USD above zero.",
    );
    expect(thresholdProblem({ above: 1, below: 2 })).toBe(
      "The upper threshold must be higher than the lower one.",
    );
    expect(thresholdProblem({ above: 2, below: 1 })).toBeNull();
  });

  it("asks with the price as data it read, and the time CoinGecko priced it", () => {
    expect(
      priceQuestion({
        symbol: "SUI",
        fired: "below",
        threshold: 0.85,
        usd: 0.84,
        pricedAt: "2026-11-05T12:05:30.000Z",
      }),
    ).toBe(
      "SUI went below 0.85: it's 0.84 now (CoinGecko, 12:05 UTC). Tell me briefly what that means for me.",
    );
  });
});
