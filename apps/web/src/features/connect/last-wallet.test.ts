import { describe, expect, it } from "vitest";
import { lastWalletConnection } from "@/features/connect/last-wallet";

describe("lastWalletConnection", () => {
  it("reads the wallet dapp-kit stored", () => {
    const raw = JSON.stringify({
      state: { lastConnectedWalletName: "Slush", lastConnectedAccountAddress: "0xabc" },
      version: 0,
    });
    expect(lastWalletConnection(raw)).toEqual({ name: "Slush", address: "0xabc" });
  });

  it("ignores a missing or broken record", () => {
    expect(lastWalletConnection(null)).toBeNull();
    expect(lastWalletConnection("not-json")).toBeNull();
    expect(
      lastWalletConnection(JSON.stringify({ state: { lastConnectedWalletName: "Slush" } })),
    ).toBeNull();
  });
});
