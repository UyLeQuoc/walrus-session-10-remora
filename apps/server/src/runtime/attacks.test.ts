/**
 * I3 (ADR-0079), the deterministic part of the payment red team: every attack in
 * evals/payment-attacks.json goes through Sonar's policy as an obedient model would send it. Money
 * moves only on `allow`, and no attack may get one.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { ResolvedReef } from "../money/reef.ts";
import { policyCheck, type SonarPolicy, type Verdict } from "./sonar.ts";

interface PolicyJson {
  status: string;
  paused: boolean;
  discPayees: string[];
  perPaymentCap: string;
  softLimit: string;
  reef: { ref: string; payTo: string }[];
}

interface Attack {
  id: string;
  name: string;
  vector: string;
  policy?: Partial<PolicyJson>;
  decision: { payee: string; payTo: string; amount: string };
  expect: { verdict: Exclude<Verdict, "allow"> };
}

const suite = JSON.parse(
  readFileSync(resolve(import.meta.dirname, "../../../../evals/payment-attacks.json"), "utf8"),
) as { policy: PolicyJson; attacks: Attack[] };

const policyOf = (o: Partial<PolicyJson> = {}): SonarPolicy => {
  const p = { ...suite.policy, ...o };
  return {
    status: p.status,
    paused: p.paused,
    discPayees: p.discPayees,
    perPaymentCap: BigInt(p.perPaymentCap),
    softLimit: BigInt(p.softLimit),
    reef: p.reef.map((e) => ({ ...e, payTo: e.payTo }) as unknown as ResolvedReef),
  };
};

describe(`payment attacks (${suite.attacks.length})`, () => {
  const paid: string[] = [];

  it.each(suite.attacks.map((a) => [`${a.id}: ${a.name}`, a] as const))("%s", (_n, a) => {
    const v = policyCheck(
      { ...a.decision, amount: BigInt(a.decision.amount), reason: a.name },
      policyOf(a.policy),
    );
    if (v.verdict === "allow") paid.push(a.id);
    expect(v.verdict, v.reasons.join("; ")).toBe(a.expect.verdict);
  });

  it("an honest purchase still goes through", () => {
    const v = policyCheck(
      {
        payee: "reef:sui-risk",
        payTo: suite.policy.discPayees[0] ?? "",
        amount: 10_000n,
        reason: "check 0x2",
      },
      policyOf(),
    );
    expect(v.verdict).toBe("allow");
  });

  it("paid nothing", () => {
    expect(paid).toEqual([]);
    console.log(`${suite.attacks.length} payment attacks, 0 paid`);
  });
});
