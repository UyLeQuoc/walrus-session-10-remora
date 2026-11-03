import { describe, expect, it } from "vitest";
import { plainEvent, readable } from "./readable";

describe("readable", () => {
  it("drops untrusted wrappers", () => {
    expect(readable('<untrusted source="reef:odds">2.1</untrusted>')).toBe("2.1");
  });
});

describe("plainEvent", () => {
  const name = (ref: string) => (ref === "reef:odds" ? "Odds" : ref);
  it("writes base units as USDC and names services", () => {
    expect(plainEvent("Didn't pay 20000 to Odds: over the limit", name)).toBe(
      "Didn't pay 0.02 USDC to Odds: over the limit",
    );
    expect(plainEvent("Asked you to approve 15000 to reef:odds", name)).toBe(
      "Asked you to approve 0.015 USDC to Odds",
    );
    expect(plainEvent("Paid 0.01 USDC to Sui risk check", name)).toBe(
      "Paid 0.01 USDC to Sui risk check",
    );
  });
});
