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
  /** How many Wakes cited this memory. */
  usedIn: z.number().int().nonnegative(),
  text: z.string().optional(),
});

export type MemoryType = z.infer<typeof MemoryType>;
export type MemoryRow = z.infer<typeof MemoryRow>;
