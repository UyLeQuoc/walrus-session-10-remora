/**
 * C1 Scout: answers the owner's questions by buying data from Reef services when it helps, then
 * replies with what it found and what it cost. Purchases are planned deterministically from the
 * question (and the model may ask for follow-ups); every one goes through `pay` (Sonar → Disc). The
 * model also gets the D4 read tools and can propose a schedule or hand a question to another remora.
 * Source counters feed F2 (`source_stats` + `sources` memories via feedback).
 */

import { remoraEvents } from "@remora/db";
import { payeeLabel, type ResolvedReef } from "../money/reef.ts";
import { type PayOutcome, requestPayment } from "../tools/pay.ts";
import { handoff, proposeSchedule } from "../tools/propose.ts";
import { readTools } from "../tools/read.ts";
import { modelIdFor, type UntrustedData, usdcLabel } from "./brain.ts";
import type { RuntimeDeps } from "./deps.ts";
import { admitMemories } from "./facts.ts";
import { addUsage, REMORA_LIMITS, tokensToday } from "./limits.ts";
import { type Remora, RemoraError } from "./remoras.ts";
import { intentBase, recordWake, sha256Hex } from "./wake.ts";

export interface PlannedBuy {
  entry: ResolvedReef;
  url: string;
  reason: string;
}

/** Which Reef sources answer this question. Deterministic, so the demo and tests don't depend on a model. */
export function planBuys(question: string, reef: ResolvedReef[]): PlannedBuy[] {
  const by = (slug: string) => reef.find((r) => r.slug === slug);
  const out: PlannedBuy[] = [];
  const id = /0x[0-9a-fA-F]{1,64}/.exec(question)?.[0];
  const risk = by("sui-risk");
  if (id && risk)
    out.push({ entry: risk, url: risk.url.replace(":id", id), reason: `risk check on ${id}` });
  const odds = by("odds");
  if (odds && /\b(odds|match|game|bet|fixture)\b/i.test(question)) {
    out.push({
      entry: odds,
      url: `${odds.url}?q=${encodeURIComponent(question.slice(0, 200))}`,
      reason: "current odds",
    });
  }
  const brief = by("brief");
  const link = /https?:\/\/\S+/.exec(question)?.[0];
  if (brief && (link || /\b(summari[sz]e|brief|tl;?dr)\b/i.test(question))) {
    const q = link
      ? `url=${encodeURIComponent(link)}`
      : `text=${encodeURIComponent(question.slice(0, 500))}`;
    out.push({ entry: brief, url: `${brief.url}?${q}`, reason: "a short summary" });
  }
  return out;
}

export interface ScoutResult {
  answer: string;
  eventId: string;
  receiptId: string | null;
  outcomes: PayOutcome[];
}

const outcomeLine = (o: PayOutcome) =>
  o.kind === "paid"
    ? `paid ${o.amount}`
    : o.kind === "shadow"
      ? `would have paid ${o.amount} (practice mode)`
      : o.kind === "approval"
        ? "waiting for your approval"
        : `not paid: ${o.reasons.at(-1) ?? o.code}`;

/**
 * ADR-0088: a planned purchase that didn't go through is said in the answer itself. The model only
 * sees what was bought, so without this it answers "I can't tell" and the owner never learns a paid
 * check was tried (the U8 e2e on Oct 31: the gas station timed out on Tatum).
 */
export function unpaidNote(planned: { payee: string; o: PayOutcome }[]): string | null {
  const lines = planned.flatMap(({ payee, o }) =>
    o.kind !== "blocked"
      ? []
      : o.code === "sonar.blocked"
        ? [
            `The safety check stopped a payment to ${payeeLabel(payee)}: ${o.reasons.at(-1) ?? "against the policy"}.`,
          ]
        : [
            `I tried to buy ${payeeLabel(payee)} for this, but the payment didn't go through (${o.code}), so this answer doesn't use it. Ask again in a minute.`,
          ],
  );
  return lines.length ? lines.join(" ") : null;
}

export async function scoutAsk(
  deps: RuntimeDeps,
  r: Remora,
  question: string,
  trigger: { kind: "message" | "cron" | "handoff"; ref: string } = { kind: "message", ref: "web" },
  /** H7 (ADR-0051): a playground turn reads the chain only: no web fetch, schedules or handoffs. */
  opts: { playground?: boolean } = {},
): Promise<ScoutResult> {
  if (r.status !== "active" && r.status !== "shadow") {
    throw new RemoraError("remora.not_active", `${r.name} is ${r.status}.`, 409);
  }
  if (!deps.limiter.take(`turn:${r.id}`, REMORA_LIMITS.turns).allowed) {
    throw new RemoraError("rate_limited", "Too many questions in a minute.", 409);
  }
  if ((await tokensToday(deps.db, r.id)) >= deps.dailyTokens) {
    throw new RemoraError("model.cap_reached", `${r.name} used today's model budget.`, 409);
  }
  // K1 (ADR-0052): each stage's time, logged once per turn.
  const timings: Record<string, number> = {};
  let mark = Date.now();
  const lap = (stage: string) => {
    const now = Date.now();
    timings[stage] = now - mark;
    mark = now;
  };
  const namespaces = ["me", "sources", "feedback"];
  const recalled = await deps.memory.recall(r, question, namespaces);
  lap("recallMs");
  // F15 (ADR-0074): what the model reads, and what the Wake cites, is what admission let through.
  const {
    memories,
    facts,
    report: admission,
  } = await admitMemories(
    {
      log: deps.log,
      ...(deps.facts ? { facts: deps.facts } : {}),
      ...(deps.admissionJudge && deps.brain.judgeMemories
        ? { judge: deps.brain.judgeMemories }
        : {}),
    },
    r,
    question,
    recalled,
    namespaces,
  );
  lap("admitMs");
  const outcomes: PayOutcome[] = [];
  const data: UntrustedData[] = [];
  const paidPayees: string[] = [];
  const buy = async (payee: string, url: string, reason: string) => {
    const o = await requestPayment(deps, r, { payee, url, reason, trigger, question, memories });
    outcomes.push(o);
    if (o.kind === "paid") {
      paidPayees.push(payee);
      data.push({
        source: payeeLabel(payee),
        content: await o.response.clone().text(),
        cost: usdcLabel(o.amount),
      });
    }
    return o;
  };
  const planned: { payee: string; o: PayOutcome }[] = [];
  for (const b of planBuys(question, deps.reef(r.network)))
    planned.push({ payee: b.entry.ref, o: await buy(b.entry.ref, b.url, b.reason) });
  lap("payMs");

  const persona = String(
    (r.config as { persona?: string }).persona ?? "You are the owner's Researcher.",
  );
  let answer: string;
  let tokens = 0;
  // The Wake records the model that actually answered (D9).
  let usedModel = modelIdFor(r, deps.brain.answerModel);
  try {
    const res = await deps.brain.answer({
      model: modelIdFor(r, deps.brain.answerModel),
      persona,
      question,
      memories: memories.map((m) => m.text),
      ...(facts.length ? { facts } : {}),
      data,
      pay: async ({ payee, url, reason }) => {
        const o = await buy(payee, url, reason);
        return o.kind === "paid"
          ? {
              source: payeeLabel(payee),
              content: await o.response.clone().text(),
              cost: usdcLabel(o.amount),
            }
          : outcomeLine(o);
      },
      tools: opts.playground
        ? chainOnly(
            readTools({
              client: deps.networks.client(r.network),
              memory: deps.memory,
              remora: r,
              ...(deps.facts ? { facts: deps.facts } : {}),
            }),
          )
        : {
            ...readTools({
              client: deps.networks.client(r.network),
              memory: deps.memory,
              remora: r,
              ...(deps.fetch ? { fetch: deps.fetch } : {}),
              ...(deps.facts ? { facts: deps.facts } : {}),
            }),
            schedule: ({ when, question: q }) => proposeSchedule(deps, r, when, q),
            handoff: ({ to, question: q }) => handoff(deps, r, to, q),
          },
    });
    answer = res.text;
    tokens = res.tokens;
    usedModel = res.model ?? usedModel;
  } catch {
    // The model is down: still answer with what was bought, and the Wake says no model wrote it.
    usedModel = "remora/no-model";
    answer = data.length
      ? `Here's what I found:\n${data.map((d) => `• ${d.source}: ${d.content.slice(0, 400)}`).join("\n")}`
      : "I couldn't reach my model right now, and nothing needed buying.";
  }
  const note = unpaidNote(planned);
  if (note) answer = `${answer}\n\n_${note}_`;
  lap("modelMs");
  await addUsage(deps.db, r.id, tokens);
  const spend = outcomes.map((o) => `${outcomeLine(o)}`).join("; ");
  const wake = await recordWake(
    { db: deps.db, memory: deps.memory, log: deps.log },
    r,
    intentBase({
      trigger,
      trustedInput: question,
      memories,
      model: usedModel,
      prompt: `${persona}\n${question}`,
    }),
    {
      action: "answer",
      reason: outcomes.length ? `answered after: ${spend}` : "answered from memory",
    },
    { verdict: "allow", reasons: ["no money moved in this step"] },
    { responseSha256: sha256Hex(answer) },
  );
  const [e] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "answer",
      summary: question.slice(0, 140),
      payload: {
        question,
        answer,
        paidPayees,
        digests: outcomes.flatMap((o) => (o.kind === "paid" && o.digest ? [o.digest] : [])),
        outcomes: outcomes.map((o) => ({ kind: o.kind, eventId: o.eventId })),
        admission,
      },
      receiptId: wake?.id ?? null,
    })
    .returning({ id: remoraEvents.id });
  lap("writeMs");
  deps.log.info("turn.timings", { remora: r.id, ...timings, paid: paidPayees.length });
  return { answer, eventId: e?.id ?? "", receiptId: wake?.id ?? null, outcomes };
}

/** A playground turn's tools: Tatum reads only. */
const chainOnly = ({ balances, object }: ReturnType<typeof readTools>) => ({
  ...(balances ? { balances } : {}),
  ...(object ? { object } : {}),
});
