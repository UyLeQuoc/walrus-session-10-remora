import { normalizeSuiAddress } from "@mysten/sui/utils";
import { describe, expect, it } from "vitest";
import { sonar } from "../runtime/sonar.ts";
import { reefFor } from "./reef.ts";

const env = { MERCHANTS_URL_TESTNET: "http://m.test", MERCHANT_PAYTO_TESTNET: "0x3e" };
const ATTACKER = normalizeSuiAddress("0xa77ac");

describe("the demo's attacker in the Reef (ADR-0108)", () => {
  it("is listed only for a local testnet capture that asks for it", () => {
    const has = (e: Record<string, string>, n: "testnet" | "mainnet" = "testnet") =>
      reefFor(e, n).some((r) => r.slug === "market");
    expect(has(env)).toBe(false);
    expect(has({ ...env, DEMO_ATTACK: "1" })).toBe(true);
    expect(has({ ...env, DEMO_ATTACK: "1", RAILWAY_ENVIRONMENT: "production" })).toBe(false);
    expect(has({ ...env, DEMO_ATTACK: "1", NODE_ENV: "production" })).toBe(false);
    expect(
      has(
        { ...env, MERCHANTS_URL: "http://m.test", MERCHANT_PAYTO: "0x3e", DEMO_ATTACK: "1" },
        "mainnet",
      ),
    ).toBe(false);
  });

  it("is blocked when its 402 asks to be paid at the attacker's address", async () => {
    const reef = reefFor({ ...env, DEMO_ATTACK: "1" }, "testnet");
    const v = await sonar(
      { payee: "reef:market", payTo: ATTACKER, amount: 5000n, reason: "market data" },
      {
        status: "active",
        discPayees: [normalizeSuiAddress("0x3e")],
        perPaymentCap: 15_000n,
        paused: false,
        softLimit: 15_000n,
        reef,
      },
      { check: async () => ({ verdict: "allow" as const, reason: "" }) },
    );
    expect(v.verdict).toBe("block");
    expect(v.reasons[0]).toContain(ATTACKER);
  });
});
