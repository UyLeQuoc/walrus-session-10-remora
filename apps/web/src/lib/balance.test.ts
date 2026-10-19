/** Reading a balance answer from the gRPC client and formatting SUI (§6). */
import { describe, expect, it } from "vitest";
import { balanceMist, formatSui } from "./balance";

describe("balanceMist", () => {
  it("reads the gRPC answer shape", () => {
    expect(balanceMist({ balance: { balance: "1000000000" } })).toBe(1_000_000_000n);
  });

  it("reads a flat string or totalBalance", () => {
    expect(balanceMist({ balance: "5" })).toBe(5n);
    expect(balanceMist({ totalBalance: "7" })).toBe(7n);
  });

  it("returns null for anything unreadable", () => {
    expect(balanceMist(null)).toBeNull();
    expect(balanceMist({})).toBeNull();
    expect(balanceMist({ balance: { coinType: "0x2::sui::SUI" } })).toBeNull();
    expect(balanceMist({ balance: 12 })).toBeNull();
  });
});

describe("formatSui", () => {
  it("shows two decimals of 9-decimal MIST", () => {
    expect(formatSui(12_400_000_000n)).toBe("12.40");
    expect(formatSui(0n)).toBe("0.00");
    expect(formatSui(999_999n)).toBe("0.00");
    expect(formatSui(1_999_999_999n)).toBe("1.99");
  });
});
