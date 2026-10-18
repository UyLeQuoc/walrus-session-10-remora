import { normalizeSuiAddress } from "@mysten/sui/utils";
import { describe, expect, it } from "vitest";
import type { ResolvedReef } from "../money/reef.ts";
import { SlidingLimiter } from "./limits.ts";
import { describeEvent, parseRule, triage } from "./rules.ts";
import { policyCheck, type SonarPolicy, sonar } from "./sonar.ts";

const PAYTO = normalizeSuiAddress("0x3e");
const ATTACKER = normalizeSuiAddress("0xa77ac");
const reef = [
  {
    ref: "reef:sui-risk",
    slug: "sui-risk",
    name: "",
    description: "",
    path: "",
    price: "10000",
    url: "",
    payTo: PAYTO,
  },
] as ResolvedReef[];
const policy: SonarPolicy = {
  status: "active",
  discPayees: [PAYTO],
  perPaymentCap: 50_000n,
  paused: false,
  softLimit: 20_000n,
  reef,
};
const pay = (o: Partial<{ payee: string; payTo: string; amount: bigint }> = {}) => ({
  payee: "reef:sui-risk",
  payTo: PAYTO,
  amount: 10_000n,
  reason: "risk check",
  ...o,
});

describe("Sonar (I2)", () => {
  it("allows a Reef payee on the Disc under the limits", () => {
    expect(policyCheck(pay(), policy)).toEqual({
      verdict: "allow",
      reasons: ["payee on Disc and in the Reef", "under per-payment cap"],
    });
  });

  it("blocks an injected payee, even under a real Reef label", () => {
    expect(policyCheck(pay({ payTo: ATTACKER }), policy).verdict).toBe("block");
    expect(policyCheck(pay({ payee: "reef:evil", payTo: ATTACKER }), policy).reasons[0]).toMatch(
      /isn't in the Reef/,
    );
    expect(policyCheck(pay(), { ...policy, discPayees: [] }).reasons[0]).toMatch(
      /isn't on the Disc/,
    );
  });

  it("asks the owner above the caps and blocks when paused", () => {
    expect(policyCheck(pay({ amount: 60_000n }), policy).verdict).toBe("ask");
    expect(policyCheck(pay({ amount: 30_000n }), policy).verdict).toBe("ask");
    expect(policyCheck(pay(), { ...policy, paused: true }).verdict).toBe("block");
  });

  it("lets the check model only tighten, and survives it being down", async () => {
    const strict = { check: async () => ({ verdict: "block" as const, reason: "looks off" }) };
    expect((await sonar(pay(), policy, strict)).verdict).toBe("block");
    const lax = { check: async () => ({ verdict: "allow" as const, reason: "fine" }) };
    expect((await sonar(pay({ payTo: ATTACKER }), policy, lax)).verdict).toBe("block");
    const down = {
      check: async () => {
        throw new Error("503");
      },
    };
    expect(await sonar(pay(), policy, down)).toMatchObject({ verdict: "allow" });
  });
});

describe("Sentinel rules (C2, F2)", () => {
  it("parses the common phrasings", () => {
    expect(parseRule("Ignore incoming transfers under 0.01 SUI")).toEqual({
      action: "ignore",
      when: { direction: "in", coin: "SUI", under: 0.01 },
    });
    expect(parseRule("Always ping me for anything over 1 SUI")).toEqual({
      action: "ping",
      when: { coin: "SUI", over: 1 },
    });
    expect(parseRule("hello there")).toBeNull();
  });

  it("triages newest-first and pings by default", () => {
    const event = {
      address: PAYTO,
      direction: "in" as const,
      coinType: "0x2::sui::SUI",
      amount: 5_000_000n,
      decimals: 9,
      digest: "Dg1234567",
    };
    const ignoreSmall = {
      rule: parseRule("ignore incoming SUI under 0.01") ?? never(),
      text: "ignore small",
    };
    expect(triage([ignoreSmall], event)).toEqual({ verdict: "noise", because: "ignore small" });
    expect(triage([ignoreSmall], { ...event, amount: 20_000_000n }).verdict).toBe("ping");
    expect(triage([], event)).toEqual({ verdict: "ping", because: null });
    expect(describeEvent(event)).toBe("Received 0.005 SUI (Dg123456…)");
  });
});

describe("rate limits (I4)", () => {
  it("allows up to the limit per window, then reopens", () => {
    let t = 0;
    const l = new SlidingLimiter(() => t);
    const w = { limit: 2, ms: 1_000 };
    expect(l.take("r", w).allowed).toBe(true);
    expect(l.take("r", w).allowed).toBe(true);
    expect(l.take("r", w)).toMatchObject({ allowed: false, retryAfterMs: 1_000 });
    expect(l.take("other", w).allowed).toBe(true);
    t = 1_001;
    expect(l.take("r", w).allowed).toBe(true);
  });
});

function never(): never {
  throw new Error("unreachable");
}
