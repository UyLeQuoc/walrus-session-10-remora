import { z } from "zod";
import { CopyKey } from "./copy-keys.ts";

export const ButtonKind = z.enum([
  "why",
  "teach",
  "mute",
  "approve",
  "reject",
  "useful",
  "noise",
  "snooze",
]);
export const Button = z.object({ kind: ButtonKind, ref: z.string().min(1) });

/**
 * What the runtime (Uy) asks a channel to send. Words come from copy keys whose
 * text lives in apps/server/src/copy/ (Huấn), so wording changes never touch logic.
 */
export const OutboundMessage = z.object({
  remora: z.string().min(1),
  copyKey: CopyKey,
  params: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  priority: z.enum(["ping", "digest", "silent"]),
  buttons: z.array(Button).default([]),
  wakeId: z.string().optional(),
});

export const Channel = z.enum(["telegram", "discord", "slack", "web", "cli"]);

/** What a channel adapter hands the runtime (hippo's `handleIncoming` input, plus button presses). */
export const InboundMessage = z.object({
  channel: Channel,
  externalId: z.string().min(1),
  displayName: z.string().optional(),
  text: z.string(),
  threadKey: z.string().optional(),
  button: Button.optional(),
});

export type ButtonKind = z.infer<typeof ButtonKind>;
export type OutboundMessage = z.infer<typeof OutboundMessage>;
export type InboundMessage = z.infer<typeof InboundMessage>;
