/**
 * U18 B2 (ADR-0129): the Subscriptions Keeper pays recurring x402 charges and remembers what each one
 * normally costs. Before every charge it reads the 402 first: at the remembered price it pays through
 * the ordinary pay path; at 20% or more above it, it doesn't pay and asks (pay once, accept the new
 * price, or cancel). A merchant whose 402 asks to be paid elsewhere is refused by the ADR-0109 guard,
 * and three failed charges in a row are flagged.
 */
import { normalizeStructTag, normalizeSuiAddress } from "@mysten/sui/utils";
import { approvals, eq, remoraEvents, remoras } from "@remora/db";
import { type PaymentRequired, toX402Network } from "@remora/disc-sdk";
import { listedFor } from "../money/contacts.ts";
import { payeeLabel } from "../money/reef.ts";
import { requestPayment } from "../tools/pay.ts";
import { saveConfig } from "./config-versions.ts";
import type { RuntimeDeps } from "./deps.ts";
import { type Remora, RemoraError } from "./remoras.ts";

/** At this many percent over the remembered price, it asks instead of paying. */
export const HIKE_PCT = 20n;
/** Failed charges in a row before it tells the owner. */
export const FAILURES_TO_FLAG = 3;

export interface Subscription {
  id: string;
  /** A listed Reef ref (house, community or a remora on sale). */
  ref: string;
  /** The exact URL charged each time, at the listing's address. */
  url: string;
  /** The price it remembers, in smallest units; null before the first charge. */
  usual: string | null;
  failures: number;
  paused?: boolean;
}

export const subscriptionsOf = (r: { config: unknown }): Subscription[] =>
  (r.config as { subscriptions?: Subscription[] }).subscriptions ?? [];

const usdc = (u: bigint | string) => (Number(u) / 1e6).toFixed(3).replace(/0$/, "");

/** The 402's price for this network's USDC, read before paying. */
export async function quote(
  deps: Pick<RuntimeDeps, "networks" | "fetch">,
  r: Pick<Remora, "network">,
  url: string,
): Promise<{ amount: bigint; payTo: string } | { error: string }> {
  const http = deps.fetch ?? fetch;
  const res = await http(url).catch((err: Error) => ({ status: 0, err }) as const);
  if ("err" in res) return { error: `unreachable (${res.err.message.slice(0, 80)})` };
  if (res.status !== 402) return { error: `answered ${res.status}, not 402` };
  const body = (await res.json().catch(() => null)) as PaymentRequired | null;
  const coin = deps.networks.config(r.network).usdcCoinType;
  const req = body?.accepts?.find(
    (a) =>
      a.network === toX402Network(r.network) &&
      normalizeStructTag(a.asset) === normalizeStructTag(coin),
  );
  if (!req) return { error: "no requirement in this network's USDC" };
  return { amount: BigInt(req.amount), payTo: normalizeSuiAddress(req.payTo) };
}

export const isHike = (amount: bigint, usual: bigint) => amount * 100n >= usual * (100n + HIKE_PCT);

async function patchSub(
  deps: Pick<RuntimeDeps, "db">,
  r: Remora,
  id: string,
  patch: Partial<Subscription>,
  summary: string,
) {
  return saveConfig(
    deps.db,
    r.id,
    (c) => ({
      ...c,
      subscriptions: subscriptionsOf({ config: c }).map((s) =>
        s.id === id ? { ...s, ...patch } : s,
      ),
    }),
    { summary: () => summary },
  );
}

/** Remembers a merchant's price, as a fact the next turn can read. */
const rememberPrice = (
  deps: RuntimeDeps,
  r: Remora,
  s: Subscription,
  amount: bigint,
  why: string,
) =>
  deps.memory
    .remember(
      r,
      "feedback",
      "budget",
      `PRICE ${s.ref} · usually ${usdc(amount)} USDC a charge · ${why} · as_of ${new Date().toISOString().slice(0, 10)}`,
      { dedupe: false },
    )
    .catch((err) => deps.log.warn("keeper.memory_failed", { remora: r.id, error: err }));

export interface ChargeResult {
  id: string;
  ref: string;
  outcome: "paid" | "hike" | "failed" | "skipped";
  amount?: string;
  usual?: string | null;
  digest?: string | null;
  note: string;
}

/** One charge: quote, compare with the remembered price, then pay or ask. */
export async function charge(
  deps: RuntimeDeps,
  r: Remora,
  s: Subscription,
  opts: { confirmed?: boolean } = {},
): Promise<ChargeResult> {
  const label = payeeLabel(s.ref);
  const listed = listedFor(deps, r).find((e) => e.ref === s.ref);
  if (!listed)
    return { id: s.id, ref: s.ref, outcome: "skipped", note: `${label} isn't listed anymore` };
  const q = await quote(deps, r, s.url);
  const fail = async (note: string): Promise<ChargeResult> => {
    const failures = s.failures + 1;
    await patchSub(deps, r, s.id, { failures }, `${label}'s charge failed (${failures} in a row).`);
    if (failures === FAILURES_TO_FLAG)
      await deps.notifier.send(r.ownerAddress, {
        text: `${r.name}: ${label} failed ${failures} times in a row (${note}).`,
        buttons: [{ label: "Open", url: `${deps.webBase}/remoras/${r.id}` }],
      });
    return { id: s.id, ref: s.ref, outcome: "failed", note };
  };
  if ("error" in q) return fail(q.error);
  const usual = s.usual ? BigInt(s.usual) : null;
  if (usual && !opts.confirmed && isHike(q.amount, usual)) {
    const note = `${label} now asks ${usdc(q.amount)} USDC, up from ${usdc(usual)}`;
    const [a] = await deps.db
      .insert(approvals)
      .values({
        remoraId: r.id,
        network: r.network,
        kind: "over_limit_payment",
        summary: `Price hike: ${label} ${usdc(usual)} → ${usdc(q.amount)} USDC`,
        payload: {
          kind: "price_hike",
          subscriptionId: s.id,
          payee: s.ref,
          payTo: q.payTo,
          amount: q.amount.toString(),
          usual: usual.toString(),
          url: s.url,
          reason: `subscription to ${label}`,
          // Within its limits, so a yes pays once from its own Disc.
          viaDisc: true,
        },
      })
      .returning({ id: approvals.id });
    await deps.db.insert(remoraEvents).values({
      remoraId: r.id,
      network: r.network,
      type: "price_hike",
      summary: `Didn't pay: ${note}`,
      payload: {
        payee: s.ref,
        amount: q.amount.toString(),
        previous: usual.toString(),
        approvalId: a?.id,
        subscriptionId: s.id,
      },
    });
    await deps.notifier.send(r.ownerAddress, {
      text: `${r.name}: ${note}. I didn't pay. Pay once, accept the new price, or cancel?`,
      urgent: true,
      buttons: [{ label: "Decide", url: `${deps.webBase}/remoras/${r.id}` }],
    });
    return {
      id: s.id,
      ref: s.ref,
      outcome: "hike",
      amount: q.amount.toString(),
      usual: s.usual,
      note,
    };
  }
  const out = await requestPayment(deps, r, {
    payee: s.ref,
    url: s.url,
    reason: `subscription to ${label}`,
    trigger: { kind: "cron", ref: `subscription:${s.id}` },
    question: `subscription to ${label}`,
    memories: [],
  });
  if (out.kind !== "paid")
    return fail(out.kind === "shadow" ? "practice mode" : (out.reasons[0] ?? out.kind));
  const paid = BigInt(out.amount);
  // The remembered price only falls on its own: small rises don't creep it up to a hike.
  const next = !usual || paid < usual ? paid : usual;
  if (next !== usual)
    await rememberPrice(deps, r, s, next, usual ? "it got cheaper" : "first charge");
  await patchSub(
    deps,
    r,
    s.id,
    { usual: next.toString(), failures: 0 },
    `${label} charged ${usdc(paid)} USDC.`,
  );
  return {
    id: s.id,
    ref: s.ref,
    outcome: "paid",
    amount: out.amount,
    usual: paid.toString(),
    digest: out.digest,
    note: `paid ${label} ${usdc(paid)} USDC`,
  };
}

/** A run over every active subscription; the lines go to the feed and the owner. */
export async function runKeeper(deps: RuntimeDeps, r: Remora, ref = "cron") {
  const results: ChargeResult[] = [];
  for (const s of subscriptionsOf(r).filter((x) => !x.paused)) {
    // Each charge reads the remora fresh: the last one may have changed its config.
    const [now] = await deps.db.select().from(remoras).where(eq(remoras.id, r.id));
    const live = subscriptionsOf(now ?? r).find((x) => x.id === s.id) ?? s;
    results.push(
      await charge(deps, now ?? r, live).catch((err: Error) => ({
        id: s.id,
        ref: s.ref,
        outcome: "failed" as const,
        note: err.message.slice(0, 120),
      })),
    );
  }
  const answer = results.length
    ? results
        .map((x) => `${x.outcome === "paid" ? "✓" : x.outcome === "hike" ? "!" : "·"} ${x.note}`)
        .join("\n")
    : "No subscriptions yet.";
  const [e] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "answer",
      summary: `Subscriptions (${ref})`,
      payload: {
        question: "subscriptions",
        answer,
        paidPayees: results.filter((x) => x.outcome === "paid").map((x) => x.ref),
        digests: results.flatMap((x) => (x.digest ? [x.digest] : [])),
        charges: results,
      },
    })
    .returning({ id: remoraEvents.id });
  return { results, answer, eventId: e?.id ?? "" };
}

/** Adds a subscription to a listed service (its payee must already be one of the Disc's). */
export async function addSubscription(
  deps: RuntimeDeps,
  r: Remora,
  input: { ref: string; url?: string },
) {
  const listed = listedFor(deps, r).find((e) => e.ref === input.ref);
  if (!listed) throw new RemoraError("reef.unknown_payee", `${input.ref} isn't a listed service.`);
  const url = input.url?.trim() || listed.url;
  if (url.includes("/:"))
    throw new RemoraError("subscription.url", "Give the exact URL it should charge each time.");
  const id = crypto.randomUUID().slice(0, 8);
  return saveConfig(
    deps.db,
    r.id,
    (c) => ({
      ...c,
      subscriptions: [
        ...subscriptionsOf({ config: c }).filter((s) => s.ref !== input.ref || s.url !== url),
        { id, ref: input.ref, url, usual: null, failures: 0 },
      ],
    }),
    { summary: () => `${r.name} subscribes to ${payeeLabel(input.ref)}.` },
  );
}

export async function removeSubscription(deps: RuntimeDeps, r: Remora, id: string) {
  const s = subscriptionsOf(r).find((x) => x.id === id);
  if (!s) throw new RemoraError("subscription.not_found", "No such subscription.", 404);
  return saveConfig(
    deps.db,
    r.id,
    (c) => ({ ...c, subscriptions: subscriptionsOf({ config: c }).filter((x) => x.id !== id) }),
    { summary: () => `${r.name} cancelled ${payeeLabel(s.ref)}.` },
  );
}

/** The owner accepts a merchant's new price: it's remembered, and the next charge pays it. */
export async function acceptPrice(deps: RuntimeDeps, r: Remora, id: string, amount: string) {
  const s = subscriptionsOf(r).find((x) => x.id === id);
  if (!s) throw new RemoraError("subscription.not_found", "No such subscription.", 404);
  if (!/^\d{1,12}$/.test(amount))
    throw new RemoraError("subscription.price", "That isn't a price.");
  await rememberPrice(deps, r, s, BigInt(amount), "the owner accepted a new price");
  return patchSub(deps, r, id, { usual: amount }, `${payeeLabel(s.ref)}'s new price accepted.`);
}

/** The owner's yes to a hike: pay this one charge, without changing the remembered price. */
export async function payHikeOnce(deps: RuntimeDeps, owner: string, approvalId: string) {
  const [row] = await deps.db
    .select({ a: approvals, r: remoras })
    .from(approvals)
    .innerJoin(remoras, eq(remoras.id, approvals.remoraId))
    .where(eq(approvals.id, approvalId));
  if (!row) throw new RemoraError("approval.not_found", "No such approval.", 404);
  if (normalizeSuiAddress(row.r.ownerAddress) !== normalizeSuiAddress(owner))
    throw new RemoraError("remora.not_owner", "That isn't yours.", 403);
  if (row.a.status !== "pending")
    throw new RemoraError("approval.decided", `Already ${row.a.status}.`, 409);
  const p = row.a.payload as { subscriptionId: string };
  const s = subscriptionsOf(row.r).find((x) => x.id === p.subscriptionId);
  if (!s) throw new RemoraError("subscription.not_found", "That subscription is gone.", 409);
  await deps.db
    .update(approvals)
    .set({ status: "approved", decidedAt: new Date() })
    .where(eq(approvals.id, approvalId));
  // Paid once at the new price; the remembered price stays until the owner accepts it.
  const out = await requestPayment(deps, row.r, {
    payee: s.ref,
    url: s.url,
    reason: `subscription to ${payeeLabel(s.ref)} (paid once at a new price)`,
    trigger: { kind: "message", ref: `approval:${approvalId}` },
    question: `subscription to ${payeeLabel(s.ref)}`,
    memories: [],
  });
  return {
    answer:
      out.kind === "paid"
        ? `Paid ${payeeLabel(s.ref)} once at ${usdc(out.amount)} USDC.`
        : `Didn't pay: ${out.kind === "shadow" ? "practice mode" : (out.reasons[0] ?? out.kind)}.`,
    digest: out.kind === "paid" ? out.digest : null,
  };
}
