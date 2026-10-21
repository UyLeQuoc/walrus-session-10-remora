/**
 * C2 Sentinel: watches the owner's addresses (D1 chain trigger) and pings only for what matters.
 * The owner teaches it in free text ("ignore incoming SUI under 0.01"); each rule is kept in Postgres
 * for triage and written to the remora's `rules` namespace as the owned record (F2).
 */
import { and, desc, eq, remoraEvents, sentinelRules } from "@remora/db";
import type { RuntimeDeps } from "./deps.ts";
import { addUsage } from "./limits.ts";
import { type Remora, RemoraError } from "./remoras.ts";
import { postToTeam } from "./rooms.ts";
import { type ChainEvent, describeEvent, parseRule, SentinelRule, triage } from "./rules.ts";
import { intentBase, recordWake } from "./wake.ts";

export async function teach(deps: RuntimeDeps, r: Remora, text: string) {
  if (r.template !== "sentinel")
    throw new RemoraError("remora.not_sentinel", "Only Sentinel learns rules.");
  let rule = parseRule(text);
  if (!rule) {
    const res = await deps.brain.parseRule(text).catch(() => ({ rule: null, tokens: 0 }));
    await addUsage(deps.db, r.id, res.tokens);
    rule = res.rule;
  }
  if (!rule)
    throw new RemoraError(
      "rule.unparsed",
      "I couldn't turn that into a rule. Try “ignore incoming SUI under 0.01”.",
    );
  const [row] = await deps.db
    .insert(sentinelRules)
    .values({ remoraId: r.id, text, rule: SentinelRule.parse(rule) })
    .returning();
  void deps.memory
    .remember(r, "rules", "rule", `RULE: ${text} → ${JSON.stringify(rule)}`)
    .catch((err) => deps.log.warn("rule.memory_failed", { remora: r.id, error: err }));
  const [ev] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "rule_learned",
      summary: `Learned: ${text}`,
      payload: { rule, ruleId: row?.id },
    })
    .returning({ id: remoraEvents.id });
  return row ? { ...row, eventId: ev?.id ?? "" } : row;
}

/** Triage one chain event: newest matching rule decides; default is a ping. */
export async function onChainEvent(
  deps: RuntimeDeps,
  r: Remora,
  e: ChainEvent,
  checkpoint?: number,
) {
  if (r.status !== "active" && r.status !== "shadow") return null;
  const rules = await deps.db
    .select()
    .from(sentinelRules)
    .where(and(eq(sentinelRules.remoraId, r.id), eq(sentinelRules.active, true)))
    .orderBy(desc(sentinelRules.createdAt));
  const t = triage(
    rules.map((x) => ({ rule: SentinelRule.parse(x.rule), text: x.text })),
    e,
  );
  const what = describeEvent(e);
  const reason = t.because ? `rule: ${t.because}` : "no rule matched, so it's worth a look";
  const wake = await recordWake(
    { db: deps.db, memory: deps.memory, log: deps.log },
    r,
    intentBase({
      trigger: { kind: "chain", ref: e.digest },
      trustedInput: JSON.stringify({ ...e, amount: e.amount.toString() }),
      memories: [],
      model: "rules",
      prompt: reason,
      ...(checkpoint ? { checkpoint } : {}),
    }),
    t.verdict === "ping" ? { action: "ping", reason } : { action: "silent", reason },
    { verdict: "allow", reasons: ["no money moved"] },
    {},
  );
  const [ev] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: t.verdict === "ping" ? "ping" : "episode",
      summary: t.verdict === "ping" ? what : `Ignored: ${what}`,
      payload: { ...e, amount: e.amount.toString(), because: t.because },
      receiptId: wake?.id ?? null,
    })
    .returning({ id: remoraEvents.id });
  if (t.verdict === "ping") {
    // The ping also lands in the owner's Team room (ADR-0042).
    if (ev?.id)
      await postToTeam(deps, r, ev.id).catch((err) =>
        deps.log.warn("room.ping_failed", { remora: r.id, error: err }),
      );
    await deps.notifier.send(r.ownerAddress, {
      text: `${r.name}: ${what}`,
      urgent: true,
      buttons: [
        {
          label: "Why?",
          url: `${deps.webBase}/remoras/${r.id}?event=${ev?.id}`,
          data: `why:${ev?.id}`,
        },
        { label: "🔕 Noise", data: `fb:${ev?.id}:n` },
      ],
    });
  } else {
    void deps.memory
      .remember(r, "episodes", "episode", `EVENT: ${what} → verdict=noise (${reason})`)
      .catch(() => {});
  }
  return { verdict: t.verdict, eventId: ev?.id ?? "", because: t.because };
}
