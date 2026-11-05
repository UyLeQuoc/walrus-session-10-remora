/**
 * C2 (ADR-0138): a bill from a photo. A photo sent to an Errand (web or Telegram) is read by the
 * vision model into `{merchant, total, currency, date, items}`; the reply is a card: split it (the
 * Splitter and its pay link, ADR-0132) or pay a contact (the Errand's own limits, ADR-0125).
 *
 * - **Images are data, never instructions.** Nothing read from a photo pays, adds a contact or changes
 *   a rule: only the owner's tap on the card does. Text in the image that tells anyone to do
 *   something is quoted on the card, and Why? says it was treated as data.
 * - **Privacy:** the image is never stored or written to memory. Only the extracted line is
 *   remembered, once the owner acts on it ("[bill] Nov 6, dinner at Pho 24 0.40, split with Linh").
 * - An unclear total, or a currency that isn't USD/USDC, makes the card ask for the amount.
 */
import { and, eq, remoraEvents } from "@remora/db";
import { contactsOf, findContact } from "../money/contacts.ts";
import type { BillRead } from "./brain.ts";
import type { RuntimeDeps } from "./deps.ts";
import { payContact } from "./errand.ts";
import { addUsage, tokensToday } from "./limits.ts";
import { type Remora, RemoraError } from "./remoras.ts";
import { addExpense, settleUp } from "./splitter.ts";

export const BILL_MAX_BYTES = 5 * 1024 * 1024;
const USD = /^(USD|USDC|US\$|\$)$/i;

/** JPEG, PNG or WebP by their first bytes; anything else is refused before the model sees it. */
export function sniffImage(b: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47)
    return "image/png";
  if (
    b.length > 12 &&
    String.fromCharCode(...b.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...b.slice(8, 12)) === "WEBP"
  )
    return "image/webp";
  return null;
}

/** "12.4" → 12_400_000n (USDC has 6 decimals); null past 6 decimals or above 1,000,000. */
export function toUnits(total: string | null): bigint | null {
  if (!total || !/^\d{1,9}(\.\d{1,6})?$/.test(total)) return null;
  const [whole, frac = ""] = total.split(".");
  const units = BigInt(whole ?? "0") * 1_000_000n + BigInt(frac.padEnd(6, "0"));
  return units > 0n && units <= 1_000_000_000_000n ? units : null;
}

/** 400000n → "0.40"; more decimals only when the amount has them. */
const usdcText = (u: bigint) => {
  const n = Number(u) / 1e6;
  return Number.isInteger(n * 100) ? n.toFixed(2) : String(n);
};

export interface BillCard {
  eventId: string;
  readable: boolean;
  merchant: string | null;
  total: string | null;
  currency: string | null;
  date: string | null;
  items: BillRead["items"];
  /** Smallest USDC units, when the total is clear and in USD/USDC. */
  amount: string | null;
  /** What it asks before acting (unclear total, other currency, unreadable). */
  ask: string | null;
  /** Text in the image that told someone to do something: quoted, never followed. */
  instructions: string | null;
  /** The card's headline, e.g. "Dinner at Pho 24, 0.40 USDC. Split with Linh?" */
  text: string;
  contacts: string[];
  why: string;
}

/** The card for what the model read. Pure, so the golden fixtures test it with the model mocked. */
export function billCard(bill: BillRead, contacts: string[], eventId = ""): BillCard {
  const clearCurrency = !bill.currency || USD.test(bill.currency.trim());
  const units = bill.readable && !bill.totalUnclear && clearCurrency ? toUnits(bill.total) : null;
  const where = bill.merchant ? ` at ${bill.merchant}` : "";
  const ask = !bill.readable
    ? "I couldn't read a total in that photo. Type the amount, or send a clearer photo."
    : bill.totalUnclear
      ? `I see more than one total${bill.total ? ` (I read ${bill.total})` : ""}. Which amount should I use?`
      : !clearCurrency
        ? `That bill is in ${bill.currency}. How much is it in USDC?`
        : units === null
          ? "I couldn't read the total. Type the amount."
          : null;
  const first = contacts[0];
  const text = units
    ? `Bill${where}, ${usdcText(units)} USDC${bill.date ? ` (${bill.date})` : ""}.${first ? ` Split with ${first}?` : ""}`
    : `Bill${where}: ${ask}`;
  return {
    eventId,
    readable: bill.readable,
    merchant: bill.merchant,
    total: bill.total,
    currency: bill.currency,
    date: bill.date,
    items: bill.items.slice(0, 30),
    amount: units?.toString() ?? null,
    ask,
    instructions: bill.instructions?.trim() ? bill.instructions.trim().slice(0, 300) : null,
    text,
    contacts,
    why: bill.instructions?.trim()
      ? "Text in the image was treated as data: it asked for something, and nothing was done. Only your tap on this card acts."
      : "Read from the photo by the model; nothing is paid or split until you tap.",
  };
}

/** Reads one photo for an Errand. The image goes to the model and is then dropped. */
export async function readBillPhoto(
  deps: RuntimeDeps,
  r: Remora,
  bytes: Uint8Array,
  source: "web" | "telegram",
): Promise<BillCard> {
  if (r.template !== "errand")
    throw new RemoraError(
      "bill.not_errand",
      "Send bills to an Errand: it's the one that can pay people.",
    );
  if (r.status !== "active" && r.status !== "shadow")
    throw new RemoraError("remora.not_active", `${r.name} is ${r.status}.`, 409);
  if (bytes.length > BILL_MAX_BYTES)
    throw new RemoraError("bill.too_big", "That photo is over 5 MB: send a smaller one.");
  const mediaType = sniffImage(bytes);
  if (!mediaType) throw new RemoraError("bill.bad_image", "Send a JPEG, PNG or WebP photo.");
  if (!deps.brain.readBill)
    throw new RemoraError("bill.no_model", "Reading photos isn't set up on this server.", 409);
  if ((await tokensToday(deps.db, r.id)) >= deps.dailyTokens)
    throw new RemoraError("model.cap_reached", `${r.name} used today's model budget.`, 409);
  const { bill, tokens } = await deps.brain.readBill({ image: bytes, mediaType });
  await addUsage(deps.db, r.id, tokens);
  const contacts = contactsOf(r).map((c) => c.name);
  const card = billCard(bill, contacts);
  const [e] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "bill_read",
      summary: card.text.slice(0, 140),
      // What was read, never the image.
      payload: {
        source,
        merchant: card.merchant,
        total: card.total,
        currency: card.currency,
        date: card.date,
        items: card.items,
        amount: card.amount,
        ask: card.ask,
        instructions: card.instructions,
        why: card.why,
      },
    })
    .returning({ id: remoraEvents.id });
  return { ...card, eventId: e?.id ?? "" };
}

/** A card read earlier (Telegram's "Split or pay" link opens it on the web). */
export async function billOf(deps: Pick<RuntimeDeps, "db">, r: Remora, eventId: string) {
  const [e] = await deps.db
    .select()
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.id, eventId),
        eq(remoraEvents.remoraId, r.id),
        eq(remoraEvents.type, "bill_read"),
      ),
    );
  if (!e) throw new RemoraError("bill.not_found", "No such bill.", 404);
  const p = e.payload as Partial<BillCard> & { usedAt?: string; action?: string };
  return {
    eventId: e.id,
    readable: p.ask === null || p.amount != null,
    merchant: p.merchant ?? null,
    total: p.total ?? null,
    currency: p.currency ?? null,
    date: p.date ?? null,
    items: p.items ?? [],
    amount: p.amount ?? null,
    ask: p.ask ?? null,
    instructions: p.instructions ?? null,
    text: e.summary,
    contacts: contactsOf(r).map((c) => c.name),
    why: p.why ?? "",
    usedAt: p.usedAt ?? null,
  };
}

export type BillAction =
  | { kind: "split"; with: string[]; amount?: string }
  | { kind: "pay"; to: string; amount?: string };

/** The owner's tap on a card: split it, or pay a contact. The only path from a photo to money. */
export async function billAction(deps: RuntimeDeps, r: Remora, eventId: string, a: BillAction) {
  const [e] = await deps.db
    .select()
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.id, eventId),
        eq(remoraEvents.remoraId, r.id),
        eq(remoraEvents.type, "bill_read"),
      ),
    );
  if (!e) throw new RemoraError("bill.not_found", "No such bill.", 404);
  const p = e.payload as {
    merchant?: string | null;
    date?: string | null;
    amount?: string | null;
    usedAt?: string;
  };
  if (p.usedAt) throw new RemoraError("bill.used", "You already acted on this bill.", 409);
  // The owner's typed amount wins when the card asked for one.
  const amount = a.amount ? toUnits(a.amount) : p.amount ? BigInt(p.amount) : null;
  if (!amount) throw new RemoraError("bill.no_amount", "How much? Type the amount in USDC.");
  const memo = `${p.merchant ? `bill at ${p.merchant}` : "bill"}`.slice(0, 80);
  const day = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
  let lines: string[];
  let outcome: Record<string, unknown>;
  if (a.kind === "split") {
    const names = [...new Set(a.with.map((x) => x.trim()).filter(Boolean))].slice(0, 8);
    if (!names.length) throw new RemoraError("bill.no_people", "Split it with whom?");
    const added = await addExpense(deps, r, {
      payer: "me",
      amount: amount.toString(),
      memo,
      among: ["me", ...names],
    });
    const settled = await settleUp(
      deps,
      { ...r, config: added.remora.config },
      `split the ${memo}`,
    );
    lines = settled.lines;
    outcome = {
      split: names,
      links: settled.links.map((l) => ({ name: l.name, token: l.token, amount: l.amount })),
    };
  } else {
    const contact = findContact(r, a.to);
    if (!contact)
      throw new RemoraError(
        "bill.not_contact",
        `${a.to} isn't one of its contacts. Add them first (one signature).`,
      );
    const out = await payContact(deps, r, {
      contact,
      amount,
      memo,
      question: `pay ${contact.name} for the ${memo}`,
    });
    lines = [out.answer];
    outcome = {
      paid: contact.name,
      result: out.outcome,
      digest: out.digest ?? null,
      approvalId: out.approvalId ?? null,
    };
  }
  await deps.db
    .update(remoraEvents)
    .set({ payload: { ...p, usedAt: new Date().toISOString(), action: a.kind, ...outcome } })
    .where(eq(remoraEvents.id, eventId));
  // Only the line is remembered, never the image.
  const who = a.kind === "split" ? `split with ${a.with.join(", ")}` : `paid ${a.to}`;
  void deps.memory
    .remember(r, "me", "episode", `[bill] ${day}, ${memo} ${usdcText(amount)} USDC, ${who}`, {
      dedupe: false,
    })
    .catch((err) => deps.log.warn("bill.memory_failed", { remora: r.id, error: err }));
  return { lines, ...outcome };
}
