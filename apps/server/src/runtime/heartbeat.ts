/**
 * A2 (ADR-0137): rule proposals from outcomes. A daily heartbeat per remora (and on demand) reads the
 * last 14 days:
 * - answers its owner rated noise (👎), by the service they bought and the question's shape;
 * - over-limit payments the owner declined, by payee.
 *
 * Rules in code decide when and what; the model writes only the one-line reason. A proposal cites 2–5
 * memories (the service's track record notes), or it isn't made. One open proposal at a time, and a
 * declined one waits 7 days. Accepting is a tap, because a rule can only narrow spending: it goes into
 * `config.rules` (config history shows it) and is written as a `[rule]` memory that cites the outcomes.
 *
 * Sentinel's muted pings already become ignore rules on the 🔕 itself (N19), so they aren't proposed
 * again here.
 */
import { randomUUID } from "node:crypto";
import { and, approvals, desc, eq, gt, inArray, remoraEvents, remoras } from "@remora/db";
import {
  type PlannerRule,
  QUESTION_SHAPES,
  type QuestionShape,
  ruleText,
  shapesOf,
} from "@remora/schema";
import { payeeLabel } from "../money/reef.ts";
import { modelIdFor } from "./brain.ts";
import { saveConfig } from "./config-versions.ts";
import type { RuntimeDeps } from "./deps.ts";
import { enqueue, type JobHandler } from "./jobs.ts";
import { rulesAt } from "./plan-memory.ts";
import { type Remora, RemoraError, type RemoraService } from "./remoras.ts";

export const RULE_HEARTBEAT = "rules.heartbeat";
const DAY_MS = 86_400_000;
export const HEARTBEAT = {
  days: 14,
  noise: 3,
  declined: 2,
  declineWaitMs: 7 * DAY_MS,
  minCites: 2,
  maxCites: 5,
} as const;

export interface Outcome {
  kind: "noise" | "useful" | "declined";
  payee: string;
  shapes: QuestionShape[];
  at: Date;
}

export interface RuleDraft {
  rule: Omit<PlannerRule, "id" | "acceptedAt" | "reason" | "cites" | "text">;
  /** Display numbers behind it. */
  count: number;
  since: Date;
  evidence: "noise" | "declined";
}

/**
 * Pure: which rule the outcomes call for, most-evidenced first, or null.
 * - ≥3 noise for one service: skip it unless the question names a shape every useful answer from it
 *   had and no noisy one did; with no such shape, ask before buying it.
 * - ≥2 declined over-limit payments to one payee: ask before buying it.
 */
export function draftRule(outcomes: Outcome[], existing: PlannerRule[]): RuleDraft | null {
  const covered = (payee: string) =>
    existing.some((r) => r.service === payee && r.action !== "prefer");
  const byPayee = new Map<string, Outcome[]>();
  for (const o of outcomes) byPayee.set(o.payee, [...(byPayee.get(o.payee) ?? []), o]);
  const drafts: RuleDraft[] = [];
  for (const [payee, os] of byPayee) {
    if (covered(payee)) continue;
    const noise = os.filter((o) => o.kind === "noise");
    const useful = os.filter((o) => o.kind === "useful");
    const declined = os.filter((o) => o.kind === "declined");
    if (noise.length >= HEARTBEAT.noise) {
      const shape = QUESTION_SHAPES.find(
        (s) =>
          useful.length > 0 &&
          useful.every((u) => u.shapes.includes(s)) &&
          noise.every((n) => !n.shapes.includes(s)),
      );
      drafts.push({
        rule: shape
          ? { action: "skip", service: payee, when: { has: [], lacks: [shape] } }
          : { action: "ask", service: payee, when: { has: [], lacks: [] } },
        count: noise.length,
        since: noise.reduce((a, b) => (b.at < a ? b.at : a), noise[0]?.at ?? new Date()),
        evidence: "noise",
      });
    } else if (declined.length >= HEARTBEAT.declined) {
      drafts.push({
        rule: { action: "ask", service: payee, when: { has: [], lacks: [] } },
        count: declined.length,
        since: declined.reduce((a, b) => (b.at < a ? b.at : a), declined[0]?.at ?? new Date()),
        evidence: "declined",
      });
    }
  }
  // Most evidence first; at a tie, the narrower rule (a skip that keeps a shape) before "ask".
  const specific = (d: RuleDraft) => (d.rule.when.lacks.length ? 1 : 0);
  return drafts.sort((a, b) => b.count - a.count || specific(b) - specific(a))[0] ?? null;
}

/** A rule can only narrow: a `prefer` naming a service the remora can't already buy is refused. */
export function narrowsOnly(
  rule: Pick<PlannerRule, "action" | "service" | "over">,
  listed: string[],
) {
  if (rule.action !== "prefer") return true;
  return listed.includes(rule.service) && (!rule.over || listed.includes(rule.over));
}

const sameRule = (a: RuleDraft["rule"], b: Partial<RuleDraft["rule"]> | undefined) =>
  !!b &&
  a.action === b.action &&
  a.service === b.service &&
  JSON.stringify(a.when) === JSON.stringify(b.when);

/** The last 14 days of outcomes from the remora's own events and approvals. */
export async function outcomesOf(deps: Pick<RuntimeDeps, "db">, r: Remora, now = new Date()) {
  const since = new Date(now.getTime() - HEARTBEAT.days * DAY_MS);
  const rated = await deps.db
    .select({
      payload: remoraEvents.payload,
      feedback: remoraEvents.feedback,
      at: remoraEvents.createdAt,
    })
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, r.id),
        eq(remoraEvents.type, "answer"),
        gt(remoraEvents.createdAt, since),
        inArray(remoraEvents.feedback, ["useful", "noise"]),
      ),
    );
  const out: Outcome[] = [];
  for (const e of rated) {
    const p = e.payload as { question?: string; paidPayees?: string[] };
    const shapes = shapesOf(String(p.question ?? ""));
    for (const payee of new Set(p.paidPayees ?? []))
      out.push({ kind: e.feedback === "noise" ? "noise" : "useful", payee, shapes, at: e.at });
  }
  const declined = await deps.db
    .select({ payload: approvals.payload, at: approvals.createdAt })
    .from(approvals)
    .where(
      and(
        eq(approvals.remoraId, r.id),
        eq(approvals.kind, "over_limit_payment"),
        eq(approvals.status, "rejected"),
        gt(approvals.createdAt, since),
      ),
    );
  for (const a of declined) {
    const p = a.payload as { payee?: string; question?: string };
    if (p.payee)
      out.push({
        kind: "declined",
        payee: p.payee,
        shapes: shapesOf(String(p.question ?? "")),
        at: a.at,
      });
  }
  return out;
}

/** The service's track-record notes (every version, newest first): what a proposal cites. */
async function notesOn(deps: Pick<RuntimeDeps, "facts">, r: Remora, payee: string) {
  if (!deps.facts) return [];
  const facts = await deps.facts.list(r, ["sources"]).catch(() => []);
  return facts
    .filter((f) => f.subject === payee && f.predicate === "track_record" && !f.hidden)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .flatMap((f) => f.blobIds.map((blobId) => ({ blobId, value: f.value, at: f.recordedAt })))
    .slice(0, HEARTBEAT.maxCites);
}

export interface RuleProposalPayload {
  kind: "planner_rule";
  rule: RuleDraft["rule"] & { text: string };
  reason: string;
  cites: { blobId: string; label: string; at: string }[];
  count: number;
  since: string;
  evidence: RuleDraft["evidence"];
  ruleId?: string;
  declinedAt?: string;
}

const day = (d: Date | string) =>
  new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Runs the heartbeat for one remora: opens a proposal if a rule fires, else says why not. */
export async function heartbeat(
  deps: RuntimeDeps,
  r: Remora,
  now = new Date(),
): Promise<{ proposalId: string } | { skipped: string }> {
  if (!(r.config as { budget?: unknown }).budget || !r.discId)
    return { skipped: "only remoras that buy answers get rule proposals" };
  const [open] = await deps.db
    .select({ id: approvals.id })
    .from(approvals)
    .where(
      and(
        eq(approvals.remoraId, r.id),
        eq(approvals.kind, "rule"),
        eq(approvals.status, "pending"),
      ),
    )
    .limit(1);
  if (open) return { skipped: "a rule proposal is already open" };
  const draft = draftRule(await outcomesOf(deps, r, now), rulesAt(r.config));
  if (!draft) return { skipped: "nothing happened often enough to propose a rule" };
  const declined = await deps.db
    .select({ payload: approvals.payload })
    .from(approvals)
    .where(
      and(
        eq(approvals.remoraId, r.id),
        eq(approvals.kind, "rule"),
        eq(approvals.status, "rejected"),
        gt(approvals.decidedAt, new Date(now.getTime() - HEARTBEAT.declineWaitMs)),
      ),
    );
  if (declined.some((d) => sameRule(draft.rule, (d.payload as Partial<RuleProposalPayload>).rule)))
    return { skipped: "you declined this rule in the last 7 days" };
  const notes = await notesOn(deps, r, draft.rule.service);
  if (notes.length < HEARTBEAT.minCites)
    return { skipped: "not enough memories to cite yet (it needs 2)" };
  const text = ruleText(draft.rule);
  const svc = payeeLabel(draft.rule.service);
  const fallback =
    draft.evidence === "noise"
      ? `You rated ${svc}'s answers noise ${draft.count} times since ${day(draft.since)}.`
      : `You declined ${draft.count} payments to ${svc} since ${day(draft.since)}.`;
  let reason = fallback;
  try {
    const out = await deps.brain.answer({
      model: modelIdFor(r, deps.brain.answerModel),
      persona: "You are a careful agent writing to your owner about a rule for your own spending.",
      question: `In one sentence of at most 25 words, tell your owner why you propose the rule "${text}". Use only these facts and memories. No greeting, no markdown, no new numbers.`,
      memories: notes.map((n) => `${n.at.slice(0, 10)}: ${svc} track record: ${n.value}`),
      data: [{ source: "outcomes", content: fallback }],
    });
    reason = out.text.replace(/\s+/g, " ").trim().slice(0, 240) || fallback;
  } catch {
    reason = fallback;
  }
  const payload: RuleProposalPayload = {
    kind: "planner_rule",
    rule: { ...draft.rule, text },
    reason,
    cites: notes.map((n) => ({
      blobId: n.blobId,
      label: `${svc} track record: ${n.value}`,
      at: n.at.slice(0, 10),
    })),
    count: draft.count,
    since: draft.since.toISOString(),
    evidence: draft.evidence,
  };
  const [a] = await deps.db
    .insert(approvals)
    .values({
      remoraId: r.id,
      network: r.network,
      kind: "rule",
      summary: `${text}: ${fallback}`.slice(0, 280),
      payload: payload as unknown as Record<string, unknown>,
    })
    .returning({ id: approvals.id });
  if (!a) throw new Error("rule proposal insert returned no row");
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "proposal",
    summary: `Proposed a rule: ${text}`,
    payload: { approvalId: a.id, rule: payload.rule, cites: payload.cites.map((c) => c.blobId) },
  });
  await deps.notifier
    .send(r.ownerAddress, {
      text: `${r.name} proposes a rule: “${text}”. ${reason}`,
      buttons: [{ label: "Review", url: `${deps.webBase}/remoras/${r.id}` }],
    })
    .catch(() => {});
  return { proposalId: a.id };
}

async function pendingRule(deps: RuntimeDeps, owner: string, id: string) {
  const [row] = await deps.db
    .select({ a: approvals, r: remoras })
    .from(approvals)
    .innerJoin(remoras, eq(remoras.id, approvals.remoraId))
    .where(eq(approvals.id, id));
  if (!row || row.r.ownerAddress !== owner)
    throw new RemoraError("approval.not_found", "No such proposal.", 404);
  const p = row.a.payload as Partial<RuleProposalPayload>;
  if (row.a.kind !== "rule" || p.kind !== "planner_rule")
    throw new RemoraError("approval.not_rule", "That isn't a rule proposal.", 409);
  if (row.a.status !== "pending")
    throw new RemoraError("approval.decided", `Already ${row.a.status}.`, 409);
  return { a: row.a, r: row.r as unknown as Remora, p: p as RuleProposalPayload };
}

/** Accept with a tap: into `config.rules`, then a `[rule]` memory citing the outcomes. */
export async function acceptRule(
  deps: RuntimeDeps,
  service: RemoraService,
  owner: string,
  id: string,
  now = new Date(),
) {
  const { r, p } = await pendingRule(deps, owner, id);
  const listed = deps.reef(r.network).map((e) => e.ref);
  if (!narrowsOnly(p.rule, listed))
    throw new RemoraError(
      "rule.widens",
      "A rule can only narrow spending: that one would add a service.",
      409,
    );
  const ruleId = randomUUID();
  let memoryId: string | undefined;
  const line = `[rule] ${p.rule.text} · accepted ${now.toISOString().slice(0, 10)} · because ${p.reason.slice(0, 160)} · cites ${p.cites.map((c) => c.blobId).join(", ")}`;
  try {
    memoryId = (
      await deps.memory.remember(r, "feedback", "rule", line, { dedupe: false, asserted: "owner" })
    ).indexId;
  } catch (err) {
    deps.log.warn("rule.memory_failed", { remora: r.id, error: err });
  }
  const rule: PlannerRule = {
    id: ruleId,
    action: p.rule.action,
    service: p.rule.service,
    when: { has: p.rule.when?.has ?? [], lacks: p.rule.when?.lacks ?? [] },
    ...(p.rule.over ? { over: p.rule.over } : {}),
    text: p.rule.text,
    reason: p.reason,
    cites: p.cites.map((c) => c.blobId),
    acceptedAt: now.toISOString(),
    proposalId: id,
    ...(memoryId ? { memoryId } : {}),
  };
  await saveConfig(
    deps.db,
    r.id,
    (c) => ({ ...c, rules: [...((c.rules as PlannerRule[] | undefined) ?? []), rule] }),
    { summary: () => `You accepted a rule for ${r.name}: ${rule.text}.`, now },
  );
  await deps.db
    .update(approvals)
    .set({
      status: "approved",
      decidedAt: now,
      payload: { ...p, ruleId } as unknown as Record<string, unknown>,
    })
    .where(eq(approvals.id, id));
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "rule_learned",
    summary: `You accepted a rule: ${rule.text}`,
    payload: { approvalId: id, rule, memoryId: memoryId ?? null },
  });
  void service;
  return { rule };
}

/** Decline with a tap: remembered, and the same proposal waits 7 days. */
export async function declineRule(deps: RuntimeDeps, owner: string, id: string, now = new Date()) {
  const { r, p } = await pendingRule(deps, owner, id);
  await deps.db
    .update(approvals)
    .set({
      status: "rejected",
      decidedAt: now,
      payload: { ...p, declinedAt: now.toISOString() } as unknown as Record<string, unknown>,
    })
    .where(eq(approvals.id, id));
  await deps.memory
    .remember(
      r,
      "feedback",
      "rule",
      `[rule] declined: ${p.rule.text} · ${now.toISOString().slice(0, 10)} · not proposed again before ${new Date(now.getTime() + HEARTBEAT.declineWaitMs).toISOString().slice(0, 10)}`,
      { dedupe: false, asserted: "owner" },
    )
    .catch((err) => deps.log.warn("rule.memory_failed", { remora: r.id, error: err }));
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary: `You declined a rule: ${p.rule.text}`,
    payload: { approvalId: id },
  });
  return { declined: true };
}

export async function removeRule(
  deps: RuntimeDeps,
  _service: RemoraService,
  r: Remora,
  ruleId: string,
) {
  const rules = rulesAt(r.config);
  const gone = rules.find((x) => x.id === ruleId);
  if (!gone) throw new RemoraError("rule.not_found", "No such rule.", 404);
  await saveConfig(
    deps.db,
    r.id,
    (c) => ({
      ...c,
      rules: ((c.rules as PlannerRule[] | undefined) ?? []).filter((x) => x.id !== ruleId),
    }),
    { summary: () => `You removed a rule from ${r.name}: ${gone.text}.` },
  );
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary: `You removed a rule: ${gone.text}`,
    payload: { ruleId },
  });
}

export async function rulesView(deps: RuntimeDeps, r: Remora) {
  const [proposal] = await deps.db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.remoraId, r.id),
        eq(approvals.kind, "rule"),
        eq(approvals.status, "pending"),
      ),
    )
    .orderBy(desc(approvals.createdAt))
    .limit(1);
  const p = proposal?.payload as Partial<RuleProposalPayload> | undefined;
  return {
    rules: rulesAt(r.config),
    proposal:
      proposal && p?.kind === "planner_rule"
        ? {
            id: proposal.id,
            createdAt: proposal.createdAt.toISOString(),
            ...(p as RuleProposalPayload),
          }
        : null,
  };
}

/** The daily heartbeat: one job per remora per day, each queueing the next. */
export const heartbeatJob =
  (deps: RuntimeDeps): JobHandler =>
  async (payload) => {
    const id = String((payload as { remoraId?: string }).remoraId ?? "");
    const [row] = await deps.db.select().from(remoras).where(eq(remoras.id, id));
    if (!row || row.status === "retired" || row.playground) return;
    await queueHeartbeat(deps, id, new Date(Date.now() + DAY_MS));
    const r = row as unknown as Remora;
    if (r.status !== "active" && r.status !== "shadow") return;
    const out = await heartbeat(deps, r);
    deps.log.info("rules.heartbeat", { remora: r.id, ...out });
  };

export function queueHeartbeat(deps: Pick<RuntimeDeps, "db">, remoraId: string, at = new Date()) {
  return enqueue(deps.db, {
    kind: RULE_HEARTBEAT,
    payload: { remoraId },
    idempotencyKey: `${RULE_HEARTBEAT}:${remoraId}:${at.toISOString().slice(0, 10)}`,
    runAt: at,
    maxAttempts: 2,
  });
}
