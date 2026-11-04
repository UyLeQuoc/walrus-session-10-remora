/**
 * ADR-0106: the Briefer, the third kind. Its owner keeps a short list ("SUI and WAL prices", "weather
 * in Hanoi", a wallet, a repo). On its schedule, or on Run now, it asks the Researcher's pay path one
 * question built from the list: `planBuys` finds a service for each item, each purchase leaves its own
 * receipt, and the answer is the brief. The list lives in the remora's config next to its schedules;
 * the brief's schedule carries the question, rebuilt whenever the list changes.
 */
import { and, desc, eq, inArray, remoraEvents, remoras } from "@remora/db";
import { nextRun } from "../triggers/cron.ts";
import { BRIEF_WHEN, briefQuestion, MAX_ITEMS } from "./brief-question.ts";
import { saveConfig } from "./config-versions.ts";
import type { RuntimeDeps } from "./deps.ts";
import { type Remora, RemoraError } from "./remoras.ts";
import { addSchedule, askNow, type Schedule } from "./schedules.ts";

export { BRIEF_WHEN, briefItem, briefQuestion, MAX_ITEMS } from "./brief-question.ts";

export const itemsOf = (r: Remora) =>
  ((r.config as { items?: string[] }).items ?? []).filter((x) => x.trim());

const schedulesOf = (r: Remora) => (r.config as { schedules?: Schedule[] }).schedules ?? [];

/** The schedule that runs the brief: the first one. */
export const briefSchedule = (r: Remora) => schedulesOf(r)[0] ?? null;

/** Sets the list and keeps the brief's schedule asking about it (adding the schedule the first time). */
export async function setBriefItems(
  deps: RuntimeDeps,
  r: Remora,
  raw: string[],
  opts: { paused?: boolean } = {},
) {
  if (r.template !== "briefer")
    throw new RemoraError("brief.unsupported", `${r.name} isn't a Briefer.`, 409);
  const items = raw
    .map((x) => x.trim().slice(0, 120))
    .filter(Boolean)
    .slice(0, MAX_ITEMS);
  if (!items.length) throw new RemoraError("brief.empty", "List at least one thing to follow.");
  const question = briefQuestion(items);
  const current = briefSchedule(r);
  let next = await saveConfig(
    deps.db,
    r.id,
    (c) => {
      const list = (c as { schedules?: Schedule[] }).schedules ?? [];
      const first = list[0];
      return { ...c, items, schedules: first ? [{ ...first, question }, ...list.slice(1)] : list };
    },
    {
      summary: () => `Brief list changed: ${items.length} item${items.length === 1 ? "" : "s"}`,
      payload: { items },
    },
  );
  if (!current) {
    await addSchedule(deps, next, BRIEF_WHEN, question, opts);
    const [reloaded] = await deps.db.select().from(remoras).where(eq(remoras.id, r.id));
    next = reloaded ?? next;
  }
  return { items, schedule: briefSchedule(next) };
}

/** Run now: the brief, as its schedule would send it. */
export async function briefNow(deps: RuntimeDeps, r: Remora) {
  if (r.template !== "briefer")
    throw new RemoraError("brief.unsupported", `${r.name} isn't a Briefer.`, 409);
  const items = itemsOf(r);
  if (!items.length) throw new RemoraError("brief.empty", "List at least one thing to follow.");
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary: `Brief run now: ${items.length} item${items.length === 1 ? "" : "s"}`,
    payload: { items },
  });
  return askNow(deps, r, briefQuestion(items), { kind: "message", ref: "brief" }, `${r.name}:`);
}

/**
 * What the Briefer's page shows: its list, its schedule and the next run, and its last brief with a
 * receipt for each thing that brief bought.
 */
export async function briefView(deps: RuntimeDeps, r: Remora) {
  const s = briefSchedule(r);
  const [last] = await deps.db
    .select()
    .from(remoraEvents)
    .where(and(eq(remoraEvents.remoraId, r.id), eq(remoraEvents.type, "answer")))
    .orderBy(desc(remoraEvents.createdAt))
    .limit(1);
  const p = (last?.payload ?? {}) as {
    answer?: string;
    question?: string;
    outcomes?: { kind: string; eventId?: string }[];
  };
  const paidIds = (p.outcomes ?? []).flatMap((o) =>
    o.kind === "paid" && o.eventId ? [o.eventId] : [],
  );
  const paid = paidIds.length
    ? await deps.db.select().from(remoraEvents).where(inArray(remoraEvents.id, paidIds))
    : [];
  return {
    items: itemsOf(r),
    schedule: s
      ? {
          id: s.id,
          human: s.human,
          paused: !!s.paused,
          next: s.paused ? null : (nextRun(s.cron, new Date())?.toISOString() ?? null),
        }
      : null,
    last:
      last && p.answer
        ? {
            eventId: last.id,
            at: last.createdAt.toISOString(),
            answer: p.answer,
            paid: paid.map((e) => {
              const x = (e.payload ?? {}) as { payee?: string; amount?: string; digest?: string };
              return {
                payee: x.payee ?? "",
                amount: x.amount ?? "0",
                digest: x.digest ?? null,
              };
            }),
          }
        : null,
  };
}
