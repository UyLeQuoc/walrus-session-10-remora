/**
 * A3 (ADR-0147): a remora tidies its memory, weekly after its review and when the owner asks.
 *
 * - **Consolidate:** each 👍/👎 writes the next version of a service's track record
 *   (`SOURCE reef:x · …`, feedback.ts), so one service collects a blob per rating. When the newest
 *   3 or more versions say the same thing (the same verdict: mostly useful, or mostly noise), they
 *   become one note that restates the newest and names them, `· SOURCE: tidy of <blob ids>`. The
 *   facts ledger reads it as more evidence for the same record (packages/memory `parseSourceLine`),
 *   then the old blobs are hidden with F4's local filter. They stay on Walrus.
 * - **Conflicts:** two notes that disagree (a useful version and a noise version of one service's
 *   record within 7 days; the record carries no question shape, so the service is the scope), or a
 *   `skip`/`ask` rule and a `prefer` rule for one service that can apply to the same question,
 *   become an approval (kind `rule_conflict`, `payload.kind = "conflict"`): "Which one holds?". The
 *   owner picks; the other note gets a `[correction]` that names its blob (memory-controls
 *   `correct`, which the ledger reads as the owner's), or the other rule is removed and its `[rule]`
 *   memory corrected. A service with an open conflict isn't consolidated until it's settled.
 * - **Recency** is in plan-memory.ts: newer outcomes weigh more when the planner reads a record.
 */
import {
  and,
  approvals,
  desc,
  eq,
  inArray,
  isNotNull,
  remoraEvents,
  remoraMemories,
  remoras,
  sql,
} from "@remora/db";
import { effectiveAt } from "@remora/memory";
import type { PlannerRule, QuestionShape } from "@remora/schema";
import { payeeLabel } from "../money/reef.ts";
import type { RuntimeDeps } from "./deps.ts";
import type { FactView } from "./facts.ts";
import { removeRule } from "./heartbeat.ts";
import { correct } from "./memory-controls.ts";
import { parseTrackRecord, rulesAt } from "./plan-memory.ts";
import { type Remora, RemoraError, type RemoraService } from "./remoras.ts";

const DAY_MS = 86_400_000;
export const TIDY = {
  minNotes: 3,
  conflictDays: 7,
  maxMerges: 5,
  maxConflicts: 3,
} as const;

export type Verdict = "useful" | "noise" | "mixed";

/** One version of a service's track record, as the ledger holds it. */
export interface NoteVersion {
  factId: string;
  service: string;
  value: string;
  /** When it took effect (ISO). */
  at: string;
  status: FactView["status"];
  /** Its blobs that aren't hidden yet. */
  blobIds: string[];
}

/** "3 calls · 0 useful · 3 noise" → noise; null when it isn't a rated track record. */
export function verdictOf(value: string): Verdict | null {
  const c = parseTrackRecord(value);
  if (!c || c.useful + c.noise === 0) return null;
  return c.useful > c.noise ? "useful" : c.noise > c.useful ? "noise" : "mixed";
}

/** The ledger's track records for Reef services, as versions with their visible blobs. */
export function noteVersions(facts: FactView[], hidden: ReadonlySet<string>): NoteVersion[] {
  return facts.flatMap((f) => {
    if (f.predicate !== "track_record" || !/^reef:[a-z0-9-]+$/.test(f.subject)) return [];
    // Someone else's word (a starter pack, ADR-0131) is shown as it is, never merged.
    if (/\bSOURCE:\s*(pack|import)\b/.test(f.value)) return [];
    return [
      {
        factId: f.id,
        service: f.subject,
        value: f.value,
        at: effectiveAt(f),
        status: f.status,
        blobIds: f.blobIds.filter((b) => !hidden.has(b)),
      },
    ];
  });
}

export interface MergeGroup {
  service: string;
  verdict: Exclude<Verdict, "mixed">;
  /** Oldest first; the last is the record in effect. */
  notes: NoteVersion[];
  blobIds: string[];
}

const byService = (versions: NoteVersion[]) => {
  const m = new Map<string, NoteVersion[]>();
  for (const v of versions) m.set(v.service, [...(m.get(v.service) ?? []), v]);
  for (const list of m.values()) list.sort((a, b) => a.at.localeCompare(b.at));
  return m;
};

/**
 * Pure: per service, the newest run of versions with the same clear verdict, ending at the record in
 * effect, when it spans at least `minNotes` visible blobs.
 */
export function groupForMerge(versions: NoteVersion[], minNotes: number = TIDY.minNotes) {
  const out: MergeGroup[] = [];
  for (const [service, list] of byService(versions)) {
    const latest = list.at(-1);
    const verdict = latest ? verdictOf(latest.value) : null;
    if (latest?.status !== "active" || !verdict || verdict === "mixed") continue;
    const run: NoteVersion[] = [];
    for (let i = list.length - 1; i >= 0; i--) {
      const v = list[i] as NoteVersion;
      if (verdictOf(v.value) !== verdict) break;
      run.unshift(v);
    }
    const blobIds = [...new Set(run.flatMap((v) => v.blobIds))];
    if (blobIds.length >= minNotes) out.push({ service, verdict, notes: run, blobIds });
  }
  return out;
}

export interface ConflictOption {
  label: string;
  at: string;
  /** A note: its blobs. */
  blobIds?: string[];
  value?: string;
  /** A rule: its id and line. */
  ruleId?: string;
}

export interface Conflict {
  what: "notes" | "rules";
  service: string;
  /** The same pair is asked about once, whatever the owner answered. */
  key: string;
  a: ConflictOption;
  b: ConflictOption;
}

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/**
 * Pure: per service, the newest version that said useful and the newest that said noise, when both
 * are from the last `days` days and still have a visible blob.
 */
export function noteConflicts(
  versions: NoteVersion[],
  now: Date = new Date(),
  days: number = TIDY.conflictDays,
): Conflict[] {
  const since = now.getTime() - days * DAY_MS;
  const out: Conflict[] = [];
  for (const [service, list] of byService(versions)) {
    const recent = list.filter((v) => Date.parse(v.at) >= since && v.blobIds.length);
    const last = (verdict: Verdict) => recent.filter((v) => verdictOf(v.value) === verdict).at(-1);
    const useful = last("useful");
    const noise = last("noise");
    if (!useful || !noise) continue;
    const opt = (v: NoteVersion, verdict: Verdict): ConflictOption => ({
      label: `${day(v.at)}: ${payeeLabel(service)} was mostly ${verdict} (${v.value})`,
      at: v.at,
      blobIds: v.blobIds,
      value: v.value,
    });
    out.push({
      what: "notes",
      service,
      key: `notes:${service}:${useful.blobIds[0]}:${noise.blobIds[0]}`,
      a: opt(useful, "useful"),
      b: opt(noise, "noise"),
    });
  }
  return out;
}

/** Can two rules apply to the same question? Only when neither needs a shape the other excludes. */
export function overlap(a: Pick<PlannerRule, "when">, b: Pick<PlannerRule, "when">): boolean {
  const has = (r: Pick<PlannerRule, "when">) => r.when?.has ?? [];
  const lacks = (r: Pick<PlannerRule, "when">) => r.when?.lacks ?? [];
  const clash = (x: QuestionShape[], y: QuestionShape[]) => x.some((s) => y.includes(s));
  return !clash(has(a), lacks(b)) && !clash(has(b), lacks(a));
}

/** Pure: a `skip` or `ask` rule and a `prefer` rule for one service that can both apply. */
export function ruleConflicts(rules: PlannerRule[]): Conflict[] {
  const out: Conflict[] = [];
  for (const narrow of rules.filter((r) => r.action !== "prefer"))
    for (const prefer of rules.filter((r) => r.action === "prefer")) {
      if (narrow.service !== prefer.service || !overlap(narrow, prefer)) continue;
      const opt = (r: PlannerRule): ConflictOption => ({
        label: `${day(r.acceptedAt)}: “${r.text}”`,
        at: r.acceptedAt,
        ruleId: r.id,
      });
      out.push({
        what: "rules",
        service: narrow.service,
        key: `rules:${[narrow.id, prefer.id].sort().join(":")}`,
        a: opt(narrow),
        b: opt(prefer),
      });
    }
  return out;
}

export interface TidyMerge {
  service: string;
  verdict: MergeGroup["verdict"];
  value: string;
  blobIds: string[];
  /** The tidy note's index row (its blob lands about 25 s later). */
  noteId: string | null;
}

export interface TidyResult {
  eventId: string | null;
  merged: TidyMerge[];
  hidden: string[];
  conflicts: string[];
  note: string;
}

async function hiddenBlobs(deps: Pick<RuntimeDeps, "db">, r: Remora) {
  const rows = await deps.db
    .select({ blobId: remoraMemories.blobId })
    .from(remoraMemories)
    .where(and(eq(remoraMemories.remoraId, r.id), isNotNull(remoraMemories.hiddenAt)));
  return new Set(rows.flatMap((x) => (x.blobId ? [x.blobId] : [])));
}

/** Runs one tidy: conflicts first (a disputed service waits), then the merges. */
export async function tidy(
  deps: RuntimeDeps,
  r: Remora,
  opts: { trigger: "weekly" | "owner"; now?: Date } = { trigger: "owner" },
): Promise<TidyResult> {
  const now = opts.now ?? new Date();
  const hidden = await hiddenBlobs(deps, r);
  const facts = deps.facts ? await deps.facts.list(r, ["sources"]) : [];
  const versions = noteVersions(facts, hidden);
  const asked = await deps.db
    .select({ status: approvals.status, payload: approvals.payload })
    .from(approvals)
    .where(and(eq(approvals.remoraId, r.id), eq(approvals.kind, "rule_conflict")));
  const keys = new Set(asked.map((a) => String((a.payload as { key?: string }).key ?? "")));
  const waiting = new Set(
    asked
      .filter((a) => a.status === "pending")
      .map((a) => String((a.payload as { service?: string }).service ?? "")),
  );
  const fresh = [...noteConflicts(versions, now), ...ruleConflicts(rulesAt(r.config))]
    .filter((c) => !keys.has(c.key) && !waiting.has(c.service))
    .slice(0, TIDY.maxConflicts);
  const conflicts: string[] = [];
  for (const c of fresh) {
    const [a] = await deps.db
      .insert(approvals)
      .values({
        remoraId: r.id,
        network: r.network,
        kind: "rule_conflict",
        summary: `Which one holds? Two of ${r.name}'s ${c.what} on ${payeeLabel(c.service)} disagree.`,
        payload: { kind: "conflict", ...c },
      })
      .returning({ id: approvals.id });
    if (a) conflicts.push(a.id);
    waiting.add(c.service);
  }

  const merged: TidyMerge[] = [];
  const hid: string[] = [];
  for (const g of groupForMerge(versions)
    .filter((x) => !waiting.has(x.service))
    .slice(0, TIDY.maxMerges)) {
    const latest = g.notes.at(-1) as NoteVersion;
    const line = `SOURCE ${g.service} · ${latest.value} · as_of ${now.toISOString().slice(0, 10)} · SOURCE: tidy of ${g.blobIds.join(", ")}`;
    const res = await deps.memory
      .remember(r, "sources", "source", line, { dedupe: false })
      .catch((err) => {
        deps.log.warn("tidy.note_failed", { remora: r.id, service: g.service, error: err });
        return null;
      });
    // Nothing is hidden unless the note that replaces them was accepted.
    if (!res?.saved) continue;
    // The ledger reads the note as the same record before its old blobs are hidden, so the
    // planner never sees the record vanish.
    await deps.facts?.idle();
    await deps.db
      .update(remoraMemories)
      .set({ hiddenAt: now })
      .where(and(eq(remoraMemories.remoraId, r.id), inArray(remoraMemories.blobId, g.blobIds)));
    hid.push(...g.blobIds);
    merged.push({
      service: g.service,
      verdict: g.verdict,
      value: latest.value,
      blobIds: g.blobIds,
      noteId: res.indexId ?? null,
    });
  }

  const parts = [
    merged.length
      ? `merged ${merged.map((m) => `${m.blobIds.length} notes on ${payeeLabel(m.service)}`).join(", ")} into one each`
      : "",
    conflicts.length
      ? `${conflicts.length} conflict${conflicts.length === 1 ? "" : "s"} to settle`
      : "",
  ].filter(Boolean);
  const note = parts.length
    ? `Tidied: ${parts.join("; ")}.`
    : "Nothing to tidy: no 3 notes say the same thing, and nothing disagrees.";
  let eventId: string | null = null;
  if (merged.length || conflicts.length || opts.trigger === "owner") {
    const [e] = await deps.db
      .insert(remoraEvents)
      .values({
        remoraId: r.id,
        network: r.network,
        type: "action",
        summary: note,
        payload: { kind: "tidy", trigger: opts.trigger, merged, hidden: hid, conflicts },
      })
      .returning({ id: remoraEvents.id });
    eventId = e?.id ?? null;
  }
  if (conflicts.length)
    await deps.notifier
      .send(r.ownerAddress, {
        text: `${r.name}: two of its notes disagree. Which one holds?`,
        buttons: [{ label: "Choose", url: `${deps.webBase}/memory?tab=tidied&remora=${r.id}` }],
      })
      .catch(() => {});
  return { eventId, merged, hidden: hid, conflicts, note };
}

/** The Tidied tab: recent tidies (with each note's blob once landed) and open conflicts. */
export async function tidyView(deps: Pick<RuntimeDeps, "db">, r: Remora) {
  const runs = await deps.db
    .select()
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, r.id),
        eq(remoraEvents.type, "action"),
        sql`${remoraEvents.payload}->>'kind' = 'tidy'`,
      ),
    )
    .orderBy(desc(remoraEvents.createdAt))
    .limit(10);
  const noteIds = runs.flatMap((e) =>
    ((e.payload as { merged?: TidyMerge[] }).merged ?? []).flatMap((m) =>
      m.noteId ? [m.noteId] : [],
    ),
  );
  const notes = noteIds.length
    ? await deps.db
        .select({ id: remoraMemories.id, blobId: remoraMemories.blobId })
        .from(remoraMemories)
        .where(inArray(remoraMemories.id, noteIds))
    : [];
  const blobOf = new Map(notes.map((n) => [n.id, n.blobId]));
  const open = await deps.db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.remoraId, r.id),
        eq(approvals.kind, "rule_conflict"),
        eq(approvals.status, "pending"),
      ),
    )
    .orderBy(desc(approvals.createdAt));
  return {
    runs: runs.map((e) => {
      const p = e.payload as {
        trigger?: string;
        merged?: TidyMerge[];
        hidden?: string[];
        conflicts?: string[];
      };
      return {
        id: e.id,
        at: e.createdAt.toISOString(),
        trigger: p.trigger === "weekly" ? ("weekly" as const) : ("owner" as const),
        summary: e.summary,
        merged: (p.merged ?? []).map((m) => ({
          ...m,
          noteBlobId: m.noteId ? (blobOf.get(m.noteId) ?? null) : null,
        })),
        hidden: p.hidden ?? [],
        conflicts: p.conflicts ?? [],
      };
    }),
    conflicts: open.flatMap((a) => {
      const p = a.payload as Partial<Conflict>;
      if (!p.a || !p.b || !p.service) return [];
      return [
        {
          id: a.id,
          createdAt: a.createdAt.toISOString(),
          summary: a.summary,
          service: p.service,
          what: p.what === "rules" ? ("rules" as const) : ("notes" as const),
          a: p.a,
          b: p.b,
        },
      ];
    }),
  };
}

async function pendingConflict(deps: RuntimeDeps, owner: string, id: string) {
  const [row] = await deps.db
    .select({ a: approvals, r: remoras })
    .from(approvals)
    .innerJoin(remoras, eq(remoras.id, approvals.remoraId))
    .where(eq(approvals.id, id));
  if (!row || row.r.ownerAddress !== owner)
    throw new RemoraError("approval.not_found", "No such question.", 404);
  const p = row.a.payload as Partial<Conflict> & { kind?: string };
  if (
    row.a.kind !== "rule_conflict" ||
    p.kind !== "conflict" ||
    !p.a ||
    !p.b ||
    !p.service ||
    !p.what
  )
    throw new RemoraError("approval.not_conflict", "That isn't a conflict to settle.", 409);
  if (row.a.status !== "pending")
    throw new RemoraError("approval.decided", `Already ${row.a.status}.`, 409);
  return { a: row.a, r: row.r, p: p as Conflict };
}

/**
 * The owner picks which one holds. The other note gets a `[correction]` naming its blob, so recall
 * skips it and the ledger closes what it asserted; the other rule is removed, and its `[rule]`
 * memory corrected when it has landed.
 */
export async function resolveConflict(
  deps: RuntimeDeps,
  service: RemoraService,
  owner: string,
  id: string,
  keep: "a" | "b",
  now = new Date(),
) {
  const { r, p } = await pendingConflict(deps, owner, id);
  const kept = keep === "a" ? p.a : p.b;
  const lost = keep === "a" ? p.b : p.a;
  const namespaces = service.config(r).namespaces;
  const today = now.toISOString().slice(0, 10);
  const svc = payeeLabel(p.service);
  let corrected: string | null = null;
  if (p.what === "notes") {
    const blob = lost.blobIds?.[0];
    if (blob && namespaces.includes("sources")) {
      await correct(deps.db, deps.memory, r, namespaces, {
        blobId: blob,
        namespace: "sources",
        text: `${svc}: the note of ${day(kept.at)} holds (${kept.value ?? ""}); the note of ${day(lost.at)} (${lost.value ?? ""}) doesn't. The owner chose on ${today}.`,
      });
      corrected = blob;
    }
  } else if (lost.ruleId) {
    const rule = rulesAt(r.config).find((x) => x.id === lost.ruleId);
    await removeRule(deps, service, r, lost.ruleId).catch((err) => {
      if (!(err instanceof RemoraError && err.code === "rule.not_found")) throw err;
    });
    const [mem] = rule?.memoryId
      ? await deps.db
          .select({ blobId: remoraMemories.blobId })
          .from(remoraMemories)
          .where(eq(remoraMemories.id, rule.memoryId))
      : [];
    if (mem?.blobId && namespaces.includes("feedback")) {
      await correct(deps.db, deps.memory, r, namespaces, {
        blobId: mem.blobId,
        namespace: "feedback",
        text: `Rule no longer holds: ${rule?.text ?? lost.label}. The owner kept ${kept.label} on ${today}.`,
      });
      corrected = mem.blobId;
    }
  }
  await deps.db
    .update(approvals)
    .set({ status: "approved", decidedAt: now, payload: { ...p, keep, corrected } })
    .where(eq(approvals.id, id));
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary: `You settled a conflict on ${svc}: ${kept.label} holds.`,
    payload: { kind: "conflict_settled", approvalId: id, keep, corrected },
  });
  return { kept, superseded: lost, corrected };
}

/** Both stay as they are; the same pair isn't asked about again. */
export async function dismissConflict(
  deps: RuntimeDeps,
  owner: string,
  id: string,
  now = new Date(),
) {
  const { r, p } = await pendingConflict(deps, owner, id);
  await deps.db
    .update(approvals)
    .set({ status: "rejected", decidedAt: now })
    .where(eq(approvals.id, id));
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary: `You left both of ${r.name}'s ${p.what} on ${payeeLabel(p.service)} as they are.`,
    payload: { kind: "conflict_dismissed", approvalId: id },
  });
  return { dismissed: true };
}
