import { sql, turnLog } from "@remora/db";

export const SIDE_CALL_MODES = ["command", "suggestion", "compare", "import"] as const;
type SideCallMode = (typeof SIDE_CALL_MODES)[number];
export type ModelSideCall = Exclude<SideCallMode, "command">;

/**
 * Rows that only exist so a call counts against the rate limit. Counting them as
 * conversation would inflate the memory-off side of the before/after the article
 * rests on, so every report filters through this one list.
 */
export const isConversationTurn = sql`(${turnLog.mode} not in (${sql.join(
  SIDE_CALL_MODES.map((mode) => sql`${mode}`),
  sql`, `,
)}))`;
