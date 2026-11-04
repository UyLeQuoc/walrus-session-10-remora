/**
 * ADR-0114 (U17 B): crews. A crew is a team applied with one signature, plus a lead. Asked a
 * question, the lead plans the purchases (`planBuys`), hands each one to the member that covers it,
 * all at once, and answers with every member's receipt. Each member pays from its own Disc. The crew
 * lives in each member's config (`crew`), so there's no schema change.
 */
import { and, eq, remoraEvents, remoras } from "@remora/db";
import type { RuntimeDeps } from "./deps.ts";
import { type Remora, RemoraError } from "./remoras.ts";
import type { PlannedBuy } from "./scout.ts";

export interface Crew {
  id: string;
  name: string;
  leadId: string;
  /** Reef slugs this member buys for the lead. */
  covers: string[];
}

export const crewOf = (r: Remora): Crew | null => {
  const c = (r.config as { crew?: Crew }).crew;
  return c && typeof c.id === "string" && typeof c.leadId === "string" ? c : null;
};

export const isLead = (r: Remora) => crewOf(r)?.leadId === r.id;

/** Everyone in this remora's crew, the lead included, retired ones left out. */
export async function crewMembers(deps: RuntimeDeps, r: Remora): Promise<Remora[]> {
  const crew = crewOf(r);
  if (!crew) return [];
  const mine = await deps.db
    .select()
    .from(remoras)
    .where(and(eq(remoras.ownerAddress, r.ownerAddress), eq(remoras.network, r.network)));
  return mine.filter((m) => m.status !== "retired" && crewOf(m)?.id === crew.id);
}

/**
 * Who buys what: each planned purchase goes to a live member that covers its service, else to the
 * members in turn. The lead never buys.
 */
export function assign(planned: PlannedBuy[], members: Remora[]): Map<Remora, PlannedBuy[]> {
  const live = members
    .filter((m) => !isLead(m) && (m.status === "active" || m.status === "shadow"))
    .sort((a, b) => a.name.localeCompare(b.name));
  const out = new Map<Remora, PlannedBuy[]>();
  let turn = 0;
  for (const p of planned) {
    const slug = p.entry.slug;
    const covering = live.filter((m) => crewOf(m)?.covers.includes(slug));
    // Spread a member's services across members that cover the same one.
    const pick = covering.length
      ? covering.reduce((a, b) => ((out.get(a)?.length ?? 0) <= (out.get(b)?.length ?? 0) ? a : b))
      : live[turn++ % Math.max(live.length, 1)];
    if (!pick) continue;
    out.set(pick, [...(out.get(pick) ?? []), p]);
  }
  return out;
}

/** What the crew page shows: each member, its limit and what it has spent this month. */
export async function crewView(deps: RuntimeDeps, r: Remora) {
  const crew = crewOf(r);
  if (!crew) throw new RemoraError("crew.none", `${r.name} isn't in a crew.`, 404);
  const members = await crewMembers(deps, r);
  const since = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
  const rows: {
    id: string;
    name: string;
    template: string;
    status: string;
    lead: boolean;
    covers: string[];
    limit: string | null;
    perPayment: string | null;
    spent: string;
    payments: number;
  }[] = [];
  for (const m of members) {
    const events = await deps.db
      .select()
      .from(remoraEvents)
      .where(and(eq(remoraEvents.remoraId, m.id), eq(remoraEvents.type, "payment")));
    const spent = events
      .filter((e) => e.createdAt >= since)
      .reduce((n, e) => n + BigInt(String((e.payload as { amount?: string }).amount ?? 0)), 0n);
    const budget = (m.config as { budget?: { windowLimit?: string; perPaymentCap?: string } })
      .budget;
    rows.push({
      id: m.id,
      name: m.name,
      template: m.template,
      status: m.status,
      lead: m.id === crew.leadId,
      covers: crewOf(m)?.covers ?? [],
      limit: budget?.windowLimit ?? null,
      perPayment: budget?.perPaymentCap ?? null,
      spent: spent.toString(),
      payments: events.filter((e) => e.createdAt >= since).length,
    });
  }
  const total = (k: "limit" | "spent") =>
    rows.reduce((n, x) => n + BigInt(x[k] ?? "0"), 0n).toString();
  return {
    crew: { id: crew.id, name: crew.name, leadId: crew.leadId },
    members: rows,
    limit: total("limit"),
    spent: total("spent"),
  };
}

/** Pause or resume the whole crew in the runtime: one click, no transaction. */
export async function pauseCrew(deps: RuntimeDeps, r: Remora, paused: boolean) {
  const changed: string[] = [];
  for (const m of await crewMembers(deps, r)) {
    const next = paused
      ? m.status === "active" || m.status === "shadow"
        ? "paused"
        : null
      : m.status === "paused"
        ? ((m.config as { crewWas?: string }).crewWas ?? "active")
        : null;
    if (!next) continue;
    await deps.db
      .update(remoras)
      .set({
        status: next as Remora["status"],
        config: { ...m.config, crewWas: paused ? m.status : undefined },
        updatedAt: new Date(),
      })
      .where(eq(remoras.id, m.id));
    await deps.db.insert(remoraEvents).values({
      remoraId: m.id,
      network: m.network,
      type: "action",
      summary: paused ? `${m.name} is paused with its crew.` : `${m.name} is back with its crew.`,
      payload: { kind: "crew", crewId: crewOf(m)?.id, paused },
    });
    changed.push(m.id);
  }
  return { changed };
}
