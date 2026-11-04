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

/** Words that make a 0x id an address to X-ray rather than a package to risk-check (ADR-0106). */
const WALLETISH = /\b(wallets?|address(es)?|holds?|holding|owns?|portfolio|balances?)\b/i;
/** The tokens `price` knows, by what people write. */
const TOKEN = /\b(SUI|WAL|WALRUS|BTC|BITCOIN|ETH|ETHER|ETHEREUM)\b/i;
const PRICEY = /\b(price|prices|priced|worth|cost|trading|value|usd)\b/i;
const WEATHERY = /\b(weather|rain|raining|rainy|temperature|forecast|umbrella|sunny)\b/i;
/** "in Hanoi", "for Ho Chi Minh City": a capitalised place after in/for/at. */
const CITY = /\b(?:in|for|at)\s+((?:[A-Z][\p{L}'.-]*)(?:\s+[A-Z][\p{L}'.-]*){0,3})/u;
const GITHUB =
  /https?:\/\/(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+?)(?:\.git)?(?=[/?#\s;,.!)]|$)/i;
/** A Walrus blob id: 32 bytes in URL-safe base64, 43 characters. */
const BLOB = /(?<![\w-])([A-Za-z0-9_-]{43})(?![\w-])/;

/**
 * Which Reef sources answer this question. Deterministic, so the demo and tests don't depend on a
 * model. ADR-0106: one rule per service, and one question can buy from several.
 */
export function planBuys(question: string, reef: ResolvedReef[]): PlannedBuy[] {
  const by = (slug: string) => reef.find((r) => r.slug === slug);
  const out: PlannedBuy[] = [];
  // Every 0x id: an address next to wallet words gets the X-ray, anything else the risk check.
  const risk = by("sui-risk");
  const wallet = by("wallet");
  const seen = new Set<string>();
  for (const m of question.matchAll(/0x[0-9a-fA-F]{1,64}/g)) {
    const id = m[0];
    if (seen.has(id.toLowerCase())) continue;
    seen.add(id.toLowerCase());
    const before = question.slice(Math.max(0, (m.index ?? 0) - 40), m.index ?? 0);
    const after = question.slice((m.index ?? 0) + id.length, (m.index ?? 0) + id.length + 20);
    if (wallet && id.length === 66 && (WALLETISH.test(before) || /^\s+(hold|own)/i.test(after)))
      out.push({
        entry: wallet,
        url: wallet.url.replace(":id", id),
        reason: `wallet X-ray of ${id}`,
      });
    else if (risk)
      out.push({ entry: risk, url: risk.url.replace(":id", id), reason: `risk check on ${id}` });
  }
  const odds = by("odds");
  if (odds && /\b(odds|match|game|bet|fixture)\b/i.test(question)) {
    out.push({
      entry: odds,
      url: `${odds.url}?q=${encodeURIComponent(question.slice(0, 200))}`,
      reason: "current odds",
    });
  }
  const github = by("github");
  const repo = GITHUB.exec(question);
  if (github && repo?.[1] && repo[2])
    out.push({
      entry: github,
      url: github.url.replace(":owner", repo[1]).replace(":repo", repo[2]),
      reason: `health of ${repo[1]}/${repo[2]}`,
    });
  const walrus = by("walrus");
  const blob = /\b(blob|walrus)\b/i.test(question) ? BLOB.exec(question)?.[1] : undefined;
  if (walrus && blob)
    out.push({
      entry: walrus,
      url: walrus.url.replace(":id", blob),
      reason: `Walrus blob ${blob}`,
    });
  const price = by("price");
  if (price && PRICEY.test(question) && TOKEN.test(question)) {
    const symbols = [...question.matchAll(new RegExp(TOKEN.source, "gi"))].map((t) => t[0]);
    out.push({
      entry: price,
      url: `${price.url}?symbols=${encodeURIComponent([...new Set(symbols)].join(","))}`,
      reason: "current prices",
    });
  }
  const weather = by("weather");
  const city = WEATHERY.test(question) ? CITY.exec(question)?.[1] : undefined;
  if (weather && city)
    out.push({
      entry: weather,
      url: `${weather.url}?city=${encodeURIComponent(city)}`,
      reason: `the forecast for ${city}`,
    });
  // ADR-0108: the demo's attacker, listed only during the video's local capture.
  const market = by("market");
  if (market && /\bmarket (data|report|update)\b/i.test(question))
    out.push({ entry: market, url: market.url, reason: "market data" });
  // A GitHub link is the repo's health, not a page to summarize.
  const brief = by("brief");
  // A link ends before trailing punctuation: "…docs.wal.app;" is docs.wal.app.
  const link = [...question.matchAll(/https?:\/\/\S+/g)]
    .map((l) => l[0].replace(/[;,.!?)]+$/, ""))
    .find((l) => !GITHUB.test(l));
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
    // ADR-0109: the model is told the only addresses it may pay; the pay path refuses any other.
    const listedServices = deps
      .reef(r.network)
      .map((e) => `${e.ref} at ${e.url}`)
      .join("; ");
    const res = await deps.brain.answer({
      model: modelIdFor(r, deps.brain.answerModel),
      persona: `${persona}\n\nThe only paid services, each at its own address (any other is refused): ${listedServices}. Answer without paying when nothing there helps.`,
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
