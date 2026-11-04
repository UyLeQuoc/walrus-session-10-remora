/**
 * D4 `pay`: the only money tool. Every call: rate limit → the remora's status → the live Disc →
 * the 402's exact requirements → Sonar (I2) → then one of:
 * - pay through the Disc (`payWithDisc`, Wake anchored as `Paid.intent`);
 * - shadow mode (N3): record "would have paid", spend nothing;
 * - over a cap: an approval for the owner (N2/E4);
 * - blocked: a Wake with the reasons, nothing signed.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { approvals, remoraEvents, sourceStats, sql } from "@remora/db";
import { getDisc, toDiscError } from "@remora/disc-sdk";
import { PaymentStopped, payWithDisc } from "../money/pay.ts";
import { atListedAddress, payeeLabel } from "../money/reef.ts";
import { modelIdFor } from "../runtime/brain.ts";
import type { RuntimeDeps } from "../runtime/deps.ts";
import { REMORA_LIMITS } from "../runtime/limits.ts";
import type { Recalled } from "../runtime/memory.ts";
import type { Remora } from "../runtime/remoras.ts";
import { sonar } from "../runtime/sonar.ts";
import { intentBase, recordWake, sha256Hex } from "../runtime/wake.ts";

export type PayOutcome =
  | {
      kind: "paid";
      response: Response;
      digest: string | null;
      amount: string;
      receiptId: string | null;
      eventId: string;
    }
  | {
      kind: "shadow";
      amount: string;
      reasons: string[];
      eventId: string;
      receiptId?: string | null;
    }
  | {
      kind: "approval";
      approvalId: string;
      reasons: string[];
      eventId: string;
      receiptId?: string | null;
    }
  | {
      kind: "blocked";
      code: string;
      reasons: string[];
      eventId: string;
      receiptId?: string | null;
    };

export interface PayInput {
  payee: string;
  url: string;
  reason: string;
  trigger: { kind: "message" | "cron" | "chain" | "handoff"; ref: string };
  question: string;
  memories: Recalled[];
  /**
   * What an over-limit payment (Sonar "ask") becomes. `approval` (the default) queues the E4
   * approval at once; `refuse` (an MCP agent, F14) records the Wake and returns `over_limit`, so the
   * agent asks its owner explicitly with `approval_request`. Nothing is signed either way.
   */
  onAsk?: "approval" | "refuse";
}

const reefLabel = (s: string) => (/^reef:[a-z0-9-]+$/.test(s) ? s : "reef:unknown");

export async function requestPayment(
  deps: RuntimeDeps,
  r: Remora,
  p: PayInput,
): Promise<PayOutcome> {
  const log = deps.log.child({ remora: r.id, network: r.network });
  const event = async (
    type: string,
    summary: string,
    payload: Record<string, unknown>,
    receiptId?: string | null,
  ) => {
    const [e] = await deps.db
      .insert(remoraEvents)
      .values({
        remoraId: r.id,
        network: r.network,
        type,
        summary,
        payload,
        receiptId: receiptId ?? null,
      })
      .returning({ id: remoraEvents.id });
    return e?.id ?? "";
  };
  const blocked = async (code: string, reasons: string[]): Promise<PayOutcome> => ({
    kind: "blocked",
    code,
    reasons,
    eventId: await event("blocked", `Didn't pay ${payeeLabel(p.payee)}: ${reasons[0] ?? code}`, {
      code,
      reasons,
      url: p.url,
    }),
  });

  // ADR-0109: before anything is fetched, an unlisted payee, or a listed one at an address that isn't
  // its own, is refused with Sonar's code and recorded (that's where an injection shows up). With the
  // safety check forced off (tests of the onchain layer), this goes too.
  const listed = deps.reef(r.network).find((e) => e.ref === p.payee);
  if (!deps.sonarOff && !listed)
    return blocked("sonar.blocked", [`${p.payee} isn't a listed service`]);
  if (!deps.sonarOff && listed && !atListedAddress(p.url, listed.url))
    return blocked("sonar.blocked", [
      `${p.url} isn't ${payeeLabel(p.payee)}'s listed address (${listed.url})`,
    ]);
  if (r.status !== "active" && r.status !== "shadow")
    return blocked("remora.not_active", [`the remora is ${r.status}`]);
  if (!r.discId || !r.allowanceId)
    return blocked("remora.no_disc", ["this remora has no spending limit"]);
  if (!deps.limiter.take(`pay:${r.id}`, REMORA_LIMITS.payments).allowed) {
    return blocked("rate_limited", ["too many payments this hour"]);
  }

  const core = deps.networks.client(r.network).core;
  let disc: Awaited<ReturnType<typeof getDisc>>;
  try {
    disc = await getDisc(core, r.discId);
  } catch (err) {
    if (toDiscError(err).code !== "allowance.revoked") throw err;
    // Revoked outside Remora, or not readable yet (the node lags a fresh issue): nothing is signed.
    return blocked("allowance.revoked", [
      `${r.name}'s spending limit can't be read onchain (revoked, or not visible yet), so it can't pay.`,
    ]);
  }
  const budget = (r.config as { budget?: { perPaymentCap?: string } }).budget;
  const policy = {
    status: r.status,
    discPayees: disc.payees,
    perPaymentCap: disc.perPaymentCap,
    paused: disc.paused,
    softLimit: BigInt(budget?.perPaymentCap ?? disc.perPaymentCap.toString()),
    reef: deps.reef(r.network),
  };
  const base = intentBase({
    trigger: p.trigger,
    trustedInput: `${p.question}\n${p.reason}`,
    memories: p.memories,
    model: modelIdFor(r, deps.brain.answerModel),
    prompt: p.reason,
  });
  let shadow = false;
  try {
    const { response, receipt } = await payWithDisc(
      {
        db: deps.db,
        signer: deps.signer,
        networks: deps.networks,
        log,
        ...(deps.fetch ? { fetch: deps.fetch } : {}),
        ...(deps.buildKind ? { buildKind: deps.buildKind } : {}),
      },
      {
        remoraId: r.id,
        keyId: String((r.config as { keyId?: string }).keyId ?? r.id),
        network: r.network,
        url: p.url,
        disc: { discId: r.discId, allowanceId: r.allowanceId, funder: r.ownerAddress },
        // Sonar decides (allow / ask / block) with the exact 402; the Disc enforces the hard caps.
        maxAmount: 2n ** 63n,
        intent: {
          ...base,
          sonar: { verdict: "allow", reasons: [] },
          decision: { payee: reefLabel(p.payee), reason: p.reason },
        },
        review: async (req) => {
          const decision = {
            payee: reefLabel(p.payee),
            payTo: normalizeSuiAddress(req.payTo),
            amount: BigInt(req.amount),
            reason: p.reason,
          };
          const v = deps.sonarOff
            ? { verdict: "allow" as const, reasons: ["safety check off (test)"] }
            : await sonar(decision, policy, deps.brain.check);
          if (v.verdict === "allow" && r.status === "shadow") {
            shadow = true;
            return { verdict: "block", reasons: [...v.reasons, "practice mode: would have paid"] };
          }
          return v;
        },
      },
    );
    const digest = receipt?.txDigest ?? null;
    // The merchant answered without a settled payment (verify or settle refused): nothing was bought.
    if (!response.ok || !digest) {
      const body = (await response
        .clone()
        .json()
        .catch(() => ({}))) as { error?: string };
      const reason = body.error ?? `the service answered ${response.status}`;
      log.warn("pay.unsettled", { url: p.url, status: response.status, reason });
      return blocked("x402.unsettled", [reason]);
    }
    const amount =
      (receipt?.wake as { intent?: { decision?: { amount?: string } } } | undefined)?.intent
        ?.decision?.amount ?? "0";
    await deps.db
      .insert(sourceStats)
      .values({ remoraId: r.id, payee: reefLabel(p.payee), calls: 1, spent: BigInt(amount) })
      .onConflictDoUpdate({
        target: [sourceStats.remoraId, sourceStats.payee],
        set: {
          calls: sql`${sourceStats.calls} + 1`,
          spent: sql`${sourceStats.spent} + ${BigInt(amount)}`,
          updatedAt: new Date(),
        },
      });
    if (receipt?.wake) {
      void deps.memory
        .remember(r, "receipts", "wake", JSON.stringify(receipt.wake))
        .catch((err) => log.warn("wake.memory_failed", { error: err }));
    }
    const eventId = await event(
      "payment",
      `Paid ${amount} to ${payeeLabel(p.payee)}`,
      { payee: p.payee, amount, digest, url: p.url, status: response.status },
      receipt?.id,
    );
    return { kind: "paid", response, digest, amount, receiptId: receipt?.id ?? null, eventId };
  } catch (err) {
    if (err instanceof PaymentStopped) {
      const decision = err.intent.decision;
      const amount = decision.action === "pay" ? decision.amount : "0";
      const wake = await recordWake(
        { db: deps.db, memory: deps.memory, log },
        r,
        base,
        decision,
        { verdict: err.verdict, reasons: err.reasons },
        {
          error: shadow
            ? "shadow"
            : err.verdict === "ask"
              ? "awaiting approval"
              : "blocked by the safety check",
        },
      );
      if (shadow) {
        const eventId = await event(
          "shadow",
          `Would have paid ${amount} to ${payeeLabel(p.payee)}`,
          { payee: p.payee, amount, url: p.url },
          wake?.id,
        );
        return {
          kind: "shadow",
          amount,
          reasons: err.reasons,
          eventId,
          receiptId: wake?.id ?? null,
        };
      }
      if (err.verdict === "ask" && p.onAsk === "refuse") {
        const eventId = await event(
          "blocked",
          `Didn't pay ${amount} to ${payeeLabel(p.payee)}: over the limit, the agent can ask you`,
          { code: "over_limit", reasons: err.reasons, url: p.url, amount },
          wake?.id,
        );
        return {
          kind: "blocked",
          code: "over_limit",
          reasons: err.reasons,
          eventId,
          receiptId: wake?.id ?? null,
        };
      }
      if (err.verdict === "ask") {
        const [a] = await deps.db
          .insert(approvals)
          .values({
            remoraId: r.id,
            network: r.network,
            kind: "over_limit_payment",
            summary: `Pay ${amount} to ${payeeLabel(p.payee)} (${err.reasons.at(-1) ?? "over the limit"})`,
            payload: {
              payee: p.payee,
              payTo: err.requirements.payTo,
              amount,
              url: p.url,
              reason: p.reason,
              question: p.question,
            },
          })
          .returning({ id: approvals.id });
        const eventId = await event(
          "approval_needed",
          `Asked you to approve ${amount} to ${p.payee}`,
          { approvalId: a?.id },
          wake?.id,
        );
        await deps.notifier.send(r.ownerAddress, {
          text: `${r.name} wants to pay ${amount} to ${p.payee}, over its limit. Approve?`,
          urgent: true,
          buttons: [{ label: "Review", url: `${deps.webBase}/approvals` }],
        });
        return {
          kind: "approval",
          approvalId: a?.id ?? "",
          reasons: err.reasons,
          eventId,
          receiptId: wake?.id ?? null,
        };
      }
      const eventId = await event(
        "blocked",
        `The safety check stopped a payment to ${p.payee}: ${err.reasons.at(-1)}`,
        { code: "sonar.blocked", reasons: err.reasons, url: p.url, payTo: err.requirements.payTo },
        wake?.id,
      );
      return {
        kind: "blocked",
        code: "sonar.blocked",
        reasons: err.reasons,
        eventId,
        receiptId: wake?.id ?? null,
      };
    }
    const e = err as { code?: string; message?: string };
    const code = e.code ?? toDiscError(err).code;
    log.warn("pay.refused", { code, error: err });
    return blocked(code, [e.message?.slice(0, 200) ?? code]);
  }
}

export const shaOf = sha256Hex;
