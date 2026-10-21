import { z } from "zod";
import { BlobId, IsoDateTime } from "./common.ts";

/** hippo's types (profile … style) plus Remora's (rule … wake). Memory text keeps hippo's grammar. */
export const MEMORY_TYPES = [
  "profile",
  "decision",
  "gotcha",
  "commitment",
  "correction",
  "style",
  "rule",
  "episode",
  "source",
  "feedback",
  "budget",
  "handoff",
  "wake",
] as const;
export const MemoryType = z.enum(MEMORY_TYPES);

/** Namespace names (remora-spec §8). Namespaces are public on chain: never put names or handles in them. */
export const NAMESPACES = {
  me: "me",
  sources: "sources",
  feedback: "feedback",
  budget: "budget",
  handoffs: "handoffs",
  receipts: "receipts",
  rules: (remora: string) => `remora:${remora}:rules`,
  episodes: (remora: string) => `remora:${remora}:episodes`,
} as const;

/** One row of the memory inspector (F3): metadata from the index, text only when recalled. */
export const MemoryRow = z.object({
  blobId: BlobId,
  namespace: z.string().min(1),
  type: MemoryType,
  status: z.enum(["pending", "stored", "failed"]),
  createdAt: IsoDateTime,
  /** From the relayer read API; about 210 days for new memories (ADR-0005). */
  expiresAt: IsoDateTime.nullable(),
  /** Hidden locally (F4): recall and dedupe skip it, the blob stays on Walrus. */
  hidden: z.boolean(),
  /** F4: the correction that replaced this fact; recall skips it, the blob stays on Walrus. */
  supersededBy: BlobId.nullable().default(null),
  /** How many Wakes cited this memory. */
  usedIn: z.number().int().nonnegative(),
  text: z.string().optional(),
});

/**
 * F8: `GET /api/remoras/:id/memory/export?format=json`. Metadata always; text when recall returns
 * it, marked `verified` when it hashes to what was written. The Markdown export renders the same.
 */
export const RemoraMemoryExport = z.object({
  format: z.literal("remora.memory-export/v1"),
  remora: z.object({ id: z.uuid(), name: z.string().min(1) }),
  network: z.enum(["testnet", "mainnet"]),
  exportedAt: IsoDateTime,
  memories: z.array(
    z.object({
      blobId: BlobId,
      namespace: z.string().min(1),
      type: MemoryType.nullable(),
      createdAt: IsoDateTime,
      expiresAt: IsoDateTime.nullable(),
      hidden: z.boolean(),
      supersededBy: BlobId.nullable(),
      text: z.string().nullable(),
      verified: z.boolean(),
    }),
  ),
  /** Plain statements of what the file can't do (no per-memory delete, no self-decrypt…). */
  notes: z.array(z.string().min(1)),
});

export type MemoryType = z.infer<typeof MemoryType>;
export type MemoryRow = z.infer<typeof MemoryRow>;
export type RemoraMemoryExport = z.infer<typeof RemoraMemoryExport>;
