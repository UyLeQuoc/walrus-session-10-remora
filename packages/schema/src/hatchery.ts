/**
 * The Hatchery (M1, M3–M7, ADR-0012, ADR-0046): a remora or a team is shared as a `remora.team/v1`
 * file stored as a Walrus blob, with authorship and fork lineage from `remora::hatchery` events. A
 * shared file never carries keys, memories, ids, Wakes or raw addresses, and the same safety review
 * runs before publishing and again before hatching.
 */
import { z } from "zod";
import { BlobId, IsoDateTime, ObjectId, ReefRef, SuiAddress } from "./common.ts";
import { Network } from "./network.ts";
import { TeamFile } from "./team.ts";

/** M7: what the review found. `block` stops publish and hatch; `warn` shows on the consent screen. */
export const SafetyFinding = z.object({
  severity: z.enum(["block", "warn"]),
  code: z.enum([
    "injection",
    "exfiltration",
    "raw_address",
    "unknown_payee",
    "unknown_template",
    "secret",
    "model_flag",
    /** ADR-0131: a starter memory line that names a person, a handle, an email or a phone. */
    "private_memory",
  ]),
  /** Where in the file, e.g. `remoras[0].persona`. */
  where: z.string().min(1),
  detail: z.string().min(1),
});

export const SafetyReport = z.object({
  verdict: z.enum(["pass", "warn", "block"]),
  findings: z.array(SafetyFinding),
  /** The checks that ran: `patterns`, `reef`, `scrubber`, and `model` when a model was reachable. */
  checks: z.array(z.string().min(1)),
  checkedAt: IsoDateTime,
});

/** What each remora in a template may do: shown before sharing and on the consent screen. */
export const TemplatePermissions = z.object({
  remora: z.string().min(1),
  template: z.string().min(1),
  tools: z.array(z.string()),
  triggers: z.array(z.string()),
  payees: z.array(ReefRef),
  /** The author's suggestion, e.g. "0.50 USDC a month, at most 0.015 a payment"; null for free ones. */
  budget: z.string().nullable(),
  model: z.string().nullable(),
});

/** M1: `POST /api/remoras/:id/share`, before anything leaves. `markdown` is exactly what is stored. */
export const ShareReview = z.object({
  team: TeamFile,
  markdown: z.string().min(1),
  permissions: z.array(TemplatePermissions),
  /** What was taken out and why (memories, watched addresses, secrets the scrubber found…). */
  removed: z.array(z.object({ field: z.string().min(1), reason: z.string().min(1) })),
  safety: SafetyReport,
  sizeBytes: z.number().int().positive(),
  /** ADR-0131: memories the author could add as a public starter pack, each checked. */
  packCandidates: z
    .array(z.object({ text: z.string(), ok: z.boolean(), why: z.string().nullable() }))
    .optional(),
});

/** M4: one template in the gallery, from the hatchery events and its blob. */
export const HatcheryListing = z.object({
  /** The frozen `remora::hatchery::Template` object. */
  templateId: ObjectId,
  network: Network,
  blobId: BlobId,
  author: SuiAddress,
  /** The template this one was derived from, if any. */
  parent: ObjectId.nullable(),
  name: z.string().min(1),
  description: z.string().nullable(),
  permissions: z.array(TemplatePermissions),
  /** Hatches recorded onchain (`Forked`). */
  forks: z.number().int().nonnegative(),
  deprecated: z.boolean(),
  safety: SafetyReport.shape.verdict,
  publishedAt: IsoDateTime,
  publishDigest: z.string().min(1),
  /** Opt-in outcomes from hatched remoras' Wakes; null until there are some. */
  stats: z
    .object({
      hatched: z.number().int().nonnegative(),
      usefulAnswers: z.number().int().nonnegative(),
      costPerUsefulUsdc: z.string().nullable(),
    })
    .nullable(),
});

/** M5: the install-style consent screen, before the one signature. */
export const HatchConsent = z.object({
  listing: HatcheryListing,
  team: TeamFile,
  permissions: z.array(TemplatePermissions),
  /** Every payee the remoras may pay, resolved against this network's Reef. */
  payees: z.array(
    z.object({
      ref: ReefRef,
      name: z.string().min(1),
      priceUsdc: z.string().nullable(),
      known: z.boolean(),
    }),
  ),
  safety: SafetyReport,
  /** Hatched remoras start in shadow mode (ADR-0012). */
  startsInShadow: z.literal(true),
  /** The hatch takes one owner signature: every Disc and the `Forked` record together. */
  signatures: z.number().int().min(0).max(1),
});

export type SafetyFinding = z.infer<typeof SafetyFinding>;
export type SafetyReport = z.infer<typeof SafetyReport>;
export type TemplatePermissions = z.infer<typeof TemplatePermissions>;
export type ShareReview = z.infer<typeof ShareReview>;
export type HatcheryListing = z.infer<typeof HatcheryListing>;
export type HatchConsent = z.infer<typeof HatchConsent>;
