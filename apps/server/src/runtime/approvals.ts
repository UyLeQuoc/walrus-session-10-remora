/**
 * N2 + E4: the approval inbox. An over-limit payment waits here; the owner approves with one
 * signature: a one-off x402 payment from their own address balance (not the remora's Disc). The
 * server builds it from the merchant's live 402, the wallet signs, the server sends it to the merchant,
 * and Scout answers with what was bought. The owner pays this gas themselves (ADR-0031).
 */
import { Transaction } from "@mysten/sui/transactions";
import { normalizeStructTag, toBase64 } from "@mysten/sui/utils";
import { and, approvals, desc, eq, remoraEvents, remoras } from "@remora/db";
import {
  decodeHeader,
  encodeHeader,
  PAYMENT_HEADER,
  PAYMENT_RESPONSE_HEADER,
  type PaymentRequired,
  type PaymentRequirements,
  type SettleResponse,
  toX402Network,
  X402_VERSION,
} from "@remora/disc-sdk";
import { payeeLabel } from "../money/reef.ts";
import { modelIdFor, usdcLabel } from "./brain.ts";
import type { RuntimeDeps } from "./deps.ts";
import { RemoraError } from "./remoras.ts";
import { followUpInRooms } from "./rooms.ts";
import { intentBase, recordWake, sha256Hex } from "./wake.ts";

async function pendingOf(deps: RuntimeDeps, owner: string, id: string) {
  const [row] = await deps.db
    .select({ a: approvals, r: remoras })
    .from(approvals)
    .innerJoin(remoras, eq(remoras.id, approvals.remoraId))
    .where(eq(approvals.id, id));
  if (!row) throw new RemoraError("approval.not_found", "No such approval.", 404);
  if (row.r.ownerAddress !== owner)
    throw new RemoraError("remora.not_owner", "That isn't yours.", 403);
  if (row.a.status !== "pending")
    throw new RemoraError("approval.decided", `Already ${row.a.status}.`, 409);
  return row;
}

export async function listApprovals(deps: RuntimeDeps, owner: string, network: string) {
  return deps.db
    .select({ a: approvals, remora: remoras.name })
    .from(approvals)
    .innerJoin(remoras, eq(remoras.id, approvals.remoraId))
    .where(
      and(
        eq(remoras.ownerAddress, owner),
        eq(remoras.playground, false),
        eq(approvals.network, network as "testnet"),
      ),
    )
    .orderBy(desc(approvals.createdAt));
}

/** Builds the owner's one-off payment from the merchant's current 402. The owner pays their own gas. */
export async function approvalPayTx(deps: RuntimeDeps, owner: string, id: string) {
  const { a, r } = await pendingOf(deps, owner, id);
  const url = String((a.payload as { url?: string }).url ?? "");
  const http = deps.fetch ?? fetch;
  const first = await http(url);
  if (first.status !== 402)
    throw new RemoraError("approval.not_payable", `The service answered ${first.status}, not 402.`);
  const required = (await first.json()) as PaymentRequired;
  const coinType = deps.networks.config(r.network).usdcCoinType;
  const req = required.accepts.find(
    (x) =>
      x.scheme === "exact" &&
      x.network === toX402Network(r.network) &&
      normalizeStructTag(x.asset) === normalizeStructTag(coinType),
  );
  if (!req)
    throw new RemoraError(
      "x402.no_matching_requirements",
      "That service doesn't take this network's USDC.",
    );
  const tx = ownerPaymentTx(owner, coinType, req);
  const bytes = await tx.build({ client: deps.networks.client(r.network) });
  return { transaction: toBase64(bytes), requirements: req };
}

/** A plain `exact` payment from the owner's address balance to the merchant's `payTo`. */
export function ownerPaymentTx(
  owner: string,
  coinType: string,
  req: Pick<PaymentRequirements, "amount" | "payTo">,
): Transaction {
  const tx = new Transaction();
  tx.setSender(owner);
  const coin = tx.moveCall({
    target: "0x2::coin::redeem_funds",
    typeArguments: [coinType],
    arguments: [tx.withdrawal({ amount: BigInt(req.amount), type: coinType })],
  });
  tx.moveCall({
    target: "0x2::coin::send_funds",
    typeArguments: [coinType],
    arguments: [coin, tx.pure.address(req.payTo)],
  });
  return tx;
}

/** Sends the owner-signed payment to the merchant; on success Scout answers with the data. */
export async function approvalPay(
  deps: RuntimeDeps,
  owner: string,
  id: string,
  signed: { transaction: string; signature: string },
) {
  const { a, r } = await pendingOf(deps, owner, id);
  const payload = a.payload as {
    url?: string;
    payee?: string;
    reason?: string;
    question?: string;
    amount?: string;
  };
  const http = deps.fetch ?? fetch;
  const res = await http(String(payload.url), {
    headers: {
      [PAYMENT_HEADER]: encodeHeader({
        x402Version: X402_VERSION,
        scheme: "exact",
        network: toX402Network(r.network),
        payload: { signature: signed.signature, transaction: signed.transaction },
      }),
    },
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new RemoraError(
      "approval.payment_failed",
      body.error ?? `The service answered ${res.status}.`,
    );
  }
  const header = res.headers.get(PAYMENT_RESPONSE_HEADER);
  const settle = header ? decodeHeader<SettleResponse>(header) : null;
  const data = await res.text();
  await deps.db
    .update(approvals)
    .set({ status: "approved", decidedAt: new Date() })
    .where(eq(approvals.id, id));
  const [paid] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "payment",
      summary: `You paid ${payload.amount} to ${payeeLabel(payload.payee ?? "")} (approved)`,
      payload: {
        payee: payload.payee,
        amount: payload.amount,
        digest: settle?.transaction ?? null,
        approvalId: id,
        approvedBy: "owner",
      },
    })
    .returning({ id: remoraEvents.id });
  const question = String(payload.question ?? payload.reason ?? "approved purchase");
  // The remora's own model writes it, and the Wake records the model that did (D9, ADR-0042).
  let usedModel = modelIdFor(r, deps.brain.answerModel);
  const answer = await deps.brain
    .answer({
      model: usedModel,
      persona: String((r.config as { persona?: string }).persona ?? ""),
      question,
      memories: [],
      data: [
        { source: String(payload.payee), content: data, cost: usdcLabel(String(payload.amount)) },
      ],
    })
    .then((x) => {
      usedModel = x.model ?? usedModel;
      return x.text;
    })
    .catch(() => {
      usedModel = "remora/no-model";
      return `Here's what the approved purchase returned:\n${data.slice(0, 800)}`;
    });
  const wake = await recordWake(
    { db: deps.db, memory: deps.memory, log: deps.log },
    r,
    intentBase({
      trigger: { kind: "message", ref: `approval:${id}` },
      trustedInput: question,
      memories: [],
      model: usedModel,
      prompt: question,
    }),
    {
      action: "answer",
      reason: `answered after the owner approved ${payload.amount} to ${payeeLabel(payload.payee ?? "")}`,
    },
    { verdict: "allow", reasons: ["approved by the owner"] },
    {
      ...(settle?.transaction ? { tx: settle.transaction } : {}),
      responseSha256: sha256Hex(answer),
    },
  );
  const [e] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "answer",
      summary: question.slice(0, 140),
      payload: { question, answer, approvalId: id },
      receiptId: wake?.id ?? null,
    })
    .returning({ id: remoraEvents.id });
  // Where the card was (a room, ADR-0042), the payment and the answer follow it.
  await followUpInRooms(
    deps.db,
    id,
    [paid?.id, e?.id].filter((x): x is string => !!x),
  ).catch((err) => deps.log.warn("room.follow_up_failed", { approval: id, error: err }));
  return { answer, digest: settle?.transaction ?? null, eventId: e?.id ?? "" };
}

export async function rejectApproval(deps: RuntimeDeps, owner: string, id: string) {
  const { r } = await pendingOf(deps, owner, id);
  await deps.db
    .update(approvals)
    .set({ status: "rejected", decidedAt: new Date() })
    .where(eq(approvals.id, id));
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary: "You declined an over-limit payment.",
    payload: { approvalId: id },
  });
}
