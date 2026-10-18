import { and, eq, memoryIndex, sql } from "@remora/db";
import { db } from "../context.ts";

/** Lines indexed since `since`, except writes that failed and can be tried again. */
export async function knownMemoryHashes(personId: string, since: Date): Promise<Set<string>> {
  const rows = await db
    .select({ textSha256: memoryIndex.textSha256 })
    .from(memoryIndex)
    .where(
      and(
        eq(memoryIndex.personId, personId),
        sql`${memoryIndex.createdAt} >= ${since.toISOString()}`,
        sql`${memoryIndex.status} <> 'failed'`,
      ),
    );
  return new Set(rows.map((row) => row.textSha256));
}
