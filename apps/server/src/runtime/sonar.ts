/**
 * I2 Sonar: the pre-action check before every payment (spec §10, §12.4). A deterministic policy runs
 * first; an independent check model sees only the trusted intent and the policy, never web or tool
 * content. The verdict and reasons go into the Wake. The Disc still enforces the hard limits onchain.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { ResolvedReef } from "../money/reef.ts";

export type Verdict = "allow" | "block" | "ask";

export interface SonarDecision {
  /** reef:<slug> the remora says it's paying. */
  payee: string;
  payTo: string;
  amount: bigint;
  reason: string;
}

export interface SonarPolicy {
  status: string;
  /** The Disc's onchain allowlist and caps (read live). */
  discPayees: string[];
  perPaymentCap: bigint;
  paused: boolean;
  /** Soft limit for one call, at or below the cap. */
  softLimit: bigint;
  reef: ResolvedReef[];
}

export interface SonarVerdict {
  verdict: Verdict;
  reasons: string[];
}

export interface CheckModel {
  check(input: {
    intent: SonarDecision;
    policy: Record<string, unknown>;
  }): Promise<{ verdict: Verdict; reason: string }>;
}

/** The deterministic part: what must hold before money moves. */
export function policyCheck(d: SonarDecision, p: SonarPolicy): SonarVerdict {
  const reasons: string[] = [];
  const entry = p.reef.find((r) => r.ref === d.payee);
  const payTo = normalizeSuiAddress(d.payTo);
  if (!entry) return { verdict: "block", reasons: [`${d.payee} isn't a listed service`] };
  if (normalizeSuiAddress(entry.payTo) !== payTo) {
    return { verdict: "block", reasons: [`${d.payee} pays ${entry.payTo}, not ${payTo}`] };
  }
  if (!p.discPayees.map((a) => normalizeSuiAddress(a)).includes(payTo)) {
    return { verdict: "block", reasons: [`${payTo} isn't one of its allowed payees`] };
  }
  reasons.push("payee allowed and listed");
  if (p.paused || p.status === "paused")
    return { verdict: "block", reasons: [...reasons, "its spending is paused"] };
  if (p.status === "retired")
    return { verdict: "block", reasons: [...reasons, "the remora is retired"] };
  if (d.amount > p.perPaymentCap) {
    return {
      verdict: "ask",
      reasons: [...reasons, `${d.amount} is over the per-payment cap ${p.perPaymentCap}`],
    };
  }
  reasons.push("under per-payment cap");
  if (d.amount > p.softLimit) {
    return {
      verdict: "ask",
      reasons: [...reasons, `${d.amount} is over the soft limit ${p.softLimit}`],
    };
  }
  return { verdict: "allow", reasons };
}

/** Policy first; the check model only runs when the policy allows, and can only make it stricter. */
export async function sonar(
  d: SonarDecision,
  p: SonarPolicy,
  model?: CheckModel,
): Promise<SonarVerdict> {
  const v = policyCheck(d, p);
  if (v.verdict !== "allow" || !model) return v;
  try {
    const m = await model.check({
      intent: d,
      policy: {
        payees: p.discPayees,
        perPaymentCap: p.perPaymentCap.toString(),
        softLimit: p.softLimit.toString(),
      },
    });
    if (m.verdict === "allow")
      return { verdict: "allow", reasons: [...v.reasons, `check model: ${m.reason}`] };
    return { verdict: m.verdict, reasons: [...v.reasons, `check model: ${m.reason}`] };
  } catch {
    // The check model is a second opinion; if it's down, the deterministic policy and the Disc still hold.
    return { verdict: "allow", reasons: [...v.reasons, "check model unavailable"] };
  }
}
