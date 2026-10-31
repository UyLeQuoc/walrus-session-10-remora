/**
 * G5 + L1 (ADR-0046, ADR-0048): learning you can check, built only from what was recorded.
 * - **Proof of Learning:** two decisions by the same remora on the same kind of trigger and the same
 *   shape of input, with different outcomes, where the later Wake used memories the earlier one
 *   didn't have. That memory delta is what changed the outcome, and both Wakes verify.
 * - **Learning series:** per UTC day, from events and the owner's feedback. No modelled or smoothed
 *   numbers: a day with no data has no point.
 */
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  receipts,
  remoraEvents,
  remoraMemories,
  sentinelRules,
} from "@remora/db";
import {
  type DecisionRef,
  type LearningSeries,
  type ProofOfLearning,
  Wake,
  type WakeIntent,
} from "@remora/schema";
import type { RuntimeDeps } from "./deps.ts";
import { type Remora, RemoraError } from "./remoras.ts";

type Db = RuntimeDeps["db"];
type Action = DecisionRef["action"];

interface Decided {
  ref: DecisionRef;
  shape: string;
  createdAt: Date;
}

/** What "the same input" means: the same direction and coin for chain events, the same question otherwise. */
function shapeOf(
  intent: WakeIntent,
  payload: Record<string, unknown> | undefined,
  summary: string,
) {
  if (intent.trigger.kind === "chain") {
    const coin =
      String(payload?.coinType ?? "")
        .split("::")
        .pop() ?? "";
    return `chain:${String(payload?.direction ?? "")}:${coin}`;
  }
  const question = String(payload?.question ?? summary)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return `${intent.trigger.kind}:${question}`;
}

const VERB: Record<Action, string> = {
  pay: "paid",
  ping: "pinged you",
  digest: "put it in a digest",
  silent: "stayed quiet",
  answer: "answered",
};

/** Decisions a remora made, oldest first, each with the event it produced. */
async function decisions(db: Db, r: Remora, limit = 400): Promise<Decided[]> {
  const rows = await db
    .select()
    .from(receipts)
    .where(eq(receipts.remoraId, r.id))
    .orderBy(desc(receipts.createdAt))
    .limit(limit);
  const ids = rows.map((x) => x.id);
  const events = ids.length
    ? await db.select().from(remoraEvents).where(inArray(remoraEvents.receiptId, ids))
    : [];
  const byReceipt = new Map(events.map((e) => [e.receiptId, e]));
  const out: Decided[] = [];
  for (const row of rows.reverse()) {
    const wake = Wake.safeParse(row.wake);
    if (!wake.success) continue;
    const intent = wake.data.intent;
    const ev = byReceipt.get(row.id);
    const summary = ev?.summary ?? intent.decision.reason;
    out.push({
      createdAt: row.createdAt,
      shape: shapeOf(intent, ev?.payload, summary),
      ref: {
        receiptId: row.id,
        eventId: ev?.id ?? null,
        at: row.createdAt.toISOString(),
        trigger: intent.trigger,
        action: intent.decision.action,
        reason: intent.decision.reason,
        summary,
        memories: intent.memories,
        intentHash: row.intentHash,
        verify: `/verify/${row.id}`,
      },
    });
  }
  return out;
}

/** What each delta blob was, when this server knows: the rule it holds, or when it was written. */
async function describeDelta(db: Db, r: Remora, blobIds: string[]) {
  if (!blobIds.length) return [];
  const mems = await db
    .select()
    .from(remoraMemories)
    .where(and(eq(remoraMemories.remoraId, r.id), inArray(remoraMemories.blobId, blobIds)));
  const ruleRows = mems.length
    ? await db
        .select()
        .from(sentinelRules)
        .where(
          inArray(
            sentinelRules.memoryId,
            mems.map((m) => m.id),
          ),
        )
    : [];
  return blobIds.map((blobId) => {
    const m = mems.find((x) => x.blobId === blobId);
    const rule = m ? ruleRows.find((x) => x.memoryId === m.id) : undefined;
    return {
      blobId,
      text: rule?.text ?? null,
      learnedAt: (rule?.createdAt ?? m?.createdAt)?.toISOString() ?? null,
    };
  });
}

function build(
  r: Remora,
  before: DecisionRef,
  after: DecisionRef,
  delta: { blobId: string; namespace: string; text: string | null; learnedAt: string | null }[],
): ProofOfLearning {
  const learned = delta.find((d) => d.text)?.text;
  return {
    remoraId: r.id,
    remora: r.name,
    before,
    after,
    delta,
    change: {
      from: before.action,
      to: after.action,
      summary: `Before, it ${VERB[before.action]} (${before.summary}). After it learned ${learned ? `“${learned}”` : "something new"}, it ${VERB[after.action]} (${after.summary}).`,
    },
  };
}

/** G5: the remora's proofs, newest first. */
export async function proofsFor(db: Db, r: Remora, limit = 10): Promise<ProofOfLearning[]> {
  const all = await decisions(db, r);
  const out: ProofOfLearning[] = [];
  for (let j = all.length - 1; j >= 0 && out.length < limit; j--) {
    const after = all[j];
    if (!after?.ref.memories.length) continue;
    for (let i = j - 1; i >= 0; i--) {
      const before = all[i];
      if (!before) continue;
      if (before.ref.trigger.kind !== after.ref.trigger.kind || before.shape !== after.shape)
        continue;
      if (before.ref.action === after.ref.action) continue;
      const had = new Set(before.ref.memories.map((m) => m.blobId));
      const fresh = after.ref.memories.filter((m) => !had.has(m.blobId));
      if (!fresh.length) continue;
      const described = await describeDelta(
        db,
        r,
        fresh.map((m) => m.blobId),
      );
      out.push(
        build(
          r,
          before.ref,
          after.ref,
          fresh.map((m, k) => ({
            blobId: m.blobId,
            namespace: m.namespace,
            text: described[k]?.text ?? null,
            learnedAt: described[k]?.learnedAt ?? null,
          })),
        ),
      );
      break;
    }
  }
  return out;
}

/** G5: one proof between two of the remora's decisions, chosen by receipt id. */
export async function proofBetween(db: Db, r: Remora, beforeId: string, afterId: string) {
  const all = await decisions(db, r, 1_000);
  const before = all.find((d) => d.ref.receiptId === beforeId);
  const after = all.find((d) => d.ref.receiptId === afterId);
  if (!before || !after)
    throw new RemoraError("proof.not_found", "Those two decisions aren't this remora's.", 404);
  const had = new Set(before.ref.memories.map((m) => m.blobId));
  const fresh = after.ref.memories.filter((m) => !had.has(m.blobId));
  const described = await describeDelta(
    db,
    r,
    fresh.map((m) => m.blobId),
  );
  return build(
    r,
    before.ref,
    after.ref,
    fresh.map((m, k) => ({
      blobId: m.blobId,
      namespace: m.namespace,
      text: described[k]?.text ?? null,
      learnedAt: described[k]?.learnedAt ?? null,
    })),
  );
}

const day = (d: Date) => d.toISOString().slice(0, 10);

/** L1: the charts that apply to this remora's template. */
export async function learningSeries(db: Db, r: Remora): Promise<LearningSeries[]> {
  const events = await db
    .select()
    .from(remoraEvents)
    .where(eq(remoraEvents.remoraId, r.id))
    .orderBy(asc(remoraEvents.createdAt));
  const days = new Map<string, typeof events>();
  for (const e of events) {
    const k = day(e.createdAt);
    days.set(k, [...(days.get(k) ?? []), e]);
  }
  const series = (
    metric: LearningSeries["metric"],
    unit: LearningSeries["unit"],
    source: string,
    point: (es: typeof events) => { value: number | null; n: number },
  ): LearningSeries => ({
    remoraId: r.id,
    metric,
    unit,
    source,
    points: [...days.entries()]
      .map(([d, es]) => ({ day: d, ...point(es) }))
      .filter((p) => p.n > 0 || p.value !== null),
  });

  if (r.template === "sentinel") {
    return [
      series("noise_rate", "ratio", "Sentinel's pings that you marked 👎 noise", (es) => {
        const pings = es.filter((e) => e.type === "ping");
        const noise = pings.filter((e) => e.feedback === "noise").length;
        return { value: pings.length ? noise / pings.length : null, n: pings.length };
      }),
    ];
  }
  // Scout and other paying remoras.
  const receiptIds = events.flatMap((e) =>
    e.type === "answer" && e.receiptId ? [e.receiptId] : [],
  );
  const wakes = receiptIds.length
    ? await db.select().from(receipts).where(inArray(receipts.id, receiptIds))
    : [];
  const usedMemory = new Set(
    wakes
      .filter((w) => (Wake.safeParse(w.wake).data?.intent.memories.length ?? 0) > 0)
      .map((w) => w.id),
  );
  return [
    series(
      "cost_per_useful",
      "usdc",
      "What the remora paid, divided by the answers you marked 👍 useful",
      (es) => {
        const spent = es
          .filter((e) => e.type === "payment" && e.payload.approvedBy !== "owner")
          .reduce((sum, e) => sum + Number(e.payload.amount ?? 0), 0);
        const useful = es.filter((e) => e.type === "answer" && e.feedback === "useful").length;
        return { value: useful ? spent / 1e6 / useful : null, n: useful };
      },
    ),
    series("memory_hit_rate", "ratio", "Answers that used a memory and bought nothing", (es) => {
      const answers = es.filter((e) => e.type === "answer");
      const hits = answers.filter((e) => {
        const paid = (e.payload.paidPayees as unknown[] | undefined)?.length ?? 0;
        return !paid && e.receiptId && usedMemory.has(e.receiptId);
      }).length;
      return { value: answers.length ? hits / answers.length : null, n: answers.length };
    }),
  ];
}
