/**
 * D4 `schedule` and `handoff` as the model sees them: neither acts on its own. A schedule is a
 * proposal the owner approves (N2); a handoff is a question queued for another of the owner's remoras.
 */
import { and, approvals, eq, remoraEvents, remoras } from "@remora/db";
import type { RuntimeDeps } from "../runtime/deps.ts";
import { enqueue } from "../runtime/jobs.ts";
import type { Remora } from "../runtime/remoras.ts";
import { previewSchedule } from "../triggers/schedule.ts";

export const JOB = {
  cron: "remora.cron",
  ask: "remora.ask",
  firstRun: "remora.first_run",
} as const;

/** D4 `schedule` from the model: only a proposal the owner approves. */
export async function proposeSchedule(
  deps: RuntimeDeps,
  r: Remora,
  when: string,
  question: string,
) {
  const p = previewSchedule(when);
  if (!p) return `"${when}" isn't a schedule I understand.`;
  const [a] = await deps.db
    .insert(approvals)
    .values({
      remoraId: r.id,
      network: r.network,
      kind: "schedule",
      summary: `Ask "${question.slice(0, 80)}" ${p.human}`,
      payload: { when, cron: p.cron, human: p.human, question: question.slice(0, 300) },
    })
    .returning({ id: approvals.id });
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "approval_needed",
    summary: `${r.name} proposes asking "${question.slice(0, 80)}" ${p.human}.`,
    payload: { approvalId: a?.id },
  });
  return `Proposed ${p.human}; it starts once the owner approves.`;
}

/** D4 `handoff`: ask another of the owner's remoras, by name. The answer lands in the feed. */
export async function handoff(deps: RuntimeDeps, from: Remora, to: string, question: string) {
  const mine = await deps.db
    .select()
    .from(remoras)
    .where(
      and(
        eq(remoras.ownerAddress, from.ownerAddress),
        eq(remoras.network, from.network),
        eq(remoras.playground, false),
      ),
    );
  const target = mine.find(
    (r) => r.name.toLowerCase() === to.trim().toLowerCase() && r.id !== from.id,
  );
  if (!target) return `You have no remora called ${to}.`;
  if (target.template !== "scout") return `${target.name} doesn't answer questions.`;
  await enqueue(deps.db, {
    kind: JOB.ask,
    payload: { remoraId: target.id, question: question.slice(0, 500), from: from.id },
    idempotencyKey: `handoff:${from.id}:${target.id}:${Date.now()}`,
    maxAttempts: 2,
  });
  await deps.db.insert(remoraEvents).values({
    remoraId: from.id,
    network: from.network,
    type: "handoff",
    summary: `Asked ${target.name}: ${question.slice(0, 100)}`,
    payload: { to: target.id, question },
  });
  return `Asked ${target.name}; the answer will show up in the feed.`;
}
