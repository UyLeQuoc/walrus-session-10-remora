/**
 * N19 → F2: feedback is how remoras learn. 👍/🔕 on a Scout answer moves its sources' scores, and the
 * new score is written as a `sources` conclusion memory. 🔕 on a Sentinel ping becomes a rule that
 * ignores events like it ("learns escalation rules from 👍/🔕/free text", spec §4).
 */
import { and, eq, remoraEvents, remoras, sentinelRules, sourceStats, sql } from "@remora/db";
import type { RuntimeDeps } from "./deps.ts";
import { RemoraError } from "./remoras.ts";
import { SentinelRule } from "./rules.ts";

export async function giveFeedback(
  deps: RuntimeDeps,
  owner: string,
  eventId: string,
  verdict: "useful" | "noise",
) {
  const [row] = await deps.db
    .select({ e: remoraEvents, r: remoras })
    .from(remoraEvents)
    .innerJoin(remoras, eq(remoras.id, remoraEvents.remoraId))
    .where(eq(remoraEvents.id, eventId));
  if (!row) throw new RemoraError("event.not_found", "No such event.", 404);
  if (row.r.ownerAddress !== owner)
    throw new RemoraError("remora.not_owner", "That isn't yours.", 403);
  await deps.db.update(remoraEvents).set({ feedback: verdict }).where(eq(remoraEvents.id, eventId));
  const { e, r } = row;

  if (e.type === "answer") {
    const payees = ((e.payload as { paidPayees?: string[] }).paidPayees ?? []).filter(Boolean);
    for (const payee of new Set(payees)) {
      const [s] = await deps.db
        .update(sourceStats)
        .set(
          verdict === "useful"
            ? { useful: sql`${sourceStats.useful} + 1` }
            : { noise: sql`${sourceStats.noise} + 1` },
        )
        .where(and(eq(sourceStats.remoraId, r.id), eq(sourceStats.payee, payee)))
        .returning();
      if (s) {
        const perUseful = s.useful ? Number(s.spent) / 1e6 / s.useful : null;
        const line = `SOURCE ${payee} · ${s.calls} calls · ${s.useful} useful · ${s.noise} noise · ${perUseful === null ? "no useful answers yet" : `$${perUseful.toFixed(3)} per useful answer`} · as_of ${new Date().toISOString().slice(0, 10)}`;
        void deps.memory.remember(r, "sources", "source", line).catch(() => {});
      }
    }
    return { learned: payees.length ? `scored ${payees.length} source(s)` : "noted" };
  }

  if (e.type === "ping" && verdict === "noise" && r.template === "sentinel") {
    const p = e.payload as {
      direction?: "in" | "out";
      coinType?: string;
      amount?: string;
      decimals?: number;
    };
    if (p.direction && p.coinType && p.amount) {
      const units = Number(p.amount) / 10 ** (p.decimals ?? 9);
      const coin = p.coinType.split("::").pop() ?? p.coinType;
      const rule = SentinelRule.parse({
        action: "ignore",
        when: { direction: p.direction, coin, under: Number((units * 2).toPrecision(2)) },
      });
      const text = `ignore ${p.direction === "in" ? "incoming" : "outgoing"} ${coin} under ${rule.when.under} (from 🔕)`;
      await deps.db.insert(sentinelRules).values({ remoraId: r.id, text, rule });
      await deps.db.insert(remoraEvents).values({
        remoraId: r.id,
        network: r.network,
        type: "rule_learned",
        summary: `Learned: ${text}`,
        payload: { rule },
      });
      void deps.memory
        .remember(r, "rules", "rule", `RULE: ${text} → ${JSON.stringify(rule)}`)
        .catch(() => {});
      return { learned: text };
    }
  }
  return { learned: "noted" };
}
