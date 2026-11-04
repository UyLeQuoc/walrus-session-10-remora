/**
 * E5 (ADR-0124): a remora proposes its own budget. Rules in code decide when and what; the model only
 * writes the one-line reason, from the numbers and the memories it's shown, and a proposal that cites
 * fewer than two memories isn't made. A proposal is an approval of kind `budget_change`: accepting is the owner's one
 * signature (revoke and reissue, `budgetTx`), declining is one click, and either way the outcome is
 * written back to memory, so the next proposal reads how the last one ended.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import {
  and,
  approvals,
  desc,
  eq,
  gt,
  inArray,
  isNotNull,
  isNull,
  memoryFacts,
  receipts,
  remoraEvents,
  remoraMemories,
  remoras,
  sql,
} from "@remora/db";
import { getAllowance, getDisc } from "@remora/disc-sdk";
import type { Budget } from "@remora/schema";
import { payeeLabel } from "../money/reef.ts";
import { modelIdFor } from "./brain.ts";
import type { RuntimeDeps } from "./deps.ts";
import { enqueue, type JobHandler } from "./jobs.ts";
import { type Remora, RemoraError, type RemoraService } from "./remoras.ts";

export const PROPOSAL_CHECK = "proposal.check";

const DAY_MS = 86_400_000;
/** One proposal's worth of a usable step: 0.01 USDC. */
const STEP = 10_000n;
/** After a decline, the same kind of change waits this long. */
export const DECLINE_WAIT_MS = 7 * DAY_MS;

export type ProposalRule = "approvals" | "near_limit" | "cap_hit" | "unused";

export interface RuleInput {
  budget: Pick<Budget, "windowLimit" | "window" | "perPaymentCap">;
  /** The live window from the allowance; null when it can't be read. */
  window: { limit: bigint; spent: bigint; startMs: number; endMs: number } | null;
  now: number;
  /** When this budget was set (the last budget change, or the remora's creation). */
  budgetSinceMs: number;
  /** What the remora paid in the last 7 days, from its own Disc. */
  paid7d: bigint[];
  /** Over-limit payments it asked the owner to approve in the last 7 days. */
  asked7d: bigint[];
}

export interface RuleHit {
  rule: ProposalRule;
  to: { windowLimit: bigint; perPaymentCap: bigint };
  /** The numbers behind it, as display strings (USDC, days, percent). */
  numbers: Record<string, string>;
}

const usdc = (units: bigint) => `${(Number(units) / 1e6).toFixed(2)}`;
const up = (units: bigint) => ((units + STEP - 1n) / STEP) * STEP;
const down = (units: bigint) => (units / STEP) * STEP;
const max = (...xs: bigint[]) => xs.reduce((a, b) => (b > a ? b : a));
const min = (...xs: bigint[]) => xs.reduce((a, b) => (b < a ? b : a));

/** The window the allowance is in right now: periodic from its start, or the calendar month. */
export function windowBounds(
  a: { startMs: number | null; rateLimit: { periodMs?: number; months?: number } | null },
  now: number,
): { startMs: number; endMs: number } | null {
  const rl = a.rateLimit;
  if (!rl) return null;
  if (rl.periodMs) {
    const start = a.startMs ?? now;
    const n = Math.max(0, Math.floor((now - start) / rl.periodMs));
    return { startMs: start + n * rl.periodMs, endMs: start + (n + 1) * rl.periodMs };
  }
  if (rl.months) {
    const d = new Date(now);
    const startMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    const endMs = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + rl.months, 1);
    return { startMs, endMs };
  }
  return null;
}

/**
 * When to propose and what, most urgent first. Raises never exceed three times the current value;
 * a lower limit never drops under three payments at the cap. Pure, so the rules are tested alone.
 */
export function ruleFor(i: RuleInput): RuleHit | null {
  const limit = BigInt(i.budget.windowLimit);
  const cap = BigInt(i.budget.perPaymentCap);
  if (i.asked7d.length >= 2) {
    const biggest = max(...i.asked7d);
    const to = min(up(biggest), limit);
    if (to > cap)
      return {
        rule: "approvals",
        to: { windowLimit: limit, perPaymentCap: to },
        numbers: {
          asked: String(i.asked7d.length),
          biggest: usdc(biggest),
          cap: usdc(cap),
        },
      };
  }
  const w = i.window;
  if (w && w.limit > 0n) {
    const length = w.endMs - w.startMs;
    const elapsed = Math.max(i.now - w.startMs, length * 0.02);
    const left = (w.endMs - i.now) / length;
    if (w.spent * 100n >= w.limit * 80n && left > 0.3) {
      // What this pace spends by the window's end, plus a tenth, within 1.5x to 3x the limit.
      const pace = BigInt(Math.ceil((Number(w.spent) * length * 1.1) / elapsed));
      const to = up(min(max(pace, (w.limit * 3n) / 2n), w.limit * 3n));
      return {
        rule: "near_limit",
        to: { windowLimit: to, perPaymentCap: cap },
        numbers: {
          spent: usdc(w.spent),
          limit: usdc(w.limit),
          used: `${Math.round(Number((w.spent * 100n) / w.limit))}%`,
          left: `${Math.round(left * 100)}%`,
        },
      };
    }
  }
  if (i.paid7d.length >= 5 && i.paid7d.every((a) => a >= cap)) {
    const to = min(up((cap * 3n) / 2n), limit);
    if (to > cap)
      return {
        rule: "cap_hit",
        to: { windowLimit: limit, perPaymentCap: to },
        numbers: { payments: String(i.paid7d.length), cap: usdc(cap) },
      };
  }
  if (
    w &&
    w.limit > 0n &&
    i.now - i.budgetSinceMs >= 7 * DAY_MS &&
    w.spent * 100n < w.limit * 20n
  ) {
    const days = (i.now - i.budgetSinceMs) / DAY_MS;
    const week = i.paid7d.reduce((a, b) => a + b, 0n);
    const perWindow = BigInt(Math.ceil((Number(week) / 7) * ((w.endMs - w.startMs) / DAY_MS)));
    const to = down(max(perWindow * 2n, cap * 3n, STEP));
    if (to * 100n <= w.limit * 80n)
      return {
        rule: "unused",
        to: { windowLimit: to, perPaymentCap: min(cap, to) },
        numbers: {
          spent: usdc(w.spent),
          limit: usdc(w.limit),
          used: `${Math.round(Number((w.spent * 100n) / w.limit))}%`,
          days: String(Math.floor(days)),
        },
      };
  }
  return null;
}

/** The change in words, e.g. "Lower its monthly limit 0.50 → 0.20 USDC". */
export function changeLine(from: Budget, to: Budget): string {
  const per = { day: "daily", week: "weekly", month: "monthly" }[from.window];
  const parts: string[] = [];
  if (from.windowLimit !== to.windowLimit) {
    const verb = BigInt(to.windowLimit) > BigInt(from.windowLimit) ? "Raise" : "Lower";
    parts.push(
      `${verb} its ${per} limit ${usdc(BigInt(from.windowLimit))} → ${usdc(BigInt(to.windowLimit))} USDC`,
    );
  }
  if (from.perPaymentCap !== to.perPaymentCap) {
    const verb = BigInt(to.perPaymentCap) > BigInt(from.perPaymentCap) ? "raise" : "lower";
    const line = `${verb} its per-payment cap ${usdc(BigInt(from.perPaymentCap))} → ${usdc(BigInt(to.perPaymentCap))} USDC`;
    parts.push(parts.length ? line : line[0]?.toUpperCase() + line.slice(1));
  }
  return parts.join(", and ");
}

export interface Cite {
  memoryId: string;
  blobId: string;
  namespace: string;
  label: string;
  at: string;
}

const dateOf = (d: Date) => d.toISOString().slice(0, 10);

/**
 * The memories a proposal rests on: the latest paid Wakes, the source scores and how the last
 * proposal ended, each a stored Walrus blob. Labels come from the rows written at the same moment
 * (the receipt beside a Wake, the fact a score became), never from the model.
 */
export async function citedMemories(
  deps: Pick<RuntimeDeps, "db">,
  r: Pick<Remora, "id">,
  limit = 5,
): Promise<Cite[]> {
  const rows = await deps.db
    .select()
    .from(remoraMemories)
    .where(
      and(
        eq(remoraMemories.remoraId, r.id),
        eq(remoraMemories.status, "stored"),
        isNotNull(remoraMemories.blobId),
        isNull(remoraMemories.hiddenAt),
        inArray(remoraMemories.namespace, ["receipts", "sources", "feedback"]),
      ),
    )
    .orderBy(desc(remoraMemories.createdAt))
    .limit(40);
  if (!rows.length) return [];
  const wakes = await deps.db
    .select({ wake: receipts.wake, txDigest: receipts.txDigest, createdAt: receipts.createdAt })
    .from(receipts)
    .where(eq(receipts.remoraId, r.id))
    .orderBy(desc(receipts.createdAt))
    .limit(80);
  const facts = await deps.db
    .select({
      subject: memoryFacts.subject,
      predicate: memoryFacts.predicate,
      value: memoryFacts.value,
      sources: memoryFacts.sourceMemoryIds,
    })
    .from(memoryFacts)
    .where(
      sql`${memoryFacts.sourceMemoryIds} && ARRAY[${sql.join(
        rows.map((x) => sql`${x.id}`),
        sql`, `,
      )}]::uuid[]`,
    );
  const factFor = (id: string) => facts.find((f) => f.sources.includes(id));
  const labelOf = (m: (typeof rows)[number]): string | null => {
    if (m.namespace === "receipts") {
      // The Wake is remembered right after its receipt row: the nearest one before it, within a minute.
      const w = wakes.find(
        (x) =>
          x.createdAt.getTime() <= m.createdAt.getTime() &&
          m.createdAt.getTime() - x.createdAt.getTime() < 60_000,
      );
      const d = (w?.wake as { intent?: { decision?: Record<string, string> } } | undefined)?.intent
        ?.decision;
      if (!d) return null;
      return d.action === "pay"
        ? `paid ${usdc(BigInt(d.amount ?? "0"))} USDC to ${payeeLabel(d.payee ?? "")}`
        : `${d.action ?? "acted"}: ${String(d.reason ?? "").slice(0, 60)}`;
    }
    const f = factFor(m.id);
    if (f) return `${payeeLabel(f.subject)} ${f.predicate.replace(/_/g, " ")}: ${f.value}`;
    return m.namespace === "sources" ? "a source score it wrote" : "how its last proposal ended";
  };
  const pick = (ns: string, n: number) =>
    rows
      .filter((m) => m.namespace === ns)
      .flatMap((m) => {
        const label = labelOf(m);
        return label
          ? [
              {
                memoryId: m.id,
                blobId: m.blobId as string,
                namespace: m.namespace,
                label,
                at: dateOf(m.createdAt),
              },
            ]
          : [];
      })
      .slice(0, n);
  return [...pick("feedback", 1), ...pick("receipts", 2), ...pick("sources", 2)].slice(0, limit);
}

export interface ProposalPayload {
  kind: "proposal";
  rule: ProposalRule;
  from: Budget;
  to: Budget;
  numbers: Record<string, string>;
  cites: Cite[];
  reason: string;
  previous?: { rule: string; outcome: "accepted" | "declined"; reason?: string; at: string };
  declineReason?: string;
  digest?: string;
  /** The `remora_memories` row of the outcome written back to memory. */
  outcomeMemoryId?: string;
}

const budgetOf = (r: Remora) => (r.config as { budget?: Budget }).budget ?? null;

async function lastDecided(deps: Pick<RuntimeDeps, "db">, r: Remora) {
  const [a] = await deps.db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.remoraId, r.id),
        eq(approvals.kind, "budget_change"),
        inArray(approvals.status, ["approved", "rejected"]),
      ),
    )
    .orderBy(desc(approvals.decidedAt))
    .limit(1);
  return a ?? null;
}

/** The one-line reason, written by the remora's model from the numbers and its memories only. */
async function reasonFor(
  deps: RuntimeDeps,
  r: Remora,
  change: string,
  hit: RuleHit,
  cites: Cite[],
  previous: ProposalPayload["previous"],
): Promise<string> {
  const fallback = {
    approvals: `You approved ${hit.numbers.asked} payments over its cap this week; the biggest was ${hit.numbers.biggest} USDC.`,
    near_limit: `It has used ${hit.numbers.used} of its limit with ${hit.numbers.left} of the window left.`,
    cap_hit: `Its last ${hit.numbers.payments} payments all hit the ${hit.numbers.cap} USDC cap.`,
    unused: `It spent ${hit.numbers.spent} of ${hit.numbers.limit} USDC in ${hit.numbers.days} days.`,
  }[hit.rule];
  try {
    const out = await deps.brain.answer({
      model: modelIdFor(r, deps.brain.answerModel),
      persona: "You are a careful agent writing to your owner about your own budget.",
      question: [
        `In one sentence of at most 30 words, tell your owner why you propose: ${change}.`,
        "Use only the numbers and memories given. No greeting, no markdown, no new numbers.",
        previous
          ? `Your owner ${previous.outcome} your last proposal (${previous.rule})${previous.reason ? ` because "${previous.reason}"` : ""}: acknowledge it in a few words.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
      memories: cites.map((c) => `${c.at}: ${c.label}`),
      data: [{ source: "budget numbers", content: JSON.stringify(hit.numbers) }],
    });
    const line = out.text.replace(/\s+/g, " ").trim().slice(0, 240);
    return line || fallback;
  } catch {
    return fallback;
  }
}

/**
 * Checks one remora and opens a proposal if a rule fires. Skips (with the reason) when one is already
 * open, the remora can't spend, the same change was declined in the last 7 days, or there's no memory
 * to cite yet.
 */
export async function checkProposal(
  deps: RuntimeDeps,
  r: Remora,
  opts: {
    now?: number;
    /** Tests: the Disc and its allowance without a chain. */
    read?: (r: Remora) => Promise<{
      allowance: Awaited<ReturnType<typeof getAllowance>>;
      disc: Awaited<ReturnType<typeof getDisc>>;
    }>;
  } = {},
): Promise<{ proposalId: string } | { skipped: string }> {
  const now = opts.now ?? Date.now();
  const budget = budgetOf(r);
  if (!budget || !r.discId || !r.allowanceId) return { skipped: "no spending limit" };
  if (r.status !== "active" && r.status !== "shadow") return { skipped: `it's ${r.status}` };
  const [open] = await deps.db
    .select({ id: approvals.id })
    .from(approvals)
    .where(
      and(
        eq(approvals.remoraId, r.id),
        eq(approvals.kind, "budget_change"),
        eq(approvals.status, "pending"),
      ),
    )
    .limit(1);
  if (open) return { skipped: "a proposal is already open" };

  const { allowance, disc } = opts.read
    ? await opts.read(r)
    : await (async () => {
        const core = deps.networks.client(r.network).core;
        const [allowance, disc] = await Promise.all([
          getAllowance(core, r.allowanceId as string),
          getDisc(core, r.discId as string),
        ]);
        return { allowance, disc };
      })();
  const bounds = windowBounds(allowance, now);
  const since = new Date(now - 7 * DAY_MS);
  const paid = await deps.db
    .select({ payload: remoraEvents.payload })
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, r.id),
        eq(remoraEvents.type, "payment"),
        gt(remoraEvents.createdAt, since),
      ),
    );
  const asked = await deps.db
    .select({ payload: approvals.payload })
    .from(approvals)
    .where(
      and(
        eq(approvals.remoraId, r.id),
        eq(approvals.kind, "over_limit_payment"),
        gt(approvals.createdAt, since),
      ),
    );
  const [changed] = await deps.db
    .select({ createdAt: remoraEvents.createdAt })
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, r.id),
        sql`${remoraEvents.payload} ? 'budget'`,
        inArray(remoraEvents.type, ["action", "config_changed"]),
      ),
    )
    .orderBy(desc(remoraEvents.createdAt))
    .limit(1);
  const amountOf = (p: unknown) => BigInt(String((p as { amount?: string }).amount ?? "0"));
  const hit = ruleFor({
    budget: { ...budget, perPaymentCap: disc.perPaymentCap.toString() },
    window:
      allowance.rateLimit && bounds
        ? { limit: allowance.rateLimit.limit, spent: allowance.rateLimit.spent, ...bounds }
        : null,
    now,
    budgetSinceMs: (changed?.createdAt ?? r.createdAt).getTime(),
    // The owner's own approved payments came from their wallet, not the Disc.
    paid7d: paid
      .filter((x) => (x.payload as { approvedBy?: string }).approvedBy !== "owner")
      .map((x) => amountOf(x.payload)),
    asked7d: asked.map((x) => amountOf(x.payload)),
  });
  if (!hit) return { skipped: "no rule fired" };

  const previousRow = await lastDecided(deps, r);
  const prev = previousRow?.payload as ProposalPayload | undefined;
  if (
    previousRow?.status === "rejected" &&
    prev?.rule === hit.rule &&
    previousRow.decidedAt &&
    now - previousRow.decidedAt.getTime() < DECLINE_WAIT_MS
  )
    return { skipped: "declined less than 7 days ago" };

  const cites = await citedMemories(deps, r);
  if (cites.length < 2) return { skipped: "fewer than two memories to cite yet" };

  const to: Budget = {
    ...budget,
    windowLimit: hit.to.windowLimit.toString(),
    perPaymentCap: hit.to.perPaymentCap.toString(),
  };
  const change = changeLine(budget, to);
  const previous: ProposalPayload["previous"] =
    previousRow && prev?.kind === "proposal"
      ? {
          rule: prev.rule,
          outcome: previousRow.status === "approved" ? "accepted" : "declined",
          ...(prev.declineReason ? { reason: prev.declineReason } : {}),
          at: dateOf(previousRow.decidedAt ?? previousRow.createdAt),
        }
      : undefined;
  const reason = await reasonFor(deps, r, change, hit, cites, previous);
  const payload: ProposalPayload = {
    kind: "proposal",
    rule: hit.rule,
    from: budget,
    to,
    numbers: hit.numbers,
    cites,
    reason,
    ...(previous ? { previous } : {}),
  };
  const [a] = await deps.db
    .insert(approvals)
    .values({
      remoraId: r.id,
      network: r.network,
      kind: "budget_change",
      summary: change,
      payload: payload as unknown as Record<string, unknown>,
    })
    .returning({ id: approvals.id });
  if (!a) throw new Error("proposal insert returned no row");
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "proposal",
    summary: `Proposed: ${change}`,
    payload: { approvalId: a.id, rule: hit.rule, reason, cites: cites.map((c) => c.blobId) },
  });
  await deps.notifier
    .send(r.ownerAddress, {
      text: `${r.name} proposes: ${change}. ${reason}`,
      buttons: [{ label: "Review", url: `${deps.webBase}/remoras/${r.id}?proposal=${a.id}` }],
    })
    .catch((err) => deps.log.warn("proposal.notify_failed", { remora: r.id, error: err }));
  return { proposalId: a.id };
}

async function proposalOf(deps: Pick<RuntimeDeps, "db">, owner: string, id: string) {
  const [row] = await deps.db
    .select({ a: approvals, r: remoras })
    .from(approvals)
    .innerJoin(remoras, eq(remoras.id, approvals.remoraId))
    .where(eq(approvals.id, id));
  if (row?.a.kind !== "budget_change")
    throw new RemoraError("proposal.not_found", "No such proposal.", 404);
  if (normalizeSuiAddress(row.r.ownerAddress) !== normalizeSuiAddress(owner))
    throw new RemoraError("remora.not_owner", "That isn't yours.", 403);
  if (row.a.status !== "pending")
    throw new RemoraError("approval.decided", `Already ${row.a.status}.`, 409);
  return { a: row.a, r: row.r, p: row.a.payload as unknown as ProposalPayload };
}

/** Writes how a proposal ended into the remora's `feedback` memory; the next proposal cites it. */
async function rememberOutcome(
  deps: RuntimeDeps,
  r: Remora,
  p: ProposalPayload,
  outcome: "accepted" | "declined",
  reason?: string,
): Promise<string | undefined> {
  const line = `PROPOSAL ${p.rule} · ${changeLine(p.from, p.to)} · ${outcome}${reason ? ` · because ${reason.slice(0, 200)}` : ""} · as_of ${dateOf(new Date())}`;
  const res = await deps.memory
    .remember(r, "feedback", "budget", line, { dedupe: false, asserted: "owner" })
    .catch((err) => {
      deps.log.warn("proposal.memory_failed", { remora: r.id, error: err });
      return null;
    });
  return res?.indexId;
}

/** Accept, step 1: the owner's revoke-and-reissue transaction for the proposed budget. */
export async function proposalTx(
  deps: RuntimeDeps,
  service: RemoraService,
  owner: string,
  id: string,
) {
  const { r, p } = await proposalOf(deps, owner, id);
  return { transaction: await service.budgetTx(r.id, owner, p.to), to: p.to };
}

/** Accept, step 2: the signed transaction renewed the limit; the proposal is accepted and remembered. */
export async function confirmProposal(
  deps: RuntimeDeps,
  service: RemoraService,
  owner: string,
  id: string,
  digest: string,
) {
  const { a, r, p } = await proposalOf(deps, owner, id);
  const updated = await service.confirmBudget(r.id, owner, digest, p.to);
  const outcomeMemoryId = await rememberOutcome(deps, r, p, "accepted");
  await deps.db
    .update(approvals)
    .set({
      status: "approved",
      decidedAt: new Date(),
      payload: { ...a.payload, digest, ...(outcomeMemoryId ? { outcomeMemoryId } : {}) },
    })
    .where(eq(approvals.id, id));
  return { remora: updated, digest };
}

/** Decline: one click and an optional reason. The same kind of change waits 7 days. */
export async function declineProposal(deps: RuntimeDeps, owner: string, id: string, reason = "") {
  const { a, r, p } = await proposalOf(deps, owner, id);
  const why = reason.trim().slice(0, 200);
  const outcomeMemoryId = await rememberOutcome(deps, r, p, "declined", why || undefined);
  await deps.db
    .update(approvals)
    .set({
      status: "rejected",
      decidedAt: new Date(),
      payload: {
        ...a.payload,
        ...(why ? { declineReason: why } : {}),
        ...(outcomeMemoryId ? { outcomeMemoryId } : {}),
      },
    })
    .where(eq(approvals.id, id));
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary: `You declined: ${changeLine(p.from, p.to)}${why ? ` (${why})` : ""}`,
    payload: { approvalId: id, proposal: "declined" },
  });
  return { ok: true };
}

/** The open proposal and the last few, newest first, for the remora page. */
export async function proposalsOf(deps: Pick<RuntimeDeps, "db">, r: Remora) {
  const rows = await deps.db
    .select()
    .from(approvals)
    .where(and(eq(approvals.remoraId, r.id), eq(approvals.kind, "budget_change")))
    .orderBy(desc(approvals.createdAt))
    .limit(6);
  const view = (x: (typeof rows)[number]) => ({
    id: x.id,
    status: x.status,
    summary: x.summary,
    createdAt: x.createdAt.toISOString(),
    decidedAt: x.decidedAt?.toISOString() ?? null,
    ...(x.payload as unknown as ProposalPayload),
  });
  const open = rows.find((x) => x.status === "pending");
  return {
    open: open ? view(open) : null,
    recent: rows.filter((x) => x.status !== "pending").map(view),
  };
}

/** After a payment, and once a day: queue a check (one per remora per hour). */
export const queueProposalCheck = (
  deps: Pick<RuntimeDeps, "db">,
  remoraId: string,
  at = new Date(Date.now() + 60_000),
) =>
  enqueue(deps.db, {
    kind: PROPOSAL_CHECK,
    payload: { remoraId },
    idempotencyKey: `${PROPOSAL_CHECK}:${remoraId}:${at.toISOString().slice(0, 13)}`,
    runAt: at,
    maxAttempts: 2,
  });

export function proposalCheckHandler(deps: RuntimeDeps): JobHandler {
  return async (payload) => {
    const { remoraId } = payload as { remoraId: string };
    const [r] = await deps.db.select().from(remoras).where(eq(remoras.id, remoraId));
    if (!r || r.status === "retired" || r.playground) return;
    const out = await checkProposal(deps, r);
    deps.log.info("proposal.checked", { remora: r.id, ...out });
    // The daily check: tomorrow at the same hour, as long as the remora lives.
    await queueProposalCheck(deps, r.id, new Date(Date.now() + DAY_MS));
  };
}
