import { describe, expect, it } from "vitest";
import { payeeName } from "./payee";

describe("payeeName", () => {
  it("names the known services and drops the reef: prefix from the rest", () => {
    expect(payeeName("reef:sui-risk")).toBe("Sui risk check");
    expect(payeeName("reef:weather")).toBe("weather");
    expect(payeeName("0xabc")).toBe("0xabc");
  });
});
