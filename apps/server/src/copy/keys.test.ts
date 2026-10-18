import { COPY_KEYS } from "@remora/schema";
import { describe, expect, it } from "vitest";
import { COPY_TEXT, PENDING_COPY, placeholders, render } from "./keys.ts";

describe("copy v1", () => {
  it("has text for every copy key", () => {
    const missing = COPY_KEYS.filter((k) => !(COPY_TEXT as Record<string, string>)[k]?.trim());
    expect(missing).toEqual([]);
  });

  it("keeps button labels short enough for a Telegram keyboard", () => {
    for (const k of COPY_KEYS.filter((k) => k.startsWith("button."))) {
      expect(COPY_TEXT[k].length, k).toBeLessThanOrEqual(20);
    }
  });

  it("fills placeholders and refuses a half-filled sentence", () => {
    expect(render("payment.made", { amount: "0.01", payee: "reef:sui-risk", tx: "H7Nc…" })).toBe(
      "Paid 0.01 USDC to reef:sui-risk. Receipt: H7Nc…",
    );
    expect(() => render("payment.made", { amount: "0.01" })).toThrow(/needs \{payee\}/);
    expect(placeholders("error.disc.over_per_payment_cap")).toEqual(["cap"]);
  });

  it("drafts copy for the codes proposed in contract PR #4", () => {
    expect(render("error.network.unavailable", { network: "mainnet" })).toBe(
      "mainnet isn't available yet.",
    );
    expect(Object.keys(PENDING_COPY).every((k) => k.startsWith("error."))).toBe(true);
  });
});
