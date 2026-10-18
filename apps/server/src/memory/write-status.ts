import { and, eq, memoryIndex } from "@remora/db";
import { db } from "../context.ts";
import { ownMemoryOf } from "../identity/persons.ts";

export type WriteStatus = "pending" | "stored" | "failed";

export type StatusResult =
  | {
      ok: true;
      status: WriteStatus;
      blobId: string | null;
      hidden: boolean;
      type: string;
    }
  | { ok: false; reason: "missing" };

export async function writeStatus(personId: string, id: string): Promise<StatusResult> {
  const [row] = await db
    .select({
      status: memoryIndex.status,
      blobId: memoryIndex.blobId,
      hiddenAt: memoryIndex.hiddenAt,
      type: memoryIndex.type,
    })
    .from(memoryIndex)
    .where(and(ownMemoryOf(personId), eq(memoryIndex.id, id)))
    .limit(1);
  if (!row) return { ok: false, reason: "missing" };
  return {
    ok: true,
    status: row.status,
    blobId: row.blobId,
    hidden: Boolean(row.hiddenAt),
    type: row.type,
  };
}
