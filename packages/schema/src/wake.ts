import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, utf8ToBytes } from "@noble/hashes/utils.js";
import { z } from "zod";
import { Amount, BlobId, IsoDateTime, ObjectId, ReefRef, Sha256Hex, SuiAddress } from "./common.ts";

/** What the remora decided (remora-spec §9). Built only from trusted context (ADR-0014). */
export const Decision = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("pay"),
    payee: ReefRef,
    payTo: SuiAddress,
    amount: Amount,
    coinType: z.string().min(1),
    reason: z.string().min(1),
  }),
  z.object({ action: z.literal("ping"), reason: z.string().min(1) }),
  z.object({ action: z.literal("digest"), reason: z.string().min(1) }),
  z.object({ action: z.literal("silent"), reason: z.string().min(1) }),
  z.object({ action: z.literal("answer"), reason: z.string().min(1) }),
]);

export const WakeIntent = z.object({
  trigger: z.object({
    kind: z.enum(["message", "cron", "chain", "price", "webhook", "handoff"]),
    ref: z.string().min(1),
  }),
  inputs: z.object({
    via: z.literal("tatum"),
    checkpoint: z.number().int().nonnegative().optional(),
    objects: z.array(z.object({ id: ObjectId, version: z.string().min(1) })).default([]),
    sha256: Sha256Hex,
  }),
  memories: z.array(z.object({ blobId: BlobId, namespace: z.string(), distance: z.number() })),
  model: z.object({ id: z.string().min(1), promptSha256: Sha256Hex }),
  decision: Decision,
  sonar: z.object({ verdict: z.enum(["allow", "block", "ask"]), reasons: z.array(z.string()) }),
});

export const Wake = z.object({
  v: z.literal(1),
  remora: z.string().min(1),
  agent: SuiAddress,
  ts: IsoDateTime,
  intent: WakeIntent,
  result: z.object({
    tx: z.string().optional(),
    responseSha256: Sha256Hex.optional(),
    error: z.string().optional(),
  }),
});

/** What the "Why?" drawer and the verify page show (N4, G3). */
export const WakeView = z.object({
  wakeBlobId: BlobId.nullable(),
  intentHash: Sha256Hex,
  /** True once `Paid.intent` (or a Merkle anchor) matches `intentHash`. */
  anchored: z.boolean(),
  wake: Wake,
});

/** JSON with object keys sorted at every level, so the same intent always hashes the same. */
export function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalJson(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * `sha256(canonicalJson(intent))`, computed before paying and passed to `disc::pay`
 * (ADR-0007). Uses @noble/hashes so the browser can verify a Wake too.
 */
export function intentHash(intent: z.infer<typeof WakeIntent>): string {
  return bytesToHex(sha256(utf8ToBytes(canonicalJson(intent))));
}

export type Decision = z.infer<typeof Decision>;
export type WakeIntent = z.infer<typeof WakeIntent>;
export type Wake = z.infer<typeof Wake>;
export type WakeView = z.infer<typeof WakeView>;
