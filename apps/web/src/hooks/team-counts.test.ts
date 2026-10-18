import { describe, expect, it } from "vitest";
import { membersLabel, sharedCounts } from "./team-counts";

describe("membersLabel", () => {
  it("says member for one and members for any other count", () => {
    expect(membersLabel(1)).toBe("1 member");
    expect(membersLabel(0)).toBe("0 members");
    expect(membersLabel(12)).toBe("12 members");
  });
});

describe("sharedCounts", () => {
  it("counts every shared memory and the ones this person added", () => {
    expect(sharedCounts([{ mine: true }, { mine: false }, { mine: true }])).toEqual({
      shared: 3,
      mine: 2,
    });
  });

  it("counts nothing in an empty team", () => {
    expect(sharedCounts([])).toEqual({ shared: 0, mine: 0 });
  });
});
