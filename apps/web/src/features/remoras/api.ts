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
  HatchConsent,
  HatcheryListing,
  InspectorResponse,
  LearningSeries,
  OwnerSettings,
  ProofOfLearning,
  RemoraView,
  Room,
  RoomMessage,
  type RoomResponder,
  SafetyReport,
  Schedule,
  SchedulePreview,
  ShareReview,
  TeamPreview,
  Template,
  VerifyResult,
  WhyResponse,
} from "@remora/schema";
import { z } from "zod";
import { apiFetch, errorMessage } from "@/lib/api";
import { CostResponse } from "./cost";

export type Result<T> = { ok: true; data: T } | { ok: false; error: string };

export async function call<T>(
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

/** ADR-0106: what a Briefer's page shows (`GET /api/remoras/:id/brief`). */
export const BriefView = z.object({
  items: z.array(z.string()),
  schedule: z
    .object({
      id: z.string(),
      human: z.string(),
      paused: z.boolean(),
      next: z.string().nullable(),
    })
    .nullable(),
  last: z
    .object({
      eventId: z.string(),
      at: z.string(),
      answer: z.string(),
      paid: z.array(
        z.object({ payee: z.string(), amount: z.string(), digest: z.string().nullable() }),
      ),
    })
    .nullable(),
});
export type BriefView = z.infer<typeof BriefView>;

/** ADR-0111: a remora's answers on sale, and what it has sold. */
export const SaleView = z.object({
  sale: z
    .object({ on: z.boolean(), slug: z.string(), price: z.string(), blurb: z.string() })
    .nullable(),
  listed: z.boolean(),
  ref: z.string().nullable(),
  url: z.string().nullable(),
  path: z.string().nullable(),
  sold: z.array(
    z.object({
      at: z.string(),
      buyer: z.string(),
      amount: z.string(),
      digest: z.string().nullable(),
    }),
  ),
  earned: z.string(),
});
export type SaleView = z.infer<typeof SaleView>;

/** ADR-0114: a crew, its members and what each spent this month. */
export const CrewView = z.object({
  crew: z.object({ id: z.string(), name: z.string(), leadId: z.string() }),
  members: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      template: z.string(),
      status: z.string(),
      lead: z.boolean(),
      covers: z.array(z.string()),
      limit: z.string().nullable(),
      perPayment: z.string().nullable(),
      spent: z.string(),
      payments: z.number(),
    }),
  ),
  limit: z.string(),
  spent: z.string(),
});
export type CrewView = z.infer<typeof CrewView>;

const Ok = z.object({ ok: z.literal(true) });
const Tx = z.object({ transaction: z.string().nullable() });
const Remora = z.object({ remora: RemoraView });

export const api = {
  templates: () =>
    call("GET", "/api/templates", z.object({ templates: z.record(z.string(), Template) })),
  remoras: () => call("GET", "/api/remoras", z.object({ remoras: z.array(RemoraView) })),
  remora: (id: string) => call("GET", `/api/remoras/${id}`, Remora),
  create: (b: {
    template: string;
    name?: string;
    budget?: unknown;
    watch?: string[];
    items?: string[];
  }) => call("POST", "/api/remoras", CreateRemoraResponse, b),
  brief: (id: string) => call("GET", `/api/remoras/${id}/brief`, BriefView),
  setBriefItems: (id: string, items: string[]) =>
    call("PUT", `/api/remoras/${id}/brief/items`, BriefView, { items }),
  runBrief: (id: string) =>
    call(
      "POST",
      `/api/remoras/${id}/brief/run`,
      z.object({ answer: z.string(), eventId: z.string() }).loose(),
    ),
  crew: (id: string) => call("GET", `/api/remoras/${id}/crew`, CrewView),
  pauseCrew: (id: string, paused: boolean) =>
    call("POST", `/api/remoras/${id}/crew/pause`, CrewView, { paused }),
  retireCrewTx: (id: string) => call("POST", `/api/remoras/${id}/crew/retire`, Tx),
  retireCrewConfirm: (id: string, digest: string) =>
    call(
      "POST",
      `/api/remoras/${id}/crew/retire/confirm`,
      z.object({ retired: z.array(z.string()) }),
      { digest },
    ),
  sale: (id: string) => call("GET", `/api/remoras/${id}/sell`, SaleView),
  setSale: (id: string, b: { on?: boolean; slug?: string; price?: string; blurb?: string }) =>
    call("PUT", `/api/remoras/${id}/sell`, SaleView, b),
  payeesTx: (id: string, payees: string[]) =>
    call("POST", `/api/remoras/${id}/payees`, Tx, { payees }),
  payeesConfirm: (id: string, digest: string, payees: string[]) =>
    call("POST", `/api/remoras/${id}/payees/confirm`, Remora, { digest, payees }),
  confirm: (id: string, digest: string) =>
    call("POST", `/api/remoras/${id}/confirm`, Remora, { digest }),
  edit: (
    id: string,
    b: { name?: string; persona?: string; watch?: string[]; model?: string | null },
  ) => call("PATCH", `/api/remoras/${id}`, Remora, b),
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
  cost: (id: string, month: string) =>
    call("GET", `/api/remoras/${id}/cost?month=${encodeURIComponent(month)}`, CostResponse),
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
    call("GET", `/api/remoras/${id}/schedules`, z.object({ schedules: z.array(Schedule) })),
  removeSchedule: (id: string, scheduleId: string) =>
    call("DELETE", `/api/remoras/${id}/schedules/${scheduleId}`, Ok),
  feed: (
    o: {
      remora?: string;
      type?: string;
      before?: string;
      after?: string;
      order?: "asc";
      limit?: string;
    } = {},
  ) => {
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
  // ── U6 (ADR-0042): 1-1 threads, rooms, teams, paused schedules ─────────────
  message: (id: string, text: string) =>
    call(
      "POST",
      `/api/remoras/${id}/messages`,
      z.object({ messageId: z.string(), eventIds: z.array(z.string()) }),
      { text },
    ),
  pauseSchedule: (id: string, scheduleId: string, paused: boolean) =>
    call(
      "POST",
      `/api/remoras/${id}/schedules/${scheduleId}/${paused ? "pause" : "resume"}`,
      z.object({ schedule: Schedule }),
    ),
  rooms: () => call("GET", "/api/rooms", z.object({ rooms: z.array(Room) })),
  createRoom: (b: {
    name: string;
    memberIds: string[];
    responder?: RoomResponder;
    leadId?: string | null;
  }) => call("POST", "/api/rooms", z.object({ room: Room }), b),
  editRoom: (
    id: string,
    b: { name?: string; responder?: RoomResponder; leadId?: string | null; memberIds?: string[] },
  ) => call("PATCH", `/api/rooms/${id}`, z.object({ room: Room }), b),
  roomMessages: (id: string, after?: string) =>
    call(
      "GET",
      `/api/rooms/${id}/messages${after ? `?after=${encodeURIComponent(after)}` : ""}`,
      z.object({ messages: z.array(RoomMessage) }),
    ),
  postToRoom: (id: string, text: string) =>
    call(
      "POST",
      `/api/rooms/${id}/messages`,
      z.object({
        messageId: z.string(),
        routedTo: z.array(z.string()),
        route: z.string(),
        replies: z.array(z.string()),
      }),
      { text },
    ),
  teamPreview: (markdown: string) => call("POST", "/api/teams/preview", TeamPreview, { markdown }),
  teamApply: (markdown: string) =>
    call(
      "POST",
      "/api/teams/apply",
      z.object({
        remoras: z.array(z.string()),
        transaction: z.string().nullable(),
        roomId: z.string(),
        skipped: z.array(z.string()),
      }),
      { markdown },
    ),
  teamConfirm: (digest: string, remoraIds: string[]) =>
    call("POST", "/api/teams/confirm", z.object({ confirmed: z.array(z.string()) }), {
      digest,
      remoraIds,
    }),
  // ── U7 (ADR-0046, ADR-0048): Hatchery, Proof of Learning, learning, memory controls ──
  share: (id: string) =>
    call("POST", `/api/remoras/${id}/share`, z.object({ review: ShareReview })),
  publishTx: (markdown: string, parent?: string | null) =>
    call(
      "POST",
      "/api/hatchery/publish",
      z.object({ transaction: z.string(), blobId: z.string(), safety: SafetyReport }),
      { markdown, ...(parent ? { parent } : {}) },
    ),
  publishConfirm: (digest: string) =>
    call("POST", "/api/hatchery/publish/confirm", HatcheryWithLinks, { digest }),
  hatchery: (o: { q?: string; kind?: string } = {}) => {
    const q = new URLSearchParams(Object.entries(o).filter(([, v]) => v) as [string, string][]);
    return call(
      "GET",
      `/api/hatchery${q.size ? `?${q}` : ""}`,
      z.object({ templates: z.array(HatcheryListing) }),
    );
  },
  template: (id: string) =>
    call(
      "GET",
      `/api/hatchery/${id}`,
      HatcheryWithLinks.extend({ markdown: z.string().nullable() }),
    ),
  consent: (id: string) =>
    call("GET", `/api/hatchery/${id}/consent`, z.object({ consent: HatchConsent })),
  hatchTx: (id: string) =>
    call(
      "POST",
      `/api/hatchery/${id}/hatch`,
      z.object({
        transaction: z.string(),
        remoras: z.array(z.string()),
        roomId: z.string(),
        skipped: z.array(z.string()),
      }),
    ),
  hatchConfirm: (id: string, digest: string, remoraIds: string[]) =>
    call(
      "POST",
      `/api/hatchery/${id}/hatch/confirm`,
      z.object({ confirmed: z.array(z.string()), remoras: z.array(z.string()) }).loose(),
      { digest, remoraIds },
    ),
  deprecateTx: (id: string) =>
    call("POST", `/api/hatchery/${id}/deprecate`, z.object({ transaction: z.string() })),
  deprecateConfirm: (id: string, digest: string) =>
    call("POST", `/api/hatchery/${id}/deprecate/confirm`, z.object({ listing: HatcheryListing }), {
      digest,
    }),
  proofs: (id: string) =>
    call("GET", `/api/remoras/${id}/proofs`, z.object({ proofs: z.array(ProofOfLearning) })),
  learning: (id: string) =>
    call("GET", `/api/remoras/${id}/learning`, z.object({ series: z.array(LearningSeries) })),
  hideMemory: (id: string, b: { blobId: string; namespace: string; hidden: boolean }) =>
    call(
      "POST",
      `/api/remoras/${id}/memory/hide`,
      z.object({ blobId: z.string(), hidden: z.boolean() }),
      b,
    ),
  correctMemory: (id: string, b: { blobId: string; namespace: string; text: string }) =>
    call(
      "POST",
      `/api/remoras/${id}/memory/correct`,
      z.object({ corrects: z.string(), saved: z.boolean(), note: z.string() }),
      b,
    ),
  forgetMemory: (id: string, namespace: string) =>
    call(
      "POST",
      `/api/remoras/${id}/memory/forget`,
      z.object({ namespace: z.string(), note: z.string() }),
      { namespace },
    ),
};

const HatcheryWithLinks = z.object({
  listing: HatcheryListing,
  links: z.object({ url: z.string(), telegram: z.string().nullable() }),
});

/** A file download from the API (memory export, learning export). */
export async function download(path: string, fallback: string): Promise<Result<Blob>> {
  try {
    const res = await apiFetch(path);
    if (!res.ok) return { ok: false, error: await errorMessage(res, fallback) };
    return { ok: true, data: await res.blob() };
  } catch {
    return { ok: false, error: "Can't reach the server." };
  }
}

/** `GET /api/teams/export` is a Markdown file, not JSON. */
export async function exportTeam(): Promise<Result<string>> {
  try {
    const res = await apiFetch("/api/teams/export");
    if (!res.ok) return { ok: false, error: await errorMessage(res, "Couldn't export the team.") };
    return { ok: true, data: await res.text() };
  } catch {
    return { ok: false, error: "Can't reach the server." };
  }
}
