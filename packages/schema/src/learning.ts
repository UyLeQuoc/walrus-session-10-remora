/**
 * Learning you can check (G5, L1, ADR-0046): Proof of Learning sets two decisions side by side and
 * names the memories that changed the outcome; learning series are charts built only from real
 * Wakes and feedback.
 */
import { z } from "zod";
import { BlobId, IsoDateTime, Sha256Hex } from "./common.ts";
import { type Decision, WakeIntent } from "./wake.ts";

const Action = z.enum(["pay", "ping", "digest", "silent", "answer"]);

/** One decision, from its Wake. */
export const DecisionRef = z.object({
  receiptId: z.uuid(),
  eventId: z.uuid().nullable(),
  at: IsoDateTime,
  trigger: WakeIntent.shape.trigger,
  action: Action,
  reason: z.string(),
  summary: z.string(),
  memories: WakeIntent.shape.memories,
  intentHash: Sha256Hex,
  /** Where anyone can check it (`/verify/<receipt>`). */
  verify: z.string().min(1),
});

/** G5: `GET /api/proofs/:before/:after`. */
export const ProofOfLearning = z.object({
  remoraId: z.uuid(),
  remora: z.string().min(1),
  before: DecisionRef,
  after: DecisionRef,
  /** Memories the later decision used that the earlier one didn't have. */
  delta: z.array(
    z.object({
      blobId: BlobId,
      namespace: z.string().min(1),
      /** What was learned, when this server knows it (a rule it taught, a feedback note). */
      text: z.string().nullable(),
      learnedAt: IsoDateTime.nullable(),
    }),
  ),
  change: z.object({ from: Action, to: Action, summary: z.string().min(1) }),
});

export const LEARNING_METRICS = ["noise_rate", "cost_per_useful", "memory_hit_rate"] as const;
export const LearningMetric = z.enum(LEARNING_METRICS);

/** L1: one chart, one point per UTC day with data. */
export const LearningSeries = z.object({
  remoraId: z.uuid().nullable(),
  metric: LearningMetric,
  /** `ratio` (0–1) or `usdc`. */
  unit: z.enum(["ratio", "usdc"]),
  points: z.array(
    z.object({
      day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      value: z.number().nullable(),
      /** How many decisions or answers the point is based on. */
      n: z.number().int().nonnegative(),
    }),
  ),
  /** What the series was computed from, in words. */
  source: z.string().min(1),
});

export type DecisionRef = z.infer<typeof DecisionRef>;
export type ProofOfLearning = z.infer<typeof ProofOfLearning>;
export type LearningMetric = z.infer<typeof LearningMetric>;
export type LearningSeries = z.infer<typeof LearningSeries>;
// Keep `Decision` reachable for consumers that build DecisionRef from a Wake.
export type DecisionAction = z.infer<typeof Decision>["action"];
