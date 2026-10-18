import { and, eq, turnLog } from "@remora/db";
import { isConversationTurn } from "../chat/turn-modes.ts";
import { db } from "../context.ts";
import { type MemoryUsage, memoryUsage } from "./usage.ts";

export async function usageFor(personId: string): Promise<MemoryUsage> {
  const rows = await db
    .select({ injected: turnLog.injected })
    .from(turnLog)
    .where(and(eq(turnLog.personId, personId), isConversationTurn));
  return memoryUsage(rows);
}
