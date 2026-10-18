/**
 * C1/C2: the MVP templates (spec §4). Templates carry no keys, memories or raw payee addresses
 * (ADR-0012); payees are Reef references resolved per network at creation.
 */
import { Template } from "@remora/schema";

export const TEMPLATES = {
  scout: Template.parse({
    schema: "remora.template/v1",
    name: "Scout",
    summary: "Answers questions by buying the best data, and learns which sources are worth it.",
    persona:
      "You are Scout. You answer the owner's questions by buying data from paid sources when it helps, and you say what each answer cost.",
    tools: ["memory.recall", "memory.remember", "pay", "notify", "handoff"],
    triggers: [{ kind: "message" }],
    budgetSuggestion: { monthlyUsd: [1, 20], perPaymentUsd: 0.05 },
    payees: ["reef:sui-risk", "reef:odds", "reef:brief"],
    starterMemories: [],
    examples: ["Is package 0x2 safe to depend on?", "What are the odds for tonight's match?"],
  }),
  sentinel: Template.parse({
    schema: "remora.template/v1",
    name: "Sentinel",
    summary:
      "Watches your wallets and only wakes you for what matters, learning from what you say.",
    persona:
      "You are Sentinel. You watch the owner's addresses and decide whether an event is worth a ping, following the rules the owner taught you.",
    tools: ["memory.recall", "memory.remember", "tatum.transactions", "notify", "handoff"],
    triggers: [{ kind: "chain", addresses: [], objects: [], eventTypes: [] }],
    budgetSuggestion: { monthlyUsd: [0, 0], perPaymentUsd: 0 },
    payees: [],
    starterMemories: [],
    examples: [
      "Ignore incoming transfers under 0.01 SUI",
      "Always ping me for anything over 1 SUI",
    ],
  }),
} as const;

export type TemplateSlug = keyof typeof TEMPLATES;
export const isTemplateSlug = (s: string): s is TemplateSlug => s in TEMPLATES;
