import { describe, expect, it } from "vitest";
import { isUniqueViolation } from "./unique-violation.ts";

describe("isUniqueViolation", () => {
  it("finds the Postgres code on the error or anywhere down its causes", () => {
    expect(isUniqueViolation({ code: "23505" })).toBe(true);
    expect(isUniqueViolation(new Error("query failed", { cause: { code: "23505" } }))).toBe(true);
    expect(
      isUniqueViolation(
        new Error("outer", { cause: new Error("inner", { cause: { code: "23505" } }) }),
      ),
    ).toBe(true);
  });

  it("is false for any other failure", () => {
    expect(isUniqueViolation({ code: "23503" })).toBe(false);
    expect(isUniqueViolation(new Error("connection refused"))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
    expect(isUniqueViolation("23505")).toBe(false);
  });
});
