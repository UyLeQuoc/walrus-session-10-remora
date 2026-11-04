/**
 * F10 (ADR-0128): every week a remora writes "What I learned": what it paid for and what was useful,
 * which sources it trusts more or less, what it was taught, how its budget proposals ended, and its
 * spend against its limit. The numbers come from its own rows; the model only words them. The review
 * goes back into Walrus Memory, so next week's reads last week's, and to Telegram when it's linked.
 */
import { and, approvals, desc, eq, gt, inArray, remoraEvents, remoras } from "@remora/db";
import type { Budget } from "@remora/schema";
import { payeeLabel } from "../money/reef.ts";
import { modelIdFor } from "./brain.ts";
import type { RuntimeDeps } from "./deps.ts";
import { enqueue, type JobHandler } from "./jobs.ts";
import type { Remora } from "./remoras.ts";

export const REVIEW_WEEKLY = "review.weekly";
const DAY_MS = 86_400_000;

export interface ReviewFacts {
  from: string;
  to: string;
  /** Spend per day, oldest first (smallest units). */
  days: { date: string; spent: string }[];
  spent: string;
  limit: string | null;
  bought: { payee: string; calls: number; spent: string; useful: number; noise: number }[];
  useful: number;
  noise: number;
  taught: string[];
  proposals: { summary: string; outcome: "accepted" | "declined"; reason?: string }[];
  answers: number;
}

const usdc = (u: bigint | string) => (Number(u) / 1e6).toFixed(2);
const dateOf = (d: Date) => d.toISOString().slice(0, 10);

/** The week's numbers, from the remora's own events and approvals. */
export async function reviewFacts(
  deps: Pick<RuntimeDeps, "db">,
  r: Remora,
  now = new Date(),
): Promise<ReviewFacts> {
  const since = new Date(now.getTime() - 7 * DAY_MS);
  const events = await deps.db
    .select()
    .from(remoraEvents)
    .where(and(eq(remoraEvents.remoraId, r.id), gt(remoraEvents.createdAt, since)))
    .orderBy(desc(remoraEvents.createdAt))
    .limit(500);
  const decided = await deps.db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.remoraId, r.id),
        eq(approvals.kind, "budget_change"),
        inArray(approvals.status, ["approved", "rejected"]),
        gt(approvals.createdAt, since),
      ),
    );
  const days = Array.from({ length: 7 }, (_, i) =>
    dateOf(new Date(since.getTime() + (i + 1) * DAY_MS)),
  );
  const perDay = new Map(days.map((d) => [d, 0n]));
  const bought = new Map<string, ReviewFacts["bought"][number]>();
  let spent = 0n;
  let useful = 0;
  let noise = 0;
  let answers = 0;
  const taught: string[] = [];
  for (const e of events) {
    const p = e.payload as {
      payee?: string;
      amount?: string;
      approvedBy?: string;
      paidPayees?: string[];
    };
    if (e.type === "payment" && p.payee && p.amount && p.approvedBy !== "owner") {
      const a = BigInt(p.amount);
      spent += a;
      const d = dateOf(e.createdAt);
      if (perDay.has(d)) perDay.set(d, (perDay.get(d) ?? 0n) + a);
      const b = bought.get(p.payee) ?? {
        payee: p.payee,
        calls: 0,
        spent: "0",
        useful: 0,
        noise: 0,
      };
      b.calls += 1;
      b.spent = (BigInt(b.spent) + a).toString();
      bought.set(p.payee, b);
    }
    if (e.type === "answer") {
      answers += 1;
      if (e.feedback === "useful") useful += 1;
      if (e.feedback === "noise") noise += 1;
      for (const payee of p.paidPayees ?? []) {
        const b = bought.get(payee);
        if (b && e.feedback === "useful") b.useful += 1;
        if (b && e.feedback === "noise") b.noise += 1;
      }
    }
    if (e.type === "rule_learned") taught.push(e.summary.replace(/^Learned:\s*/, ""));
  }
  const budget = (r.config as { budget?: Budget }).budget;
  return {
    from: dateOf(since),
    to: dateOf(now),
    days: days.map((date) => ({ date, spent: (perDay.get(date) ?? 0n).toString() })),
    spent: spent.toString(),
    limit: budget?.windowLimit ?? null,
    bought: [...bought.values()].sort((a, b) => b.calls - a.calls),
    useful,
    noise,
    taught: taught.slice(0, 5),
    proposals: decided.map((a) => ({
      summary: a.summary,
      outcome: a.status === "approved" ? "accepted" : "declined",
      ...((a.payload as { declineReason?: string }).declineReason
        ? { reason: (a.payload as { declineReason?: string }).declineReason }
        : {}),
    })),
    answers,
  };
}

/** The week's numbers with every amount in USDC, for the model. */
export function inUsdc(f: ReviewFacts) {
  return {
    ...f,
    days: f.days.map((d) => ({ date: d.date, spentUsdc: usdc(d.spent) })),
    spent: undefined,
    spentUsdc: usdc(f.spent),
    limit: undefined,
    limitUsdc: f.limit ? usdc(f.limit) : null,
    bought: f.bought.map((b) => ({
      service: payeeLabel(b.payee),
      calls: b.calls,
      spentUsdc: usdc(b.spent),
      useful: b.useful,
      noise: b.noise,
    })),
  };
}

/** The lines when no model writes them: plain, from the numbers only. */
export function plainLines(f: ReviewFacts, previous: string | null): string[] {
  const lines: string[] = [];
  lines.push(
    `I spent ${usdc(f.spent)} USDC${f.limit ? ` of my ${usdc(f.limit)} limit` : ""} on ${f.bought.reduce((a, b) => a + b.calls, 0)} purchases, and answered ${f.answers} times.`,
  );
  const best = f.bought.find((b) => b.useful > b.noise);
  if (best)
    lines.push(
      `${payeeLabel(best.payee)} was worth it: ${best.useful} useful of ${best.calls} buys.`,
    );
  const worst = f.bought.find((b) => b.noise > b.useful);
  if (worst)
    lines.push(
      `I trust ${payeeLabel(worst.payee)} less: ${worst.noise} answers it fed were noise.`,
    );
  if (f.useful + f.noise) lines.push(`You rated ${f.useful} answers useful and ${f.noise} noise.`);
  for (const t of f.taught.slice(0, 2)) lines.push(`You taught me: ${t}.`);
  for (const p of f.proposals)
    lines.push(`You ${p.outcome} "${p.summary}"${p.reason ? ` because ${p.reason}` : ""}.`);
  if (previous) lines.push(`Last week I said: "${previous.slice(0, 120)}"`);
  return lines.slice(0, 7);
}

/** Writes this week's review: an event with the numbers and the words, and a memory. */
export async function writeReview(deps: RuntimeDeps, r: Remora, now = new Date()) {
  const facts = await reviewFacts(deps, r, now);
  const [prev] = await deps.db
    .select()
    .from(remoraEvents)
    .where(and(eq(remoraEvents.remoraId, r.id), eq(remoraEvents.type, "review")))
    .orderBy(desc(remoraEvents.createdAt))
    .limit(1);
  const previous = prev ? String((prev.payload as { lines?: string[] }).lines?.[0] ?? "") : null;
  let lines = plainLines(facts, previous);
  let model = "remora/no-model";
  try {
    const out = await deps.brain.answer({
      model: modelIdFor(r, deps.brain.answerModel),
      persona: "You are an agent writing your owner a short weekly note about what you learned.",
      question: [
        "Write 3 to 6 short lines, one per line, no bullets or markdown, in the first person:",
        "what you paid for and whether it was worth it, which sources you trust more or less, what you were taught, how your budget proposals ended, and your spend against your limit.",
        previous ? `Start by comparing with what you said last week: "${previous}".` : "",
        "Use only these numbers; never invent one.",
      ]
        .filter(Boolean)
        .join(" "),
      memories: [],
      // In USDC, so the model never writes smallest units.
      data: [{ source: "this week's numbers (USDC)", content: JSON.stringify(inUsdc(facts)) }],
    });
    const written = out.text
      .split("\n")
      .map((l) => l.replace(/^[-*•\d.)\s]+/, "").trim())
      .filter(Boolean)
      .slice(0, 6);
    if (written.length >= 2) {
      lines = written;
      model = out.model ?? modelIdFor(r, deps.brain.answerModel);
    }
  } catch {
    // The plain lines stand.
  }
  const text = `REVIEW ${facts.from}..${facts.to} · ${lines.join(" · ")}`;
  const saved = await deps.memory
    .remember(r, "feedback", "episode", text.slice(0, 1_800), { dedupe: false })
    .catch((err) => {
      deps.log.warn("review.memory_failed", { remora: r.id, error: err });
      return null;
    });
  const [e] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "review",
      summary: `What ${r.name} learned, ${facts.from} to ${facts.to}`,
      payload: {
        lines,
        facts,
        model,
        ...(prev ? { previousId: prev.id } : {}),
        ...(saved?.indexId ? { memoryId: saved.indexId } : {}),
      },
    })
    .returning();
  await deps.notifier
    .send(r.ownerAddress, {
      text: `${r.name}'s week:\n${lines.map((l) => `• ${l}`).join("\n")}`,
      buttons: [{ label: "Open", url: `${deps.webBase}/remoras/${r.id}?tab=learning` }],
    })
    .catch((err) => deps.log.warn("review.notify_failed", { remora: r.id, error: err }));
  return e;
}

/** The last few reviews, newest first, each with its memory's blob once it has landed. */
export async function reviewsOf(deps: Pick<RuntimeDeps, "db">, r: Remora) {
  const rows = await deps.db
    .select()
    .from(remoraEvents)
    .where(and(eq(remoraEvents.remoraId, r.id), eq(remoraEvents.type, "review")))
    .orderBy(desc(remoraEvents.createdAt))
    .limit(4);
  const { remoraMemories } = await import("@remora/db");
  const ids = rows.flatMap((x) => {
    const id = (x.payload as { memoryId?: string }).memoryId;
    return id ? [id] : [];
  });
  const mems = ids.length
    ? await deps.db
        .select({ id: remoraMemories.id, blobId: remoraMemories.blobId })
        .from(remoraMemories)
        .where(inArray(remoraMemories.id, ids))
    : [];
  return rows.map((x) => {
    const p = x.payload as {
      lines: string[];
      facts: ReviewFacts;
      memoryId?: string;
      previousId?: string;
    };
    return {
      id: x.id,
      at: x.createdAt.toISOString(),
      lines: p.lines,
      facts: p.facts,
      previousId: p.previousId ?? null,
      blobId: mems.find((m) => m.id === p.memoryId)?.blobId ?? null,
    };
  });
}

/** Next Monday at 09:00 in the owner's timezone. */
export function nextMonday9(now: Date, timezone = "UTC"): Date {
  const local = (d: Date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      weekday: "short",
    }).formatToParts(d);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
    return {
      weekday: get("weekday"),
      hour: Number(get("hour")) % 24,
      minute: Number(get("minute")),
    };
  };
  // Walk forward hour by hour (at most a week) to the next local Monday 09:00.
  const start = new Date(Math.floor(now.getTime() / 3_600_000) * 3_600_000 + 3_600_000);
  for (let t = start.getTime(); t < now.getTime() + 8 * DAY_MS; t += 3_600_000) {
    const l = local(new Date(t));
    if (l.weekday === "Mon" && l.hour === 9) return new Date(t - l.minute * 60_000);
  }
  return new Date(now.getTime() + 7 * DAY_MS);
}

export const queueWeeklyReview = async (deps: Pick<RuntimeDeps, "db">, r: Remora, at: Date) =>
  enqueue(deps.db, {
    kind: REVIEW_WEEKLY,
    payload: { remoraId: r.id },
    idempotencyKey: `${REVIEW_WEEKLY}:${r.id}:${dateOf(at)}`,
    runAt: at,
    maxAttempts: 2,
  });

export function weeklyReviewHandler(
  deps: RuntimeDeps,
  timezoneOf: (owner: string) => Promise<string>,
): JobHandler {
  return async (payload) => {
    const { remoraId } = payload as { remoraId: string };
    const [r] = await deps.db.select().from(remoras).where(eq(remoras.id, remoraId));
    if (!r || r.status === "retired" || r.playground) return;
    if (r.status === "active") await writeReview(deps, r);
    await queueWeeklyReview(deps, r, nextMonday9(new Date(), await timezoneOf(r.ownerAddress)));
  };
}
