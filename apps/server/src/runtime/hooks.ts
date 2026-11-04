/**
 * D1 `price` and `webhook` triggers and the owner's side of every hook (ADR-0121).
 * - **price:** a D2 job polls `pricesOf` every 5 minutes, unpaid, for every live price trigger, and
 *   keeps each trigger's side in `config.priceState`. A crossing queues one wake (`triggers/price.ts`).
 * - **webhook:** a signed POST queues one wake carrying the body (`triggers/webhook.ts`).
 * - **outbound:** the URLs in `config.hooks.out` (`hooks-out.ts`).
 * A wake is the remora's usual turn, as a schedule's is, and the owner hears the answer. Only kinds
 * that answer questions wake this way.
 */
import { randomBytes, randomUUID } from "node:crypto";
import { and, eq, inArray, remoraEvents, remoras, sql } from "@remora/db";
import { pricesOf, TOKENS, tokenSymbol } from "@remora/merchant";
import {
  HOOK_EVENTS,
  HookEvent,
  type OutHook,
  type TeamTrigger,
  type Trigger,
} from "@remora/schema";
import { answersQuestions } from "../templates/index.ts";
import {
  crossing,
  type PriceState,
  priceQuestion,
  type Thresholds,
  thresholdProblem,
} from "../triggers/price.ts";
import { HOOK_NAME, HOOK_RATE, hookTurn, inboundSecret, signatureOk } from "../triggers/webhook.ts";
import type { UntrustedData } from "./brain.ts";
import type { RuntimeDeps } from "./deps.ts";
import {
  DELIVER_JOB,
  type DeliveryLog,
  deliver,
  deliverHandler,
  type HookDeps,
  hookLogOf,
  hookSecretOf,
  OUT_HOOKS_MAX,
  outHooksOf,
  setConfigKey,
  startHookScanner,
  targetProblem,
} from "./hooks-out.ts";
import { enqueue, type JobHandler } from "./jobs.ts";
import { type Remora, RemoraError } from "./remoras.ts";
import { answerButtons } from "./schedules.ts";
import { scoutAsk } from "./scout.ts";

export const HOOK_JOB = {
  pricePoll: "remora.price_poll",
  priceWake: "remora.price_wake",
  hookWake: "remora.hook_wake",
  deliver: DELIVER_JOB,
} as const;
export const PRICE_POLL_MS = 5 * 60_000;
const WEBHOOKS_MAX = 3;
const PRICE_TRIGGERS_MAX = 5;

export interface HooksDeps extends HookDeps {
  rt: RuntimeDeps;
  /** Where senders reach `/api/hooks/…`. */
  base: string;
}

type PriceTrigger = Extract<Trigger, { kind: "price" }>;
type WebhookTrigger = Extract<Trigger, { kind: "webhook" }>;

const triggersOf = (r: Pick<Remora, "config">) =>
  (r.config as { triggers?: Trigger[] }).triggers ?? [];
export const priceTriggersOf = (r: Pick<Remora, "config">) =>
  triggersOf(r).filter((t): t is PriceTrigger => t.kind === "price");
export const webhooksOf = (r: Pick<Remora, "config">) =>
  triggersOf(r).filter((t): t is WebhookTrigger => t.kind === "webhook");
const priceStateOf = (r: Pick<Remora, "config">) =>
  (r.config as { priceState?: Record<string, PriceState> }).priceState ?? {};

const newId = () => randomBytes(12).toString("base64url");
const live = (r: Remora) =>
  answersQuestions(r.template) && (r.status === "active" || r.status === "shadow");

export const inboundUrl = (base: string, remoraId: string, id: string) =>
  `${base.replace(/\/+$/, "")}/api/hooks/${remoraId}/${id}`;

function mustWake(r: Remora) {
  if (!answersQuestions(r.template))
    throw new RemoraError(
      "hooks.unsupported",
      "Only Researchers and Briefers wake on a price or a webhook.",
    );
}

async function saveTriggers(h: HooksDeps, r: Remora, triggers: Trigger[], summary: string) {
  await setConfigKey(h.rt.db, r.id, "triggers", triggers, { touch: true });
  await h.rt.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary,
    payload: { triggers: triggers.filter((t) => t.kind === "price" || t.kind === "webhook") },
  });
}

// ── Inbound webhooks ────────────────────────────────────────────────────────

const webhookView = (h: HooksDeps, r: Remora, w: WebhookTrigger) => ({
  id: w.id,
  name: w.name ?? null,
  url: inboundUrl(h.base, r.id, w.id),
});

export async function addWebhook(h: HooksDeps, r: Remora, name?: string) {
  mustWake(r);
  if (name !== undefined && !HOOK_NAME.test(name))
    throw new RemoraError(
      "hooks.bad_name",
      "A name is up to 20 lowercase letters, digits or dashes, like github.",
    );
  if (webhooksOf(r).length >= WEBHOOKS_MAX)
    throw new RemoraError("hooks.too_many", "Three webhooks at most. Remove one first.", 409);
  const hook: WebhookTrigger = { kind: "webhook", id: newId(), ...(name ? { name } : {}) };
  await saveTriggers(
    h,
    r,
    [...triggersOf(r), hook],
    `Wakes on a webhook${name ? ` from ${name}` : ""}.`,
  );
  return { ...webhookView(h, r, hook), secret: inboundSecret(h.secret, r.id, hook.id) };
}

/** A new id, so a new URL and secret; the old ones stop at once. */
export async function rotateWebhook(h: HooksDeps, r: Remora, id: string) {
  const old = webhooksOf(r).find((w) => w.id === id);
  if (!old) throw new RemoraError("hooks.not_found", "No such webhook.", 404);
  const hook: WebhookTrigger = { ...old, id: newId() };
  await saveTriggers(
    h,
    r,
    triggersOf(r).map((t) => (t.kind === "webhook" && t.id === id ? hook : t)),
    `Rotated a webhook${hook.name ? ` from ${hook.name}` : ""}: the old URL stopped.`,
  );
  return { ...webhookView(h, r, hook), secret: inboundSecret(h.secret, r.id, hook.id) };
}

export async function removeWebhook(h: HooksDeps, r: Remora, id: string) {
  if (!webhooksOf(r).some((w) => w.id === id))
    throw new RemoraError("hooks.not_found", "No such webhook.", 404);
  await saveTriggers(
    h,
    r,
    triggersOf(r).filter((t) => !(t.kind === "webhook" && t.id === id)),
    "Removed a webhook: its URL stopped.",
  );
}

export function webhookSecret(h: HooksDeps, r: Remora, id: string) {
  const w = webhooksOf(r).find((x) => x.id === id);
  if (!w) throw new RemoraError("hooks.not_found", "No such webhook.", 404);
  return { ...webhookView(h, r, w), secret: inboundSecret(h.secret, r.id, w.id) };
}

export type Received =
  | { ok: true; queued: boolean }
  | {
      ok: false;
      reason: "bad_signature" | "not_found" | "rate_limited" | "not_active";
      retryAfterMs?: number;
    };

/**
 * A delivery to `/api/hooks/:remoraId/:id`. The signature is checked first, from the derived secret
 * alone, so an unsigned caller learns nothing about which remoras exist.
 */
export async function receiveWebhook(
  h: HooksDeps,
  input: {
    remoraId: string;
    id: string;
    body: Uint8Array;
    signature: string | undefined;
    event?: string;
    delivery?: string;
    contentType?: string;
  },
): Promise<Received> {
  if (!signatureOk(inboundSecret(h.secret, input.remoraId, input.id), input.body, input.signature))
    return { ok: false, reason: "bad_signature" };
  const [r] = await h.rt.db.select().from(remoras).where(eq(remoras.id, input.remoraId));
  const hook = r && webhooksOf(r).find((w) => w.id === input.id);
  if (!r || !hook || r.status === "retired") return { ok: false, reason: "not_found" };
  const gate = h.rt.limiter.take(`hook:${r.id}:${hook.id}`, HOOK_RATE);
  if (!gate.allowed) return { ok: false, reason: "rate_limited", retryAfterMs: gate.retryAfterMs };
  // GitHub's hello when a hook is created: nothing to answer.
  if (input.event === "ping") return { ok: true, queued: false };
  if (!live(r)) return { ok: false, reason: "not_active" };
  const delivery =
    input.delivery && /^[\w-]{1,80}$/.test(input.delivery) ? input.delivery : randomUUID();
  await enqueue(h.rt.db, {
    kind: HOOK_JOB.hookWake,
    payload: {
      remoraId: r.id,
      hookId: hook.id,
      body: new TextDecoder().decode(input.body),
      ...(input.event ? { event: input.event.slice(0, 40) } : {}),
      ...(input.contentType ? { contentType: input.contentType.slice(0, 100) } : {}),
    },
    idempotencyKey: `hookin:${r.id}:${hook.id}:${delivery}`,
    maxAttempts: 2,
  });
  return { ok: true, queued: true };
}

// ── Price triggers ──────────────────────────────────────────────────────────

export async function addPriceTrigger(
  h: HooksDeps,
  r: Remora,
  input: { symbol: string; above?: number; below?: number; paused?: boolean },
) {
  mustWake(r);
  const symbol = tokenSymbol(input.symbol);
  if (!symbol)
    throw new RemoraError(
      "price.unknown_symbol",
      `It can watch ${Object.keys(TOKENS).join(", ")}.`,
    );
  const t: Thresholds = {
    ...(input.above !== undefined ? { above: input.above } : {}),
    ...(input.below !== undefined ? { below: input.below } : {}),
  };
  const problem = thresholdProblem(t);
  if (problem) throw new RemoraError("price.bad_threshold", problem);
  if (priceTriggersOf(r).length >= PRICE_TRIGGERS_MAX)
    throw new RemoraError("hooks.too_many", "Five price triggers at most. Remove one first.", 409);
  const trigger: PriceTrigger = {
    kind: "price",
    id: newId(),
    symbol,
    ...t,
    ...(input.paused ? { paused: true } : {}),
  };
  const sides = [
    t.above !== undefined ? `above ${t.above}` : null,
    t.below !== undefined ? `below ${t.below}` : null,
  ].filter(Boolean);
  await saveTriggers(
    h,
    r,
    [...triggersOf(r), trigger],
    `Wakes when ${symbol} goes ${sides.join(" or ")}${trigger.paused ? " (paused)" : ""}.`,
  );
  await queuePricePoll(h, new Date());
  return trigger;
}

export async function setPricePaused(h: HooksDeps, r: Remora, id: string, paused: boolean) {
  const t = priceTriggersOf(r).find((x) => x.id === id);
  if (!t) throw new RemoraError("price.not_found", "No such price trigger.", 404);
  const { paused: _was, ...rest } = t;
  const next: PriceTrigger = paused ? { ...rest, paused: true } : rest;
  await saveTriggers(
    h,
    r,
    triggersOf(r).map((x) => (x.kind === "price" && x.id === id ? next : x)),
    `${paused ? "Paused" : "Resumed"} the ${t.symbol} price trigger.`,
  );
  if (!paused) await queuePricePoll(h, new Date());
  return next;
}

export async function removePriceTrigger(h: HooksDeps, r: Remora, id: string) {
  const t = priceTriggersOf(r).find((x) => x.id === id);
  if (!t) throw new RemoraError("price.not_found", "No such price trigger.", 404);
  await saveTriggers(
    h,
    r,
    triggersOf(r).filter((x) => !(x.kind === "price" && x.id === id)),
    `Removed the ${t.symbol} price trigger.`,
  );
}

/**
 * A team file's triggers, on import (ADR-0042's rule for schedules): price triggers arrive paused, and
 * each webhook gets a fresh id, so its URL and secret are new and only this owner can reveal them.
 */
export async function importTriggers(
  deps: Pick<RuntimeDeps, "db">,
  r: Remora,
  list: TeamTrigger[],
): Promise<Trigger[]> {
  if (!answersQuestions(r.template)) return [];
  const added = list.flatMap((t): Trigger[] => {
    if (t.kind === "webhook") return [{ kind: "webhook", id: newId(), name: t.name }];
    const symbol = tokenSymbol(t.symbol);
    const th: Thresholds = {
      ...(t.above !== undefined ? { above: t.above } : {}),
      ...(t.below !== undefined ? { below: t.below } : {}),
    };
    return symbol && !thresholdProblem(th)
      ? [{ kind: "price", id: newId(), symbol, ...th, paused: true }]
      : [];
  });
  const webhooks = added.filter((t) => t.kind === "webhook").slice(0, WEBHOOKS_MAX);
  const prices = added.filter((t) => t.kind === "price").slice(0, PRICE_TRIGGERS_MAX);
  if (!webhooks.length && !prices.length) return [];
  await setConfigKey(deps.db, r.id, "triggers", [...triggersOf(r), ...webhooks, ...prices], {
    touch: true,
  });
  return [...webhooks, ...prices];
}

/** What a team file says about this remora's triggers (no ids: they're made on import). */
export const exportTriggers = (r: Pick<Remora, "config">): TeamTrigger[] => [
  ...priceTriggersOf(r).map((t) => ({
    kind: "price" as const,
    symbol: t.symbol,
    ...(t.above !== undefined ? { above: t.above } : {}),
    ...(t.below !== undefined ? { below: t.below } : {}),
  })),
  ...webhooksOf(r).map((w) => ({ kind: "webhook" as const, name: w.name ?? "webhook" })),
];

const PRICE_WATCHERS = sql`${remoras.config}->'triggers' @> '[{"kind":"price"}]'::jsonb`;

/** Whether any remora that can wake has a price trigger, so the poll's chain should go on. */
async function anyPriceTriggers(h: Pick<HooksDeps, "rt">) {
  const [hit] = await h.rt.db
    .select({ id: remoras.id })
    .from(remoras)
    .where(and(inArray(remoras.status, ["active", "shadow"]), PRICE_WATCHERS))
    .limit(1);
  return !!hit;
}

/** Queues the poll for the next 5-minute slot after `from`; a slot is queued once. */
export async function queuePricePoll(h: Pick<HooksDeps, "rt">, from: Date) {
  const at = new Date((Math.floor(from.getTime() / PRICE_POLL_MS) + 1) * PRICE_POLL_MS);
  await enqueue(h.rt.db, {
    kind: HOOK_JOB.pricePoll,
    payload: {},
    idempotencyKey: `price-poll:${at.toISOString()}`,
    runAt: at,
    // A failed poll (CoinGecko busy) isn't retried: the next slot is 5 minutes away.
    maxAttempts: 1,
  });
  return at;
}

/**
 * One poll: one unpaid CoinGecko read for every symbol a live trigger watches, then each trigger's
 * side. A crossing queues a wake keyed by the side it left, so a poll that runs twice wakes once.
 */
export async function pollPrices(
  h: Pick<HooksDeps, "rt" | "fetch">,
  now = new Date(),
): Promise<{ checked: number; fired: number }> {
  const rows = await h.rt.db
    .select()
    .from(remoras)
    .where(and(inArray(remoras.status, ["active", "shadow"]), PRICE_WATCHERS));
  const watching = rows
    .filter((r) => answersQuestions(r.template))
    .map((r) => ({
      r,
      triggers: priceTriggersOf(r).filter((t) => t.id && !t.paused && tokenSymbol(t.symbol)),
    }))
    .filter((x) => x.triggers.length);
  if (!watching.length) return { checked: 0, fired: 0 };
  const symbols = [
    ...new Set(watching.flatMap((x) => x.triggers.map((t) => tokenSymbol(t.symbol) ?? ""))),
  ].sort();
  const { prices } = await pricesOf(symbols, h.fetch ?? fetch, now.getTime());
  const bySymbol = new Map(prices.map((p) => [p.symbol, p]));
  let checked = 0;
  let fired = 0;
  for (const { r, triggers } of watching) {
    const before = priceStateOf(r);
    const next: Record<string, PriceState> = {};
    for (const t of triggers) {
      const id = t.id ?? "";
      const p = bySymbol.get(tokenSymbol(t.symbol) ?? "");
      const prev = before[id];
      if (!p) {
        if (prev) next[id] = prev;
        continue;
      }
      checked++;
      const c = crossing(t, prev?.side ?? null, p.usd);
      if (c.fired) {
        const threshold = (c.fired === "above" ? t.above : t.below) ?? 0;
        await enqueue(h.rt.db, {
          kind: HOOK_JOB.priceWake,
          payload: {
            remoraId: r.id,
            triggerId: id,
            symbol: p.symbol,
            fired: c.fired,
            threshold,
            usd: p.usd,
            question: priceQuestion({
              symbol: p.symbol,
              fired: c.fired,
              threshold,
              usd: p.usd,
              pricedAt: p.pricedAt,
            }),
          },
          idempotencyKey: `price:${r.id}:${id}:${c.fired}:${prev?.at ?? ""}`,
          maxAttempts: 2,
        });
        fired++;
      }
      next[id] = { side: c.side, usd: p.usd, at: now.toISOString() };
    }
    await setConfigKey(h.rt.db, r.id, "priceState", next);
  }
  return { checked, fired };
}

// ── Outbound ────────────────────────────────────────────────────────────────

const hooksConfigOf = (r: Remora) =>
  (r.config as { hooks?: { out?: OutHook[]; key?: string } }).hooks ?? {};

export async function addOutHook(
  h: HooksDeps,
  r: Remora,
  input: { url?: unknown; events?: unknown },
) {
  const url = typeof input.url === "string" ? input.url.trim() : "";
  if (!url || url.length > 500) throw new RemoraError("hooks.bad_url", "Paste the URL to send to.");
  const problem = await targetProblem(url, h);
  if (problem) throw new RemoraError("hooks.bad_url", problem);
  const events = HookEvent.array().safeParse(input.events);
  if (!events.success || !events.data.length)
    throw new RemoraError("hooks.no_events", "Pick at least one event to send.");
  const out = outHooksOf(r);
  if (out.length >= OUT_HOOKS_MAX)
    throw new RemoraError("hooks.too_many", "Five URLs at most. Remove one first.", 409);
  const hook: OutHook = { id: newId(), url, events: [...new Set(events.data)] };
  await setConfigKey(
    h.rt.db,
    r.id,
    "hooks",
    { ...hooksConfigOf(r), out: [...out, hook] },
    { touch: true },
  );
  await h.rt.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary: `Tells ${new URL(url).host} about ${hook.events.join(", ")}.`,
    payload: { hook },
  });
  return hook;
}

export async function removeOutHook(h: HooksDeps, r: Remora, id: string) {
  const out = outHooksOf(r);
  if (!out.some((x) => x.id === id)) throw new RemoraError("hooks.not_found", "No such URL.", 404);
  await setConfigKey(
    h.rt.db,
    r.id,
    "hooks",
    { ...hooksConfigOf(r), out: out.filter((x) => x.id !== id) },
    { touch: true },
  );
}

/** The signing secret for this remora's outbound hooks; rotating changes it for every URL. */
export const outSecret = (h: HooksDeps, r: Remora) => hookSecretOf(h, r);

export async function rotateOutSecret(h: HooksDeps, r: Remora) {
  const hooks = { ...hooksConfigOf(r), key: newId() };
  await setConfigKey(h.rt.db, r.id, "hooks", hooks, { touch: true });
  return hookSecretOf(h, { id: r.id, config: { ...r.config, hooks } });
}

/** "Send test": one signed delivery now, logged with the rest. */
export async function sendTest(h: HooksDeps, r: Remora, id: string): Promise<DeliveryLog> {
  const hook = outHooksOf(r).find((x) => x.id === id);
  if (!hook) throw new RemoraError("hooks.not_found", "No such URL.", 404);
  return deliver(h, r, hook, {
    id: randomUUID(),
    type: "test",
    remoraId: r.id,
    createdAt: new Date().toISOString(),
    data: { remora: r.name, message: "A test delivery from Remora." },
  });
}

/** What the Hooks card shows. Secrets only come from their own owner-only reads. */
export function hooksView(h: HooksDeps, r: Remora) {
  const state = priceStateOf(r);
  return {
    wakes: answersQuestions(r.template),
    inbound: webhooksOf(r).map((w) => webhookView(h, r, w)),
    price: priceTriggersOf(r).flatMap((t) =>
      t.id
        ? [
            {
              id: t.id,
              symbol: t.symbol,
              above: t.above ?? null,
              below: t.below ?? null,
              paused: !!t.paused,
              side: state[t.id]?.side ?? null,
              usd: state[t.id]?.usd ?? null,
              at: state[t.id]?.at ?? null,
            },
          ]
        : [],
    ),
    out: outHooksOf(r),
    deliveries: hookLogOf(r).slice().reverse(),
    symbols: Object.keys(TOKENS),
    events: [...HOOK_EVENTS],
  };
}

// ── Wakes and jobs ──────────────────────────────────────────────────────────

/** The remora's usual turn, then the answer to its owner, as a scheduled run does. */
async function wake(
  h: HooksDeps,
  r: Remora,
  question: string,
  trigger: { kind: "price" | "webhook"; ref: string },
  title: string,
  data: UntrustedData[] = [],
) {
  const res = await scoutAsk(h.rt, r, question, trigger, {
    ...(data.length ? { data } : {}),
    payload: { wokenBy: trigger },
  });
  await h.rt.notifier.send(r.ownerAddress, {
    text: `${title}\n\n${res.answer}`,
    buttons: answerButtons(h.rt.webBase, r, res.eventId),
  });
  return res;
}

export function hookJobHandlers(h: HooksDeps): Record<string, JobHandler> {
  const load = async (id: string) => {
    const [r] = await h.rt.db.select().from(remoras).where(eq(remoras.id, id));
    return r ?? null;
  };
  return {
    [HOOK_JOB.pricePoll]: async (_payload, job) => {
      // With no price trigger left the chain ends; adding or resuming one starts it again.
      if (!(await anyPriceTriggers(h))) return;
      // The next slot first, so a failed poll never ends the chain.
      await queuePricePoll(h, new Date(Math.max(Date.now(), job.runAt.getTime())));
      await pollPrices(h);
    },
    [HOOK_JOB.priceWake]: async (payload) => {
      const p = payload as {
        remoraId: string;
        triggerId: string;
        symbol: string;
        fired: string;
        threshold: number;
        question: string;
      };
      const r = await load(p.remoraId);
      const t = r && priceTriggersOf(r).find((x) => x.id === p.triggerId);
      if (!r || !t || t.paused || !live(r)) return;
      await wake(
        h,
        r,
        p.question,
        { kind: "price", ref: p.triggerId },
        `${r.name} · ${p.symbol} went ${p.fired} ${p.threshold}:`,
      );
    },
    [HOOK_JOB.hookWake]: async (payload) => {
      const p = payload as {
        remoraId: string;
        hookId: string;
        body: string;
        event?: string;
        contentType?: string;
      };
      const r = await load(p.remoraId);
      const w = r && webhooksOf(r).find((x) => x.id === p.hookId);
      if (!r || !w || !live(r)) return;
      const turn = hookTurn({
        hookId: w.id,
        ...(w.name ? { name: w.name } : {}),
        ...(p.event ? { event: p.event } : {}),
        body: p.body,
        ...(p.contentType ? { contentType: p.contentType } : {}),
      });
      await wake(
        h,
        r,
        turn.question,
        { kind: "webhook", ref: w.id },
        `${r.name} · ${turn.data.source}:`,
        [turn.data],
      );
    },
    [HOOK_JOB.deliver]: deliverHandler(h, load),
  };
}

/** Queues the first price poll and starts the outbound scanner. Returns a stop function. */
export function startHooks(h: HooksDeps): () => void {
  anyPriceTriggers(h)
    .then((any) => (any ? queuePricePoll(h, new Date()) : null))
    .catch((err) => h.rt.log.warn("hooks.poll_queue_failed", { error: err }));
  return startHookScanner(h);
}
