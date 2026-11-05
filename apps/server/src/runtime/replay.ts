/**
 * A1 (ADR-0136): the replay bench. The same questions, planned three ways:
 * - `none`: no recall, no facts, no rules, no notes (the chat's "without memory");
 * - `t0`: only memories our index recorded by T₀, the ledger as it stood at T₀, rules accepted by T₀;
 * - `today`: everything it remembers now.
 *
 * A replay is a plan, never a purchase: it never calls the pay path (a stub records "would buy X for
 * its listed price"), never writes memory, feedback or source stats, and never notifies. The model and
 * its daily token cap are the remora's own. Each run is one `replay.ran` event; its numbers are
 * labeled "planned in a replay on <date>" wherever they're shown.
 */
import { and, desc, eq, gt, inArray, lt, remoraEvents, remoraMemories } from "@remora/db";
import { type ReplayColumn, type ReplayPlan, type ReplayRun, shapesOf } from "@remora/schema";
import { isRemoraRef } from "../money/listings.ts";
import { payeeLabel } from "../money/reef.ts";
import { skipReason } from "../money/reputation.ts";
import { modelIdFor, usdcLabel } from "./brain.ts";
import type { RuntimeDeps } from "./deps.ts";
import { admitMemories } from "./facts.ts";
import { addUsage, tokensToday } from "./limits.ts";
import type { Recalled } from "./memory.ts";
import { applyMemory, type MemorySkip, rulesAt, trackRecords } from "./plan-memory.ts";
import { type Remora, RemoraError } from "./remoras.ts";
import { planBuys } from "./scout.ts";

export const REPLAY = {
  maxQuestions: 12,
  perHour: 3,
  /** A follow-up the model asks for inside one planned turn. */
  maxModelBuys: 2,
  /** Questions planned at once. */
  concurrency: 3,
} as const;

const COLUMNS: ReplayColumn[] = ["none", "t0", "today"];

export interface ReplayInput {
  questions: string[];
  /** The earlier point; default 24 h after the remora was created. */
  t0?: Date;
}

/** The questions this remora was asked, newest first, for the picker. */
export async function pastQuestions(deps: Pick<RuntimeDeps, "db">, r: Remora, limit = 30) {
  const rows = await deps.db
    .select({ payload: remoraEvents.payload, at: remoraEvents.createdAt })
    .from(remoraEvents)
    .where(and(eq(remoraEvents.remoraId, r.id), eq(remoraEvents.type, "answer")))
    .orderBy(desc(remoraEvents.createdAt))
    .limit(200);
  const seen = new Set<string>();
  const out: { question: string; at: string }[] = [];
  for (const x of rows) {
    const q = String((x.payload as { question?: string }).question ?? "").trim();
    if (!q || seen.has(q.toLowerCase())) continue;
    seen.add(q.toLowerCase());
    out.push({ question: q.slice(0, 500), at: x.at.toISOString() });
    if (out.length >= limit) break;
  }
  return out;
}

/** Which of these blobs our index recorded by `t0` (any of the owner's remoras could have written `me`). */
async function writtenBy(deps: Pick<RuntimeDeps, "db">, blobIds: string[], t0: Date) {
  if (!blobIds.length) return new Set<string>();
  const rows = await deps.db
    .select({ blobId: remoraMemories.blobId })
    .from(remoraMemories)
    .where(and(inArray(remoraMemories.blobId, blobIds), lt(remoraMemories.createdAt, t0)));
  return new Set(rows.flatMap((x) => (x.blobId ? [x.blobId] : [])));
}

const sum = (xs: { amount: string }[]) => xs.reduce((n, x) => n + BigInt(x.amount), 0n).toString();

/** One question under one memory: what it would buy and why it skips the rest. */
async function planOne(
  deps: RuntimeDeps,
  r: Remora,
  question: string,
  column: ReplayColumn,
  t0: Date,
  recalled: Recalled[],
  now: Date,
): Promise<{ plan: ReplayPlan; tokens: number }> {
  const at = column === "t0" ? t0 : undefined;
  const namespaces = ["me", "sources", "feedback"];
  const reef = deps.reef(r.network).filter((e) => !isRemoraRef(e.ref));
  const priceOf = (ref: string) => reef.find((e) => e.ref === ref)?.price ?? "0";
  let memories: Recalled[] = [];
  let facts: string[] = [];
  if (column !== "none" && recalled.length) {
    const pool =
      column === "t0"
        ? await writtenBy(
            deps,
            recalled.map((m) => m.blobId),
            t0,
          ).then((ok) => recalled.filter((m) => ok.has(m.blobId)))
        : recalled;
    const admitted = await admitMemories(
      { log: deps.log, ...(deps.facts ? { facts: deps.facts } : {}) },
      r,
      question,
      pool,
      namespaces,
      at,
    );
    memories = admitted.memories;
    facts = admitted.facts;
  }
  const rules = column === "none" ? [] : rulesAt(r.config, at);
  const records = column === "none" ? [] : await trackRecords(deps, r, at ?? now);
  const mp = applyMemory({ buys: planBuys(question, reef), question, rules, records });
  const skips: ReplayPlan["skips"] = mp.skips.map((s: MemorySkip) => ({
    payee: s.payee,
    reason: s.reason,
    kind: s.kind,
    cites: s.cites,
    ...(s.ruleId ? { ruleId: s.ruleId } : {}),
  }));
  // The Reef's own floor (ADR-0127) is the same in every column: it isn't this remora's memory.
  const scores = deps.reputation?.(r.network);
  const buys: ReplayPlan["buys"] = [];
  for (const b of mp.keep) {
    const why = skipReason(scores?.get(b.entry.ref), payeeLabel(b.entry.ref));
    if (why) skips.push({ payee: b.entry.ref, reason: why, kind: "reef", cites: [] });
    else buys.push({ payee: b.entry.ref, amount: b.entry.price ?? "0" });
  }
  // The model plans too, with a pay tool that only records what it would buy.
  let tokens = 0;
  let answer = "";
  let asked = 0;
  try {
    const persona = String(
      (r.config as { persona?: string }).persona ?? "You are the owner's Researcher.",
    );
    const listed = reef.map((e) => `${e.ref} at ${e.url}`).join("; ");
    const res = await deps.brain.answer({
      model: modelIdFor(r, deps.brain.answerModel),
      persona: `${persona}\n\nPaid services you may buy from, each only at its own address: ${listed}. Buy only when one of them adds data the question needs; otherwise answer from what you know, without paying.`,
      question,
      memories: memories.map((m) => m.text),
      ...(facts.length ? { facts } : {}),
      data: buys.map((b) => ({
        source: payeeLabel(b.payee),
        content: "(replay: planned purchase, not bought; no data)",
        cost: usdcLabel(b.amount),
      })),
      pay: async ({ payee }) => {
        const mine = applyMemory({ buys: [{ entry: { ref: payee } }], question, rules, records })
          .skips[0];
        if (mine) {
          if (!skips.some((s) => s.payee === payee)) skips.push({ ...mine, cites: mine.cites });
          return `Not bought: ${mine.reason}.`;
        }
        if (buys.some((b) => b.payee === payee)) return "(replay: already planned)";
        if (!reef.some((e) => e.ref === payee)) return `${payee} isn't a listed service.`;
        if (asked >= REPLAY.maxModelBuys) return "(replay: no more purchases this turn)";
        asked++;
        buys.push({ payee, amount: priceOf(payee) });
        return `(replay: would buy ${payeeLabel(payee)} for ${usdcLabel(priceOf(payee))}; nothing was bought)`;
      },
    });
    tokens = res.tokens;
    answer = res.text.slice(0, 600);
  } catch (err) {
    deps.log.warn("replay.model_failed", { remora: r.id, error: err });
    answer = "(the model didn't answer in this replay; the plan above is the planner's)";
  }
  return {
    plan: {
      buys,
      skips,
      memories: memories.map((m) => m.blobId),
      total: sum(buys),
      answer,
      fromMemory: buys.length === 0 && memories.length > 0,
    },
    tokens,
  };
}

/** Services bought in one column and not the next (or the other way), with what caused it. */
export function differences(plans: Partial<Record<ReplayColumn, ReplayPlan>>) {
  const out: ReplayRun["questions"][number]["differences"] = [];
  const pairs: [ReplayColumn, ReplayColumn][] = [
    ["none", "t0"],
    ["t0", "today"],
  ];
  for (const [from, to] of pairs) {
    const a = plans[from];
    const b = plans[to];
    if (!a || !b) continue;
    for (const x of a.buys)
      if (!b.buys.some((y) => y.payee === x.payee)) {
        const skip = b.skips.find((s) => s.payee === x.payee);
        out.push({
          payee: x.payee,
          from,
          to,
          reason: skip?.reason ?? `not planned with ${to === "today" ? "today's" : "that"} memory`,
          cites: skip?.cites ?? [],
        });
      }
    for (const y of b.buys)
      if (!a.buys.some((x) => x.payee === y.payee))
        out.push({
          payee: y.payee,
          from,
          to,
          reason: `added with ${to === "today" ? "today's" : "the T₀"} memory`,
          cites: b.memories.slice(0, 3),
        });
  }
  return out;
}

export function totalsOf(questions: ReplayRun["questions"]): ReplayRun["totals"] {
  const t = (c: ReplayColumn) => {
    const plans = questions.flatMap((q) => (q.plans[c] ? [q.plans[c]] : []));
    return {
      services: plans.reduce((n, p) => n + p.buys.length, 0),
      spend: plans.reduce((n, p) => n + BigInt(p.total), 0n).toString(),
      fromMemory: plans.filter((p) => p.fromMemory).length,
    };
  };
  return { none: t("none"), t0: t("t0"), today: t("today") };
}

/** 24 h after it was made, or halfway to now for a remora younger than two days. */
export const defaultT0 = (createdAt: Date, now = new Date()) =>
  new Date(
    Math.min(
      createdAt.getTime() + 86_400_000,
      createdAt.getTime() + (now.getTime() - createdAt.getTime()) / 2,
    ),
  );

const running = new Set<string>();

/**
 * Starts a replay and returns its run id at once; the plans fill in as they're made. Owner checks are
 * the caller's. One at a time per remora, at most 3 an hour; 12 questions count as 36 planned turns
 * against the daily token cap.
 */
export async function startReplay(
  deps: RuntimeDeps,
  r: Remora,
  input: ReplayInput,
  opts: { wait?: boolean; now?: Date } = {},
): Promise<{ runId: string; done?: Promise<void> }> {
  const questions = [...new Set(input.questions.map((q) => q.trim()).filter(Boolean))]
    .map((q) => q.slice(0, 500))
    .slice(0, REPLAY.maxQuestions);
  if (!questions.length)
    throw new RemoraError("replay.no_questions", "Pick at least one question.");
  if (r.status !== "active" && r.status !== "shadow")
    throw new RemoraError("remora.not_active", `${r.name} is ${r.status}.`, 409);
  const now = opts.now ?? new Date();
  const t0 = input.t0 ?? defaultT0(r.createdAt, now);
  if (t0.getTime() > now.getTime())
    throw new RemoraError("replay.bad_t0", "T₀ has to be in the past.");
  if (running.has(r.id))
    throw new RemoraError("replay.running", "A replay is already running for this remora.", 409);
  const [recent] = await deps.db
    .select({ id: remoraEvents.id })
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, r.id),
        eq(remoraEvents.type, "replay.ran"),
        gt(remoraEvents.createdAt, new Date(now.getTime() - 3_600_000)),
      ),
    )
    .orderBy(desc(remoraEvents.createdAt))
    .offset(REPLAY.perHour - 1)
    .limit(1);
  if (recent)
    throw new RemoraError("replay.rate_limited", "Three replays an hour: try again later.", 409);
  if ((await tokensToday(deps.db, r.id)) >= deps.dailyTokens)
    throw new RemoraError("model.cap_reached", `${r.name} used today's model budget.`, 409);

  const run: ReplayRun = {
    runId: "",
    remoraId: r.id,
    status: "running",
    startedAt: now.toISOString(),
    finishedAt: null,
    t0: t0.toISOString(),
    questions: questions.map((question) => ({
      question,
      shapes: shapesOf(question),
      plans: {},
      differences: [],
    })),
    totals: totalsOf([]),
    tokens: 0,
    error: null,
  };
  const [e] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "replay.ran",
      summary: `Replayed ${questions.length} question${questions.length === 1 ? "" : "s"} three ways (planned, nothing bought)`,
      payload: run as unknown as Record<string, unknown>,
    })
    .returning({ id: remoraEvents.id });
  const runId = e?.id ?? "";
  run.runId = runId;
  running.add(r.id);

  const save = () =>
    deps.db
      .update(remoraEvents)
      .set({ payload: run as unknown as Record<string, unknown> })
      .where(eq(remoraEvents.id, runId));

  const work = (async () => {
    try {
      let next = 0;
      const worker = async () => {
        while (next < run.questions.length) {
          const q = run.questions[next++];
          if (!q) break;
          // One recall per question; the T₀ column filters it by what was written by then.
          const recalled = await deps.memory
            .recall(r, q.question, ["me", "sources", "feedback"])
            .catch(() => []);
          for (const c of COLUMNS) {
            const { plan, tokens } = await planOne(deps, r, q.question, c, t0, recalled, now);
            q.plans[c] = plan;
            run.tokens += tokens;
            await addUsage(deps.db, r.id, tokens);
          }
          q.differences = differences(q.plans);
          run.totals = totalsOf(run.questions);
          await save();
        }
      };
      await Promise.all(Array.from({ length: REPLAY.concurrency }, worker));
      run.status = "done";
    } catch (err) {
      run.status = "failed";
      run.error = (err as Error).message.slice(0, 200);
      deps.log.warn("replay.failed", { remora: r.id, error: err });
    } finally {
      run.finishedAt = new Date().toISOString();
      run.totals = totalsOf(run.questions);
      await save().catch(() => {});
      running.delete(r.id);
    }
  })();
  if (opts.wait) await work;
  return { runId, done: work };
}

export async function replayRun(
  deps: Pick<RuntimeDeps, "db">,
  r: Remora,
  runId: string,
): Promise<ReplayRun> {
  const [e] = await deps.db
    .select()
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.id, runId),
        eq(remoraEvents.remoraId, r.id),
        eq(remoraEvents.type, "replay.ran"),
      ),
    );
  if (!e) throw new RemoraError("replay.not_found", "No such replay.", 404);
  return { ...(e.payload as unknown as ReplayRun), runId: e.id };
}

export async function replayRuns(deps: Pick<RuntimeDeps, "db">, r: Remora, limit = 10) {
  const rows = await deps.db
    .select()
    .from(remoraEvents)
    .where(and(eq(remoraEvents.remoraId, r.id), eq(remoraEvents.type, "replay.ran")))
    .orderBy(desc(remoraEvents.createdAt))
    .limit(limit);
  return rows.map((e) => {
    const p = e.payload as unknown as ReplayRun;
    return {
      runId: e.id,
      status: p.status,
      startedAt: p.startedAt,
      t0: p.t0,
      questions: p.questions?.length ?? 0,
      totals: p.totals,
    };
  });
}
