import { z } from "zod";
import { ERROR_CODES } from "./errors.ts";

/**
 * Every sentence and button the channels send, by key. Keys are a contract
 * (Uy renders them); the text is Huấn's, in apps/server/src/copy/.
 */
export const COPY_KEYS = [
  "remora.created",
  "remora.shadow_started",
  "remora.activated",
  "remora.paused",
  "remora.resumed",
  "remora.retired",
  "remora.key_rotated",
  "ping.chain_event",
  "digest.morning",
  "payment.made",
  "payment.blocked",
  "approval.needed",
  "rule.learned",
  "rule.undone",
  "handoff.sent",
  "shadow.would_have",
  "why.title",
  "button.why",
  "button.teach",
  "button.mute",
  "button.approve",
  "button.reject",
  "button.useful",
  "button.noise",
  "button.snooze",
  ...ERROR_CODES.map((code) => `error.${code}` as const),
] as const;
export const CopyKey = z.enum(COPY_KEYS);
export type CopyKey = z.infer<typeof CopyKey>;
