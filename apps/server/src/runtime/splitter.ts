/**
 * U18 B3 (ADR-0132): the Errand splits bills. "I paid 12 for dinner for Linh, Huy and me" keeps a
 * running balance between the owner and each person; "settle up" pays what the owner owes (each person
 * must be a contact, paid through the Errand's own limit) and makes a pay link for what each person
 * owes the owner: a public page where they pay from their own wallet, gas sponsored.
 */
import { randomBytes } from "node:crypto";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { remoras, sql } from "@remora/db";
import { findContact } from "../money/contacts.ts";
import { saveConfig } from "./config-versions.ts";
import type { RuntimeDeps } from "./deps.ts";
import { payContact } from "./errand.ts";
import { type Remora, RemoraError } from "./remoras.ts";

export const ME = "me";

export interface Expense {
  at: string;
  /** Who paid: "me" or a person's name. */
  payer: string;
  /** Smallest USDC units. */
  amount: string;
  memo: string;
  /** Everyone it was for, payer included when they took part. */
  among: string[];
}

export interface PayLink {
  token: string;
  name: string;
  amount: string;
  memo: string;
  createdAt: string;
  paidDigest?: string;
}

export interface Splits {
  expenses: Expense[];
  links: PayLink[];
  /** When the last "settle up" closed the book; expenses before it are settled. */
  settledAt?: string;
}

export const splitsOf = (r: { config: unknown }): Splits => ({
  expenses: [],
  links: [],
  ...((r.config as { splits?: Partial<Splits> }).splits ?? {}),
});

const units = (v: string) => {
  const [w = "0", f = ""] = v.replace(",", ".").split(".");
  return BigInt(w) * 1_000_000n + BigInt(`${f}000000`.slice(0, 6));
};
const usdc = (u: bigint) => (Number(u) / 1e6).toFixed(2);
const norm = (name: string) =>
  /^(me|i|myself|mình|tôi|tao)$/i.test(name.trim()) ? ME : name.trim();

/**
 * "I paid 12 for dinner for Linh, Huy and me", "Linh paid 9 for taxi for me and Huy",
 * "split 30 for groceries with Linh and Huy". Anything else isn't a split.
 */
export function parseSplit(text: string): Omit<Expense, "at"> | null {
  const t = text.trim().replace(/\s+/g, " ");
  const amount = "\\$?(\\d{1,6}(?:[.,]\\d{1,6})?)\\s*(?:usdc|usd|\\$)?";
  const list = (s: string) =>
    s
      .split(/\s*(?:,|\band\b|&|\bvà\b)\s*/i)
      .map((x) => x.trim())
      .filter(Boolean)
      .map(norm);
  const paid = new RegExp(`^(.+?) paid ${amount} for (.+?) for (.+)$`, "i").exec(t);
  if (paid?.[1] && paid[2] && paid[3] && paid[4]) {
    const among = [...new Set(list(paid[4]))];
    return { payer: norm(paid[1]), amount: units(paid[2]).toString(), memo: paid[3], among };
  }
  const split = new RegExp(`^split ${amount} for (.+?) with (.+)$`, "i").exec(t);
  if (split?.[1] && split[2] && split[3]) {
    const among = [...new Set([ME, ...list(split[3])])];
    return { payer: ME, amount: units(split[1]).toString(), memo: split[2], among };
  }
  return null;
}

/**
 * Net per person against the owner, in smallest units: positive means they owe the owner. Each share
 * is the amount divided evenly, rounded down; the remainder stays with whoever paid.
 */
export function balances(expenses: Expense[]): Map<string, bigint> {
  const net = new Map<string, bigint>();
  const add = (k: string, v: bigint) => net.set(k, (net.get(k) ?? 0n) + v);
  for (const e of expenses) {
    if (!e.among.length) continue;
    const share = BigInt(e.amount) / BigInt(e.among.length);
    for (const who of e.among) {
      if (who === e.payer) continue;
      // Only debts that involve the owner are the Errand's business.
      if (e.payer === ME) add(who, share);
      else if (who === ME) add(e.payer, -share);
    }
  }
  for (const [k, v] of net) if (v === 0n) net.delete(k);
  return net;
}

const open = (s: Splits) => s.expenses.filter((e) => !s.settledAt || e.at > s.settledAt);

export function balanceLines(s: Splits): string[] {
  const lines = [...balances(open(s))].map(([who, v]) =>
    v > 0n ? `${who} owes you ${usdc(v)} USDC` : `You owe ${who} ${usdc(-v)} USDC`,
  );
  return lines.length ? lines : ["Everyone is even."];
}

/** Records one expense; returns the new balances. */
export async function addExpense(deps: RuntimeDeps, r: Remora, e: Omit<Expense, "at">) {
  const next = await saveConfig(
    deps.db,
    r.id,
    (c) => {
      const s = splitsOf({ config: c });
      return {
        ...c,
        splits: {
          ...s,
          expenses: [...s.expenses, { ...e, at: new Date().toISOString() }].slice(-200),
        },
      };
    },
    { summary: () => `Split ${usdc(BigInt(e.amount))} USDC for ${e.memo.slice(0, 60)}.` },
  );
  return { remora: next, lines: balanceLines(splitsOf(next)) };
}

/**
 * Settles the book: the Errand pays each contact the owner owes (through its own limit), and makes a
 * pay link for each person who owes the owner. Someone the owner owes who isn't a contact is listed,
 * not paid.
 */
export async function settleUp(deps: RuntimeDeps, r: Remora, question: string) {
  const s = splitsOf(r);
  const memo = [...new Set(open(s).map((e) => e.memo))].join(", ").slice(0, 100);
  const lines: string[] = [];
  const links: PayLink[] = [];
  for (const [who, v] of balances(open(s))) {
    if (v < 0n) {
      const c = findContact(r, who);
      if (!c) {
        lines.push(`You owe ${who} ${usdc(-v)} USDC, but ${who} isn't a contact, so I didn't pay.`);
        continue;
      }
      const out = await payContact(deps, r, {
        contact: c,
        amount: -v,
        memo: `settle up: ${memo}`,
        question,
      });
      lines.push(out.answer);
    } else {
      const link: PayLink = {
        token: randomBytes(12).toString("base64url"),
        name: who,
        amount: v.toString(),
        memo: `settle up: ${memo}`,
        createdAt: new Date().toISOString(),
      };
      links.push(link);
      lines.push(`${who} owes you ${usdc(v)} USDC: ${deps.webBase}/pay/${link.token}`);
    }
  }
  await saveConfig(
    deps.db,
    r.id,
    (c) => {
      const now = splitsOf({ config: c });
      return {
        ...c,
        splits: {
          ...now,
          links: [...now.links, ...links].slice(-50),
          settledAt: new Date().toISOString(),
        },
      };
    },
    { summary: () => `Settled up (${lines.length} people).` },
  );
  return { lines: lines.length ? lines : ["Everyone is even."], links };
}

/** A pay link, for its public page: who it's from, to whom, how much. */
export async function payLinkOf(deps: Pick<RuntimeDeps, "db">, token: string) {
  if (!/^[A-Za-z0-9_-]{12,32}$/.test(token)) return null;
  const [r] = await deps.db
    .select()
    .from(remoras)
    .where(sql`${remoras.config}->'splits'->'links' @> ${JSON.stringify([{ token }])}::jsonb`)
    .limit(1);
  if (!r) return null;
  const link = splitsOf(r).links.find((l) => l.token === token);
  return link ? { r, link } : null;
}

/** The payer's transaction, read back: the owner got the amount; the link is marked paid. */
export async function confirmPayLink(deps: RuntimeDeps, token: string, digest: string) {
  const found = await payLinkOf(deps, token);
  if (!found) throw new RemoraError("paylink.not_found", "No such pay link.", 404);
  const { r, link } = found;
  if (link.paidDigest) return { paid: true, digest: link.paidDigest };
  const res = await deps.networks.client(r.network).core.getTransaction({
    digest,
    include: { effects: true, balanceChanges: true },
  });
  const tx = res.Transaction ?? res.FailedTransaction;
  const owner = normalizeSuiAddress(r.ownerAddress);
  const got = (tx.balanceChanges ?? []).some(
    (b) => normalizeSuiAddress(b.address) === owner && BigInt(b.amount) >= BigInt(link.amount),
  );
  if (!tx.effects?.status.success || !got)
    throw new RemoraError("paylink.unpaid", "That transaction didn't pay this link.");
  await saveConfig(
    deps.db,
    r.id,
    (c) => {
      const s = splitsOf({ config: c });
      return {
        ...c,
        splits: {
          ...s,
          links: s.links.map((l) => (l.token === token ? { ...l, paidDigest: digest } : l)),
        },
      };
    },
    { summary: () => `${link.name} paid you ${usdc(BigInt(link.amount))} USDC.` },
  );
  await deps.notifier
    .send(r.ownerAddress, {
      text: `${link.name} paid you ${usdc(BigInt(link.amount))} USDC (${link.memo}).`,
    })
    .catch(() => {});
  return { paid: true, digest };
}

/** Whether a message is for the splitter, and what it says back. */
export async function splitAsk(deps: RuntimeDeps, r: Remora, text: string) {
  const t = text.trim();
  if (/^(balances?|who owes( what)?\??|ai nợ ai\??)$/i.test(t))
    return { lines: balanceLines(splitsOf(r)) };
  if (/^settle( up)?\.?$/i.test(t)) return settleUp(deps, r, t);
  const e = parseSplit(t);
  if (!e) return null;
  if (e.among.length < 2)
    return { lines: ['Who was it for? e.g. "I paid 12 for dinner for Linh and me".'] };
  const { lines } = await addExpense(deps, r, e);
  return { lines: [`Noted ${usdc(BigInt(e.amount))} USDC for ${e.memo}.`, ...lines] };
}
