/**
 * H7 (ADR-0051): the public playground. A visitor without a wallet gets their own Scout with a $1
 * Disc funded by the playground wallet, for a few questions and a limited time; the Disc caps the
 * worst case onchain, and its expiry and revoke end it.
 */
import { z } from "zod";
import { IsoDateTime, ObjectId, ReefRef } from "./common.ts";
import { Network } from "./network.ts";

export const PlaygroundLimits = z.object({
  /** Questions one visitor may ask their Scout. */
  questionsPerSession: z.number().int().positive(),
  /** New sessions one IP may start per UTC day. */
  sessionsPerIpPerDay: z.number().int().positive(),
  /** Playground Scouts live at the same time. */
  pool: z.number().int().positive(),
  /** How long a session lives before its Disc is revoked. */
  ttlMinutes: z.number().int().positive(),
  /** The Disc's lifetime cap, in USDC. */
  discUsdc: z.string().regex(/^\d+(\.\d+)?$/),
});

export const PlaygroundAnswer = z.object({
  question: z.string().min(1),
  answer: z.string(),
  eventId: z.uuid(),
  /** `/verify/<receipt>` for the answer's Wake; null when no Wake was recorded. */
  verify: z.string().nullable(),
  paid: z.array(
    z.object({ payee: ReefRef, amountUsdc: z.string(), digest: z.string().nullable() }),
  ),
  at: IsoDateTime,
});

/** `POST /api/playground/session`, `GET /api/playground/session`, and after each ask. */
export const PlaygroundSession = z.object({
  remoraId: z.uuid(),
  name: z.string().min(1),
  network: Network,
  status: z.enum(["live", "expired", "retired"]),
  discId: ObjectId.nullable(),
  /** The Disc's issue, signed by the playground wallet. */
  issueDigest: z.string().nullable(),
  /** The revoke, once the session ended. */
  revokeDigest: z.string().nullable(),
  budgetUsdc: z.string(),
  spentUsdc: z.string(),
  questionsLeft: z.number().int().nonnegative(),
  expiresAt: IsoDateTime,
  answers: z.array(PlaygroundAnswer),
  limits: PlaygroundLimits,
});

export type PlaygroundLimits = z.infer<typeof PlaygroundLimits>;
export type PlaygroundAnswer = z.infer<typeof PlaygroundAnswer>;
export type PlaygroundSession = z.infer<typeof PlaygroundSession>;
