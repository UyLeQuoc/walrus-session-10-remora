/**
 * The W2 API contract (ADR-0032): what `/api/remoras*`, `/api/feed`, `/api/approvals`,
 * `/api/settings`, `/api/schedule/preview` and `/api/verify` return. Dates are ISO strings on the
 * wire; amounts are integer strings in the coin's smallest units.
 */
import { z } from "zod";
import { Amount, IsoDateTime, Sha256Hex } from "./common.ts";
import { MemoryType } from "./memory.ts";
import { Network } from "./network.ts";
import { RemoraConfig } from "./remora.ts";
import { Wake } from "./wake.ts";

/** A remora as the API returns it: the row plus its parsed config. */
export const RemoraView = z.object({
  id: z.uuid(),
  ownerAddress: z.string().min(1),
  network: Network,
  template: z.string().min(1),
  name: z.string().min(1),
  /** `creating` until the owner's issue transaction is confirmed. */
  status: z.enum(["creating", "shadow", "active", "paused", "retired"]),
  address: z.string().nullable(),
  discName: z.string().nullable(),
  discId: z.string().nullable(),
  allowanceId: z.string().nullable(),
  capId: z.string().nullable(),
  shadowUntil: IsoDateTime.nullable(),
  createdAt: IsoDateTime,
  updatedAt: IsoDateTime,
  config: RemoraConfig,
});

/** `POST /api/remoras`: the remora, and the owner's unsigned issue transaction when it needs a Disc. */
export const CreateRemoraResponse = z.object({
  remora: RemoraView,
  transaction: z.string().nullable(),
});

/** Every type a feed item can have (N1). */
export const FEED_TYPES = [
  "action",
  /** The owner's own line in a remora's 1-1 thread (ADR-0042). */
  "message",
  "answer",
  "payment",
  "blocked",
  "shadow",
  "approval_needed",
  "ping",
  "episode",
  "rule_learned",
  "handoff",
  "config_changed",
  /** ADR-0124: a remora proposed its own budget. */
  "proposal",
  /** ADR-0128: a weekly "What I learned". */
  "review",
  /** U18 B2: a subscription asked more than the price it remembers. */
  "price_hike",
] as const;

/** One row of the activity feed (`GET /api/feed`); `receiptId` opens its Wake (N4). */
export const FeedItem = z.object({
  id: z.uuid(),
  remoraId: z.uuid(),
  /** The remora's display name. */
  remora: z.string(),
  network: Network,
  type: z.enum(FEED_TYPES),
  summary: z.string(),
  payload: z.record(z.string(), z.unknown()),
  receiptId: z.uuid().nullable(),
  feedback: z.enum(["useful", "noise"]).nullable(),
  createdAt: IsoDateTime,
});

/** `GET /api/events/:id/why`: the event, its remora's name, and the stored Wake if any. */
export const WhyResponse = z.object({
  event: FeedItem.omit({ remora: true }),
  remora: z.string(),
  wake: z
    .object({
      id: z.uuid(),
      intentHash: Sha256Hex,
      txDigest: z.string().nullable(),
      anchored: z.boolean(),
      wakeBlobId: z.string().nullable(),
      wake: Wake,
    })
    .nullable(),
});

/** N5: the Disc and allowance right now, with a burn-rate forecast. */
export const BudgetMeter = z.object({
  spent: Amount,
  lifetimeCap: Amount.nullable(),
  window: z.object({ limit: Amount, spent: Amount }).nullable(),
  perPaymentCap: Amount,
  paused: z.boolean(),
  expiresAt: IsoDateTime.nullable(),
  payees: z.array(z.string()),
  forecast: z.object({ perDay: Amount, runsOutOn: z.iso.date().nullable() }).nullable(),
});

/** A7/H5: notification policy and locale. Quiet hours are "HH:MM" in `timezone`. */
export const OwnerSettings = z.object({
  ownerAddress: z.string().min(1),
  timezone: z.string().min(1),
  quietStart: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  quietEnd: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
  language: z.enum(["en", "vi"]),
  notify: z.enum(["all", "important", "digest"]),
  /** True once a Telegram chat redeemed this owner's link code (A5). */
  telegramLinked: z.boolean().default(false),
});

/** N12: `POST /api/schedule/preview`. */
export const SchedulePreview = z.object({
  cron: z.string().min(1),
  human: z.string().min(1),
  next: z.array(IsoDateTime),
});

/** G3: `GET /api/verify/:ref`. `ok: null` means the check doesn't apply (no onchain anchor). */
export const VerifyCheck = z.object({
  name: z.string().min(1),
  ok: z.boolean().nullable(),
  detail: z.string(),
});
export const VerifyResult = z.object({
  found: z.literal(true),
  receiptId: z.uuid(),
  anchored: z.boolean(),
  wake: Wake,
  checks: z.array(VerifyCheck),
});

/** F3 + F6: `GET /api/remoras/:id/memory`. */
export const InspectorResponse = z.object({
  namespaces: z.array(z.string()),
  rows: z.array(
    z.object({
      namespace: z.string(),
      blobId: z.string(),
      createdAt: z.string(),
      expiresAt: z.string().nullable(),
      status: z.enum(["active", "expired"]),
      size: z.number().int().nonnegative(),
      /** F4: from the local index; recall and dedupe skip hidden or superseded memories. */
      type: MemoryType.nullable().default(null),
      hiddenAt: z.string().nullable().default(null),
      supersededBy: z.string().nullable().default(null),
      /** F5: expires within 30 days. */
      expiresSoon: z.boolean().default(false),
      /** ADR-0086: later writes skipped because they matched this memory. */
      duplicateWrites: z.number().int().nonnegative().default(0),
    }),
  ),
  counts: z.record(z.string(), z.number().int().nonnegative()),
  written: z.record(z.string(), z.number().int().nonnegative()),
  mismatches: z.array(
    z.object({ namespace: z.string(), written: z.number().int(), relayer: z.number().int() }),
  ),
  results: z.array(
    z.object({ blobId: z.string(), namespace: z.string(), text: z.string(), distance: z.number() }),
  ),
  /** ADR-0086: the newest writes skipped as duplicates; `blobId` is the memory each one matched. */
  duplicates: z
    .array(
      z.object({
        namespace: z.string(),
        type: MemoryType.nullable(),
        blobId: z.string(),
        at: z.string(),
      }),
    )
    .default([]),
});

/** E4: `POST /api/approvals/:id/pay-tx`, the owner's one-off payment to sign (ADR-0031). */
export const ApprovalPayTx = z.object({
  transaction: z.string().min(1),
  requirements: z
    .object({ amount: Amount, payTo: z.string().min(1), asset: z.string().min(1) })
    .loose(),
});

export type RemoraView = z.infer<typeof RemoraView>;
export type CreateRemoraResponse = z.infer<typeof CreateRemoraResponse>;
export type FeedType = (typeof FEED_TYPES)[number];
export type FeedItem = z.infer<typeof FeedItem>;
export type WhyResponse = z.infer<typeof WhyResponse>;
export type BudgetMeter = z.infer<typeof BudgetMeter>;
export type OwnerSettings = z.infer<typeof OwnerSettings>;
export type SchedulePreview = z.infer<typeof SchedulePreview>;
export type VerifyCheck = z.infer<typeof VerifyCheck>;
export type VerifyResult = z.infer<typeof VerifyResult>;
export type InspectorResponse = z.infer<typeof InspectorResponse>;
export type ApprovalPayTx = z.infer<typeof ApprovalPayTx>;
