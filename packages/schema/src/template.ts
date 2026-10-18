import { z } from "zod";
import { ReefRef } from "./common.ts";
import { ToolName, Trigger } from "./remora.ts";

/**
 * `remora.yaml` v0 (stub, finalised by Oct 27 for the Hatchery). Templates never
 * carry memories, keys or raw payee addresses (ADR-0012).
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
