/**
 * Team files (ADR-0042): a whole team in one Markdown file, YAML frontmatter (`remora.team/v1`)
 * plus a playbook body people can read. Like a template (ADR-0012), a team file never carries keys,
 * memories, Disc or allowance ids, payee addresses or watched addresses of the person who exported
 * it. Imported remoras start in shadow mode and their schedules arrive paused.
 */
import { z } from "zod";
import { SuiAddress } from "./common.ts";
import { RoomResponder } from "./rooms.ts";

export const TeamSchedule = z.object({
  /** A human schedule ("weekdays at 8am") or a five-field UTC cron. */
  when: z.string().min(1).max(80),
  question: z.string().min(1).max(300),
});

/**
 * ADR-0121: what else wakes a Researcher or Briefer. A price trigger arrives paused, like a schedule;
 * a webhook gets its own URL and secret on import, which only the owner can reveal.
 */
export const TeamTrigger = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("price"),
    symbol: z.string().min(1).max(10),
    above: z.number().positive().optional(),
    below: z.number().positive().optional(),
  }),
  z.object({ kind: z.literal("webhook"), name: z.string().regex(/^[a-z0-9-]{1,20}$/) }),
]);

export const TeamRemora = z.object({
  template: z.string().min(1),
  name: z.string().min(1).max(40),
  persona: z.string().min(1).max(2_000).optional(),
  /** A `MODEL_CATALOG` id; anything else runs on the server default. */
  model: z.string().min(1).optional(),
  /** Paying templates only. USD, turned into USDC smallest units at import. */
  budget: z
    .object({
      monthlyUsd: z.number().positive().max(1_000),
      perPaymentUsd: z.number().positive().max(100),
    })
    .refine((b) => b.perPaymentUsd <= b.monthlyUsd, "perPaymentUsd must not exceed monthlyUsd")
    .optional(),
  /** Sentinel: addresses to watch. Empty means the importer's own address. */
  watch: z.array(SuiAddress).max(10).default([]),
  /** Sentinel rules in plain words, taught at import. */
  rules: z.array(z.string().min(1).max(500)).max(20).default([]),
  schedules: z.array(TeamSchedule).max(10).default([]),
  /** Briefer (ADR-0106): what its brief follows, one line each ("SUI and WAL prices"). */
  items: z.array(z.string().min(1).max(120)).max(6).default([]),
  /**
   * ADR-0114: in a crew, the services this member buys for its lead, by Reef slug ("price",
   * "wallet"). Empty: it takes what no one else covers.
   */
  covers: z
    .array(z.string().regex(/^[a-z0-9-]+$/))
    .max(8)
    .default([]),
  triggers: z.array(TeamTrigger).max(4).optional(),
});

export const TeamFile = z.object({
  schema: z.literal("remora.team/v1"),
  name: z.string().min(1).max(60),
  description: z.string().max(500).optional(),
  remoras: z.array(TeamRemora).min(1).max(10),
  /**
   * ADR-0131: a starter memory pack, in public plaintext. Each line was scrubbed and approved by the
   * author; whoever hatches it picks which lines to import (each marked `SOURCE: pack`).
   */
  pack: z.array(z.string().min(3).max(240)).max(20).optional(),
  /**
   * ADR-0114: the team is a crew. Its lead (a remora name from `remoras`) splits a question's
   * purchases across the others, each paying from its own limit, and answers with every receipt.
   */
  crew: z.object({ lead: z.string().min(1).max(40) }).optional(),
  room: z
    .object({
      name: z.string().min(1).max(40).default("Team"),
      responder: RoomResponder.default("auto"),
      /** A remora name from `remoras`. */
      lead: z.string().min(1).max(40).optional(),
    })
    .optional(),
});

/** `POST /api/teams/preview`: what an import would create, before anything is written. */
export const TeamPreview = z.object({
  team: TeamFile,
  /** The Markdown body under the frontmatter. */
  playbook: z.string(),
  remoras: z.array(
    z.object({
      name: z.string(),
      template: z.string(),
      model: z.string().nullable(),
      budget: z.string().nullable(),
      watch: z.number().int().nonnegative(),
      rules: z.array(z.object({ text: z.string(), understood: z.boolean() })),
      schedules: z.array(
        z.object({ when: z.string(), human: z.string().nullable(), question: z.string() }),
      ),
      needsDisc: z.boolean(),
    }),
  ),
  /** Owner signatures the import needs: one for every Disc together, or none. */
  signatures: z.number().int().min(0).max(1),
  warnings: z.array(z.string()),
});

/** A remora's recurring question (D1 cron, N12); `paused` ones don't run. */
export const Schedule = z.object({
  id: z.string().min(1),
  cron: z.string().min(1),
  human: z.string().min(1),
  question: z.string().min(1),
  paused: z.boolean().default(false),
});

export type TeamSchedule = z.infer<typeof TeamSchedule>;
export type TeamTrigger = z.infer<typeof TeamTrigger>;
export type TeamRemora = z.infer<typeof TeamRemora>;
export type TeamFile = z.infer<typeof TeamFile>;
export type TeamPreview = z.infer<typeof TeamPreview>;
export type Schedule = z.infer<typeof Schedule>;
