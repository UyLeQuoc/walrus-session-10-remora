/** A1/A2 (ADR-0136, ADR-0137): the replay bench and rule proposals, as the server serves them. */
import { PlannerRule, ReplayRun } from "@remora/schema";
import { z } from "zod";
import { call } from "@/features/remoras/api";

export const ReplayHome = z.object({
  questions: z.array(z.object({ question: z.string(), at: z.string() })),
  runs: z.array(
    z.object({
      runId: z.string(),
      status: z.enum(["running", "done", "failed"]),
      startedAt: z.string(),
      t0: z.string(),
      questions: z.number(),
      totals: ReplayRun.shape.totals.optional(),
    }),
  ),
  defaultT0: z.string(),
});
export type ReplayHome = z.infer<typeof ReplayHome>;

export const RuleProposal = z.object({
  id: z.string(),
  createdAt: z.string(),
  kind: z.literal("planner_rule"),
  rule: z.object({
    action: z.enum(["skip", "ask", "prefer"]),
    service: z.string(),
    text: z.string(),
  }),
  reason: z.string(),
  cites: z.array(z.object({ blobId: z.string(), label: z.string(), at: z.string() })),
  count: z.number(),
  since: z.string(),
  evidence: z.enum(["noise", "declined"]),
});
export type RuleProposal = z.infer<typeof RuleProposal>;

export const RulesView = z.object({
  rules: z.array(PlannerRule),
  proposal: RuleProposal.nullable(),
  skipped: z.string().optional(),
});
export type RulesView = z.infer<typeof RulesView>;

export const replayApi = {
  home: (id: string) => call("GET", `/api/remoras/${id}/replay`, ReplayHome),
  start: (id: string, questions: string[], t0?: string) =>
    call("POST", `/api/remoras/${id}/replay`, z.object({ runId: z.string() }), {
      questions,
      ...(t0 ? { t0 } : {}),
    }),
  run: (id: string, runId: string) => call("GET", `/api/remoras/${id}/replay/${runId}`, ReplayRun),
  rules: (id: string) => call("GET", `/api/remoras/${id}/planner-rules`, RulesView),
  checkRules: (id: string) => call("POST", `/api/remoras/${id}/planner-rules/check`, RulesView),
  removeRule: (id: string, ruleId: string) =>
    call(
      "POST",
      `/api/remoras/${id}/planner-rules/${encodeURIComponent(ruleId)}/remove`,
      RulesView,
    ),
  accept: (approvalId: string) =>
    call("POST", `/api/approvals/${approvalId}/rule-accept`, z.object({ rule: PlannerRule })),
  decline: (approvalId: string) =>
    call("POST", `/api/approvals/${approvalId}/rule-decline`, z.object({ declined: z.boolean() })),
};
