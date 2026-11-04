/**
 * N11 (ADR-0122): a remora's versions, from its `config_changed` events; one version against the
 * current config; and restore. Restore applies the settings that don't touch money at once, as a new
 * version. The spending limit and the payees never apply here: they come back as a transaction from
 * the usual builders, the owner signs it, and the usual confirm applies it (and records the version).
 */
import { and, asc, type Db, eq, remoraEvents } from "@remora/db";
import {
  Budget,
  type ConfigFieldDiff,
  type ConfigVersion,
  isCatalogModel,
  RemoraConfig,
} from "@remora/schema";
import type { Listings } from "../money/listings.ts";
import { changedFields, configDiff, type StoredConfig, saveConfig } from "./config-versions.ts";
import type { RuntimeDeps } from "./deps.ts";
import { type Remora, RemoraError, type RemoraService } from "./remoras.ts";
import { checkSale, type SaleInput } from "./sales.ts";

export interface ConfigEvent {
  id: string;
  at: Date;
  summary: string;
  payload: Record<string, unknown>;
}

export interface Version extends Omit<ConfigVersion, "at"> {
  at: Date;
  config: StoredConfig;
}

const configIn = (v: unknown): StoredConfig | null =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as StoredConfig) : null;
const revisionOf = (v: unknown, fallback: number) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * Oldest first: the config before the first change (`initial`), then each change's config after it.
 * An older `edit` event kept only `previous`; its after is the next change's before, or the config now.
 */
export function versionsOf(
  events: ConfigEvent[],
  r: { config: StoredConfig; createdAt: Date },
): Version[] {
  const firstBefore = configIn(events[0]?.payload.previous) ?? (events.length ? null : r.config);
  const out: Version[] = [];
  if (firstBefore)
    out.push({
      id: "initial",
      revision: revisionOf(firstBefore.revision, 1),
      at: r.createdAt,
      summary: "First version",
      fields: [],
      config: firstBefore,
      current: false,
    });
  events.forEach((e, i) => {
    const after =
      configIn(e.payload.after) ?? configIn(events[i + 1]?.payload.previous) ?? r.config;
    const before = configIn(e.payload.previous) ?? out.at(-1)?.config ?? after;
    out.push({
      id: e.id,
      revision: revisionOf(e.payload.revision ?? after.revision, out.length + 1),
      at: e.at,
      summary: e.summary,
      fields: changedFields(before, after),
      config: after,
      current: false,
    });
  });
  const newest = out.at(-1);
  if (newest) newest.current = true;
  return out;
}

async function versions(db: Db, r: Remora) {
  const rows = await db
    .select({
      id: remoraEvents.id,
      at: remoraEvents.createdAt,
      summary: remoraEvents.summary,
      payload: remoraEvents.payload,
    })
    .from(remoraEvents)
    .where(and(eq(remoraEvents.remoraId, r.id), eq(remoraEvents.type, "config_changed")))
    .orderBy(asc(remoraEvents.createdAt), asc(remoraEvents.id));
  return versionsOf(rows, r);
}

const view = ({ config: _c, at, ...v }: Version): ConfigVersion => ({ ...v, at: at.toISOString() });

/** Newest first. */
export async function listVersions(db: Db, r: Remora): Promise<ConfigVersion[]> {
  return (await versions(db, r)).reverse().map(view);
}

async function versionOf(db: Db, r: Remora, id: string) {
  const v = (await versions(db, r)).find((x) => x.id === id);
  if (!v) throw new RemoraError("history.not_found", "No such version of this remora.", 404);
  return v;
}

export async function versionDiff(
  db: Db,
  r: Remora,
  id: string,
): Promise<{ version: ConfigVersion; changes: ConfigFieldDiff[] }> {
  const v = await versionOf(db, r, id);
  return { version: view(v), changes: configDiff(r.config, v.config) };
}

const isWebhook = (t: unknown): t is { kind: "webhook"; id: string } =>
  !!t && typeof t === "object" && (t as { kind?: unknown }).kind === "webhook";

/**
 * A webhook's secret is derived from its id (C4), so a hook rotated or removed since this version
 * stays rotated or removed: only the current hooks come back.
 */
export function restoredTriggers(version: unknown, current: unknown): unknown[] {
  const live = new Set((Array.isArray(current) ? current : []).filter(isWebhook).map((t) => t.id));
  return (Array.isArray(version) ? version : []).filter((t) => !isWebhook(t) || live.has(t.id));
}

export interface RestoreDeps {
  runtime: RuntimeDeps;
  service: RemoraService;
  listings?: Listings;
}

export type RestoreSign =
  | { kind: "budget"; transaction: string; budget: Budget }
  | { kind: "payees"; transaction: string; payees: string[] }
  | null;

export async function restoreVersion(
  deps: RestoreDeps,
  r: Remora,
  owner: string,
  id: string,
): Promise<{ remora: Remora; applied: string[]; skipped: string[]; sign: RestoreSign }> {
  if (r.status === "retired" || r.status === "creating")
    throw new RemoraError(
      "history.locked",
      r.status === "retired"
        ? `${r.name} is retired, so its settings can't change.`
        : `${r.name} isn't set up yet.`,
      409,
    );
  const v = await versionOf(deps.runtime.db, r, id);
  const changes = configDiff(r.config, v.config);
  const skipped = changes.filter((c) => c.restore === "none").map((c) => c.field);
  const patch: StoredConfig = {};
  const drop: string[] = [];
  for (const c of changes.filter((x) => x.restore === "direct")) {
    if (c.field === "model") {
      if (c.version === undefined) drop.push("model");
      else if (typeof c.version === "string" && isCatalogModel(c.version)) patch.model = c.version;
      else skipped.push("model");
    } else if (c.field === "triggers") {
      const triggers = restoredTriggers(c.version, r.config.triggers);
      if (triggers.length) patch.triggers = triggers;
      else skipped.push("triggers");
    } else if (c.field === "sell") {
      if (c.version === undefined) drop.push("sell");
      else patch.sell = await checkSale(deps.runtime, r, c.version as SaleInput);
    } else if (c.field === "name" && typeof c.version === "string" && c.version.trim()) {
      patch.name = c.version.trim().slice(0, 40);
    } else if (c.field === "persona" && typeof c.version === "string" && c.version.trim()) {
      patch.persona = c.version.trim().slice(0, 2_000);
    } else skipped.push(c.field);
  }
  const applied = [...Object.keys(patch), ...drop];
  let remora = r;
  if (applied.length) {
    const apply = (c: StoredConfig) => {
      const out: StoredConfig = { ...c, ...patch };
      for (const f of drop) delete out[f];
      return out;
    };
    const check = RemoraConfig.safeParse({ ...apply(r.config), status: "shadow" });
    if (!check.success)
      throw new RemoraError("history.invalid", "That version's settings aren't valid anymore.");
    remora = await saveConfig(deps.runtime.db, r.id, apply, {
      summary: (after) =>
        `${String(after.name ?? r.name)}'s settings are back to revision ${v.revision}.`,
      payload: { restored: { from: v.id, revision: v.revision, fields: applied } },
    });
    if (applied.includes("sell")) await deps.listings?.refresh();
  }

  const money = changes.filter((c) => c.restore === "signature").map((c) => c.field);
  let sign: RestoreSign = null;
  if (money.length) {
    const budget = Budget.safeParse(v.config.budget);
    if (!r.discId || !budget.success) skipped.push(...money);
    else if (money.includes("budget"))
      sign = {
        kind: "budget",
        transaction: await deps.service.budgetTx(r.id, owner, budget.data),
        budget: budget.data,
      };
    else
      sign = {
        kind: "payees",
        transaction: await deps.service.payeesTx(r.id, owner, budget.data.payees),
        payees: budget.data.payees,
      };
  }
  return { remora, applied, skipped, sign };
}
