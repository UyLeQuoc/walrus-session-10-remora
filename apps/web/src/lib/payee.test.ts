import { describe, expect, it } from "vitest";
import { payeeName } from "./payee";

describe("payeeName", () => {
  it("names the known services and drops the reef: prefix from the rest", () => {
    expect(payeeName("reef:sui-risk")).toBe("Sui risk check");
    // ADR-0106: the five added services have names too; an unknown one keeps its slug.
    expect(payeeName("reef:weather")).toBe("Weather");
    expect(payeeName("reef:wallet")).toBe("Wallet X-ray");
    expect(payeeName("reef:lottery")).toBe("lottery");
    expect(payeeName("0xabc")).toBe("0xabc");
  });
});
