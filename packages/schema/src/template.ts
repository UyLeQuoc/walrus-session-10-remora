import { z } from "zod";
import { ReefRef } from "./common.ts";
import { ToolName, Trigger } from "./remora.ts";

/**
 * A built-in remora kind (Scout, Sentinel…): its persona, tools, triggers and Reef payees. This is the
 * catalog the wizard and team files pick from by slug. What people share in the Hatchery is a
 * `remora.team/v1` file (ADR-0046), never this. Kinds carry no memories, keys or raw payee
 * addresses (ADR-0012).
 */
export const Template = z.object({
  schema: z.literal("remora.template/v1"),
  name: z.string().min(1).max(40),
  summary: z.string().min(1),
  persona: z.string().min(1),
  tools: z.array(ToolName).min(1),
  triggers: z.array(Trigger).min(1),
  budgetSuggestion: z.object({
    monthlyUsd: z.tuple([z.number().nonnegative(), z.number().nonnegative()]),
    perPaymentUsd: z.number().nonnegative(),
  }),
  payees: z.array(ReefRef),
  starterMemories: z.array(z.string()).default([]),
  examples: z.array(z.string()).default([]),
});

export type Template = z.infer<typeof Template>;
