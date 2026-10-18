/**
 * The W2 API (ADR-0032) as typed calls. Every response is parsed with its `packages/schema` contract
 * (ADR-0033), so a server change that breaks a shape shows as an error here, not a blank page.
 * Errors come back as the server's human sentence (N6).
 */
import {
  ApprovalPayTx,
  ApprovalRequest,
  BudgetMeter,
  CreateRemoraResponse,
  FeedItem,
  InspectorResponse,
  OwnerSettings,
  RemoraView,
  SchedulePreview,
  Template,
  VerifyResult,
  WhyResponse,
} from "@remora/schema";
import { z } from "zod";
import { apiFetch, errorMessage } from "@/lib/api";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(
  method: string,
  path: string,
  schema: z.ZodType<T>,
  body?: unknown,
): Promise<Result<T>> {
  try {
    const res = await apiFetch(path, {
      method,
      ...(body === undefined
        ? {}
        : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });
    if (!res.ok) return { ok: false, error: await errorMessage(res, "Something went wrong.") };
    const parsed = schema.safeParse(await res.json().catch(() => null));
    return parsed.success
      ? { ok: true, data: parsed.data }
      : { ok: false, error: "The server answered in a shape this page doesn't know." };
  } catch {
    return { ok: false, error: "Can't reach the server." };
  }
}

const Ok = z.object({ ok: z.literal(true) });
const Tx = z.object({ transaction: z.string().nullable() });
const Remora = z.object({ remora: RemoraView });

export const api = {
  templates: () =>
    call("GET", "/api/templates", z.object({ templates: z.record(z.string(), Template) })),
  remoras: () => call("GET", "/api/remoras", z.object({ remoras: z.array(RemoraView) })),
  remora: (id: string) => call("GET", `/api/remoras/${id}`, Remora),
  create: (b: { template: string; name?: string; budget?: unknown; watch?: string[] }) =>
    call("POST", "/api/remoras", CreateRemoraResponse, b),
  confirm: (id: string, digest: string) =>
    call("POST", `/api/remoras/${id}/confirm`, Remora, { digest }),
  edit: (id: string, b: { name?: string; persona?: string; watch?: string[] }) =>
    call("PATCH", `/api/remoras/${id}`, Remora, b),
  activate: (id: string) => call("POST", `/api/remoras/${id}/activate`, Remora),
  pause: (id: string, paused: boolean) =>
    call(
      "POST",
      `/api/remoras/${id}/pause`,
      z.object({ transaction: z.string().nullable(), remora: RemoraView.optional() }),
      { paused },
    ),
  pauseConfirm: (id: string) => call("POST", `/api/remoras/${id}/pause/confirm`, Remora),
  retire: (id: string) => call("POST", `/api/remoras/${id}/retire`, Tx),
  retireConfirm: (id: string, digest?: string) =>
    call("POST", `/api/remoras/${id}/retire/confirm`, Remora, digest ? { digest } : {}),
  budget: (id: string) =>
    call("GET", `/api/remoras/${id}/budget`, z.object({ meter: BudgetMeter.nullable() })),
  budgetTx: (id: string, budget: unknown) =>
    call("POST", `/api/remoras/${id}/budget`, Tx, { budget }),
  budgetConfirm: (id: string, digest: string, budget: unknown) =>
    call("POST", `/api/remoras/${id}/budget/confirm`, Remora, { digest, budget }),
  rotate: (id: string) =>
    call(
      "POST",
      `/api/remoras/${id}/rotate`,
      z.object({ transaction: z.string(), keyId: z.string(), newSpender: z.string() }),
    ),
  rotateConfirm: (id: string, digest: string, keyId: string) =>
    call("POST", `/api/remoras/${id}/rotate/confirm`, Remora, { digest, keyId }),
  ask: (id: string, question: string) =>
    call(
      "POST",
      `/api/remoras/${id}/ask`,
      z
        .object({ answer: z.string(), eventId: z.string(), receiptId: z.string().nullable() })
        .loose(),
      { question },
    ),
  teach: (id: string, text: string) =>
    call("POST", `/api/remoras/${id}/teach`, z.object({ text: z.string() }).loose(), { text }),
  rules: (id: string) =>
    call(
      "GET",
      `/api/remoras/${id}/rules`,
      z.object({
        rules: z.array(
          z.object({ id: z.string(), text: z.string(), createdAt: z.string() }).loose(),
        ),
      }),
    ),
  deleteRule: (id: string, ruleId: string) =>
    call("DELETE", `/api/remoras/${id}/rules/${ruleId}`, Ok),
  sources: (id: string) =>
    call(
      "GET",
      `/api/remoras/${id}/sources`,
      z.object({
        sources: z.array(
          z
            .object({
              payee: z.string(),
              calls: z.number(),
              useful: z.number(),
              noise: z.number(),
              spent: z.string(),
            })
            .loose(),
        ),
      }),
    ),
  schedulePreview: (text: string) =>
    call("POST", "/api/schedule/preview", SchedulePreview, { text }),
  addSchedule: (id: string, when: string, question: string) =>
    call("POST", `/api/remoras/${id}/schedules`, z.object({ next: z.array(z.string()) }).loose(), {
      when,
      question,
    }),
  schedules: (id: string) =>
    call(
      "GET",
      `/api/remoras/${id}/schedules`,
      z.object({
        schedules: z.array(
          z.object({ id: z.string(), cron: z.string(), human: z.string(), question: z.string() }),
        ),
      }),
    ),
  removeSchedule: (id: string, scheduleId: string) =>
    call("DELETE", `/api/remoras/${id}/schedules/${scheduleId}`, Ok),
  feed: (o: { remora?: string; type?: string; before?: string } = {}) => {
    const q = new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]);
    return call(
      "GET",
      `/api/feed${q.size ? `?${q}` : ""}`,
      z.object({ events: z.array(FeedItem) }),
    );
  },
  why: (eventId: string) => call("GET", `/api/events/${eventId}/why`, WhyResponse),
  feedback: (eventId: string, verdict: "useful" | "noise") =>
    call("POST", `/api/events/${eventId}/feedback`, z.object({ learned: z.string() }), { verdict }),
  approvals: (status = "pending") =>
    call(
      "GET",
      `/api/approvals?status=${status}`,
      z.object({ approvals: z.array(ApprovalRequest.loose()) }),
    ),
  approvalPayTx: (id: string) => call("POST", `/api/approvals/${id}/pay-tx`, ApprovalPayTx),
  approvalPay: (id: string, signed: { transaction: string; signature: string }) =>
    call(
      "POST",
      `/api/approvals/${id}/pay`,
      z.object({ answer: z.string(), digest: z.string().nullable(), eventId: z.string() }),
      signed,
    ),
  approve: (id: string) => call("POST", `/api/approvals/${id}/approve`, z.object({}).loose()),
  reject: (id: string) => call("POST", `/api/approvals/${id}/reject`, Ok),
  panic: () =>
    call("POST", "/api/panic", z.object({ transaction: z.string().nullable(), discs: z.number() })),
  panicConfirm: (digest?: string) =>
    call(
      "POST",
      "/api/panic/confirm",
      z.object({ paused: z.array(z.string()) }),
      digest ? { digest } : {},
    ),
  verify: (ref: string) => call("GET", `/api/verify/${encodeURIComponent(ref)}`, VerifyResult),
  memory: (id: string, q?: string) =>
    call(
      "GET",
      `/api/remoras/${id}/memory${q ? `?q=${encodeURIComponent(q)}` : ""}`,
      InspectorResponse,
    ),
  settings: () => call("GET", "/api/settings", z.object({ settings: OwnerSettings })),
  saveSettings: (s: Partial<OwnerSettings>) =>
    call("PUT", "/api/settings", z.object({ settings: OwnerSettings }), s),
  telegramLink: () =>
    call(
      "POST",
      "/api/telegram/link",
      z.object({ code: z.string(), url: z.string().nullable(), expiresInMinutes: z.number() }),
    ),
};
