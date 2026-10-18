import { describe, expect, it } from "vitest";
import { GETTING_TO_KNOW, isGettingToKnow } from "./getting-to-know.ts";

describe("isGettingToKnow", () => {
  it("asks while hippo knows little about a new person", () => {
    expect(isGettingToKnow({ facts: 0, turns: 0 })).toBe(true);
    expect(isGettingToKnow({ facts: GETTING_TO_KNOW.facts - 1, turns: 2 })).toBe(true);
  });

  it("stops once it knows a few things, or after a few turns the person did not answer", () => {
    expect(isGettingToKnow({ facts: GETTING_TO_KNOW.facts, turns: 1 })).toBe(false);
    expect(isGettingToKnow({ facts: 0, turns: GETTING_TO_KNOW.turns })).toBe(false);
  });
});
