/**
 * C1/C2: the MVP templates (spec §4). The slugs stay `scout` and `sentinel`; people read the names,
 * "Researcher" and "Wallet watcher" (ADR-0101). Templates carry no keys, memories or raw payee addresses
 * (ADR-0012); payees are Reef references resolved per network at creation.
 */
import { Template } from "@remora/schema";

export const TEMPLATES = {
  scout: Template.parse({
    schema: "remora.template/v1",
    name: "Researcher",
    summary: "Answers questions by buying the best data, and learns which sources are worth it.",
    persona:
      "You are the owner's Researcher. You answer the owner's questions by buying data from paid sources when it helps, and you say what each answer cost.",
    tools: ["memory.recall", "memory.remember", "pay", "notify", "handoff"],
    triggers: [{ kind: "message" }],
    budgetSuggestion: { monthlyUsd: [1, 20], perPaymentUsd: 0.05 },
    payees: [
      "reef:sui-risk",
      "reef:odds",
      "reef:brief",
      "reef:wallet",
      "reef:walrus",
      "reef:github",
      "reef:price",
      "reef:weather",
    ],
    starterMemories: [],
    examples: ["Is package 0x2 safe to depend on?", "What are the odds for tonight's match?"],
  }),
  sentinel: Template.parse({
    schema: "remora.template/v1",
    name: "Wallet watcher",
    summary:
      "Watches your wallets and only wakes you for what matters, learning from what you say.",
    persona:
      "You are the owner's Wallet watcher. You watch the owner's addresses and decide whether an event is worth a ping, following the rules the owner taught you.",
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
  // ADR-0106: the third kind. It answers like a Researcher, but on a schedule, about a list its owner
  // keeps (runtime/briefer.ts), and posts one brief with a receipt for each thing it bought.
  briefer: Template.parse({
    schema: "remora.template/v1",
    name: "Briefer",
    summary: "Every weekday morning, buys what you follow and sends one brief, a receipt for each.",
    persona:
      "You are the owner's Briefer. Each morning you get fresh data you bought for the owner's list. Write one short brief: one line per item with the number that matters, then what the brief cost in total. No advice.",
    tools: ["memory.recall", "memory.remember", "pay", "notify"],
    triggers: [{ kind: "cron", cron: "0 1 * * 1-5", human: "weekdays at 8am" }],
    budgetSuggestion: { monthlyUsd: [1, 5], perPaymentUsd: 0.015 },
    payees: [
      "reef:sui-risk",
      "reef:odds",
      "reef:brief",
      "reef:wallet",
      "reef:walrus",
      "reef:github",
      "reef:price",
      "reef:weather",
    ],
    starterMemories: [],
    examples: ["SUI and WAL prices", "weather in Hanoi", "github.com/MystenLabs/sui"],
  }),
} as const;

export type TemplateSlug = keyof typeof TEMPLATES;
/** Kinds that answer questions and pay for data: the Researcher, and the Briefer (ADR-0106). */
export const answersQuestions = (template: string) =>
  template === "scout" || template === "briefer";
export const isTemplateSlug = (s: string): s is TemplateSlug => s in TEMPLATES;
