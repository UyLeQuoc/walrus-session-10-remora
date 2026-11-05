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
  // ADR-0125: the fourth kind pays people. Its payees are its owner's contacts, added with one
  // signature each time; it remembers what each is usually paid and asks before an unusual amount.
  errand: Template.parse({
    schema: "remora.template/v1",
    name: "Errand",
    summary: "Pays the people you list, within its limit, and asks before anything unusual.",
    persona:
      "You are the owner's Errand. You pay the owner's contacts when asked, within your limit, with a memo for each payment. You never pay anyone who isn't a contact.",
    tools: ["memory.recall", "memory.remember", "pay", "notify"],
    triggers: [{ kind: "message" }],
    budgetSuggestion: { monthlyUsd: [1, 20], perPaymentUsd: 1 },
    payees: [],
    starterMemories: [],
    examples: ["Pay Linh 2 USDC for lunch", "Send Huy 0.5 USDC for the taxi"],
  }),
  // ADR-0129: the fifth kind pays recurring x402 charges and remembers what each normally costs.
  keeper: Template.parse({
    schema: "remora.template/v1",
    name: "Subscriptions keeper",
    summary: "Pays your recurring paid feeds, remembers their usual price, and stops on a hike.",
    persona:
      "You are the owner's Subscriptions keeper. You pay the owner's recurring paid services at their usual price, and you never pay a price hike without asking.",
    tools: ["memory.recall", "memory.remember", "pay", "notify", "schedule"],
    triggers: [{ kind: "cron", cron: "0 1 * * *", human: "every day at 8am" }],
    budgetSuggestion: { monthlyUsd: [1, 10], perPaymentUsd: 0.05 },
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
    examples: ["The SUI price every morning", "A paid feed you listed in the Reef"],
  }),
  // C3 (ADR-0148): the sixth kind watches a team's wallets and prepares payments only the owner
  // signs. No Disc: a request, even the owner's, becomes an approval paid from the owner's wallet.
  treasurer: Template.parse({
    schema: "remora.template/v1",
    name: "Treasurer",
    summary:
      "Watches your team's wallets, reports what came in, went out and how long it lasts, and turns requests into payments only you sign.",
    persona:
      "You are the owner's Treasurer. You watch the team's addresses, report what came in and went out and the runway at the current burn, and turn spend requests into approvals the owner pays from their own wallet. You never pay anything yourself.",
    tools: ["memory.recall", "memory.remember", "tatum.balances", "notify"],
    triggers: [
      { kind: "chain", addresses: [], objects: [], eventTypes: [] },
      { kind: "message" },
      { kind: "cron", cron: "0 9 * * 1", human: "a report every Monday at 9am" },
    ],
    budgetSuggestion: { monthlyUsd: [0, 0], perPaymentUsd: 0 },
    payees: [],
    starterMemories: [],
    examples: ["pay 0.30 to huy.sui for design", "Report now"],
  }),
} as const;

export type TemplateSlug = keyof typeof TEMPLATES;
/** Kinds that answer questions and pay for data: the Researcher, and the Briefer (ADR-0106). */
export const answersQuestions = (template: string) =>
  template === "scout" || template === "briefer";
export const isTemplateSlug = (s: string): s is TemplateSlug => s in TEMPLATES;
