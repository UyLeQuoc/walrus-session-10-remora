/** The balance reader asks the current network's USDC coin type, and degrades instead of throwing. */
import { describe, expect, it } from "vitest";
import { readBalances } from "./use-wallet-balance";

const OWNER = `0x${"a".repeat(64)}`;

describe("readBalances", () => {
  it("reads SUI and the network's USDC", async () => {
    const seen: Array<string | undefined> = [];
    const client = {
      getBalance: async ({ coinType }: { coinType?: string }) => {
        seen.push(coinType);
        if (coinType === "0x2::sui::SUI") return { balance: { balance: "12400000000" } };
        return { balance: { balance: "1620000" } };
      },
    };
    await expect(readBalances(client, OWNER, "testnet")).resolves.toEqual({
      sui: 12_400_000_000n,
      usdc: 1_620_000n,
    });
    expect(seen).toContain("0x2::sui::SUI");
    expect(seen.some((coin) => coin?.endsWith("::usdc::USDC"))).toBe(true);
  });

  it("is null when the client cannot read a balance", async () => {
    await expect(readBalances({}, OWNER, "testnet")).resolves.toBeNull();
  });

  it("is null when the node throws", async () => {
    const client = {
      getBalance: async () => {
        throw new Error("node down");
      },
    };
    await expect(readBalances(client, OWNER, "testnet")).resolves.toBeNull();
  });
});
