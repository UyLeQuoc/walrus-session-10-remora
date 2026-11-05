import { z } from "zod";
import { Amount, IsoDateTime, ObjectId, ReefRef, SuiAddress } from "./common.ts";
import { McpServerEntry } from "./mcp.ts";
import { PlannerRule } from "./planner-rules.ts";

export const TOOL_NAMES = [
  "memory.recall",
  "memory.remember",
  "tatum.balances",
  "tatum.transactions",
  "tatum.objects",
  "tatum.events",
  "web.fetch",
  "pay",
  "notify",
  "handoff",
  "schedule",
] as const;
export const ToolName = z.enum(TOOL_NAMES);

/** What wakes a remora up (remora-spec §3, D1). */
export const Trigger = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("message") }),
  z.object({ kind: z.literal("cron"), cron: z.string().min(1), human: z.string().optional() }),
  z.object({
    kind: z.literal("chain"),
    addresses: z.array(SuiAddress).default([]),
    objects: z.array(ObjectId).default([]),
    eventTypes: z.array(z.string()).default([]),
  }),
  z.object({
    kind: z.literal("price"),
    symbol: z.string().min(1),
    above: z.number().optional(),
    below: z.number().optional(),
    /** ADR-0121: names the trigger's crossing state; imported ones arrive paused. */
    id: z.string().min(1).optional(),
    paused: z.boolean().optional(),
  }),
  /** ADR-0121: its secret is derived from the server's and never stored; `name` says who sends it. */
  z.object({ kind: z.literal("webhook"), id: z.string().min(1), name: z.string().optional() }),
]);

/** ADR-0121: what an outbound webhook can be sent. */
export const HOOK_EVENTS = [
  "payment.settled",
  "approval.asked",
  "answer.ready",
  "proposal.made",
  "price.hike",
] as const;
export const HookEvent = z.enum(HOOK_EVENTS);

/** ADR-0121: a URL the owner wants told about some of this remora's events. */
export const OutHook = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  events: z.array(HookEvent),
});

/** The remora's Disc budget as the owner configured it (ADR-0003). Amounts are smallest units. */
export const Budget = z.object({
  coinType: z.string().min(1),
  windowLimit: Amount,
  window: z.enum(["day", "week", "month"]),
  perPaymentCap: Amount,
  expiresAt: IsoDateTime.optional(),
  payees: z.array(ReefRef),
});

/** shadow → active after review (N3); paused and retired are owner kill switches. */
export const RemoraStatus = z.enum(["shadow", "active", "paused", "retired"]);

export const RemoraConfig = z.object({
  version: z.literal(1),
  id: z.uuid(),
  name: z.string().min(1).max(40),
  template: z.string().min(1),
  persona: z.string().min(1),
  tools: z.array(ToolName).min(1),
  triggers: z.array(Trigger).min(1),
  /** Null for read-only remoras such as Sentinel. */
  budget: Budget.nullable(),
  status: RemoraStatus,
  identity: z.object({
    /** The remora's own key's address: spender of its Disc and delegate on the owner's memory. */
    address: SuiAddress,
    suinsName: z.string().optional(),
  }),
  /** Walrus Memory namespaces this remora reads and writes (memory.ts). */
  namespaces: z.array(z.string().min(1)),
  /** Its brain: a `MODEL_CATALOG` id; absent means the server default (D9, ADR-0042). */
  model: z.string().min(1).optional(),
  /** ADR-0127: the owner shares this remora's counts with the Reef's reputation (off by default). */
  share: z.object({ stats: z.boolean() }).optional(),
  /** ADR-0125: an Errand's people, each also one of its Disc's payees (`reef:contact-<slug>`). */
  contacts: z
    .array(
      z.object({
        name: z.string().min(1).max(40),
        address: SuiAddress,
        ref: ReefRef,
        /** C1 (ADR-0144): the `.sui` name it was added by, resolved again before each payment. */
        suins: z.string().max(80).optional(),
        resolvedAt: z.string().optional(),
      }),
    )
    .optional(),
  /** ADR-0114: the crew it's in, its lead, and the services it buys for that lead. */
  crew: z
    .object({
      id: z.string().min(1),
      name: z.string().min(1),
      leadId: z.string().min(1),
      covers: z.array(z.string()).default([]),
    })
    .optional(),
  /** ADR-0121: outbound webhooks, signed with a secret derived per remora. */
  hooks: z.object({ out: z.array(OutHook).default([]) }).optional(),
  /** A2 (ADR-0137): planner rules the owner accepted from outcomes; they only narrow spending. */
  rules: z.array(PlannerRule).optional(),
  /** ADR-0143: read-only MCP servers it may call, with the tools the owner ticked. */
  mcp: z.array(McpServerEntry).max(5).optional(),
});

export type ToolName = z.infer<typeof ToolName>;
export type Trigger = z.infer<typeof Trigger>;
export type Budget = z.infer<typeof Budget>;
export type RemoraStatus = z.infer<typeof RemoraStatus>;
export type RemoraConfig = z.infer<typeof RemoraConfig>;
export type HookEvent = z.infer<typeof HookEvent>;
export type OutHook = z.infer<typeof OutHook>;
