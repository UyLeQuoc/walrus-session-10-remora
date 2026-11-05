/**
 * D2 + D3 (ADR-0149, ADR-0150): what owners say about a template, what its author sees, and the
 * update a hatched remora is offered when its template gets a new version.
 *
 * A rating is a `template.rated` event on the rater's hatched remora, signed as a personal message;
 * an update is a `template_update` approval. Neither needs a schema push (ADR-0134).
 */
import { z } from "zod";
import { IsoDateTime, ObjectId, SuiAddress } from "./common.ts";
import { ConfigRestore } from "./history.ts";

export const RATING_TEXT_MAX = 280;

/** The weighted rating the gallery and the template page show: counts only. */
export const TemplateRatingSummary = z.object({
  /** Each rating weighs 1 + log2(1 + the rater's paid calls), at most 6; one decimal. */
  stars: z.number().min(1).max(5),
  /** Raters: one rating per address, the last one signed counts. */
  count: z.number().int().nonnegative(),
});

/** `POST /api/hatchery/:id/rating/message`: the exact text the wallet signs, and the text as stored. */
export const RatingMessage = z.object({
  message: z.string().min(1),
  /** The text after the scrubber: what is stored and shown, and what the message's hash covers. */
  text: z.string().max(RATING_TEXT_MAX),
  at: IsoDateTime,
});

/** One rating as its template's author sees it. */
export const TemplateRating = z.object({
  rater: SuiAddress,
  stars: z.number().int().min(1).max(5),
  text: z.string().max(RATING_TEXT_MAX),
  /** Paid calls of the rater's remoras hatched from it, and the weight they give the rating. */
  paidCalls: z.number().int().nonnegative(),
  weight: z.number().positive(),
  at: IsoDateTime,
});

/** `POST /api/hatchery/:id/rating`: the template's rating now, and the one just stored. */
export const RatingSaved = z.object({
  rating: TemplateRatingSummary.nullable(),
  mine: z.object({ stars: z.number().int(), text: z.string(), at: IsoDateTime }),
});

/** `GET /api/hatchery/:id/rating/me`: whether the signed-in owner can rate it, and their rating. */
export const MyRating = z.object({
  canRate: z.boolean(),
  mine: z.object({ stars: z.number().int(), text: z.string(), at: IsoDateTime }).nullable(),
});

/** `GET /api/hatchery/:id/analytics`: the author's view of their template. */
export const TemplateAnalytics = z.object({
  templateId: ObjectId,
  /** Hatches recorded onchain (`Forked`). */
  hatches: z.number().int().nonnegative(),
  /** Remoras hatched from it here. */
  remoras: z.number().int().nonnegative(),
  /** Of those, the ones that did something in the last 7 days. */
  active7d: z.number().int().nonnegative(),
  /** Answers they sold (U17), and what they earned, in USDC smallest units. */
  sales: z.number().int().nonnegative(),
  salesRevenue: z.string().regex(/^\d+$/),
  rating: TemplateRatingSummary.nullable(),
  ratings: z.array(TemplateRating),
});

/** How an accepted update applies a field: now, as a transaction the owner signs, or not here. */
export const TemplateUpdateApply = z.enum(["direct", "signature", "none"]);

export const TemplateUpdateChange = z.object({
  field: z.string().min(1),
  label: z.string().min(1),
  apply: TemplateUpdateApply,
  /** The remora's value now; absent when unset. */
  current: z.unknown().optional(),
  /** What it becomes. */
  next: z.unknown().optional(),
});

/** One template update offered to a hatched remora (a `template_update` approval). */
export const TemplateUpdate = z.object({
  id: z.uuid(),
  status: z.enum(["pending", "approved", "rejected", "expired"]),
  template: z.string(),
  /** The version the remora runs, and the new one. */
  from: ObjectId,
  to: ObjectId,
  /** 2 for the first new version after the hatched one's root, and so on. */
  version: z.number().int().positive(),
  changes: z.array(TemplateUpdateChange),
  createdAt: IsoDateTime,
  decidedAt: IsoDateTime.nullable(),
  /** Accepted, with a spending part the owner hasn't signed yet. */
  moneyOpen: z.boolean(),
  declineReason: z.string().optional(),
});

/** `GET /api/remoras/:id/template-update`. */
export const TemplateUpdates = z.object({
  open: TemplateUpdate.nullable(),
  recent: z.array(TemplateUpdate),
});

/**
 * `POST /api/remoras/:id/template-update/:approvalId/accept`: what applied now, what didn't, and the
 * money part as a prepared transaction (the usual `/budget/confirm` or `/payees/confirm` applies it).
 */
export const TemplateUpdateAccept = z.object({
  applied: z.array(z.string()),
  skipped: z.array(z.string()),
  sign: ConfigRestore.shape.sign,
});

export type TemplateRatingSummary = z.infer<typeof TemplateRatingSummary>;
export type RatingMessage = z.infer<typeof RatingMessage>;
export type TemplateRating = z.infer<typeof TemplateRating>;
export type RatingSaved = z.infer<typeof RatingSaved>;
export type MyRating = z.infer<typeof MyRating>;
export type TemplateAnalytics = z.infer<typeof TemplateAnalytics>;
export type TemplateUpdateApply = z.infer<typeof TemplateUpdateApply>;
export type TemplateUpdateChange = z.infer<typeof TemplateUpdateChange>;
export type TemplateUpdate = z.infer<typeof TemplateUpdate>;
export type TemplateUpdates = z.infer<typeof TemplateUpdates>;
export type TemplateUpdateAccept = z.infer<typeof TemplateUpdateAccept>;
