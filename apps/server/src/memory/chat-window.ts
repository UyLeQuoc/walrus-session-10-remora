import { type Citation, factsFromLookup } from "../chat/citations.ts";
import { CITATION_MISSING, CITATION_UNREACHABLE } from "../chat/cited-text.ts";
import type { WriteStatus } from "./write-status.ts";

export const WINDOW_PAD_MS = 30_000;

export interface IndexedMemory {
  id: string;
  type: string;
  status: WriteStatus;
  blobId: string | null;
  hidden: boolean;
  createdAt: Date;
}

export interface ChatMemory {
  id: string;
  type: string;
  text: string | null;
  status: WriteStatus;
  blobId: string | null;
  hidden: boolean;
}

export function memoriesInWindow(
  rows: IndexedMemory[],
  start: Date,
  end: Date,
  padMs = WINDOW_PAD_MS,
): IndexedMemory[] {
  const from = start.getTime() - padMs;
  const to = end.getTime() + padMs;
  return rows.filter((row) => {
    const at = row.createdAt.getTime();
    return at >= from && at <= to;
  });
}

export function withRecalledText(
  rows: IndexedMemory[],
  found: ReadonlyMap<string, string> | null,
): ChatMemory[] {
  const cites: Citation[] = rows.flatMap((row) =>
    row.blobId ? [{ blobId: row.blobId, type: row.type, distance: 0 }] : [],
  );
  const textByBlob = new Map(
    found ? factsFromLookup(cites, found).map((fact) => [fact.blobId, fact.text]) : [],
  );
  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    text: row.blobId ? (textByBlob.get(row.blobId) ?? null) : null,
    status: row.status,
    blobId: row.blobId,
    hidden: row.hidden,
  }));
}

export function storedWordingMissing(memories: readonly ChatMemory[]): boolean {
  return memories.some(
    (memory) => memory.status === "stored" && Boolean(memory.blobId) && !memory.text,
  );
}

export function indexedReadLimit(input: {
  reached: boolean;
  missing: boolean;
  blocked?: string;
}): { limited: true; message: string } | { limited: false } {
  if (input.blocked) return { limited: true, message: input.blocked };
  if (!input.reached) return { limited: true, message: CITATION_UNREACHABLE };
  if (input.missing) return { limited: true, message: CITATION_MISSING };
  return { limited: false };
}
