/**
 * U9 (ADR-0076): the shapes behind Huấn's H2–H6 pages, moved here from `apps/web` as agreed in the
 * contract request of Oct 29. All amounts are micro-USDC as non-negative integer strings.
 */
import { z } from "zod";
import { HealthStatus } from "./ops.ts";

const MicroUsdc = z.string().regex(/^\d+$/);

/** N20 `GET /api/status`: a name and a status per item, nothing else. */
export const PublicStatusItem = z.object({ name: z.string(), status: HealthStatus });
export const PublicStatus = z.object({
  status: HealthStatus,
  items: z.array(PublicStatusItem),
});

/** N15 `GET /api/remoras/:id/cost?month=YYYY-MM` (UTC month). */
export const CostResponse = z.object({
  llmUsdc: MicroUsdc,
  gasUsdc: MicroUsdc,
  purchasesUsdc: MicroUsdc,
});

/** E7 `GET /api/reef/services`: a bare array; `payTo` for the session's network. */
export const ReefService = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  priceUsdc: MicroUsdc,
  payTo: z.string().min(1),
  /** http(s) only: the page renders it as a link. */
  docsUrl: z.string().regex(/^https?:\/\//i),
  /**
   * ADR-0111: who runs it. `house` is ours; `remora` is a remora on sale (paid at its owner's
   * address); `community` is an API an owner listed. Absent on older servers.
   */
  kind: z.enum(["house", "remora", "community"]).optional(),
  description: z.string().max(200).optional(),
});
export const ReefServices = z.array(ReefService);

/**
 * G6: a Wake shared as a public proof link (`GET /api/public/wakes/:token`). An allow-list: chain
 * facts and the verify checks only. Never the prompt or its hash, the model, memories, the trigger,
 * inputs, Sonar's reasons, the decision's `reason`, the owner, or the receipt id. Check details are
 * fixed-format; the length limits are a backstop, not the filter.
 */
const PublicCheck = z.object({
  name: z.string().min(1).max(64),
  ok: z.boolean().nullable(),
  detail: z.string().max(200),
});

const PublicAction = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("pay"),
    payee: z
      .string()
      .max(64)
      .regex(/^reef:[a-z0-9-]+$/),
    payTo: z.string().regex(/^0x[0-9a-fA-F]{1,64}$/),
    amount: z.string().regex(/^\d{1,20}$/),
  }),
  z.object({ kind: z.enum(["ping", "digest", "silent", "answer"]) }),
]);

export const PublicWake = z.object({
  v: z.literal(1),
  remora: z.string().min(1).max(64),
  network: z.enum(["testnet", "mainnet"]),
  ts: z.iso.datetime({ offset: true }),
  action: PublicAction,
  tx: z.string().min(1).max(64).nullable(),
  agent: z.string().regex(/^0x[0-9a-fA-F]{1,64}$/),
  intentHash: z.string().regex(/^[0-9a-f]{64}$/),
  anchored: z.boolean(),
  checks: z.array(PublicCheck).max(20),
});

/** `POST /api/wakes/:id/share` (owner only, idempotent). */
export const ShareLink = z.object({ token: z.string().min(1), url: z.string().min(1) });

/** A8 `GET /api/account/export`: every memory and Wake of the owner's remoras, one JSON. */
export const AccountExport = z.object({
  v: z.literal(1),
  exportedAt: z.iso.datetime({ offset: true }),
  memories: z.array(z.unknown()),
  wakes: z.array(z.unknown()),
});

/** A8 `POST /api/account/retire`: one owner transaction that revokes every live Disc. */
export const AccountRetire = z.object({
  transaction: z.string().min(1),
  /** The remoras it retires, shown before and after. */
  remoraIds: z.array(z.string()),
});

/** A8 `POST /api/account/retire/confirm { digest }`. */
export const AccountRetired = z.object({ retired: z.array(z.string()) });

export type PublicStatus = z.infer<typeof PublicStatus>;
export type CostResponse = z.infer<typeof CostResponse>;
export type ReefService = z.infer<typeof ReefService>;
export type PublicWake = z.infer<typeof PublicWake>;
export type ShareLink = z.infer<typeof ShareLink>;
export type AccountExport = z.infer<typeof AccountExport>;
export type AccountRetire = z.infer<typeof AccountRetire>;
export type AccountRetired = z.infer<typeof AccountRetired>;
