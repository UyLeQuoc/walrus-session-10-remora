/**
 * 1-1 threads (ADR-0042): the owner talks to a remora like a contact. The owner's line is a
 * `message` event in the remora's feed. Scout answers it (the ask path, with purchases, Sonar and
 * Wakes). Sentinel learns it when it reads as a rule, and otherwise says what it watches and what it
 * has learned. The reply is the remora's events, which the thread shows in order, cards included.
 */
import { and, approvals, eq, inArray, remoraEvents, sentinelRules } from "@remora/db";
import type { RuntimeDeps } from "./deps.ts";
import { type Remora, RemoraError } from "./remoras.ts";
import { scoutAsk } from "./scout.ts";
import { teach } from "./sentinel.ts";

export interface Reply {
  /** The remora events this turn produced, in order (payments, cards, the answer). */
  eventIds: string[];
}

/** Runs one owner line through a remora. Used by 1-1 threads and rooms alike. */
export async function runRemora(
  deps: RuntimeDeps,
  r: Remora,
  text: string,
  trigger: { kind: "message"; ref: string },
): Promise<Reply> {
  if (r.status !== "active" && r.status !== "shadow") {
    throw new RemoraError("remora.not_active", `${r.name} is ${r.status}.`, 409);
  }
  if (r.template === "scout") {
    const res = await scoutAsk(deps, r, text, trigger);
    return { eventIds: [...res.outcomes.map((o) => o.eventId), res.eventId].filter(Boolean) };
  }
  if (r.template === "sentinel") {
    try {
      const learned = await teach(deps, r, text);
      return { eventIds: learned?.eventId ? [learned.eventId] : [] };
    } catch (err) {
      if (!(err instanceof RemoraError) || err.code !== "rule.unparsed") throw err;
      return { eventIds: [await sentinelStatus(deps, r, text)] };
    }
  }
  throw new RemoraError("remora.unsupported", `${r.name} can't chat yet.`, 409);
}

/** What a Sentinel says to a line that isn't a rule: what it watches, what it has learned. */
async function sentinelStatus(deps: RuntimeDeps, r: Remora, question: string): Promise<string> {
  const watched = (
    (r.config as { triggers?: { kind: string; addresses?: string[] }[] }).triggers ?? []
  ).flatMap((t) => (t.kind === "chain" ? (t.addresses ?? []) : []));
  const rules = await deps.db
    .select({ text: sentinelRules.text })
    .from(sentinelRules)
    .where(and(eq(sentinelRules.remoraId, r.id), eq(sentinelRules.active, true)));
  const answer = [
    `I'm watching ${watched.length} address${watched.length === 1 ? "" : "es"}${watched.length ? `: ${watched.map((a) => `${a.slice(0, 8)}…${a.slice(-4)}`).join(", ")}` : ""}.`,
    rules.length
      ? `What I've learned: ${rules.map((x) => x.text).join("; ")}.`
      : "I haven't learned any rules yet.",
    'Teach me in plain words, like "ignore incoming SUI under 0.01" or "always ping me for anything over 1 SUI".',
  ].join("\n");
  const [e] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "answer",
      summary: question.slice(0, 140),
      payload: { question, answer },
    })
    .returning({ id: remoraEvents.id });
  return e?.id ?? "";
}

/** The owner's line in a 1-1 thread, then the remora's reply. */
export async function postMessage(deps: RuntimeDeps, r: Remora, text: string) {
  const [m] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "message",
      summary: text.slice(0, 140),
      payload: { text, from: "owner" },
    })
    .returning({ id: remoraEvents.id });
  const messageId = m?.id ?? "";
  const reply = await runRemora(deps, r, text, { kind: "message", ref: `thread:${messageId}` });
  return { messageId, ...reply };
}

/**
 * Approval cards show inline (ADR-0042), so `approval_needed` events carry the approval's current
 * state: kind, status, amount and payee.
 */
export async function withApprovalState<
  T extends { type: string; payload: Record<string, unknown> },
>(db: RuntimeDeps["db"], events: T[]): Promise<T[]> {
  const ids = events.flatMap((e) =>
    e.type === "approval_needed" && typeof e.payload.approvalId === "string"
      ? [e.payload.approvalId]
      : [],
  );
  if (!ids.length) return events;
  const rows = await db.select().from(approvals).where(inArray(approvals.id, ids));
  const byId = new Map(rows.map((a) => [a.id, a]));
  return events.map((e) => {
    const a = e.type === "approval_needed" ? byId.get(String(e.payload.approvalId)) : undefined;
    if (!a) return e;
    const p = a.payload as { amount?: string; payee?: string; question?: string; human?: string };
    return {
      ...e,
      payload: {
        ...e.payload,
        kind: a.kind,
        status: a.status,
        ...(p.amount ? { amount: p.amount } : {}),
        ...(p.payee ? { payee: p.payee } : {}),
        ...(p.human ? { human: p.human } : {}),
        ...(p.question ? { question: p.question } : {}),
      },
    };
  });
}
