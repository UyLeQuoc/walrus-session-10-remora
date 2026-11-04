/**
 * U18 C1 and C2 (ADR-0123): steering a remora in words. A described job comes back as a draft the
 * create form shows for review; a chat command comes back as a change card, applied on a tap or
 * signed from a link. Both only propose: nothing here creates, pays or signs.
 */
import { z } from "zod";
import { IsoDateTime, SuiAddress } from "./common.ts";
import { Budget, ToolName, Trigger } from "./remora.ts";

/** `POST /api/remoras/draft`: a create input drafted from the owner's words, every field reviewable. */
export const RemoraDraft = z.object({
  /** A kind from `/api/templates`; empty when no kind fits (an issue says so). */
  template: z.string(),
  name: z.string().max(40),
  persona: z.string().max(2_000),
  tools: z.array(ToolName),
  triggers: z.array(Trigger),
  namespaces: z.array(z.string()),
  /** Null for kinds that never pay. Amounts are smallest units; payees are live Reef refs. */
  budget: Budget.nullable(),
  /** Wallet watchers: the addresses it watches. */
  watch: z.array(SuiAddress).default([]),
  /** Briefers: what its brief follows. */
  items: z.array(z.string()).default([]),
  /** Wallet watchers: rules taught right after it hatches. */
  rules: z.array(z.string()).default([]),
  /** Researchers: a question asked on a schedule. Briefers: when the brief goes out. */
  schedule: z
    .object({ when: z.string().min(1), question: z.string() })
    .nullable()
    .default(null),
  /** One line on why this kind and this budget. */
  why: z.string(),
});

/** A field the draft couldn't fill or had to drop, with what the owner should do. */
export const DraftIssue = z.object({ field: z.string(), message: z.string() });

export const DraftResponse = z.discriminatedUnion("ok", [
  z.object({ ok: z.literal(true), draft: RemoraDraft, issues: z.array(DraftIssue) }),
  /** A job Remora must not do (trading, moving the owner's own funds, beyond its tools). */
  z.object({ ok: z.literal(false), refused: z.string() }),
]);

/** `POST /api/remoras/:id/setup`: what a draft adds after the hatch, beyond the create form. */
export const SetupResponse = z.object({ done: z.array(z.string()), skipped: z.array(z.string()) });

export const CHANGE_STATUSES = ["pending", "applied", "declined", "expired", "failed"] as const;

/**
 * A chat command's change card: the `payload` of an `action` event with `kind: "change"` (so the
 * feed's types stay as they are), and what `GET /api/changes/:id` returns.
 */
export const ChangeCard = z
  .object({
    kind: z.literal("change"),
    /** The remora it changes (the event may sit in another remora's thread). */
    target: z.uuid(),
    remora: z.string(),
    title: z.string(),
    diff: z.array(z.object({ label: z.string(), before: z.string(), after: z.string() })),
    /** True: a transaction the owner signs (limits, a Disc's pause, contacts). False: a tap applies it. */
    sign: z.boolean(),
    note: z.string().optional(),
    status: z.enum(CHANGE_STATUSES),
    digest: z.string().optional(),
    expiresAt: IsoDateTime,
  })
  .loose();

export const ChangeView = z.object({ id: z.uuid(), change: ChangeCard });

export type RemoraDraft = z.infer<typeof RemoraDraft>;
export type DraftIssue = z.infer<typeof DraftIssue>;
export type DraftResponse = z.infer<typeof DraftResponse>;
export type SetupResponse = z.infer<typeof SetupResponse>;
export type ChangeCard = z.infer<typeof ChangeCard>;
export type ChangeView = z.infer<typeof ChangeView>;
