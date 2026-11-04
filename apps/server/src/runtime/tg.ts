/**
 * H3 (ADR-0115): what the Telegram Mini App shows and does, for one owner: their remoras, their last
 * receipts and what waits on them, and Pause all (in the runtime, no transaction: a paused remora
 * pays nothing; pausing onchain too still happens in the web app, where the wallet signs).
 */
import { and, desc, eq, inArray, ne, remoraEvents, remoras } from "@remora/db";
import { listApprovals } from "./approvals.ts";
import type { RuntimeDeps } from "./deps.ts";

export async function tgOverview(deps: RuntimeDeps, owner: string) {
  const mine = await deps.db
    .select()
    .from(remoras)
    .where(
      and(
        eq(remoras.ownerAddress, owner),
        eq(remoras.network, "testnet"),
        eq(remoras.playground, false),
        ne(remoras.status, "retired"),
      ),
    );
  const ids = mine.map((r) => r.id);
  const paid = ids.length
    ? await deps.db
        .select()
        .from(remoraEvents)
        .where(and(inArray(remoraEvents.remoraId, ids), eq(remoraEvents.type, "payment")))
        .orderBy(desc(remoraEvents.createdAt))
        .limit(10)
    : [];
  const waiting = await listApprovals(deps, owner, "testnet");
  const name = new Map(mine.map((r) => [r.id, r.name]));
  return {
    remoras: mine.map((r) => ({ id: r.id, name: r.name, template: r.template, status: r.status })),
    receipts: paid.map((e) => {
      const p = e.payload as { payee?: string; amount?: string; digest?: string };
      return {
        remora: name.get(e.remoraId) ?? "",
        payee: p.payee ?? "",
        amount: p.amount ?? "0",
        digest: p.digest ?? null,
        at: e.createdAt.toISOString(),
      };
    }),
    approvals: waiting
      .filter(({ a }) => a.status === "pending")
      .map(({ a, remora }) => ({ id: a.id, remora, summary: a.summary })),
    web: deps.webBase,
  };
}

/** Pause all, or resume all, in the runtime. Resume gives each remora back the status it had. */
export async function tgPauseAll(deps: RuntimeDeps, owner: string, paused: boolean) {
  const mine = await deps.db
    .select()
    .from(remoras)
    .where(and(eq(remoras.ownerAddress, owner), eq(remoras.playground, false)));
  let changed = 0;
  for (const r of mine) {
    const was = (r.config as { tgWas?: string }).tgWas;
    const next = paused
      ? r.status === "active" || r.status === "shadow"
        ? "paused"
        : null
      : r.status === "paused" && was
        ? was
        : null;
    if (!next) continue;
    await deps.db
      .update(remoras)
      .set({
        status: next as typeof r.status,
        config: { ...r.config, tgWas: paused ? r.status : undefined },
        updatedAt: new Date(),
      })
      .where(eq(remoras.id, r.id));
    await deps.db.insert(remoraEvents).values({
      remoraId: r.id,
      network: r.network,
      type: "action",
      summary: paused ? `${r.name} is paused from Telegram.` : `${r.name} is back, from Telegram.`,
      payload: { kind: "tg", paused },
    });
    changed++;
  }
  return { changed };
}
