/**
 * Per-person throttle. The web chat is public and every turn costs OpenRouter
 * credit plus relayer budget, which guest users share on one delegate key.
 */
import { eq, sql, turnLog } from "@remora/db";
import { db } from "../context.ts";
import type { ModelSideCall } from "./turn-modes.ts";

const PER_MINUTE = 10;
const PER_DAY = 200;

export interface RateDecision {
  allowed: boolean;
  message: string;
}

export async function checkRate(personId: string): Promise<RateDecision> {
  const [row] = await db
    .select({
      lastMinute: sql<number>`count(*) filter (where ${turnLog.createdAt} > now() - interval '1 minute')::int`,
      lastDay: sql<number>`count(*) filter (where ${turnLog.createdAt} > now() - interval '1 day')::int`,
    })
    .from(turnLog)
    .where(eq(turnLog.personId, personId));

  if ((row?.lastMinute ?? 0) >= PER_MINUTE) {
    return { allowed: false, message: "You are going faster than I can think. Give me a minute." };
  }
  if ((row?.lastDay ?? 0) >= PER_DAY) {
    return { allowed: false, message: "That is my daily limit for one person. Back tomorrow." };
  }
  return { allowed: true, message: "" };
}

/**
 * Commands never reach the model, so they write no ordinary turn row, which
 * would make them invisible to `checkRate` and therefore unlimited. Record a
 * lightweight row so they count against the same budget.
 */
export async function noteModelCall(
  personId: string,
  channel: string,
  mode: ModelSideCall,
  modelId: string,
): Promise<void> {
  await db
    .insert(turnLog)
    .values({
      personId,
      channel,
      memoryEnabled: false,
      mode,
      model: modelId,
      injected: [],
      writes: 0,
    })
    .catch((e) => console.error("[ratelimit] noteModelCall", mode, e));
}

export async function noteCommand(personId: string, channel: string): Promise<void> {
  await db
    .insert(turnLog)
    .values({
      personId,
      channel,
      memoryEnabled: false,
      mode: "command",
      model: "none",
      injected: [],
      writes: 0,
    })
    .catch((e) => console.error("[ratelimit] noteCommand", e));
}

/** Exported for the evidence script. */
export const LIMITS = { PER_MINUTE, PER_DAY } as const;
