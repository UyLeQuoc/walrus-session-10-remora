/**
 * U18 B1 (ADR-0125): the Errand pays people. "Pay Linh 2 USDC for lunch" names a contact, an amount
 * and a memo. Within its limits it pays through the ordinary pay path (the memo is the Wake's reason,
 * so its hash is `Paid.intent` onchain); over its cap it asks the owner, who pays once from their own
 * wallet; an amount 3x what a contact is usually paid asks first, and the owner's yes lets it pay.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { and, approvals, desc, eq, remoraEvents, remoras } from "@remora/db";
import {
  type Contact,
  contactFetch,
  contactPayUrl,
  contactsOf,
  findContact,
} from "../money/contacts.ts";
import { requestPayment } from "../tools/pay.ts";
import type { RuntimeDeps } from "./deps.ts";
import { type Remora, RemoraError } from "./remoras.ts";

/** At this many times a contact's usual payment, it asks first. */
export const UNUSUAL_FACTOR = 3n;

export interface PayRequestText {
  who: string;
  /** Smallest USDC units. */
  amount: bigint;
  memo: string;
}

const units = (v: string) => {
  const [w = "0", f = ""] = v.replace(",", ".").split(".");
  return BigInt(w) * 1_000_000n + BigInt(`${f}000000`.slice(0, 6));
};

/**
 * "pay Linh 2 USDC for lunch", "send $0.5 to Huy for the taxi", "trả Linh 2 USDC tiền ăn trưa".
 * Plain words only; anything else gets a hint, never a guess at a payment.
 */
export function parsePayText(text: string): PayRequestText | null {
  const t = text.trim().replace(/\s+/g, " ");
  const verb = "(?:pay|send|give|trả|gửi|chuyển)";
  const amount = "\\$?(\\d{1,6}(?:[.,]\\d{1,6})?)\\s*(?:usdc|usd|\\$)?";
  const memo = "(?:\\s+(?:for|as|cho|tiền|về)\\s+(.+))?";
  const a = new RegExp(`^${verb}\\s+(.+?)\\s+${amount}${memo}$`, "iu").exec(t);
  if (a?.[1] && a[2])
    return { who: a[1].replace(/^to\s+/i, ""), amount: units(a[2]), memo: (a[3] ?? "").trim() };
  const b = new RegExp(`^${verb}\\s+${amount}\\s+(?:to|cho)\\s+(.+?)${memo}$`, "iu").exec(t);
  if (b?.[1] && b[2]) return { who: b[2], amount: units(b[1]), memo: (b[3] ?? "").trim() };
  return null;
}

const usdc = (u: bigint) => (Number(u) / 1e6).toFixed(2);

/** The median of the last ten payments to this contact, or null before the first. */
export async function usualFor(
  deps: Pick<RuntimeDeps, "db">,
  r: Pick<Remora, "id">,
  c: Contact,
): Promise<bigint | null> {
  const rows = await deps.db
    .select({ payload: remoraEvents.payload })
    .from(remoraEvents)
    .where(and(eq(remoraEvents.remoraId, r.id), eq(remoraEvents.type, "payment")))
    .orderBy(desc(remoraEvents.createdAt))
    .limit(50);
  const paid = rows
    .map((x) => x.payload as { payee?: string; amount?: string })
    .filter((p) => p.payee === c.ref && p.amount)
    .slice(0, 10)
    .map((p) => BigInt(p.amount as string))
    .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (!paid.length) return null;
  return paid[Math.floor(paid.length / 2)] ?? null;
}

export interface ErrandResult {
  answer: string;
  eventId: string;
  outcome: "paid" | "asked" | "unusual" | "blocked" | "unclear";
  digest?: string | null;
  approvalId?: string;
}

async function reply(deps: RuntimeDeps, r: Remora, question: string, answer: string, extra = {}) {
  const [e] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "answer",
      summary: question.slice(0, 140),
      payload: { question, answer, ...extra },
    })
    .returning({ id: remoraEvents.id });
  return e?.id ?? "";
}

/** One payment to a contact through the Disc; `confirmed` skips the unusual-amount question. */
export async function payContact(
  deps: RuntimeDeps,
  r: Remora,
  req: { contact: Contact; amount: bigint; memo: string; question: string },
  opts: { trigger?: { kind: "message" | "webhook"; ref: string }; confirmed?: boolean } = {},
): Promise<ErrandResult> {
  const { contact, amount, memo, question } = req;
  const net = deps.networks.config(r.network);
  if (!net.facilitatorUrl)
    throw new RemoraError(
      "network.no_facilitator",
      `${r.network} has no facilitator to settle with.`,
    );
  const usual = await usualFor(deps, r, contact);
  if (!opts.confirmed && usual && amount >= usual * UNUSUAL_FACTOR) {
    const [a] = await deps.db
      .insert(approvals)
      .values({
        remoraId: r.id,
        network: r.network,
        kind: "over_limit_payment",
        summary: `Pay ${usdc(amount)} USDC to ${contact.name}? Usually ${usdc(usual)}.`,
        payload: {
          payee: contact.ref,
          payTo: contact.address,
          amount: amount.toString(),
          url: contactPayUrl(contact, memo),
          reason: memo,
          question,
          contact: true,
          // Within its limits, so the owner's yes lets the Errand pay from its own Disc.
          viaDisc: true,
          usual: usual.toString(),
        },
      })
      .returning({ id: approvals.id });
    const answer = `That's ${usdc(amount)} USDC, ${UNUSUAL_FACTOR}x or more what you usually send ${contact.name} (${usdc(usual)}). I'll pay it once you say yes.`;
    await deps.notifier.send(r.ownerAddress, {
      text: `${r.name}: ${answer}`,
      urgent: true,
      buttons: [{ label: "Review", url: `${deps.webBase}/approvals` }],
    });
    return {
      answer,
      outcome: "unusual",
      approvalId: a?.id ?? "",
      eventId: await reply(deps, r, question, answer, { approvalId: a?.id }),
    };
  }
  const out = await requestPayment(
    {
      ...deps,
      fetch: contactFetch({
        contact,
        amount,
        network: r.network,
        asset: net.usdcCoinType,
        facilitatorUrl: net.facilitatorUrl,
        ...(deps.fetch ? { fetch: deps.fetch } : {}),
      }),
    },
    r,
    {
      payee: contact.ref,
      url: contactPayUrl(contact, memo),
      reason: memo ? `${memo} (for ${contact.name})` : `pay ${contact.name}`,
      trigger: opts.trigger ?? { kind: "message", ref: "web" },
      question,
      memories: [],
      ...(memo ? { memo } : {}),
    },
  );
  if (out.kind === "paid") {
    // What this contact is usually paid, and for what: the next unusual amount is measured from it.
    void deps.memory
      .remember(
        r,
        "me",
        "profile",
        `CONTACT ${contact.name} · paid ${usdc(amount)} USDC${memo ? ` for ${memo.slice(0, 60)}` : ""} · usually ${usdc(usual ?? amount)} · as_of ${new Date().toISOString().slice(0, 10)}`,
        { dedupe: false },
      )
      .catch((err) => deps.log.warn("errand.memory_failed", { remora: r.id, error: err }));
    const answer = `Paid ${contact.name} ${usdc(amount)} USDC${memo ? ` for ${memo}` : ""}.`;
    return {
      answer,
      outcome: "paid",
      digest: out.digest,
      eventId: await reply(deps, r, question, answer, {
        paidPayees: [contact.ref],
        digests: out.digest ? [out.digest] : [],
      }),
    };
  }
  if (out.kind === "approval") {
    const answer = `${usdc(amount)} USDC is over my cap, so I asked you to pay ${contact.name} once from your wallet.`;
    return {
      answer,
      outcome: "asked",
      approvalId: out.approvalId,
      eventId: await reply(deps, r, question, answer, { approvalId: out.approvalId }),
    };
  }
  const why = out.kind === "shadow" ? "I'm in practice mode, so nothing was paid" : out.reasons[0];
  const answer = `I didn't pay ${contact.name}: ${why ?? "it was refused"}.`;
  return {
    answer,
    outcome: "blocked",
    eventId: await reply(deps, r, question, answer),
  };
}

/** A message to an Errand: a payment request in plain words, or a hint and its contacts. */
export async function errandAsk(
  deps: RuntimeDeps,
  r: Remora,
  text: string,
  trigger: { kind: "message" | "webhook"; ref: string } = { kind: "message", ref: "web" },
): Promise<ErrandResult> {
  const names = contactsOf(r)
    .map((c) => c.name)
    .join(", ");
  const parsed = parsePayText(text);
  if (!parsed || parsed.amount <= 0n) {
    const answer = `Tell me who and how much, e.g. "pay ${contactsOf(r)[0]?.name ?? "Linh"} 2 USDC for lunch". I can pay: ${names || "nobody yet"}.`;
    return { answer, outcome: "unclear", eventId: await reply(deps, r, text, answer) };
  }
  const contact = findContact(r, parsed.who);
  if (!contact) {
    const answer = `${parsed.who} isn't one of my contacts, so I can't pay them. Add them on my page (one signature). I can pay: ${names || "nobody yet"}.`;
    return { answer, outcome: "unclear", eventId: await reply(deps, r, text, answer) };
  }
  return payContact(
    deps,
    r,
    { contact, amount: parsed.amount, memo: parsed.memo, question: text },
    { trigger },
  );
}

/** The owner said yes to an unusual amount: the Errand pays it from its own Disc. */
export async function approveUnusual(deps: RuntimeDeps, owner: string, approvalId: string) {
  const [row] = await deps.db
    .select({ a: approvals, r: remoras })
    .from(approvals)
    .innerJoin(remoras, eq(remoras.id, approvals.remoraId))
    .where(eq(approvals.id, approvalId));
  if (!row) throw new RemoraError("approval.not_found", "No such approval.", 404);
  if (normalizeSuiAddress(row.r.ownerAddress) !== normalizeSuiAddress(owner))
    throw new RemoraError("remora.not_owner", "That isn't yours.", 403);
  if (row.a.status !== "pending")
    throw new RemoraError("approval.decided", `Already ${row.a.status}.`, 409);
  const p = row.a.payload as { payee: string; amount: string; reason?: string; question?: string };
  const contact = findContact(row.r, p.payee);
  if (!contact)
    throw new RemoraError("contact.gone", "That person isn't one of its contacts anymore.", 409);
  await deps.db
    .update(approvals)
    .set({ status: "approved", decidedAt: new Date() })
    .where(eq(approvals.id, approvalId));
  return payContact(
    deps,
    row.r,
    {
      contact,
      amount: BigInt(p.amount),
      memo: p.reason ?? "",
      question: p.question ?? `pay ${contact.name}`,
    },
    { confirmed: true, trigger: { kind: "message", ref: `approval:${approvalId}` } },
  );
}
