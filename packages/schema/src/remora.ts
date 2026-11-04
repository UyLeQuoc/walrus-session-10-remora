import { z } from "zod";
import { Amount, IsoDateTime, ObjectId, ReefRef, SuiAddress } from "./common.ts";

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
  }),
  z.object({ kind: z.literal("webhook"), id: z.string().min(1) }),
]);

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
  /** ADR-0125: an Errand's people, each also one of its Disc's payees (`reef:contact-<slug>`). */
  contacts: z
    .array(z.object({ name: z.string().min(1).max(40), address: SuiAddress, ref: ReefRef }))
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
});

export type ToolName = z.infer<typeof ToolName>;
export type Trigger = z.infer<typeof Trigger>;
export type Budget = z.infer<typeof Budget>;
export type RemoraStatus = z.infer<typeof RemoraStatus>;
export type RemoraConfig = z.infer<typeof RemoraConfig>;
