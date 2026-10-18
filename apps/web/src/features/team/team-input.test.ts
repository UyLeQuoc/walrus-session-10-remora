import { describe, expect, it } from "vitest";
import { factLength, isTeamFact, isTeamName } from "./team-input";

describe("isTeamName", () => {
  it("takes 2 to 48 characters once trimmed", () => {
    expect(isTeamName("QA")).toBe(true);
    expect(isTeamName("x".repeat(48))).toBe(true);
    expect(isTeamName("  Platform  ")).toBe(true);
  });

  it("refuses a name too short or too long", () => {
    expect(isTeamName("Q")).toBe(false);
    expect(isTeamName("  Q  ")).toBe(false);
    expect(isTeamName("x".repeat(49))).toBe(false);
  });
});

describe("isTeamFact", () => {
  it("takes 3 to 1000 characters once trimmed", () => {
    expect(isTeamFact("abc")).toBe(true);
    expect(isTeamFact("x".repeat(1000))).toBe(true);
  });

  it("refuses a fact too short or too long", () => {
    expect(isTeamFact(" ab ")).toBe(false);
    expect(isTeamFact("x".repeat(1001))).toBe(false);
  });
});

describe("factLength", () => {
  it("counts what will be sent, without the surrounding spaces", () => {
    expect(factLength("  deploys freeze on Friday \n")).toBe(24);
  });
});
