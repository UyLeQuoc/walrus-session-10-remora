/**
 * K1/K2 (ADR-0052): one shape for health and `diagnose`. Each item is something an operator can act
 * on: its status, what was measured, the threshold it was held to, and, when it isn't ok, the fix.
 */
import { z } from "zod";
import { IsoDateTime } from "./common.ts";

export const HealthStatus = z.enum(["ok", "degraded", "down"]);

export const HealthItem = z.object({
  name: z.string().min(1),
  status: HealthStatus,
  detail: z.string(),
  value: z.union([z.number(), z.string()]).nullable().default(null),
  threshold: z.union([z.number(), z.string()]).nullable().default(null),
  /** What to do about it; present when the item isn't ok. */
  fix: z.string().nullable().default(null),
});

/** K1: recent errors per route, from the server's ring buffer (no external vendor). */
export const RecentError = z.object({
  route: z.string().min(1),
  code: z.string().min(1),
  message: z.string(),
  count: z.number().int().positive(),
  lastAt: IsoDateTime,
});

/** `GET /api/health/deep` and `/lab/health`. */
export const HealthReport = z.object({
  status: HealthStatus,
  items: z.array(HealthItem),
  errors: z.array(RecentError).default([]),
  checkedAt: IsoDateTime,
});

/** `bun run diagnose`: the same items, and whether a deploy may go ahead. */
export const DiagnoseReport = HealthReport.extend({
  network: z.enum(["testnet", "mainnet"]),
  /** False when any item is down: the deploy gate. */
  ok: z.boolean(),
});

export type HealthStatus = z.infer<typeof HealthStatus>;
export type HealthItem = z.infer<typeof HealthItem>;
export type RecentError = z.infer<typeof RecentError>;
export type HealthReport = z.infer<typeof HealthReport>;
export type DiagnoseReport = z.infer<typeof DiagnoseReport>;
