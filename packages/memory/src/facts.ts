/**
 * F15 (ADR-0074): facts a remora holds, and the rule that decides what a new one does to the old.
 *
 * A memory on Walrus is evidence: a line someone wrote, at a time, that can't be edited. A fact is
 * what that line asserts, in a slot (`subject`, `predicate`, optional `qualifier`), with when it's
 * true (`validFrom`/`validUntil`), when Remora heard it (`observedAt`) and who said it
 * (`assertedBy`). Recall finds both "I use pnpm" and "we moved to bun"; only the facts can say which
 * one is true now, and whether the newer one had the standing to replace the older.
 *
 * `reconcile` is deterministic: the same candidate against the same slot always gives the same
 * decision, so the ledger can be rebuilt by replaying the memories in the order they were written.
 * A newer fact is not automatically a truer one. An agent can't overwrite what the owner said; it
 * opens a dispute the owner settles.
 */
import { redactCredentials } from "./redact.ts";

/** Who said it, weakest first. The owner outranks Remora's own records, which outrank agents. */
export const AUTHORITIES = ["extractor", "agent", "runtime", "owner"] as const;
export type Authority = (typeof AUTHORITIES)[number];

/** `explicit`: the writer stated it. `inferred`: the extractor read it between the lines. */
export const VERIFICATIONS = ["inferred", "explicit"] as const;
export type Verification = (typeof VERIFICATIONS)[number];

/** `one`: a slot holds one value at a time (a timezone). `many`: values coexist (projects). */
export type Cardinality = "one" | "many";

/**
 * - `active`: the slot's latest version (for `one`, at most one per slot).
 * - `superseded`: an older version, or a closed interval in the past. Still history, still answers
 *   "what was true in March".
 * - `disputed`: a weaker source contradicted the active fact. Never read as true until the owner
 *   accepts it.
 * - `retracted`: the owner rejected it, or forgot its namespace.
 */
export type FactStatus = "active" | "superseded" | "disputed" | "retracted";

export interface FactInput {
  subject: string;
  predicate: string;
  qualifier?: string | null;
  value: string;
  cardinality: Cardinality;
  /** When it became true (ISO). Absent: from when it was heard. */
  validFrom?: string | null;
  validUntil?: string | null;
  /** When it stops being worth reading, whatever its validity (a one-off plan). */
  expiresAt?: string | null;
  /** When Remora heard it (ISO). Telling a decision made last year today: `observedAt` is today. */
  observedAt: string;
  assertedBy: Authority;
  verification: Verification;
  confidence: number;
}

export interface Fact extends FactInput {
  id: string;
  status: FactStatus;
  version: number;
}

export type SkipReason =
  | "empty"
  | "too_long"
  | "low_confidence"
  | "secret"
  | "bad_time"
  | "expired"
  | "ended_before_it_began";

export type Reconciliation =
  | { action: "skip"; reason: SkipReason }
  /**
   * Same value already held: more evidence, never a new version. `activate`: it was disputed and
   * nothing is active any more, so it becomes the slot's value.
   */
  | { action: "extend"; factId: string; activate?: true }
  | { action: "create" }
  /** A past interval that ended before the active fact began, kept as history. */
  | { action: "history"; validUntil: string; supersededBy: string }
  /**
   * The active fact ends at `validUntil`. `promote` names a disputed fact with the new value, which
   * becomes the active one instead of a new row: a source strong enough has now said it too.
   */
  | { action: "supersede"; factId: string; validUntil: string; promote?: string }
  | { action: "dispute"; factId: string };

export const MAX_VALUE_LENGTH = 300;
/** Below this the extractor is guessing; nothing is recorded. */
export const MIN_CONFIDENCE = 0.5;

const rank = (a: Authority) => AUTHORITIES.indexOf(a);
const vrank = (v: Verification) => VERIFICATIONS.indexOf(v);

/** Slot keys are lowercase words joined by `_`; `reef:brief` and `sui.network` keep their marks. */
export function slotPart(s: string): string {
  return s
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}:._-]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function slotKey(f: Pick<FactInput, "subject" | "predicate" | "qualifier">): string {
  const q = f.qualifier ? slotPart(f.qualifier) : "";
  return `${slotPart(f.subject)}.${slotPart(f.predicate)}${q ? `[${q}]` : ""}`;
}

/** Values compare without case, spacing or a closing full stop: "Vietnamese." is "vietnamese". */
export function sameValue(a: string, b: string): boolean {
  const n = (s: string) =>
    s
      .normalize("NFKC")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[.!\s]+$/, "")
      .trim();
  return n(a) === n(b);
}

const time = (iso: string | null | undefined): number | null => {
  if (iso === null || iso === undefined || iso === "") return null;
  const t = Date.parse(iso);
  return Number.isNaN(t) ? Number.NaN : t;
};

/** When a fact took effect: its own `validFrom`, else when it was heard. */
export const effectiveAt = (f: Pick<FactInput, "validFrom" | "observedAt">): string =>
  f.validFrom || f.observedAt;

function invalid(c: FactInput, now: number): SkipReason | null {
  if (!slotPart(c.subject) || !slotPart(c.predicate) || !c.value.trim()) return "empty";
  if (c.value.length > MAX_VALUE_LENGTH) return "too_long";
  if (!(c.confidence >= MIN_CONFIDENCE && c.confidence <= 1)) return "low_confidence";
  // The port redacts before Walrus; a fact is checked again so a key never becomes a slot value.
  const all = `${c.subject} ${c.predicate} ${c.qualifier ?? ""} ${c.value}`;
  if (/\[REDACTED/i.test(all) || redactCredentials(all).removed.length) return "secret";
  const times = [c.validFrom, c.validUntil, c.expiresAt, c.observedAt].map(time);
  if (times.some((t) => Number.isNaN(t)) || time(c.observedAt) === null) return "bad_time";
  const expires = time(c.expiresAt);
  if (expires !== null && expires <= now) return "expired";
  const until = time(c.validUntil);
  if (until !== null && until <= (time(effectiveAt(c)) ?? 0)) return "ended_before_it_began";
  return null;
}

/**
 * What a new fact does to the slot it lands in. `slot` holds the slot's facts that aren't
 * retracted, in any order.
 *
 * For a `one` slot whose active fact holds a different value:
 * 1. A closed interval that ended before the active fact began is history, not a conflict.
 * 2. A weaker source (lower authority, or the same authority with weaker verification) disputes;
 *    the active fact stays.
 * 3. Otherwise a fact that took effect at or after the active one supersedes it, which ends then.
 * 4. A stronger source that took effect earlier still supersedes: the active fact never held.
 * 5. An equal source that took effect earlier is a late report of the past: history, ending where
 *    the active fact begins ("in March I worked at A", while B holds since June).
 *
 * An active fact that has expired is superseded by whatever comes next.
 */
export function reconcile(c: FactInput, slot: readonly Fact[], now = Date.now()): Reconciliation {
  const bad = invalid(c, now);
  if (bad) return { action: "skip", reason: bad };

  const active = slot.find((f) => f.status === "active");
  const same = slot.find(
    (f) => (f.status === "active" || f.status === "disputed") && sameValue(f.value, c.value),
  );
  if (same && (same.status === "active" || c.cardinality === "many" || !active)) {
    return same.status === "disputed" && !active
      ? { action: "extend", factId: same.id, activate: true }
      : { action: "extend", factId: same.id };
  }
  if (c.cardinality === "many" || !active) return { action: "create" };

  // From here the slot holds one value, `active`, and the candidate says another. `same`, if set,
  // is a disputed fact the candidate repeats.
  const promote = same ? { promote: same.id } : {};
  const cEff = effectiveAt(c);
  const fEff = effectiveAt(active);
  const expiry = time(active.expiresAt);
  if (expiry !== null && expiry <= now) {
    return {
      action: "supersede",
      factId: active.id,
      validUntil: active.expiresAt as string,
      ...promote,
    };
  }
  const until = time(c.validUntil);
  if (until !== null && until <= (time(fEff) ?? 0)) {
    return same
      ? { action: "extend", factId: same.id }
      : { action: "history", validUntil: c.validUntil as string, supersededBy: active.id };
  }
  const weaker =
    rank(c.assertedBy) < rank(active.assertedBy) ||
    (rank(c.assertedBy) === rank(active.assertedBy) &&
      vrank(c.verification) < vrank(active.verification));
  if (weaker) {
    return same ? { action: "extend", factId: same.id } : { action: "dispute", factId: active.id };
  }
  if ((time(cEff) ?? 0) >= (time(fEff) ?? 0)) {
    return { action: "supersede", factId: active.id, validUntil: cEff, ...promote };
  }
  if (rank(c.assertedBy) > rank(active.assertedBy)) {
    return { action: "supersede", factId: active.id, validUntil: fEff, ...promote };
  }
  return same
    ? { action: "extend", factId: same.id }
    : { action: "history", validUntil: fEff, supersededBy: active.id };
}

/**
 * What was true at `at`, by validity: facts in effect then, whatever was learned later. Disputed and
 * retracted facts never count. "Where did I work in March?" is `currentAt(facts, march)`.
 */
export function currentAt<T extends Fact>(facts: readonly T[], at: number = Date.now()): T[] {
  return facts.filter((f) => {
    if (f.status !== "active" && f.status !== "superseded") return false;
    const from = time(effectiveAt(f)) ?? 0;
    const until = time(f.validUntil);
    const expires = time(f.expiresAt);
    return from <= at && (until === null || until > at) && (expires === null || expires > at);
  });
}

/**
 * Remora's own `sources` lines (feedback.ts) are parsed, not interpreted: the track record of a
 * Reef service, one value per source, asserted by the runtime.
 * `SOURCE reef:brief · 9 calls · 2 useful · 7 noise · $0.010 per useful answer · as_of 2026-10-31`
 */
export function parseSourceLine(
  text: string,
  observedAt: string,
): Omit<FactInput, "assertedBy"> | null {
  const m = /^SOURCE\s+(\S+)\s+·\s+(.+?)(?:\s+·\s+as_of\s+\d{4}-\d{2}-\d{2})?\s*$/.exec(
    text.trim(),
  );
  if (!m?.[1] || !m[2]) return null;
  return {
    subject: m[1],
    predicate: "track_record",
    value: m[2],
    cardinality: "one",
    observedAt,
    verification: "explicit",
    confidence: 1,
  };
}
