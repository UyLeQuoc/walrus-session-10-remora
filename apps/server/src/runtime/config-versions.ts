/**
 * N11 (ADR-0122): every change to a remora's settings goes through `saveConfig`. It writes the row and
 * one `config_changed` event holding the config before (`previous`, the name `edit` always used) and
 * after, the revision and the fields that changed, in one transaction with the row locked. The
 * versions, their diffs and restore are in `history.ts`; the field table here says how each field
 * comes back.
 */

import { type Db, eq, remoraEvents, remoras } from "@remora/db";
import type { ConfigFieldDiff, ConfigRestoreMode } from "@remora/schema";

type Row = typeof remoras.$inferSelect;
export type StoredConfig = Record<string, unknown>;

/** Bookkeeping, not settings: never compared, shown or restored. */
const INTERNAL = new Set([
  "id",
  "version",
  "template",
  "status",
  "identity",
  "revision",
  "keyId",
  "keyGeneration",
  "tgWas",
  "crewWas",
]);

/**
 * The settings a version shows. `budget` is the limits without the payees, and `payees` the services
 * it may pay, since each comes back through its own builder. A key not listed here is shown with
 * `none`, so a field another part adds later is never restored by accident.
 */
export const CONFIG_FIELDS: Record<string, { label: string; restore: ConfigRestoreMode }> = {
  name: { label: "Name", restore: "direct" },
  persona: { label: "Persona", restore: "direct" },
  model: { label: "Brain", restore: "direct" },
  triggers: { label: "Triggers", restore: "direct" },
  sell: { label: "Sale", restore: "direct" },
  budget: { label: "Spending limit", restore: "signature" },
  payees: { label: "Services it may pay", restore: "signature" },
  schedules: { label: "Schedules", restore: "none" },
  items: { label: "Brief list", restore: "none" },
  listings: { label: "Listed APIs", restore: "none" },
  crew: { label: "Crew", restore: "none" },
  tools: { label: "Tools", restore: "none" },
  // A2 (ADR-0137): a rule only narrows spending, so an old set comes back as it was.
  rules: { label: "Rules", restore: "direct" },
  namespaces: { label: "Memory", restore: "none" },
};

const fieldMeta = (field: string) => CONFIG_FIELDS[field] ?? { label: field, restore: "none" };

/** A config as the fields a version shows. */
export function settingsOf(config: StoredConfig): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    if (INTERNAL.has(k) || v === undefined) continue;
    if (k === "budget" && v && typeof v === "object") {
      const { payees, ...limits } = v as Record<string, unknown>;
      out.budget = limits;
      out.payees = payees;
    } else out[k] = v;
  }
  return out;
}

/** JSON with sorted keys, so two configs compare by value. */
function canon(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canon).join(",")}]`;
  if (v && typeof v === "object")
    return `{${Object.entries(v as Record<string, unknown>)
      .filter(([, x]) => x !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
      .map(([k, x]) => `${JSON.stringify(k)}:${canon(x)}`)
      .join(",")}}`;
  return JSON.stringify(v ?? null);
}

export const sameValue = (a: unknown, b: unknown) => canon(a) === canon(b);

/** The fields that differ between two configs, in `CONFIG_FIELDS` order, then the rest by name. */
export function changedFields(a: StoredConfig, b: StoredConfig): string[] {
  const x = settingsOf(a);
  const y = settingsOf(b);
  const order = Object.keys(CONFIG_FIELDS);
  const rank = (f: string) => (order.includes(f) ? order.indexOf(f) : order.length);
  return [...new Set([...Object.keys(x), ...Object.keys(y)])]
    .filter((f) => !sameValue(x[f], y[f]))
    .sort((p, q) => rank(p) - rank(q) || (p < q ? -1 : 1));
}

/** Field by field, what restoring `version` over `current` would change. */
export function configDiff(current: StoredConfig, version: StoredConfig): ConfigFieldDiff[] {
  const now = settingsOf(current);
  const then = settingsOf(version);
  return changedFields(current, version).map((field) => ({
    field,
    ...fieldMeta(field),
    current: now[field],
    version: then[field],
  }));
}

export interface ConfigChange {
  /** The event's sentence, from the config after the change and its revision. */
  summary: (after: StoredConfig, revision: number) => string;
  /** Extra payload fields the event always carried (`digest`, `budget`, `sale`…). */
  payload?: Record<string, unknown>;
  /** Other columns written with the config (a new Disc's ids). */
  set?: Partial<typeof remoras.$inferInsert>;
  now?: Date;
}

/**
 * Applies `change` to the remora's current config and records it as a version. The row is read under
 * a lock, so two changes at once both land, one after the other.
 */
export async function saveConfig(
  db: Db,
  id: string,
  change: (config: StoredConfig, row: Row) => StoredConfig,
  opts: ConfigChange,
): Promise<Row> {
  const now = opts.now ?? new Date();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(remoras).where(eq(remoras.id, id)).for("update");
    if (!row) throw new Error(`remora ${id} is gone`);
    const before = row.config;
    const revision = Number(before.revision ?? 1) + 1;
    const after: StoredConfig = { ...change(before, row), revision };
    const [updated] = await tx
      .update(remoras)
      .set({
        ...opts.set,
        config: after,
        ...(typeof after.name === "string" ? { name: after.name } : {}),
        updatedAt: now,
      })
      .where(eq(remoras.id, id))
      .returning();
    if (!updated) throw new Error(`remora ${id} is gone`);
    await tx.insert(remoraEvents).values({
      remoraId: id,
      network: row.network,
      type: "config_changed",
      summary: opts.summary(after, revision),
      payload: {
        ...opts.payload,
        previous: before,
        after,
        revision,
        fields: changedFields(before, after),
      },
      createdAt: now,
    });
    return updated;
  });
}
