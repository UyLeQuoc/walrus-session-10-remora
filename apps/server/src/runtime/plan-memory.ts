/**
 * A1/A2 (ADR-0136, ADR-0137): what the remora's own memory changes in a plan. Two things narrow it,
 * both read from memory, both cited by blob id:
 * - **rules the owner accepted** (`config.rules`, each written as a `[rule]` memory that cites the
 *   outcomes behind it): `skip` drops a planned purchase, `ask` asks the owner instead of buying,
 *   `prefer` only reorders what's already planned;
 * - **its notes on each service**: the `SOURCE` track record the facts ledger keeps from its own
 *   memories. A service the owner rated mostly noise is skipped, and the skip cites the note.
 *
 * Nothing here adds a purchase. `asOf` reads both as they were then: rules accepted by that time and
 * the ledger's facts in effect then, which is how a replay plans with an older memory.
 */
import {
  type PlannerRule,
  type QuestionShape,
  ruleApplies,
  ruleText,
  shapesOf,
} from "@remora/schema";
import { payeeLabel } from "../money/reef.ts";
import type { RuntimeDeps } from "./deps.ts";
import type { RemoraRef } from "./memory.ts";

/** What a skip or an ask rests on. */
export interface MemorySkip {
  payee: string;
  reason: string;
  kind: "rule" | "memory";
  /** Walrus blob ids it cites. */
  cites: string[];
  ruleId?: string;
}

export interface TrackRecord {
  service: string;
  calls: number;
  useful: number;
  noise: number;
  /** The note's blobs, newest first. */
  blobIds: string[];
  since: string;
}

/** Skipped on its own notes: at least this many rated answers, under this share useful. */
export const MEMORY_SKIP = { rated: 3, usefulPct: 34 } as const;

const num = (re: RegExp, s: string) => Number(re.exec(s)?.[1] ?? 0);

/** "3 calls · 0 useful · 3 noise · …" → counts; null when it isn't a track record. */
export function parseTrackRecord(value: string) {
  if (!/\bcalls?\b/.test(value)) return null;
  return {
    calls: num(/(\d+)\s+calls?/, value),
    useful: num(/(\d+)\s+useful/, value),
    noise: num(/(\d+)\s+noise/, value),
  };
}

/** The ledger's `track_record` facts for Reef services, in effect at `asOf`. Fails open to none. */
export async function trackRecords(
  deps: Pick<RuntimeDeps, "facts" | "log">,
  r: RemoraRef,
  asOf: Date = new Date(),
): Promise<TrackRecord[]> {
  if (!deps.facts) return [];
  try {
    const facts = await deps.facts.list(r, ["sources"], { asOf });
    return facts.flatMap((f) => {
      if (f.predicate !== "track_record" || !/^reef:[a-z0-9-]+$/.test(f.subject) || f.hidden)
        return [];
      const c = parseTrackRecord(f.value);
      return c
        ? [{ service: f.subject, ...c, blobIds: f.blobIds, since: f.observedAt.slice(0, 10) }]
        : [];
    });
  } catch (err) {
    deps.log.warn("plan.track_records_failed", { remora: r.id, error: err });
    return [];
  }
}

/** Rules accepted by `asOf` (all of them when absent). */
export function rulesAt(config: unknown, asOf?: Date): PlannerRule[] {
  const rules = ((config as { rules?: PlannerRule[] } | null)?.rules ?? []).filter(Boolean);
  return asOf ? rules.filter((x) => Date.parse(x.acceptedAt) <= asOf.getTime()) : rules;
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Applies the rules, then the notes, to a plan. Pure: the caller reads the rules and records (as of
 * now, or as of an earlier time in a replay).
 */
export function applyMemory<T extends { entry: { ref: string } }>(input: {
  buys: T[];
  question: string;
  rules: PlannerRule[];
  records: TrackRecord[];
}): { keep: T[]; skips: MemorySkip[]; shapes: QuestionShape[] } {
  const shapes = shapesOf(input.question);
  const skips: MemorySkip[] = [];
  let keep: T[] = [];
  for (const b of input.buys) {
    const ref = b.entry.ref;
    const rule = input.rules.find(
      (x) => x.service === ref && x.action !== "prefer" && ruleApplies(x, shapes),
    );
    if (rule) {
      const text = rule.text || ruleText(rule);
      skips.push({
        payee: ref,
        kind: "rule",
        ruleId: rule.id,
        cites: rule.cites ?? [],
        reason:
          rule.action === "skip"
            ? `skipped ${payeeLabel(ref)}: your rule from ${day(rule.acceptedAt)} (“${text}”)`
            : `didn't buy ${payeeLabel(ref)} yet: your rule from ${day(rule.acceptedAt)} says ask first (“${text}”); say “buy it” to go ahead`,
      });
      continue;
    }
    const rec = input.records.find((x) => x.service === ref);
    const rated = rec ? rec.useful + rec.noise : 0;
    if (rec && rated >= MEMORY_SKIP.rated && rec.useful * 100 < MEMORY_SKIP.usefulPct * rated) {
      skips.push({
        payee: ref,
        kind: "memory",
        cites: rec.blobIds.slice(0, 3),
        reason: `skipped ${payeeLabel(ref)}: my notes say ${rec.useful} of ${rated} rated answers from it were useful (since ${day(rec.since)})`,
      });
      continue;
    }
    keep.push(b);
  }
  // `prefer` reorders only what's already planned: it never adds a service.
  for (const p of input.rules.filter((x) => x.action === "prefer" && ruleApplies(x, shapes))) {
    const i = keep.findIndex((b) => b.entry.ref === p.service);
    if (i > 0) keep = [keep[i] as T, ...keep.slice(0, i), ...keep.slice(i + 1)];
  }
  return { keep, skips, shapes };
}
