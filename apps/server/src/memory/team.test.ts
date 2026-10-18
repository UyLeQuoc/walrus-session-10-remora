import { describe, expect, it } from "vitest";
import { teamFactText } from "./team.ts";

describe("teamFactText", () => {
  it("trims the fact", () => {
    expect(teamFactText("  deploys go out on Tuesdays  ")).toBe("deploys go out on Tuesdays");
  });

  it("refuses fewer than three characters after trimming", () => {
    expect(teamFactText("  ab  ")).toBeNull();
    expect(teamFactText("")).toBeNull();
    expect(teamFactText("abc")).toBe("abc");
  });

  it("refuses more than a thousand characters", () => {
    expect(teamFactText("a".repeat(1000))).toBe("a".repeat(1000));
    expect(teamFactText("a".repeat(1001))).toBeNull();
    expect(teamFactText(` ${"a".repeat(1000)} `)).toBe("a".repeat(1000));
  });
});
