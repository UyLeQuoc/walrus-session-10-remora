/**
 * J3 outbound webhooks (ADR-0121). The owner lists URLs per remora (`config.hooks.out`) with the
 * events each wants. A scanner reads what the runtime already records (payments and answers in
 * `remora_events`, `approvals` rows) every few seconds and queues one D2 job per delivery, so every
 * writer of those rows is covered without calling anything; `emitHook` is there for anything else.
 * - **Body:** `{ id, type, remoraId, createdAt, data }`.
 * - **Signature:** `Remora-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<body>")>`, with a
 *   secret derived per remora. Receivers reject a `t` more than 5 minutes off (`verifyHookSignature`).
 * - **Delivery:** https only (http to localhost when not in production), every resolved address
 *   public, no redirects, 5 s. A failure throws, so the jobs queue backs off and dead-letters it.
 * - **Log:** the last 20 attempts in `config.hookLog`.
 */
import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { and, approvals, asc, gt, inArray, remoraEvents, remoras, sql } from "@remora/db";
import { isPrivateAddress } from "@remora/merchant";
import type { HookEvent, OutHook } from "@remora/schema";
import { payeeLabel } from "../money/reef.ts";
import type { RuntimeDeps } from "./deps.ts";
import { enqueue } from "./jobs.ts";
import type { Remora } from "./remoras.ts";

export const DELIVER_JOB = "remora.hook_deliver";
export const HOOK_TOLERANCE_S = 300;
export const OUT_HOOKS_MAX = 5;
export const HOOK_LOG_MAX = 20;
const TIMEOUT_MS = 5_000;
const ATTEMPTS = 8;

export interface HookDeps {
  rt: Pick<RuntimeDeps, "db" | "log" | "webBase">;
  /** The server secret every hook secret is derived from. */
  secret: string;
  /** Production sends over https to public addresses only. */
  production: boolean;
  fetch?: typeof fetch;
  resolve?: (host: string) => Promise<string[]>;
}

export interface HookEnvelope {
  id: string;
  type: HookEvent | "test";
  remoraId: string;
  createdAt: string;
  data: Record<string, unknown>;
}

export interface DeliveryLog {
  id: string;
  hookId: string;
  type: string;
  status: "ok" | "failed" | "refused";
  code: number | null;
  ms: number;
  at: string;
  attempt: number;
  error?: string;
}

type HookConfig = { hooks?: { out?: OutHook[]; key?: string }; hookLog?: DeliveryLog[] };

export const outHooksOf = (r: Pick<Remora, "config">): OutHook[] =>
  (r.config as HookConfig).hooks?.out ?? [];
export const hookLogOf = (r: Pick<Remora, "config">): DeliveryLog[] =>
  (r.config as HookConfig).hookLog ?? [];

/** Sets one top-level config key in place, so a concurrent write to another key isn't lost. */
export async function setConfigKey(
  db: RuntimeDeps["db"],
  remoraId: string,
  key: string,
  value: unknown,
  o: { touch?: boolean } = {},
) {
  await db
    .update(remoras)
    .set({
      config: sql`jsonb_set(${remoras.config}, array[${key}]::text[], ${JSON.stringify(value)}::jsonb)`,
      ...(o.touch ? { updatedAt: new Date() } : {}),
    })
    .where(sql`${remoras.id} = ${remoraId}`);
}

export function outboundSecret(serverSecret: string, remoraId: string, key = "0"): string {
  return createHmac("sha256", serverSecret)
    .update(`remora.hook.out:${remoraId}:${key}`)
    .digest("hex");
}

export const hookSecretOf = (h: Pick<HookDeps, "secret">, r: Pick<Remora, "id" | "config">) =>
  outboundSecret(h.secret, r.id, (r.config as HookConfig).hooks?.key);

const mac = (secret: string, t: number, body: string) =>
  createHmac("sha256", secret).update(`${t}.${body}`).digest("hex");

export function signatureHeader(secret: string, body: string, t: number): string {
  return `t=${t},v1=${mac(secret, t, body)}`;
}

/** What a receiver runs: the header's MAC over `t.body`, and `t` within 5 minutes of now. */
export function verifyHookSignature(
  secret: string,
  body: string,
  header: string | null | undefined,
  nowS = Math.floor(Date.now() / 1000),
): boolean {
  const parts = Object.fromEntries(
    (header ?? "").split(",").map((p) => p.trim().split("=", 2) as [string, string]),
  );
  const t = Number(parts.t);
  if (!Number.isInteger(t) || Math.abs(nowS - t) > HOOK_TOLERANCE_S) return false;
  const got = Buffer.from(String(parts.v1 ?? ""), "hex");
  const want = Buffer.from(mac(secret, t, body), "hex");
  return got.length === want.length && timingSafeEqual(got, want);
}

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Why a URL can't receive hooks, or null. Checked when it's added and again before every send. */
export async function targetProblem(
  url: string,
  o: Pick<HookDeps, "production" | "resolve">,
): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return "That isn't a URL.";
  }
  if (u.username || u.password) return "Leave credentials out of the URL.";
  const host = u.hostname.replace(/^\[|\]$/g, "");
  if (!o.production && (LOCAL_HOSTS.has(host) || host.endsWith(".localhost")))
    return u.protocol === "http:" || u.protocol === "https:" ? null : "Use an http(s) URL.";
  if (u.protocol !== "https:")
    return o.production
      ? "Hooks are sent over https only."
      : "Hooks are sent over https (http only to localhost).";
  const resolve =
    o.resolve ?? (async (h: string) => (await lookup(h, { all: true })).map((a) => a.address));
  // DNS can still change between this lookup and the send (as in safe-fetch, ADR-0031).
  const addresses = isIP(host) ? [host] : await resolve(host).catch(() => []);
  if (!addresses.length) return "That host doesn't resolve.";
  if (addresses.some(isPrivateAddress)) return "Hooks go to public addresses only.";
  return null;
}

/** Appends one attempt to the remora's log, keeping the newest `HOOK_LOG_MAX`, in one statement. */
async function logDelivery(db: RuntimeDeps["db"], remoraId: string, entry: DeliveryLog) {
  await db
    .update(remoras)
    .set({
      config: sql`jsonb_set(${remoras.config}, '{hookLog}', (
        select coalesce(jsonb_agg(x.e order by x.n), '[]'::jsonb) from (
          select e, n from jsonb_array_elements(
            case when jsonb_typeof(${remoras.config}->'hookLog') = 'array'
              then ${remoras.config}->'hookLog' else '[]'::jsonb end || ${JSON.stringify([entry])}::jsonb
          ) with ordinality as a(e, n)
          order by n desc limit ${HOOK_LOG_MAX}
        ) x
      ))`,
    })
    .where(sql`${remoras.id} = ${remoraId}`);
}

/** One attempt at one URL, logged. Never throws; the caller decides whether a failure retries. */
export async function deliver(
  h: HookDeps,
  r: Pick<Remora, "id" | "config">,
  hook: OutHook,
  envelope: HookEnvelope,
  attempt = 1,
): Promise<DeliveryLog> {
  const started = Date.now();
  const base = { id: envelope.id, hookId: hook.id, type: envelope.type, attempt };
  const problem = await targetProblem(hook.url, h);
  let entry: DeliveryLog;
  if (problem) {
    entry = {
      ...base,
      status: "refused",
      code: null,
      ms: 0,
      at: new Date().toISOString(),
      error: problem,
    };
  } else {
    const body = JSON.stringify(envelope);
    const t = Math.floor(Date.now() / 1000);
    try {
      const res = await (h.fetch ?? fetch)(hook.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "Remora-Hooks/1",
          "remora-event": envelope.type,
          "remora-delivery": envelope.id,
          "remora-signature": signatureHeader(hookSecretOf(h, r), body, t),
        },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      await res.body?.cancel().catch(() => undefined);
      entry = {
        ...base,
        status: res.status >= 200 && res.status < 300 ? "ok" : "failed",
        code: res.status,
        ms: Date.now() - started,
        at: new Date().toISOString(),
      };
    } catch (err) {
      entry = {
        ...base,
        status: "failed",
        code: null,
        ms: Date.now() - started,
        at: new Date().toISOString(),
        error: (err as Error).name === "TimeoutError" ? "timed out after 5 s" : "unreachable",
      };
    }
  }
  await logDelivery(h.rt.db, r.id, entry);
  return entry;
}

/**
 * Queues `type` for every URL of this remora that asked for it; returns how many. Anyone can call it;
 * the scanner already calls it for payments, answers, approvals, proposals and price hikes. The same
 * `id` (a row's id) is delivered once per URL however often it's emitted.
 */
export async function emitHook(
  deps: Pick<RuntimeDeps, "db">,
  r: Pick<Remora, "id" | "config">,
  type: HookEvent,
  data: Record<string, unknown>,
  o: { id?: string; at?: Date } = {},
): Promise<number> {
  const envelope: HookEnvelope = {
    id: o.id ?? randomUUID(),
    type,
    remoraId: r.id,
    createdAt: (o.at ?? new Date()).toISOString(),
    data,
  };
  const targets = outHooksOf(r).filter((x) => x.events.includes(type));
  for (const hook of targets)
    await enqueue(deps.db, {
      kind: DELIVER_JOB,
      payload: { remoraId: r.id, hookId: hook.id, envelope },
      idempotencyKey: `hook:${hook.id}:${envelope.id}`,
      maxAttempts: ATTEMPTS,
    });
  return targets.length;
}

type EventRow = typeof remoraEvents.$inferSelect;
type ApprovalRow = typeof approvals.$inferSelect;

const str = (v: unknown) => (typeof v === "string" ? v : null);

/** A feed row as a hook event, or null when no hook event describes it. */
export function hookEventOf(
  row: Pick<EventRow, "id" | "type" | "summary" | "payload" | "network" | "remoraId">,
  webBase: string,
): { type: HookEvent; data: Record<string, unknown> } | null {
  const p = row.payload;
  const why = `${webBase}/remoras/${row.remoraId}?event=${row.id}`;
  switch (row.type) {
    case "payment": {
      const digest = str(p.digest);
      if (!digest) return null;
      const payee = str(p.payee) ?? "";
      return {
        type: "payment.settled",
        data: {
          eventId: row.id,
          payee,
          label: payeeLabel(payee),
          amount: str(p.amount) ?? "0",
          digest,
          network: row.network,
          why,
        },
      };
    }
    case "answer": {
      const answer = str(p.answer);
      if (!answer) return null;
      return {
        type: "answer.ready",
        data: {
          eventId: row.id,
          question: (str(p.question) ?? row.summary).slice(0, 1_000),
          answer: answer.slice(0, 4_000),
          digests: Array.isArray(p.digests) ? p.digests.filter((d) => typeof d === "string") : [],
          why,
        },
      };
    }
    case "price_hike":
    case "price.hike":
      return {
        type: "price.hike",
        data: { eventId: row.id, summary: row.summary, details: p, why },
      };
    default:
      return null;
  }
}

/** An approval as a hook event: a budget proposal (A1) is `proposal.made`, the rest `approval.asked`. */
export function approvalHookOf(
  row: Pick<ApprovalRow, "id" | "kind" | "summary" | "payload" | "remoraId">,
  webBase: string,
): { type: HookEvent; data: Record<string, unknown> } {
  const proposal = row.kind === "budget_change" || row.payload.kind === "proposal";
  return {
    type: proposal ? "proposal.made" : "approval.asked",
    data: {
      approvalId: row.id,
      kind: row.kind,
      summary: row.summary,
      review: proposal ? `${webBase}/remoras/${row.remoraId}` : `${webBase}/approvals`,
    },
  };
}

/** One pass: rows written since `since` for remoras with hooks become deliveries. */
export async function scanHookEvents(
  h: Pick<HookDeps, "rt">,
  since: Date,
  seen: Map<string, number> = new Map(),
): Promise<number> {
  const { db, webBase } = h.rt;
  const hooked = await db
    .select({ id: remoras.id, config: remoras.config })
    .from(remoras)
    .where(sql`${remoras.config}->'hooks'->'out' @> '[{}]'::jsonb`);
  if (!hooked.length) return 0;
  const byId = new Map(hooked.map((r) => [r.id, r]));
  const ids = [...byId.keys()];
  const events = await db
    .select()
    .from(remoraEvents)
    .where(
      and(
        inArray(remoraEvents.remoraId, ids),
        gt(remoraEvents.createdAt, since),
        inArray(remoraEvents.type, ["payment", "answer", "price_hike", "price.hike"]),
      ),
    )
    .orderBy(asc(remoraEvents.createdAt))
    .limit(500);
  const asked = await db
    .select()
    .from(approvals)
    .where(and(inArray(approvals.remoraId, ids), gt(approvals.createdAt, since)))
    .orderBy(asc(approvals.createdAt))
    .limit(200);
  const found = [
    ...events.map((e) => ({ row: e, hit: hookEventOf(e, webBase) })),
    ...asked.map((a) => ({ row: a, hit: approvalHookOf(a, webBase) })),
  ];
  let queued = 0;
  for (const { row, hit } of found) {
    const r = byId.get(row.remoraId);
    if (!hit || !r || seen.has(row.id)) continue;
    queued += await emitHook({ db }, r, hit.type, hit.data, { id: row.id, at: row.createdAt });
    seen.set(row.id, Date.now());
  }
  return queued;
}

/** Scans every `everyMs`, re-reading a little behind the last pass so a late commit isn't missed. */
export function startHookScanner(
  h: Pick<HookDeps, "rt">,
  o: { everyMs?: number; overlapMs?: number } = {},
): () => void {
  const overlap = o.overlapMs ?? 30_000;
  let last = Date.now() - 2 * 60_000;
  let running = false;
  const seen = new Map<string, number>();
  const timer = setInterval(() => {
    if (running) return;
    running = true;
    const started = Date.now();
    scanHookEvents(h, new Date(last - overlap), seen)
      .then(() => {
        last = started;
        for (const [id, at] of seen) if (started - at > 2 * overlap) seen.delete(id);
      })
      .catch((err) => h.rt.log.warn("hooks.scan_failed", { error: err }))
      .finally(() => {
        running = false;
      });
  }, o.everyMs ?? 5_000);
  timer.unref?.();
  return () => clearInterval(timer);
}

/** The D2 handler: one attempt; a failure throws so the queue retries with backoff. */
export function deliverHandler(h: HookDeps, load: (id: string) => Promise<Remora | null>) {
  return async (payload: unknown, job: { attempts: number }) => {
    const p = payload as { remoraId: string; hookId: string; envelope: HookEnvelope };
    const r = await load(p.remoraId);
    const hook = r && outHooksOf(r).find((x) => x.id === p.hookId);
    if (!r || !hook) return;
    const out = await deliver(h, r, hook, p.envelope, job.attempts);
    if (out.status === "failed")
      throw new Error(`hook ${hook.id}: ${out.code ? `answered ${out.code}` : out.error}`);
  };
}
