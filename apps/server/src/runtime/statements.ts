/**
 * E6 (ADR-0122): the owner's statement for a month, and the same month as a CSV, from what we already
 * record. One payment is one row, whoever paid it:
 * - **a remora's payment**: its `payment` event, with the Wake (`receipts`) behind it for the intent;
 * - **an owner-approved payment**: the `payment` event with `approvedBy: "owner"` (the owner's own
 *   wallet, not the Disc, so there's no `Paid` to match);
 * - **a settled Wake with no payment event** (the merchant answered an error after settling) and an
 *   **unexplained `Paid`** (ADR-0077's `action` event), so the statement adds up to what left onchain.
 * Rows are deduplicated by digest. `disc_events` marks a row matched when its `Paid` was indexed with
 * the same amount. A failed payment is a `blocked` event whose code isn't a deliberate refusal.
 */
import type { SuiNetwork } from "@remora/chain";
import {
  and,
  asc,
  type Db,
  discEvents,
  eq,
  inArray,
  isNotNull,
  lt,
  or,
  ownerSettings,
  receipts,
  remoraEvents,
  sql,
} from "@remora/db";
import type { Statement, StatementFlag } from "@remora/schema";
import { payeeLabel } from "../money/reef.ts";
import { RemoraError } from "./remoras.ts";

export interface LedgerPayment {
  at: Date;
  remoraId: string;
  /** A `reef:` ref (or another ref), or the address an unexplained payment went to. */
  payee: string;
  payTo: string | null;
  amount: bigint;
  digest: string | null;
  /** The Wake's intent hash, which is `Paid.intent` onchain. */
  intent: string | null;
  memo: string | null;
  paidBy: "remora" | "owner";
  /** Null when it didn't go through a Disc (the owner's wallet). */
  matched: boolean | null;
  receiptId: string | null;
}

export interface FailedPayment {
  at: Date;
  remoraId: string;
  code: string;
}

export interface PriceHike {
  at: Date;
  remoraId: string;
  summary: string;
  payee: string | null;
  amount: bigint | null;
  previous: bigint | null;
}

export interface Ledger {
  payments: LedgerPayment[];
  failures: FailedPayment[];
  hikes: PriceHike[];
}

/** A day under this never counts as a spike, whatever the median: 0.10 USDC. */
export const SPIKE_FLOOR = 100_000n;
export const SPIKE_TIMES = 3n;
export const SPIKE_DAYS = 14;
/** A price change is a payment ≥20% above or below the payee's previous one. */
export const PRICE_CHANGE_PERCENT = 20n;
export const FAILED_RUN = 3;

/**
 * Refusals that did what they were for (the safety check, the sale rules, an over-limit ask, a paused
 * remora); they aren't failures. Every other `blocked` code is: the payment was meant to go and didn't.
 */
const REFUSAL = /^(sonar\.|sale\.)|^(over_limit|remora\.not_active)$/;
export const isFailure = (code: string) => !REFUSAL.test(code);

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const DIGITS = /^\d{1,30}$/;
const units = (v: unknown): bigint | null =>
  typeof v === "string" && DIGITS.test(v) ? BigInt(v) : null;
const text = (v: unknown) => (typeof v === "string" && v ? v : null);

/** `YYYY-MM-DD` in a timezone (one formatter per call site, not per row). */
export function dayIn(timeZone: string): (at: Date) => string {
  const f = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return (at) => {
    const p = Object.fromEntries(f.formatToParts(at).map((x) => [x.type, x.value]));
    return `${p.year}-${p.month}-${p.day}`;
  };
}

export function validTimezone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

export function checkMonth(month: string): string {
  if (!MONTH.test(month)) throw new RemoraError("statement.bad_month", "Pick a month as YYYY-MM.");
  return month;
}

const addDays = (day: string, n: number) => {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + n)).toISOString().slice(0, 10);
};

export function daysOf(month: string): string[] {
  const [y, m] = checkMonth(month).split("-").map(Number);
  const n = new Date(Date.UTC(y ?? 1970, m ?? 1, 0)).getUTCDate();
  return Array.from({ length: n }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

/** Everything recorded before this covers the month in any timezone: the 2nd of the next month, UTC. */
export function monthEnd(month: string): Date {
  const [y, m] = checkMonth(month).split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, m ?? 1, 2));
}

/** "0.015", "2.00": at least two decimals, as many as the amount needs. */
export function usdcText(v: bigint): string {
  const frac = (v % 1_000_000n).toString().padStart(6, "0").replace(/0+$/, "");
  return `${v / 1_000_000n}.${frac.padEnd(2, "0")}`;
}

/** The exact decimal, for a spreadsheet: "0.010000". */
const usdcExact = (v: bigint) =>
  `${v / 1_000_000n}.${(v % 1_000_000n).toString().padStart(6, "0")}`;

export const labelOf = (payee: string) =>
  /^0x[0-9a-fA-F]+$/.test(payee) ? `${payee.slice(0, 6)}…${payee.slice(-4)}` : payeeLabel(payee);

const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

function median(values: bigint[]): bigint {
  const s = [...values].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  if (!s.length) return 0n;
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? (s[mid] ?? 0n) : ((s[mid - 1] ?? 0n) + (s[mid] ?? 0n)) / 2n;
}

interface Bucket {
  amount: bigint;
  payments: number;
}
const add = (m: Map<string, Bucket>, key: string, amount: bigint) => {
  const b = m.get(key) ?? { amount: 0n, payments: 0 };
  m.set(key, { amount: b.amount + amount, payments: b.payments + 1 });
};

export interface StatementInput {
  month: string;
  timezone: string;
  network: SuiNetwork;
  /** Every payment up to the month's end; earlier ones are the baselines. */
  ledger: Ledger;
  names: Map<string, string>;
}

/** The month's payments, oldest first. */
export function paymentsIn(month: string, timezone: string, payments: LedgerPayment[]) {
  const day = dayIn(timezone);
  return payments
    .filter((p) => day(p.at).slice(0, 7) === month)
    .sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function statementOf(input: StatementInput): Statement {
  const { month, timezone, ledger, names } = input;
  const day = dayIn(timezone);
  const all = [...ledger.payments].sort((a, b) => a.at.getTime() - b.at.getTime());
  const inMonth = (at: Date) => day(at).slice(0, 7) === month;
  const mine = all.filter((p) => inMonth(p.at));
  const nameOf = (id: string) => names.get(id) ?? "A remora";
  const flags: StatementFlag[] = [];
  const flag = (
    f: Partial<Omit<StatementFlag, "day" | "at">> &
      Pick<StatementFlag, "kind" | "summary"> & { at: Date },
  ) =>
    flags.push({
      remoraId: null,
      remora: null,
      payee: null,
      amount: null,
      baseline: null,
      count: null,
      digest: null,
      ...f,
      day: day(f.at),
      at: f.at.toISOString(),
    });

  const byDay = new Map<string, Bucket>();
  const lastAt = new Map<string, Date>();
  for (const p of all) {
    add(byDay, day(p.at), p.amount);
    lastAt.set(day(p.at), p.at);
  }
  const days = daysOf(month).map((d) => ({
    day: d,
    amount: (byDay.get(d)?.amount ?? 0n).toString(),
    payments: byDay.get(d)?.payments ?? 0,
  }));

  for (const d of daysOf(month)) {
    const total = byDay.get(d)?.amount ?? 0n;
    if (total < SPIKE_FLOOR) continue;
    const usual = median(
      Array.from({ length: SPIKE_DAYS }, (_, i) => byDay.get(addDays(d, -1 - i))?.amount ?? 0n),
    );
    if (total <= SPIKE_TIMES * usual) continue;
    flag({
      kind: "spike",
      at: lastAt.get(d) ?? new Date(`${d}T12:00:00Z`),
      amount: total.toString(),
      baseline: usual.toString(),
      summary: `${usdcText(total)} USDC on ${dayLabel(d)}: a usual day of the 14 before was ${usdcText(usual)}.`,
    });
  }

  const first = new Map<string, LedgerPayment>();
  const previous = new Map<string, bigint>();
  for (const p of all) {
    if (!first.has(p.payee)) {
      first.set(p.payee, p);
      if (inMonth(p.at))
        flag({
          kind: "new_payee",
          at: p.at,
          remoraId: p.remoraId,
          remora: nameOf(p.remoraId),
          payee: labelOf(p.payee),
          amount: p.amount.toString(),
          digest: p.digest,
          summary: `First payment to ${labelOf(p.payee)}: ${usdcText(p.amount)} USDC from ${nameOf(p.remoraId)}.`,
        });
    }
    // A service has a price; people (an Errand's contacts) are paid what each errand costs.
    if (!p.payee.startsWith("reef:")) continue;
    const before = previous.get(p.payee);
    previous.set(p.payee, p.amount);
    if (before === undefined || before === 0n || !inMonth(p.at)) continue;
    const delta = p.amount > before ? p.amount - before : before - p.amount;
    if (delta * 100n < PRICE_CHANGE_PERCENT * before) continue;
    const pct = Number((delta * 100n) / before);
    flag({
      kind: "price_change",
      at: p.at,
      remoraId: p.remoraId,
      remora: nameOf(p.remoraId),
      payee: labelOf(p.payee),
      amount: p.amount.toString(),
      baseline: before.toString(),
      digest: p.digest,
      summary: `${labelOf(p.payee)} charged ${usdcText(p.amount)} USDC, ${p.amount > before ? "up" : "down"} ${pct}% from ${usdcText(before)}.`,
    });
  }

  for (const h of ledger.hikes) {
    if (!inMonth(h.at)) continue;
    flag({
      kind: "price_hike",
      at: h.at,
      remoraId: h.remoraId,
      remora: nameOf(h.remoraId),
      payee: h.payee ? labelOf(h.payee) : null,
      amount: h.amount?.toString() ?? null,
      baseline: h.previous?.toString() ?? null,
      summary: h.summary,
    });
  }

  // A run: failed payments from one remora with no payment of its own in between.
  const attempts = [
    ...all
      .filter((p) => p.paidBy === "remora")
      .map((p) => ({ at: p.at, remoraId: p.remoraId, code: null as string | null })),
    ...ledger.failures.map((f) => ({
      at: f.at,
      remoraId: f.remoraId,
      code: f.code as string | null,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  const runs = new Map<string, { at: Date; code: string }[]>();
  const close = (remoraId: string) => {
    const run = runs.get(remoraId) ?? [];
    runs.delete(remoraId);
    const third = run[FAILED_RUN - 1];
    if (!third || !inMonth(third.at)) return;
    const last = run.at(-1) ?? third;
    flag({
      kind: "failed_run",
      at: third.at,
      remoraId,
      remora: nameOf(remoraId),
      count: run.length,
      summary: `${nameOf(remoraId)}: ${run.length} payments in a row failed (${last.code}).`,
    });
  };
  for (const a of attempts) {
    if (a.code === null) close(a.remoraId);
    else runs.set(a.remoraId, [...(runs.get(a.remoraId) ?? []), { at: a.at, code: a.code }]);
  }
  for (const id of [...runs.keys()]) close(id);

  const byRemora = new Map<string, Bucket>();
  const byPayee = new Map<string, Bucket>();
  let total = 0n;
  let byOwner = 0n;
  for (const p of mine) {
    add(byRemora, p.remoraId, p.amount);
    add(byPayee, p.payee, p.amount);
    total += p.amount;
    if (p.paidBy === "owner") byOwner += p.amount;
  }
  const desc = <T extends { amount: bigint }>(a: T, b: T) =>
    a.amount < b.amount ? 1 : a.amount > b.amount ? -1 : 0;

  return {
    month,
    timezone,
    network: input.network,
    total: total.toString(),
    payments: mine.length,
    byRemoras: (total - byOwner).toString(),
    byOwner: byOwner.toString(),
    failed: ledger.failures.filter((f) => inMonth(f.at)).length,
    days,
    remoras: [...byRemora.entries()]
      .map(([id, b]) => ({ id, ...b }))
      .sort(desc)
      .map((b) => ({
        id: b.id,
        name: nameOf(b.id),
        amount: b.amount.toString(),
        payments: b.payments,
      })),
    payees: [...byPayee.entries()]
      .map(([payee, b]) => ({ payee, ...b }))
      .sort(desc)
      .map((b) => ({
        payee: b.payee,
        label: labelOf(b.payee),
        amount: b.amount.toString(),
        payments: b.payments,
        firstPaid: (first.get(b.payee)?.at ?? new Date(0)).toISOString(),
      })),
    flags: flags.sort((a, b) => a.at.localeCompare(b.at)),
  };
}

export const CSV_COLUMNS = [
  "time",
  "remora",
  "payee",
  "pay_to",
  "amount_usdc",
  "amount_units",
  "digest",
  "intent",
  "memo",
  "verify_url",
  "paid_by",
  "matched_onchain",
] as const;

/** RFC 4180 quoting; a cell a spreadsheet would run as a formula (`=`, `+`, `-`, `@`) starts with `'`. */
export function csvCell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/** One row per payment, oldest first. The verify link takes a digest, or the Wake's id without one. */
export function statementCsv(
  payments: LedgerPayment[],
  names: Map<string, string>,
  webBase: string,
): string {
  const base = webBase.replace(/\/+$/, "");
  const lines = payments.map((p) => {
    const ref = p.digest ?? p.receiptId;
    return [
      p.at.toISOString(),
      names.get(p.remoraId) ?? p.remoraId,
      labelOf(p.payee),
      p.payTo ?? "",
      usdcExact(p.amount),
      p.amount.toString(),
      p.digest ?? "",
      p.intent ?? "",
      p.memo ?? "",
      ref ? `${base}/verify/${ref}` : "",
      p.paidBy === "owner" ? "owner-approved" : "remora",
      p.matched === null ? "n/a" : p.matched ? "yes" : "no",
    ]
      .map(csvCell)
      .join(",");
  });
  return `${[CSV_COLUMNS.join(","), ...lines].join("\r\n")}\r\n`;
}

export async function ownerTimezone(db: Db, owner: string): Promise<string> {
  const [s] = await db
    .select({ timezone: ownerSettings.timezone })
    .from(ownerSettings)
    .where(eq(ownerSettings.ownerAddress, owner));
  return validTimezone(s?.timezone);
}

/** The owner's payments, failures and price hikes recorded before `until`, for these remoras. */
export async function loadLedger(
  db: Db,
  remoraIds: string[],
  network: SuiNetwork,
  until: Date,
  reef: { ref: string; payTo: string }[],
): Promise<Ledger> {
  if (!remoraIds.length) return { payments: [], failures: [], hikes: [] };
  const events = await db
    .select({
      remoraId: remoraEvents.remoraId,
      type: remoraEvents.type,
      payload: remoraEvents.payload,
      receiptId: remoraEvents.receiptId,
      createdAt: remoraEvents.createdAt,
    })
    .from(remoraEvents)
    .where(
      and(
        inArray(remoraEvents.remoraId, remoraIds),
        eq(remoraEvents.network, network),
        lt(remoraEvents.createdAt, until),
        or(
          inArray(remoraEvents.type, ["payment", "blocked", "price_hike"]),
          sql`(${remoraEvents.type} = 'action' and ${remoraEvents.payload}->>'unexplained' = 'true')`,
        ),
      ),
    )
    .orderBy(asc(remoraEvents.createdAt), asc(remoraEvents.id));
  const decision = sql`${receipts.wake}->'intent'->'decision'`;
  const wakes = await db
    .select({
      id: receipts.id,
      remoraId: receipts.remoraId,
      intentHash: receipts.intentHash,
      txDigest: receipts.txDigest,
      anchored: receipts.anchored,
      createdAt: receipts.createdAt,
      payee: sql<string | null>`${decision}->>'payee'`,
      payTo: sql<string | null>`${decision}->>'payTo'`,
      amount: sql<string | null>`${decision}->>'amount'`,
      memo: sql<string | null>`coalesce(${decision}->>'memo', ${receipts.wake}->>'memo')`,
    })
    .from(receipts)
    .where(
      and(
        inArray(receipts.remoraId, remoraIds),
        eq(receipts.network, network),
        isNotNull(receipts.txDigest),
        lt(receipts.createdAt, until),
        sql`${decision}->>'action' = 'pay'`,
      ),
    )
    .orderBy(asc(receipts.createdAt), asc(receipts.id));
  const wakeById = new Map(wakes.map((w) => [w.id, w]));
  const payToOf = (payee: string) => reef.find((e) => e.ref === payee)?.payTo ?? null;

  const payments: LedgerPayment[] = [];
  const failures: FailedPayment[] = [];
  const hikes: PriceHike[] = [];
  const seen = new Set<string>();
  const push = (p: LedgerPayment) => {
    if (p.digest && seen.has(p.digest)) return;
    if (p.digest) seen.add(p.digest);
    payments.push(p);
  };
  for (const e of events) {
    const p = e.payload;
    if (e.type === "blocked") {
      const code = text(p.code) ?? "unknown";
      if (isFailure(code)) failures.push({ at: e.createdAt, remoraId: e.remoraId, code });
      continue;
    }
    if (e.type === "price_hike") {
      hikes.push({
        at: e.createdAt,
        remoraId: e.remoraId,
        summary: text(p.summary) ?? "",
        payee: text(p.payee),
        amount: units(p.amount) ?? units(p.to) ?? units(p.price),
        previous: units(p.previous) ?? units(p.from) ?? units(p.usual),
      });
      continue;
    }
    if (e.type !== "payment") continue;
    const w = e.receiptId ? wakeById.get(e.receiptId) : undefined;
    const payee = text(p.payee) ?? w?.payee ?? "unknown";
    const owner = p.approvedBy === "owner";
    push({
      at: e.createdAt,
      remoraId: e.remoraId,
      payee,
      payTo: w?.payTo ?? text(p.payTo) ?? payToOf(payee),
      amount: units(p.amount) ?? units(w?.amount) ?? 0n,
      digest: text(p.digest) ?? w?.txDigest ?? null,
      intent: w?.intentHash ?? null,
      memo: text(p.memo) ?? w?.memo ?? null,
      paidBy: owner ? "owner" : "remora",
      matched: owner ? null : (w?.anchored ?? false),
      receiptId: w?.id ?? null,
    });
  }
  for (const w of wakes) {
    if (!w.txDigest || seen.has(w.txDigest)) continue;
    push({
      at: w.createdAt,
      remoraId: w.remoraId,
      payee: w.payee ?? "unknown",
      payTo: w.payTo,
      amount: units(w.amount) ?? 0n,
      digest: w.txDigest,
      intent: w.intentHash,
      memo: w.memo,
      paidBy: "remora",
      matched: w.anchored,
      receiptId: w.id,
    });
  }
  for (const e of events) {
    if (e.type !== "action") continue;
    const p = e.payload;
    const payTo = text(p.payTo);
    push({
      at: e.createdAt,
      remoraId: e.remoraId,
      payee: payTo ?? "unknown",
      payTo,
      amount: units(p.amount) ?? 0n,
      digest: text(p.digest),
      intent: null,
      memo: null,
      paidBy: "remora",
      matched: false,
      receiptId: null,
    });
  }

  // A `Paid` the indexer stored for the same digest and amount confirms the row from the chain.
  const digests = payments.flatMap((p) => (p.digest && p.paidBy === "remora" ? [p.digest] : []));
  if (digests.length) {
    const paid = await db
      .select({
        digest: discEvents.txDigest,
        amount: sql<string>`${discEvents.payload}->>'amount'`,
      })
      .from(discEvents)
      .where(
        and(
          eq(discEvents.network, network),
          eq(discEvents.type, "Paid"),
          inArray(discEvents.txDigest, digests),
        ),
      );
    const onchain = new Map(paid.map((x) => [x.digest, x.amount]));
    for (const p of payments)
      if (p.matched === false && p.digest && onchain.get(p.digest) === p.amount.toString())
        p.matched = true;
  }
  return { payments, failures, hikes };
}
