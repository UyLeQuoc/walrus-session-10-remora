import { z } from "zod";
import { Amount, BlobId, IsoDateTime, ReefRef } from "./common.ts";

const base = { id: z.string().min(1), remora: z.string().min(1), ts: IsoDateTime };

/** The activity feed (N1) and the "Why?" links (N4) are built from these, streamed over SSE. */
export const RemoraEvent = z.discriminatedUnion("type", [
  z.object({
    ...base,
    type: z.literal("action"),
    summary: z.string(),
    wakeId: z.string().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("payment"),
    payee: ReefRef,
    amount: Amount,
    coinType: z.string().min(1),
    tx: z.string().min(1),
    wakeId: z.string().min(1),
  }),
  z.object({
    ...base,
    type: z.literal("ping"),
    priority: z.enum(["ping", "digest", "silent"]),
    summary: z.string(),
    wakeId: z.string().optional(),
  }),
  z.object({
    ...base,
    type: z.literal("rule_learned"),
    rule: z.string(),
    blobId: BlobId.nullable(),
  }),
  z.object({ ...base, type: z.literal("handoff"), to: z.string().min(1), summary: z.string() }),
  z.object({ ...base, type: z.literal("approval_needed"), approvalId: z.string().min(1) }),
  z.object({
    ...base,
    type: z.literal("shadow_would_have"),
    summary: z.string(),
    wakeId: z.string().optional(),
  }),
]);

/** One item in the approval inbox (N2). */
export const ApprovalRequest = z.object({
  id: z.string().min(1),
  remora: z.string().min(1),
  kind: z.enum([
    "over_limit_payment",
    "budget_change",
    "rule_conflict",
    "template_update",
    "schedule",
  ]),
  createdAt: IsoDateTime,
  summary: z.string().min(1),
  payload: z.record(z.string(), z.unknown()),
  status: z.enum(["pending", "approved", "rejected", "expired"]),
});

export type RemoraEvent = z.infer<typeof RemoraEvent>;
export type ApprovalRequest = z.infer<typeof ApprovalRequest>;
