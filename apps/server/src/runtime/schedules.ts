/**
 * D1 cron + D4 `schedule`/`handoff` + N13 first run, as D2 jobs:
 * - `remora.cron` asks a remora its scheduled question, tells the owner, and queues the next run;
 * - `remora.ask` is a one-off question (a handoff from another remora, or the first run);
 * - `remora.first_run` gives the owner something useful within a minute of creating a remora.
 * The owner sets schedules directly; a remora can only propose one, as an approval (N2).
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { approvals, eq, ownerSettings, remoraEvents, remoras, sentinelRules } from "@remora/db";
import { answersQuestions } from "../templates/index.ts";
import { nextRun } from "../triggers/cron.ts";
import { previewSchedule } from "../triggers/schedule.ts";
import { briefQuestion } from "./brief-question.ts";
import type { RuntimeDeps } from "./deps.ts";
import { approveUnusual } from "./errand.ts";
import { enqueue, type JobHandler } from "./jobs.ts";
import type { Button } from "./notify.ts";
import { type Remora, RemoraError } from "./remoras.ts";
import { scoutAsk } from "./scout.ts";
import { teach } from "./sentinel.ts";

export { handoff, JOB, proposeSchedule } from "../tools/propose.ts";

import { JOB } from "../tools/propose.ts";
import { PAID_CHECK } from "../triggers/indexer.ts";
import { PROPOSAL_CHECK, proposalCheckHandler } from "./proposals.ts";
import { paidCheckHandler } from "./reality.ts";
import { REVIEW_WEEKLY, weeklyReviewHandler } from "./review.ts";

export interface Schedule {
  id: string;
  cron: string;
  human: string;
  question: string;
  /** Paused schedules don't run; imported ones arrive paused (ADR-0042). */
  paused?: boolean;
}

const schedulesOf = (r: Remora) =>
  ((r.config as { schedules?: Schedule[] }).schedules ?? []).slice();

async function load(deps: RuntimeDeps, id: string) {
  const [r] = await deps.db.select().from(remoras).where(eq(remoras.id, id));
  return r ?? null;
}

async function queueNext(deps: RuntimeDeps, r: Remora, s: Schedule, from: Date) {
  const at = nextRun(s.cron, from);
  if (!at) return null;
  await enqueue(deps.db, {
    kind: JOB.cron,
    payload: { remoraId: r.id, scheduleId: s.id },
    idempotencyKey: `cron:${r.id}:${s.id}:${at.toISOString()}`,
    runAt: at,
    maxAttempts: 2,
  });
  return at;
}

/** The owner adds a schedule ("weekdays at 8am" + a question). */
export async function addSchedule(
  deps: RuntimeDeps,
  r: Remora,
  when: string,
  question: string,
  opts: { paused?: boolean } = {},
) {
  if (!answersQuestions(r.template))
    throw new RemoraError(
      "schedule.unsupported",
      "Only Researchers and Briefers answer on a schedule.",
    );
  const p = previewSchedule(when);
  if (!p) throw new RemoraError("schedule.unparsed", `I can't read "${when}" as a schedule.`);
  const s: Schedule = {
    id: crypto.randomUUID(),
    cron: p.cron,
    human: p.human,
    question: question.slice(0, 300),
    ...(opts.paused ? { paused: true } : {}),
  };
  const schedules = [...schedulesOf(r), s].slice(-10);
  const [updated] = await deps.db
    .update(remoras)
    .set({ config: { ...r.config, schedules }, updatedAt: new Date() })
    .where(eq(remoras.id, r.id))
    .returning();
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary: `Scheduled ${p.human}${s.paused ? " (paused)" : ""}: ${s.question.slice(0, 100)}`,
    payload: { schedule: s },
  });
  if (!s.paused) await queueNext(deps, updated ?? r, s, new Date());
  return { schedule: s, next: p.next };
}

/** Pauses or resumes one schedule; resuming queues its next run. */
export async function setSchedulePaused(
  deps: RuntimeDeps,
  r: Remora,
  scheduleId: string,
  paused: boolean,
) {
  const list = schedulesOf(r);
  const s = list.find((x) => x.id === scheduleId);
  if (!s) throw new RemoraError("schedule.not_found", "No such schedule.", 404);
  const next = { ...s, paused };
  const schedules = list.map((x) => (x.id === scheduleId ? next : x));
  const [updated] = await deps.db
    .update(remoras)
    .set({ config: { ...r.config, schedules }, updatedAt: new Date() })
    .where(eq(remoras.id, r.id))
    .returning();
  if (!paused) await queueNext(deps, updated ?? r, next, new Date());
  return next;
}

export async function removeSchedule(deps: RuntimeDeps, r: Remora, scheduleId: string) {
  const schedules = schedulesOf(r).filter((s) => s.id !== scheduleId);
  await deps.db
    .update(remoras)
    .set({ config: { ...r.config, schedules }, updatedAt: new Date() })
    .where(eq(remoras.id, r.id));
}

/** N2: approves a non-payment approval (a proposed schedule). */
/**
 * F14 (ADR-0066): a rule an agent proposed through MCP becomes Sentinel's rule only on the owner's
 * yes. The approval inbox shows it as an ordinary "Approve" card.
 */
export async function approveRule(deps: RuntimeDeps, owner: string, approvalId: string) {
  const [row] = await deps.db
    .select({ a: approvals, r: remoras })
    .from(approvals)
    .innerJoin(remoras, eq(remoras.id, approvals.remoraId))
    .where(eq(approvals.id, approvalId));
  if (!row) throw new RemoraError("approval.not_found", "No such approval.", 404);
  if (row.r.ownerAddress !== normalizeSuiAddress(owner))
    throw new RemoraError("remora.not_owner", "That isn't yours.", 403);
  if (row.a.status !== "pending")
    throw new RemoraError("approval.decided", `Already ${row.a.status}.`, 409);
  const { text } = row.a.payload as { text: string };
  const rule = await teach(deps, row.r, text);
  await deps.db
    .update(approvals)
    .set({ status: "approved", decidedAt: new Date() })
    .where(eq(approvals.id, approvalId));
  return { rule };
}

/** The inbox's "Approve" for anything that isn't a payment: a proposed schedule or rule. */
export async function approveYes(deps: RuntimeDeps, owner: string, approvalId: string) {
  const [row] = await deps.db
    .select({ kind: approvals.kind, payload: approvals.payload })
    .from(approvals)
    .where(eq(approvals.id, approvalId));
  // ADR-0125: an unusual amount within an Errand's limits: the owner's yes lets it pay.
  if (row?.kind === "over_limit_payment" && (row.payload as { viaDisc?: boolean }).viaDisc)
    return approveUnusual(deps, owner, approvalId);
  return row?.kind === "rule"
    ? approveRule(deps, owner, approvalId)
    : approveSchedule(deps, owner, approvalId);
}

export async function approveSchedule(deps: RuntimeDeps, owner: string, approvalId: string) {
  const [row] = await deps.db
    .select({ a: approvals, r: remoras })
    .from(approvals)
    .innerJoin(remoras, eq(remoras.id, approvals.remoraId))
    .where(eq(approvals.id, approvalId));
  if (!row) throw new RemoraError("approval.not_found", "No such approval.", 404);
  if (row.r.ownerAddress !== normalizeSuiAddress(owner))
    throw new RemoraError("remora.not_owner", "That isn't yours.", 403);
  if (row.a.status !== "pending")
    throw new RemoraError("approval.decided", `Already ${row.a.status}.`, 409);
  if (row.a.kind !== "schedule")
    throw new RemoraError("approval.needs_payment", "This one needs your payment, not a yes.", 409);
  const p = row.a.payload as { when: string; question: string };
  await deps.db
    .update(approvals)
    .set({ status: "approved", decidedAt: new Date() })
    .where(eq(approvals.id, approvalId));
  return addSchedule(deps, row.r, p.when, p.question);
}

/** The owner's 👍/👎/Why? buttons under an answer (N4, N19). */
export const answerButtons = (webBase: string, r: Remora, eventId: string): Button[] => [
  { label: "👍", data: `fb:${eventId}:u` },
  { label: "👎", data: `fb:${eventId}:n` },
  { label: "Why?", url: `${webBase}/remoras/${r.id}?event=${eventId}`, data: `why:${eventId}` },
];

/** Asks now and tells the owner, as a scheduled run does (the Briefer's Run now, ADR-0106). */
export const askNow = (...args: Parameters<typeof askAndTell>) => askAndTell(...args);

async function askAndTell(
  deps: RuntimeDeps,
  r: Remora,
  question: string,
  trigger: { kind: "message" | "cron" | "handoff"; ref: string },
  title: string,
) {
  const res = await scoutAsk(deps, r, question, trigger);
  await deps.notifier.send(r.ownerAddress, {
    text: `${title}\n\n${res.answer}`,
    buttons: answerButtons(deps.webBase, r, res.eventId),
  });
  return res;
}

/** N13: right after creation, show the owner what this remora is for. */
export async function firstRun(deps: RuntimeDeps, r: Remora) {
  if (r.template === "scout") {
    const pkg = deps.networks.config(r.network).packageId;
    const question = pkg ? `Is the package ${pkg} safe to depend on?` : "What can you do for me?";
    return askAndTell(
      deps,
      r,
      question,
      { kind: "message", ref: "first_run" },
      `${r.name}'s first answer:`,
    );
  }
  // ADR-0106: a Briefer's first answer is its first brief, when it has a list.
  if (r.template === "briefer") {
    const items = ((r.config as { items?: string[] }).items ?? []).filter(Boolean);
    if (items.length)
      return askAndTell(
        deps,
        r,
        briefQuestion(items),
        { kind: "message", ref: "first_run" },
        `${r.name}'s first brief:`,
      );
    return null;
  }
  if (r.template === "sentinel") {
    const watched = (
      (r.config as { triggers?: { kind: string; addresses?: string[] }[] }).triggers ?? []
    ).flatMap((t) => (t.kind === "chain" ? (t.addresses ?? []) : []));
    const client = deps.networks.client(r.network);
    const lines: string[] = [];
    for (const a of watched.slice(0, 3)) {
      const { balances } = await client.core
        .listBalances({ owner: a })
        .catch(() => ({ balances: [] }));
      const held = balances
        .filter((b) => b.balance !== "0")
        .map((b) => `${b.coinType.split("::").pop()} ${b.balance}`)
        .join(", ");
      lines.push(`• ${a.slice(0, 10)}…: ${held || "empty"}`);
    }
    const rules = await deps.db
      .select()
      .from(sentinelRules)
      .where(eq(sentinelRules.remoraId, r.id));
    const text = [
      `${r.name} is watching ${watched.length} address(es) on ${r.network}:`,
      ...lines,
      rules.length
        ? `Rules: ${rules.map((x) => x.text).join("; ")}`
        : 'No rules yet. Teach me in plain words, e.g. "ignore incoming SUI under 0.01".',
      "I'll ping you only for what matters, and learn from 👍/🔕.",
    ].join("\n");
    await deps.db.insert(remoraEvents).values({
      remoraId: r.id,
      network: r.network,
      type: "action",
      summary: text.split("\n")[0] ?? text,
      payload: { text, watched },
    });
    await deps.notifier.send(r.ownerAddress, { text });
    return { text };
  }
  return null;
}

/** D2 handlers for the remora jobs. */
export function remoraJobHandlers(deps: RuntimeDeps): Record<string, JobHandler> {
  return {
    [JOB.cron]: async (payload, job) => {
      const p = payload as { remoraId: string; scheduleId: string };
      const r = await load(deps, p.remoraId);
      const s = r && schedulesOf(r).find((x) => x.id === p.scheduleId);
      if (!r || !s || s.paused) return; // removed or paused since: the chain of runs ends here
      // From this run's slot, so a worker that picks it up early never queues the same slot again.
      await queueNext(deps, r, s, new Date(Math.max(Date.now(), job.runAt.getTime())));
      if (r.status !== "active" && r.status !== "shadow") return;
      await askAndTell(deps, r, s.question, { kind: "cron", ref: s.id }, `${r.name} (${s.human}):`);
    },
    [JOB.ask]: async (payload) => {
      const p = payload as { remoraId: string; question: string; from?: string };
      const r = await load(deps, p.remoraId);
      if (!r) return;
      await askAndTell(
        deps,
        r,
        p.question,
        { kind: "handoff", ref: p.from ?? "owner" },
        `${r.name} answered:`,
      );
    },
    [JOB.firstRun]: async (payload) => {
      const r = await load(deps, (payload as { remoraId: string }).remoraId);
      if (r) await firstRun(deps, r);
    },
    [PAID_CHECK]: paidCheckHandler(deps),
    [PROPOSAL_CHECK]: proposalCheckHandler(deps),
    [REVIEW_WEEKLY]: weeklyReviewHandler(deps, async (owner) => {
      const [s] = await deps.db
        .select({ timezone: ownerSettings.timezone })
        .from(ownerSettings)
        .where(eq(ownerSettings.ownerAddress, owner));
      return s?.timezone ?? "UTC";
    }),
  };
}

/** Queues the first run once per remora. */
export const queueFirstRun = (deps: Pick<RuntimeDeps, "db">, remoraId: string) =>
  enqueue(deps.db, {
    kind: JOB.firstRun,
    payload: { remoraId },
    idempotencyKey: `first:${remoraId}`,
    maxAttempts: 2,
  });
