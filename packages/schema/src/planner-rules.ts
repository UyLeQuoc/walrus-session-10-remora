/**
 * A1/A2 (ADR-0136, ADR-0137): what a question looks like, and the rules an owner accepts from what
 * happened. The shape comes from one rule-based classifier for every question, so a rule, a replay
 * and the heartbeat that proposes rules all read a question the same way.
 *
 * A rule can only narrow spending: `skip` drops a planned purchase, `ask` turns it into a question to
 * the owner, `prefer` reorders services that are already planned. None of them adds a purchase, which
 * is why the owner accepts one with a tap instead of a signature.
 */
import { z } from "zod";

export const QUESTION_SHAPES = [
  "address",
  "repo",
  "token",
  "team",
  "city",
  "link",
  "blob",
] as const;
export const QuestionShape = z.enum(QUESTION_SHAPES);
export type QuestionShape = z.infer<typeof QuestionShape>;

/** How each shape reads in a sentence ("unless the question names a team"). */
export const SHAPE_WORDS: Record<QuestionShape, string> = {
  address: "an address or object id",
  repo: "a GitHub repo",
  token: "a token",
  team: "a team",
  city: "a city",
  link: "a link",
  blob: "a Walrus blob",
};

const TOKEN = /\b(SUI|WAL|WALRUS|BTC|BITCOIN|ETH|ETHER|ETHEREUM|USDC|SOL)\b/i;
const GITHUB = /https?:\/\/(?:www\.)?github\.com\/[\w.-]+\/[\w.-]+/i;
/** "Arsenal vs Chelsea", "Hanoi FC v Viettel", "against Real Madrid". */
const TEAM =
  /\b[A-Z][\p{L}.'-]*(?:\s+[A-Z][\p{L}.'-]*){0,2}\s+(?:vs\.?|v\.?|versus|against)\s+[A-Z][\p{L}.'-]*|\b(?:FC|United|City|Rovers|Athletic|Real)\b/u;
const CITY = /\b(?:in|for|at)\s+[A-Z][\p{L}'.-]*/u;
const BLOB = /(?<![\w-])[A-Za-z0-9_-]{43}(?![\w-])/;

/** The shapes a question has, in `QUESTION_SHAPES` order. Deterministic, never a model. */
export function shapesOf(question: string): QuestionShape[] {
  // Words inside a link aren't the question's words: "github.com/…/walrus-docs" names no token.
  const words = question.replace(/https?:\/\/\S+/g, " ");
  const has: Record<QuestionShape, boolean> = {
    address: /0x[0-9a-fA-F]{6,64}/.test(question),
    repo: GITHUB.test(question),
    token: TOKEN.test(words),
    team: TEAM.test(words),
    city: CITY.test(words),
    link: /https?:\/\/\S+/.test(question.replace(GITHUB, "")),
    blob: BLOB.test(words),
  };
  return QUESTION_SHAPES.filter((s) => has[s]);
}

export const PlannerRuleAction = z.enum(["skip", "ask", "prefer"]);
export type PlannerRuleAction = z.infer<typeof PlannerRuleAction>;

export const PlannerRule = z.object({
  id: z.string().min(1).max(64),
  action: PlannerRuleAction,
  /** The Reef service it's about (`reef:odds`). */
  service: z.string().regex(/^reef:[a-z0-9-]+$/),
  /** When it applies: every `has` shape present and no `lacks` shape. Empty: always. */
  when: z
    .object({
      has: z.array(QuestionShape).default([]),
      lacks: z.array(QuestionShape).default([]),
    })
    .default({ has: [], lacks: [] }),
  /** For `prefer`: the service it goes before. */
  over: z
    .string()
    .regex(/^reef:[a-z0-9-]+$/)
    .optional(),
  /** The one line the owner accepted ("skip odds unless the question names a team"). */
  text: z.string().min(1).max(200),
  /** The model's one-line reason, from the cited outcomes. */
  reason: z.string().max(280).default(""),
  /** Walrus blob ids of the outcomes it rests on (2–5). */
  cites: z.array(z.string()).max(5).default([]),
  acceptedAt: z.string(),
  /** The approval it came from. */
  proposalId: z.string().optional(),
  /** The `[rule]` memory written when it was accepted (its index row; the blob lands later). */
  memoryId: z.string().optional(),
});
export type PlannerRule = z.infer<typeof PlannerRule>;

/** Does this rule apply to a question with these shapes? */
export function ruleApplies(
  rule: Pick<PlannerRule, "when">,
  shapes: readonly QuestionShape[],
): boolean {
  const has = rule.when?.has ?? [];
  const lacks = rule.when?.lacks ?? [];
  return has.every((s) => shapes.includes(s)) && !lacks.some((s) => shapes.includes(s));
}

/** "skip odds unless the question names a team" from the structure, never from a model. */
export function ruleText(rule: Pick<PlannerRule, "action" | "service" | "when" | "over">): string {
  const svc = rule.service.replace(/^reef:/, "");
  const verb =
    rule.action === "skip"
      ? `Skip ${svc}`
      : rule.action === "ask"
        ? `Ask before buying ${svc}`
        : `Prefer ${svc}${rule.over ? ` over ${rule.over.replace(/^reef:/, "")}` : ""}`;
  const lacks = rule.when?.lacks ?? [];
  const has = rule.when?.has ?? [];
  const parts = [
    ...(lacks.length
      ? [`unless the question names ${lacks.map((s) => SHAPE_WORDS[s]).join(" or ")}`]
      : []),
    ...(has.length
      ? [`when the question names ${has.map((s) => SHAPE_WORDS[s]).join(" and ")}`]
      : []),
  ];
  return [verb, ...parts].join(" ");
}

/** What a replay planned for one question under one memory. Plans, never purchases. */
export const ReplayPlan = z.object({
  buys: z.array(z.object({ payee: z.string(), amount: z.string() })),
  skips: z.array(
    z.object({
      payee: z.string(),
      reason: z.string(),
      kind: z.enum(["rule", "memory", "reef"]),
      cites: z.array(z.string()).default([]),
      ruleId: z.string().optional(),
    }),
  ),
  /** Admitted memories it read, by blob id. */
  memories: z.array(z.string()),
  /** Planned total in atomic USDC. */
  total: z.string(),
  answer: z.string().default(""),
  /** True when no paid service was planned and it answered from what it remembers. */
  fromMemory: z.boolean(),
});
export type ReplayPlan = z.infer<typeof ReplayPlan>;

export const ReplayColumn = z.enum(["none", "t0", "today"]);
export type ReplayColumn = z.infer<typeof ReplayColumn>;

export const ReplayRun = z.object({
  runId: z.string(),
  remoraId: z.string(),
  status: z.enum(["running", "done", "failed"]),
  startedAt: z.string(),
  finishedAt: z.string().nullable(),
  t0: z.string(),
  questions: z.array(
    z.object({
      question: z.string(),
      shapes: z.array(QuestionShape),
      plans: z.object({ none: ReplayPlan, t0: ReplayPlan, today: ReplayPlan }).partial(),
      /** Each service bought in one column and not in a later one, with what caused it. */
      differences: z.array(
        z.object({
          payee: z.string(),
          from: ReplayColumn,
          to: ReplayColumn,
          reason: z.string(),
          cites: z.array(z.string()),
        }),
      ),
    }),
  ),
  totals: z.object({
    none: z.object({ services: z.number(), spend: z.string(), fromMemory: z.number() }),
    t0: z.object({ services: z.number(), spend: z.string(), fromMemory: z.number() }),
    today: z.object({ services: z.number(), spend: z.string(), fromMemory: z.number() }),
  }),
  tokens: z.number().default(0),
  error: z.string().nullable().default(null),
});
export type ReplayRun = z.infer<typeof ReplayRun>;
