/**
 * U19 B1 (ADR-0145): auditor access. The owner lends an auditor read access to a remora's Wakes in a
 * date range through a `remora_capsule` capsule (ADR-0130): the server builds this bundle as canonical
 * JSON, Seal-encrypts it to the capsule's key id and stores it on Walrus testnet; the auditor's page
 * decrypts it in the browser and checks every receipt against Sui itself. The bundle is the owner's
 * claim, so the page treats it as data: it renders text only and trusts nothing it can't recheck.
 */
import { z } from "zod";
import { Amount, BlobId, IsoDateTime, Sha256Hex, SuiAddress } from "./common.ts";
import { AnchorProof } from "./merkle.ts";
import { Wake } from "./wake.ts";

/** An expiry of 1 to 30 days (the capsule's own limit); at most this many Wakes in one bundle. */
export const AUDIT_LIMITS = { days: 30, wakes: 500 } as const;

/** One Wake in the bundle: the stored Wake (so the page can recompute its intent hash) and its proofs. */
export const AuditWake = z.object({
  /** The receipt row's id, the same id `/verify/:ref` takes. */
  receiptId: z.string().min(1),
  /** When the Wake was stored. */
  at: IsoDateTime,
  /** The stored intent hash; the page recomputes it from `wake.intent`. */
  intentHash: Sha256Hex,
  /** The Wake as stored: intent (trigger, inputs' hash, cited memories, decision, Sonar's reasons) and result. */
  wake: Wake,
  /** A payment's claimed fields, copied from the decision; the page checks them against the transaction. */
  payment: z
    .object({
      digest: z.string().min(1),
      amount: Amount,
      payee: z.string().min(1),
      payTo: SuiAddress,
      coinType: z.string().min(1),
    })
    .nullable(),
  /** The memory blob ids the decision cited. */
  memories: z.array(BlobId),
  /** A Wake that didn't pay, once its hourly batch is anchored (ADR-0139). */
  anchor: AnchorProof.nullable(),
  /** The owner's question, only when the owner ticked "include question text". */
  question: z.string().optional(),
});

export const AuditBundle = z.object({
  v: z.literal(1),
  kind: z.literal("remora.audit"),
  remora: z.object({
    id: z.string().min(1),
    name: z.string(),
    /** The remora's key, which signs its payments and anchors. */
    agent: SuiAddress,
    owner: SuiAddress,
    network: z.enum(["mainnet", "testnet"]),
  }),
  /** `[from, to)`, as the owner chose it. */
  range: z.object({ from: IsoDateTime, to: IsoDateTime }),
  includesQuestions: z.boolean(),
  madeAt: IsoDateTime,
  count: z.number().int().nonnegative(),
  /** Oldest first. */
  wakes: z.array(AuditWake),
});

/** `GET /api/audit/:capsuleId`, public: only what the page needs to fetch and decrypt the bundle. */
export const AuditAccess = z.object({
  capsuleId: SuiAddress,
  network: z.enum(["mainnet", "testnet"]),
  /** The `remora_capsule` package whose `seal_approve` decides. */
  packageId: SuiAddress,
  blobId: BlobId,
  /** The capsule's Seal key id (hex); the ciphertext names it too. */
  keyId: z.string().regex(/^[0-9a-f]{64}$/),
  remora: z.string(),
  auditor: SuiAddress,
  count: z.number().int().positive(),
  expiresMs: z.number().int().positive(),
  range: z.object({ from: IsoDateTime, to: IsoDateTime }),
});

/** One share on the owner's card. */
export const AuditShare = z.object({
  capsuleId: SuiAddress,
  auditor: SuiAddress,
  /** The `.sui` name the owner typed, if any. */
  auditorName: z.string().nullable(),
  range: z.object({ from: IsoDateTime, to: IsoDateTime }),
  count: z.number().int().positive(),
  expiresMs: z.number().int().positive(),
  includeQuestions: z.boolean(),
  blobId: BlobId,
  digest: z.string().min(1),
  at: IsoDateTime,
  /** The revoke's digest, once the owner took it back. */
  revoked: z.string().nullable(),
  path: z.string().min(1),
});

/** The owner's `create` to sign, and what the confirm records. */
export const AuditDraft = z.object({
  keyId: z.string().regex(/^[0-9a-f]{64}$/),
  blobId: BlobId,
  count: z.number().int().positive(),
  expiresMs: z.number().int().positive(),
  auditor: SuiAddress,
  auditorName: z.string().nullable(),
  range: z.object({ from: IsoDateTime, to: IsoDateTime }),
  includeQuestions: z.boolean(),
});

export type AuditWake = z.infer<typeof AuditWake>;
export type AuditBundle = z.infer<typeof AuditBundle>;
export type AuditAccess = z.infer<typeof AuditAccess>;
export type AuditShare = z.infer<typeof AuditShare>;
export type AuditDraft = z.infer<typeof AuditDraft>;
