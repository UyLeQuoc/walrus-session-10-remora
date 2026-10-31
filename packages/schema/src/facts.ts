/**
 * F15 (ADR-0074): the facts ledger as the web sees it. `GET /api/remoras/:id/facts[?asOf=]` and
 * `POST /api/remoras/:id/facts/:factId/resolve { accept }`.
 */
import { z } from "zod";

export const FactView = z.object({
  id: z.string().min(1),
  /** me | feedback | sources */
  namespace: z.string().min(1),
  /** `subject.predicate[qualifier]`, e.g. "owner.reply_language". */
  slot: z.string().min(1),
  subject: z.string().min(1),
  predicate: z.string().min(1),
  qualifier: z.string().nullable(),
  value: z.string(),
  cardinality: z.enum(["one", "many"]),
  validFrom: z.string().nullable(),
  validUntil: z.string().nullable(),
  expiresAt: z.string().nullable(),
  observedAt: z.string(),
  assertedBy: z.enum(["owner", "runtime", "agent", "extractor"]),
  verification: z.enum(["explicit", "inferred"]),
  confidence: z.number().min(0).max(1),
  status: z.enum(["active", "superseded", "disputed", "retracted"]),
  version: z.number().int().positive(),
  /** A remora's name, `mcp:<client>` or `owner`. */
  writer: z.string(),
  extractor: z.string().nullable(),
  recordedAt: z.string(),
  closedAt: z.string().nullable(),
  supersedes: z.string().nullable(),
  supersededBy: z.string().nullable(),
  disputes: z.string().nullable(),
  /** The Walrus blobs it rests on (none until a write lands). */
  blobIds: z.array(z.string()),
  /** Every memory it rests on is hidden by the owner. */
  hidden: z.boolean(),
});

/** Without `asOf`: every fact but retracted ones, by slot then version. With it: those in effect then. */
export const FactsResponse = z.object({
  asOf: z.string().nullable(),
  facts: z.array(FactView),
  disputes: z.number().int().nonnegative(),
});

export const FactResolveResponse = z.object({ fact: FactView });

export type FactView = z.infer<typeof FactView>;
export type FactsResponse = z.infer<typeof FactsResponse>;
export type FactResolveResponse = z.infer<typeof FactResolveResponse>;
