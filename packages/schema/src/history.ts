/**
 * N11 (ADR-0122): a remora's config history. Every settings change is a `config_changed` event with
 * the config before and after; these are the versions, a version against the current config, and
 * what a restore did.
 */
import { z } from "zod";
import { RemoraView } from "./api.ts";
import { IsoDateTime, ReefRef } from "./common.ts";
import { Budget } from "./remora.ts";

/**
 * How a field comes back on restore: `direct` applies it; `signature` prepares a transaction the owner
 * signs (limits and payees); `none` is shown, never restored here.
 */
export const ConfigRestoreMode = z.enum(["direct", "signature", "none"]);

export const ConfigVersion = z.object({
  /** The `config_changed` event's id, or `initial` for the config before the first change. */
  id: z.string().min(1),
  revision: z.number().int().positive(),
  at: IsoDateTime,
  summary: z.string(),
  /** The fields this change touched. */
  fields: z.array(z.string()),
  /** The version the remora runs now. */
  current: z.boolean(),
});

/** `GET /api/remoras/:id/history`: newest first. */
export const ConfigHistory = z.object({ versions: z.array(ConfigVersion) });

export const ConfigFieldDiff = z.object({
  field: z.string(),
  label: z.string(),
  /** The value now; absent when the field isn't set. */
  current: z.unknown().optional(),
  /** The value in this version; absent when the field wasn't set. */
  version: z.unknown().optional(),
  restore: ConfigRestoreMode,
});

/** `GET /api/remoras/:id/history/:version`: what restoring this version would change. */
export const ConfigVersionDiff = z.object({
  version: ConfigVersion,
  changes: z.array(ConfigFieldDiff),
});

/**
 * `POST /api/remoras/:id/history/:version/restore`. Fields that need a signature come back as a
 * prepared transaction; the owner signs it and the usual `/budget/confirm` or `/payees/confirm`
 * applies it.
 */
export const ConfigRestore = z.object({
  remora: RemoraView,
  applied: z.array(z.string()),
  /** Fields that differ but aren't restored here. */
  skipped: z.array(z.string()),
  sign: z
    .discriminatedUnion("kind", [
      z.object({ kind: z.literal("budget"), transaction: z.string(), budget: Budget }),
      z.object({ kind: z.literal("payees"), transaction: z.string(), payees: z.array(ReefRef) }),
    ])
    .nullable(),
});

export type ConfigRestoreMode = z.infer<typeof ConfigRestoreMode>;
export type ConfigVersion = z.infer<typeof ConfigVersion>;
export type ConfigHistory = z.infer<typeof ConfigHistory>;
export type ConfigFieldDiff = z.infer<typeof ConfigFieldDiff>;
export type ConfigVersionDiff = z.infer<typeof ConfigVersionDiff>;
export type ConfigRestore = z.infer<typeof ConfigRestore>;
