/**
 * D3 (ADR-0150): template updates. When an author publishes a new version (the hatchery's `Published`
 * with a `parent` by the same author), every remora hatched here from an older version is offered a
 * `template_update` approval:
 * - **the diff** covers what a template carries for that remora: persona, brain, tools, triggers,
 *   Reef services, rules and the spending limit. A field is offered only when the author changed it
 *   between the two versions and the remora's value would change. Lists merge: what the author
 *   removed goes, what they added comes, what the owner added stays.
 * - **Accept** applies the settings that don't touch money through `saveConfig` (one version in the
 *   history, `source: "template vN"`). The spending limit and the Reef services never apply by
 *   themselves: they come back as a prepared transaction the owner signs, and the usual
 *   `/budget/confirm` or `/payees/confirm` applies it. Tools come from the remora's kind and aren't
 *   changed here.
 * - **Decline** is remembered: a memory line, and that version is never offered again.
 */
import { randomBytes } from "node:crypto";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import {
  and,
  approvals,
  type Db,
  desc,
  eq,
  hatcheryForks,
  hatcheryTemplates,
  inArray,
  remoraEvents,
  remoras,
  sentinelRules,
  sql,
} from "@remora/db";
import { tokenSymbol } from "@remora/merchant";
import {
  Budget,
  isCatalogModel,
  RemoraConfig,
  TeamFile,
  type TeamRemora,
  type TeamTrigger,
  type TemplateUpdate,
  type TemplateUpdateAccept,
  type TemplateUpdateApply,
  type TemplateUpdateChange,
  type TemplateUpdates,
  type Trigger,
} from "@remora/schema";
import { type StoredConfig, sameValue, saveConfig } from "../runtime/config-versions.ts";
import type { RuntimeDeps } from "../runtime/deps.ts";
import { exportTriggers } from "../runtime/hooks.ts";
import { type Remora, RemoraError, type RemoraService } from "../runtime/remoras.ts";
import { teach } from "../runtime/sentinel.ts";
import { answersQuestions, TEMPLATES } from "../templates/index.ts";
import { thresholdProblem } from "../triggers/price.ts";

export const UPDATE_KIND = "template_update" as const;
const USDC = 1_000_000;
const MAX_CHAIN = 20;

export interface UpdateDeps {
  runtime: RuntimeDeps;
  service: RemoraService;
}

/** What one version of a template says about one remora, or what the remora has now. */
export interface TemplateSide {
  persona: string;
  model: string | null;
  tools: string[];
  /** Price and webhook triggers (ADR-0121), without ids. */
  triggers: TeamTrigger[];
  /** Reef services it may pay. */
  payees: string[];
  /** A Wallet watcher's rules in plain words. */
  rules: string[];
  /** USD, as a team file says it; null for remoras that never pay, or when the file sets none. */
  budget: { monthlyUsd: number; perPaymentUsd: number } | null;
}

type Field = keyof TemplateSide;

const FIELDS: Record<Field, { label: string; apply: TemplateUpdateApply; list?: true }> = {
  persona: { label: "Persona", apply: "direct" },
  model: { label: "Brain", apply: "direct" },
  tools: { label: "Tools", apply: "none", list: true },
  triggers: { label: "Triggers", apply: "direct", list: true },
  payees: { label: "Reef services", apply: "signature", list: true },
  rules: { label: "Rules", apply: "direct", list: true },
  budget: { label: "Spending limit", apply: "signature" },
};

/** One remora in a template file, as the settings it would get (what an import applies, ADR-0042). */
export function sideOf(entry: TeamRemora): TemplateSide {
  const kind = TEMPLATES[entry.template as keyof typeof TEMPLATES];
  const paying = !!kind?.payees.length;
  return {
    persona: entry.persona ?? kind?.persona ?? "",
    model: isCatalogModel(entry.model) ? entry.model : null,
    tools: [...(kind?.tools ?? [])],
    triggers: answersQuestions(entry.template) ? [...(entry.triggers ?? [])] : [],
    payees: paying ? [...kind.payees] : [],
    rules: entry.template === "sentinel" ? [...entry.rules] : [],
    budget: paying ? (entry.budget ?? null) : null,
  };
}

/** The remora's settings now, in the same terms. */
export function currentSide(r: Pick<Remora, "config">, rules: string[]): TemplateSide {
  const c = r.config as {
    persona?: string;
    model?: string;
    tools?: string[];
    budget?: { windowLimit: string; perPaymentCap: string; payees?: string[] } | null;
  };
  return {
    persona: c.persona ?? "",
    model: c.model ?? null,
    tools: [...(c.tools ?? [])],
    triggers: exportTriggers(r),
    payees: [...(c.budget?.payees ?? [])],
    rules,
    budget: c.budget
      ? {
          monthlyUsd: Number(c.budget.windowLimit) / USDC,
          perPaymentUsd: Number(c.budget.perPaymentCap) / USDC,
        }
      : null,
  };
}

/** A list item's identity: a trigger by what it watches, a rule or ref by its text. */
const itemKey = (v: unknown): string => {
  if (typeof v === "string") return v.trim().toLowerCase();
  const t = v as TeamTrigger;
  if (t?.kind === "price")
    return `price:${(tokenSymbol(t.symbol) ?? t.symbol).toUpperCase()}:${t.above ?? ""}:${t.below ?? ""}`;
  if (t?.kind === "webhook") return `webhook:${t.name}`;
  return JSON.stringify(v);
};

/** `now` without what the author removed, plus what they added. The owner's own items stay. */
export function mergeList<T>(now: T[], from: T[], to: T[]): T[] {
  const removed = new Set(from.map(itemKey).filter((k) => !to.some((x) => itemKey(x) === k)));
  const kept = now.filter((x) => !removed.has(itemKey(x)));
  const have = new Set(kept.map(itemKey));
  const added = to.filter(
    (x) => !from.some((y) => itemKey(y) === itemKey(x)) && !have.has(itemKey(x)),
  );
  return [...kept, ...added];
}

const sameList = (a: unknown[], b: unknown[]) => {
  const x = new Set(a.map(itemKey));
  const y = new Set(b.map(itemKey));
  return x.size === y.size && [...x].every((k) => y.has(k));
};

/**
 * The fields the author changed between `from` and `to` whose value on this remora would change,
 * each with its value now and what it becomes.
 */
export function updateChanges(
  from: TemplateSide,
  to: TemplateSide,
  now: TemplateSide,
): TemplateUpdateChange[] {
  const out: TemplateUpdateChange[] = [];
  for (const [f, meta] of Object.entries(FIELDS) as [Field, (typeof FIELDS)[Field]][]) {
    if (meta.list) {
      const a = from[f] as unknown[];
      const b = to[f] as unknown[];
      const cur = now[f] as unknown[];
      if (sameList(a, b)) continue;
      const next = mergeList(cur, a, b);
      if (sameList(cur, next)) continue;
      out.push({ field: f, label: meta.label, apply: meta.apply, current: cur, next });
      continue;
    }
    if (sameValue(from[f], to[f])) continue;
    // A version that drops its suggested budget or brain leaves the remora's own as they are.
    if (to[f] === null) continue;
    if (sameValue(now[f], to[f])) continue;
    out.push({
      field: f,
      label: meta.label,
      apply: meta.apply,
      ...(now[f] === null ? {} : { current: now[f] }),
      next: to[f],
    });
  }
  return out;
}

export interface UpdatePayload {
  kind: typeof UPDATE_KIND;
  /** The version the remora runs (its hatch, or the last update it accepted) and the new one. */
  from: string;
  to: string;
  version: number;
  template: string;
  /** The remora's name in the template file. */
  entry: string;
  previous: TemplateSide;
  next: TemplateSide;
  changes: TemplateUpdateChange[];
  applied?: string[];
  skipped?: string[];
  /** After accept: whether a spending part waits for the owner's signature. */
  money?: "open" | "none";
  declineReason?: string;
  outcomeMemoryId?: string;
}

const labels = (changes: { label: string }[]) =>
  changes.map((c) => c.label.toLowerCase()).join(", ");

type TemplateRow = typeof hatcheryTemplates.$inferSelect;

/** Older versions of `next` by the same author, nearest first. */
async function olderVersions(db: Db, next: TemplateRow): Promise<TemplateRow[]> {
  const chain: TemplateRow[] = [];
  let id = next.parent;
  while (id && chain.length < MAX_CHAIN && !chain.some((x) => x.templateId === id)) {
    const [p] = await db
      .select()
      .from(hatcheryTemplates)
      .where(eq(hatcheryTemplates.templateId, id));
    if (!p || p.author !== next.author || p.network !== next.network) break;
    chain.push(p);
    id = p.parent;
  }
  return chain;
}

/** The entry for a hatched remora in another version: same name and kind, else same place and kind. */
function entryIn(team: TeamFile, hatched: TeamRemora, index: number): TeamRemora | undefined {
  return (
    team.remoras.find((x) => x.name === hatched.name && x.template === hatched.template) ??
    (team.remoras[index]?.template === hatched.template ? team.remoras[index] : undefined)
  );
}

async function activeRules(db: Db, r: Remora) {
  if (r.template !== "sentinel") return [];
  const rows = await db
    .select({ text: sentinelRules.text })
    .from(sentinelRules)
    .where(and(eq(sentinelRules.remoraId, r.id), eq(sentinelRules.active, true)));
  return rows.map((x) => x.text);
}

/**
 * Offers `templateId`'s version to every remora hatched here from an older one. Safe to call twice
 * (our confirmation and the indexer both do): a version is offered to a remora once.
 */
export async function offerTemplateUpdates(
  d: UpdateDeps,
  templateId: string,
): Promise<{ offered: string[] }> {
  const db = d.runtime.db;
  const [next] = await db
    .select()
    .from(hatcheryTemplates)
    .where(eq(hatcheryTemplates.templateId, normalizeSuiAddress(templateId)));
  if (!next?.parent || next.deprecated || next.verdict === "block") return { offered: [] };
  const nextTeam = TeamFile.safeParse(next.team);
  if (!nextTeam.success) return { offered: [] };
  const chain = await olderVersions(db, next);
  if (!chain.length) return { offered: [] };
  const version = chain.length + 1;
  const forks = await db
    .select()
    .from(hatcheryForks)
    .where(
      and(
        inArray(
          hatcheryForks.templateId,
          chain.map((x) => x.templateId),
        ),
        eq(hatcheryForks.network, next.network),
      ),
    );
  const offered: string[] = [];
  for (const fork of forks) {
    for (const [index, remoraId] of fork.remoraIds.entries()) {
      try {
        const id = await offerOne(d, {
          next,
          nextTeam: nextTeam.data,
          version,
          chain,
          fork,
          index,
          remoraId,
        });
        if (id) offered.push(id);
      } catch (err) {
        d.runtime.log.warn("hatchery.update_offer_failed", { remora: remoraId, error: err });
      }
    }
  }
  return { offered };
}

async function offerOne(
  d: UpdateDeps,
  o: {
    next: TemplateRow;
    nextTeam: TeamFile;
    version: number;
    chain: TemplateRow[];
    fork: typeof hatcheryForks.$inferSelect;
    index: number;
    remoraId: string;
  },
): Promise<string | null> {
  const db = d.runtime.db;
  const [r] = await db.select().from(remoras).where(eq(remoras.id, o.remoraId));
  if (!r || r.playground || r.status === "retired" || r.status === "creating") return null;
  const hatchedRow = o.chain.find((x) => x.templateId === o.fork.templateId);
  const hatchedTeam = TeamFile.safeParse(hatchedRow?.team);
  const hatched = hatchedTeam.success ? hatchedTeam.data.remoras[o.index] : undefined;
  if (!hatched || hatched.template !== r.template) return null;

  const made = await db.transaction(async (tx) => {
    // One offer per remora at a time, even when our confirmation and the indexer race.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`template_update|${r.id}`}))`);
    const past = await tx
      .select()
      .from(approvals)
      .where(and(eq(approvals.remoraId, r.id), eq(approvals.kind, UPDATE_KIND)))
      .orderBy(desc(approvals.createdAt));
    const payloadOf = (a: (typeof past)[number]) => a.payload as unknown as UpdatePayload;
    // Offered once: pending, accepted or declined, never again.
    if (past.some((a) => payloadOf(a).to === o.next.templateId)) return null;
    // The version it runs: the last update it accepted on this line, else the one it was hatched from.
    const base =
      past
        .filter((a) => a.status === "approved")
        .map((a) => payloadOf(a).to)
        .find((to) => o.chain.some((x) => x.templateId === to)) ?? o.fork.templateId;
    const baseRow = o.chain.find((x) => x.templateId === base);
    const baseTeam = TeamFile.safeParse(baseRow?.team);
    if (!baseRow || !baseTeam.success) return null;
    const fromEntry = entryIn(baseTeam.data, hatched, o.index);
    const toEntry = entryIn(o.nextTeam, hatched, o.index);
    if (!fromEntry || !toEntry) return null;
    const previous = sideOf(fromEntry);
    const next = sideOf(toEntry);
    const changes = updateChanges(previous, next, currentSide(r, await activeRules(db, r)));
    if (!changes.length) return null;
    // A newer version replaces an offer still open.
    await tx
      .update(approvals)
      .set({ status: "expired", decidedAt: new Date() })
      .where(
        and(
          eq(approvals.remoraId, r.id),
          eq(approvals.kind, UPDATE_KIND),
          eq(approvals.status, "pending"),
        ),
      );
    const name = o.next.name ?? o.nextTeam.name;
    const payload: UpdatePayload = {
      kind: UPDATE_KIND,
      from: base,
      to: o.next.templateId,
      version: o.version,
      template: name,
      entry: toEntry.name,
      previous,
      next,
      changes,
    };
    const [a] = await tx
      .insert(approvals)
      .values({
        remoraId: r.id,
        network: r.network,
        kind: UPDATE_KIND,
        summary: `${name} v${o.version}: ${labels(changes)}`,
        payload: payload as unknown as Record<string, unknown>,
      })
      .returning({ id: approvals.id });
    if (!a) return null;
    // An `action` line: an approval card in the feed would offer the wrong buttons (ADR-0150).
    await tx.insert(remoraEvents).values({
      remoraId: r.id,
      network: r.network,
      type: "action",
      summary: `Its template “${name}” has a new version (v${o.version}): ${labels(changes)}. Nothing changes until you accept.`,
      payload: { kind: UPDATE_KIND, approvalId: a.id, to: o.next.templateId, version: o.version },
    });
    return { id: a.id, name, changes };
  });
  if (!made) return null;
  await d.runtime.notifier
    .send(r.ownerAddress, {
      text: `${r.name}'s template “${made.name}” has a new version: ${labels(made.changes)}. Nothing changes until you accept.`,
      buttons: [{ label: "Review", url: `${d.runtime.webBase}/remoras/${r.id}?update=${made.id}` }],
    })
    .catch((err) =>
      d.runtime.log.warn("hatchery.update_notify_failed", { remora: r.id, error: err }),
    );
  return made.id;
}

// ── The owner's side ────────────────────────────────────────────────────────

async function updateOf(db: Db, owner: string, id: string, remoraId?: string) {
  const [row] = await db
    .select({ a: approvals, r: remoras })
    .from(approvals)
    .innerJoin(remoras, eq(remoras.id, approvals.remoraId))
    .where(eq(approvals.id, id));
  if (row?.a.kind !== UPDATE_KIND || (remoraId && row.r.id !== remoraId))
    throw new RemoraError("update.not_found", "No such template update.", 404);
  if (normalizeSuiAddress(row.r.ownerAddress) !== normalizeSuiAddress(owner))
    throw new RemoraError("remora.not_owner", "That isn't yours.", 403);
  return { a: row.a, r: row.r, p: row.a.payload as unknown as UpdatePayload };
}

const newId = () => randomBytes(12).toString("base64url");

/** Config triggers after the update: the author's removals out, their additions in (paused, fresh ids). */
export function mergeTriggers(
  current: Trigger[],
  from: TeamTrigger[],
  to: TeamTrigger[],
): Trigger[] {
  const keyOf = (t: Trigger) =>
    t.kind === "price"
      ? itemKey({ kind: "price", symbol: t.symbol, above: t.above, below: t.below })
      : t.kind === "webhook"
        ? itemKey({ kind: "webhook", name: t.name ?? "webhook" })
        : null;
  const removed = new Set(from.map(itemKey).filter((k) => !to.some((x) => itemKey(x) === k)));
  const kept = current.filter((t) => {
    const k = keyOf(t);
    return !k || !removed.has(k);
  });
  const have = new Set(kept.map(keyOf));
  const added = to
    .filter((x) => !from.some((y) => itemKey(y) === itemKey(x)) && !have.has(itemKey(x)))
    .flatMap((x): Trigger[] => {
      if (x.kind === "webhook") return [{ kind: "webhook", id: newId(), name: x.name }];
      const symbol = tokenSymbol(x.symbol);
      const th = {
        ...(x.above !== undefined ? { above: x.above } : {}),
        ...(x.below !== undefined ? { below: x.below } : {}),
      };
      return symbol && !thresholdProblem(th)
        ? [{ kind: "price", id: newId(), symbol, ...th, paused: true }]
        : [];
    });
  return [...kept, ...added];
}

/** The prepared transaction for the money part, or null when there's none (or it can't be signed). */
async function moneySign(
  d: UpdateDeps,
  r: Remora,
  owner: string,
  money: TemplateUpdateChange[],
  skipped: string[],
): Promise<TemplateUpdateAccept["sign"]> {
  if (!money.length) return null;
  const current = Budget.safeParse((r.config as { budget?: unknown }).budget);
  if (!r.discId || !current.success) {
    skipped.push(...money.map((c) => c.field));
    return null;
  }
  const limits = money.find((c) => c.field === "budget")?.next as
    | TemplateSide["budget"]
    | undefined;
  const payees = money.find((c) => c.field === "payees")?.next as string[] | undefined;
  const want: Budget = {
    ...current.data,
    ...(limits
      ? {
          window: "month" as const,
          windowLimit: String(Math.round(limits.monthlyUsd * USDC)),
          perPaymentCap: String(Math.round(limits.perPaymentUsd * USDC)),
        }
      : {}),
    ...(payees ? { payees: payees as Budget["payees"] } : {}),
  };
  if (limits)
    return {
      kind: "budget",
      transaction: await d.service.budgetTx(r.id, owner, want),
      budget: want,
    };
  return {
    kind: "payees",
    transaction: await d.service.payeesTx(r.id, owner, want.payees),
    payees: want.payees,
  };
}

/**
 * Accept: the settings that don't touch money apply now as one version (`source: "template vN"`);
 * the spending limit and the services come back as a transaction for the owner to sign.
 */
export async function acceptTemplateUpdate(
  d: UpdateDeps,
  owner: string,
  remoraId: string,
  id: string,
): Promise<TemplateUpdateAccept & { remora: Remora }> {
  const db = d.runtime.db;
  const { a, r, p } = await updateOf(db, owner, id, remoraId);
  if (a.status !== "pending")
    throw new RemoraError("approval.decided", `Already ${a.status}.`, 409);
  if (r.status === "retired" || r.status === "creating")
    throw new RemoraError(
      "update.locked",
      r.status === "retired"
        ? `${r.name} is retired, so its settings can't change.`
        : `${r.name} isn't set up yet.`,
      409,
    );
  // Against today's settings: whatever the owner changed since the offer is respected.
  const rulesNow = await activeRules(db, r);
  const changes = updateChanges(p.previous, p.next, currentSide(r, rulesNow));
  const applied: string[] = [];
  const skipped: string[] = [];
  const patch: StoredConfig = {};
  let ruleChange: { add: string[]; remove: string[] } | null = null;
  for (const c of changes) {
    if (c.apply === "none") skipped.push(c.field);
    if (c.apply !== "direct") continue;
    if (c.field === "persona" && p.next.persona.trim()) {
      patch.persona = p.next.persona.trim().slice(0, 2_000);
    } else if (c.field === "model") {
      if (isCatalogModel(p.next.model)) patch.model = p.next.model;
      else skipped.push("model");
    } else if (c.field === "triggers" && answersQuestions(r.template)) {
      const now = ((r.config as { triggers?: Trigger[] }).triggers ?? []) as Trigger[];
      patch.triggers = mergeTriggers(now, p.previous.triggers, p.next.triggers);
    } else if (c.field === "rules" && r.template === "sentinel") {
      const merged = mergeList(rulesNow, p.previous.rules, p.next.rules);
      ruleChange = {
        add: merged.filter((x) => !rulesNow.some((y) => itemKey(y) === itemKey(x))),
        remove: rulesNow.filter((x) => !merged.some((y) => itemKey(y) === itemKey(x))),
      };
    } else skipped.push(c.field);
  }
  const source = `template v${p.version}`;
  const fields = [...Object.keys(patch), ...(ruleChange ? ["rules"] : [])];
  let remora: Remora = r;
  if (fields.length) {
    const apply = (c: StoredConfig): StoredConfig => ({ ...c, ...patch });
    const check = RemoraConfig.safeParse({ ...apply(r.config), status: "shadow" });
    if (!check.success)
      throw new RemoraError(
        "update.invalid",
        "That version's settings aren't valid for this remora.",
      );
    remora = await saveConfig(db, r.id, apply, {
      summary: () =>
        `${r.name} took ${source} of “${p.template}”: ${fields.map((f) => FIELDS[f as Field]?.label.toLowerCase() ?? f).join(", ")}.`,
      payload: {
        source,
        template: { from: p.from, to: p.to, version: p.version },
        approvalId: id,
        applied: fields,
        ...(ruleChange ? { rules: ruleChange } : {}),
      },
    });
    applied.push(...fields);
  }
  if (ruleChange) {
    for (const text of ruleChange.remove)
      await db
        .update(sentinelRules)
        .set({ active: false })
        .where(
          and(
            eq(sentinelRules.remoraId, r.id),
            eq(sentinelRules.text, text),
            eq(sentinelRules.active, true),
          ),
        );
    for (const text of ruleChange.add)
      await teach(d.runtime, remora, text).catch(() => skipped.push(`rule: ${text.slice(0, 60)}`));
  }
  const sign = await moneySign(
    d,
    remora,
    owner,
    changes.filter((c) => c.apply === "signature"),
    skipped,
  );
  const outcomeMemoryId = await rememberOutcome(d, r, p, "accepted");
  await db
    .update(approvals)
    .set({
      status: "approved",
      decidedAt: new Date(),
      payload: {
        ...a.payload,
        applied,
        skipped,
        money: sign ? "open" : "none",
        ...(outcomeMemoryId ? { outcomeMemoryId } : {}),
      },
    })
    .where(eq(approvals.id, id));
  return { remora, applied, skipped, sign };
}

/** The money part of an accepted update again, until the remora's limit and services match it. */
export async function updateMoneyTx(
  d: UpdateDeps,
  owner: string,
  remoraId: string,
  id: string,
): Promise<TemplateUpdateAccept["sign"]> {
  const { a, r, p } = await updateOf(d.runtime.db, owner, id, remoraId);
  if (a.status !== "approved")
    throw new RemoraError("update.not_accepted", "Accept the update first.", 409);
  const money = updateChanges(p.previous, p.next, currentSide(r, [])).filter(
    (c) => c.apply === "signature",
  );
  const sign = await moneySign(d, r, owner, money, []);
  if (!sign) throw new RemoraError("update.no_money", "Its spending limit already matches.", 409);
  return sign;
}

/** Writes how an update ended into the remora's memory, so the decision is its own to recall. */
async function rememberOutcome(
  d: UpdateDeps,
  r: Remora,
  p: UpdatePayload,
  outcome: "accepted" | "declined",
  reason?: string,
): Promise<string | undefined> {
  const ns = (r.config as { namespaces?: string[] }).namespaces?.includes("feedback")
    ? "feedback"
    : "rules";
  const line = `TEMPLATE_UPDATE ${p.template} v${p.version} · ${labels(p.changes)} · ${outcome}${reason ? ` · because ${reason}` : ""} · as_of ${new Date().toISOString().slice(0, 10)}`;
  const res = await d.runtime.memory
    .remember(r, ns, "decision", line, { dedupe: false, asserted: "owner" })
    .catch((err) => {
      d.runtime.log.warn("hatchery.update_memory_failed", { remora: r.id, error: err });
      return null;
    });
  return res?.indexId;
}

/** Decline: remembered, and that version is never offered to this remora again. */
export async function declineTemplateUpdate(
  d: UpdateDeps,
  owner: string,
  id: string,
  reason = "",
  remoraId?: string,
) {
  const db = d.runtime.db;
  const { a, r, p } = await updateOf(db, owner, id, remoraId);
  if (a.status !== "pending")
    throw new RemoraError("approval.decided", `Already ${a.status}.`, 409);
  const why = reason.replace(/\s+/g, " ").trim().slice(0, 200);
  const outcomeMemoryId = await rememberOutcome(d, r, p, "declined", why || undefined);
  await db
    .update(approvals)
    .set({
      status: "rejected",
      decidedAt: new Date(),
      payload: {
        ...a.payload,
        ...(why ? { declineReason: why } : {}),
        ...(outcomeMemoryId ? { outcomeMemoryId } : {}),
      },
    })
    .where(eq(approvals.id, id));
  await db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary: `You declined “${p.template}” v${p.version} (${labels(p.changes)})${why ? `: ${why}` : ""}.`,
    payload: { kind: UPDATE_KIND, approvalId: id, outcome: "declined" },
  });
  return { ok: true };
}

/** The open update and the last few, for the remora's page. */
export async function templateUpdatesOf(db: Db, r: Remora): Promise<TemplateUpdates> {
  const now = currentSide(r, await activeRules(db, r));
  const rows = await db
    .select()
    .from(approvals)
    .where(and(eq(approvals.remoraId, r.id), eq(approvals.kind, UPDATE_KIND)))
    .orderBy(desc(approvals.createdAt))
    .limit(6);
  const view = (x: (typeof rows)[number]): TemplateUpdate => {
    const p = x.payload as unknown as UpdatePayload;
    // An accepted update's spending part is open until the remora's limit matches it.
    const moneyOpen =
      x.status === "approved" &&
      p.money === "open" &&
      updateChanges(p.previous, p.next, now).some((c) => c.apply === "signature");
    return {
      id: x.id,
      status: x.status,
      template: p.template,
      from: p.from,
      to: p.to,
      version: p.version,
      // Pending, or a spending part still to sign: against today's settings, so the card shows what
      // Accept (or the signature) would do now.
      changes:
        x.status === "pending" || moneyOpen ? updateChanges(p.previous, p.next, now) : p.changes,
      createdAt: x.createdAt.toISOString(),
      decidedAt: x.decidedAt?.toISOString() ?? null,
      moneyOpen,
      ...(p.declineReason ? { declineReason: p.declineReason } : {}),
    };
  };
  const open = rows.find(
    (x) => x.status === "pending" || (x.status === "approved" && view(x).moneyOpen),
  );
  return {
    open: open ? view(open) : null,
    recent: rows.filter((x) => x !== open && x.status !== "expired").map(view),
  };
}
