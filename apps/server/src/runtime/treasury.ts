/**
 * C3 (ADR-0148): the Treasurer. It watches up to 10 team addresses through the chain watcher's
 * filtered checkpoint stream (the one Sentinels use, `triggers/watch.ts`), keeps each balance change
 * as an `episode`, and writes a treasury report weekly (the review's job) and on demand: what came in
 * and went out per address, the top counterparties, and the runway at the current burn. A report can
 * be shared as a public, redacted link, the way G6 shares a Wake.
 *
 * Spend requests come from the owner's chat, Telegram or a signed webhook. It checks the contact list
 * and its limits, then turns a request into an approval the owner pays from their own wallet
 * (`approvalPay`). It holds no Disc and never pays: even the owner's own request is an approval.
 */
import { randomBytes } from "node:crypto";
import { normalizeStructTag, normalizeSuiAddress } from "@mysten/sui/utils";
import { and, approvals, desc, eq, gt, remoraEvents, remoras, sql } from "@remora/db";
import {
  type Contact,
  contactPayUrl,
  contactsOf,
  findContact,
  toContact,
} from "../money/contacts.ts";
import { canonicalName, isSuiName, type NameCore, nameMoved, resolveName } from "../money/names.ts";
import { decimalsOf } from "../triggers/watch.ts";
import { saveConfig } from "./config-versions.ts";
import type { RuntimeDeps } from "./deps.ts";
import { type Remora, RemoraError } from "./remoras.ts";
import { nextMonday9, queueWeeklyReview } from "./review.ts";
import type { ChainEvent } from "./rules.ts";

export const TREASURY_MAX_WATCH = 10;
/** Testnet-sized defaults the owner can change: 1 USDC a request, 10 a month. */
export const DEFAULT_PER_REQUEST = 1_000_000n;
export const DEFAULT_MONTHLY = 10_000_000n;
const DAY_MS = 86_400_000;
const SUI = normalizeStructTag("0x2::sui::SUI");

export interface WatchEntry {
  address: string;
  label?: string;
  /** The `.sui` name it was added by (C1, ADR-0144), and when that was resolved. */
  suins?: string;
  resolvedAt?: string;
}

export interface TreasuryConfig {
  watch: WatchEntry[];
  /** Smallest USDC units. */
  perRequestCap?: string;
  monthlyCap?: string;
}

export const isTreasurer = (r: { template: string }) => r.template === "treasurer";

export function treasuryOf(r: { config: unknown }): TreasuryConfig {
  const t = (r.config as { treasury?: Partial<TreasuryConfig> }).treasury;
  return {
    watch: (t?.watch ?? []).filter((w) => w && typeof w.address === "string"),
    ...(t?.perRequestCap ? { perRequestCap: t.perRequestCap } : {}),
    ...(t?.monthlyCap ? { monthlyCap: t.monthlyCap } : {}),
  };
}

export const limitsOf = (t: TreasuryConfig) => ({
  perRequestCap: BigInt(t.perRequestCap ?? DEFAULT_PER_REQUEST),
  monthlyCap: BigInt(t.monthlyCap ?? DEFAULT_MONTHLY),
});

/** `0x1234…abcd`. */
export const shortAddress = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/** Smallest units → "0.30", "0.0103", "0.000005": at least two decimals, no trailing zeros past them. */
export function fmtUnits(a: bigint | string, decimals: number): string {
  const v = Number(a) / 10 ** decimals;
  const s = v.toFixed(Math.abs(v) > 0 && Math.abs(v) < 0.0001 ? decimals : 4);
  const [w = "0", f = ""] = s.split(".");
  return `${w}.${f.replace(/0+$/, "").padEnd(2, "0")}`;
}

const symbolOf = (coinType: string) => coinType.split("::").pop()?.toUpperCase() ?? coinType;
const usdc = (u: bigint) => fmtUnits(u, 6);

// ── Setup: the watch list, the contacts and the limits ──────────────────────

export interface WatchIn {
  label?: string;
  /** `0x…`, or a `.sui` name resolved over gRPC NameService. */
  address: string;
}

async function resolveOrThrow(core: NameCore, name: string) {
  const suins = canonicalName(name);
  const at = await resolveName(core, suins).catch(() => {
    throw new RemoraError("name.unreachable", `Couldn't look up ${suins} just now.`, 409);
  });
  if (!at) throw new RemoraError("name.unknown", `${suins} doesn't point to an address.`);
  return { address: at, suins, resolvedAt: new Date().toISOString() };
}

/** Team addresses, names resolved and kept with the address; at most 10, no repeats. */
export async function resolveWatch(core: NameCore, list: WatchIn[]): Promise<WatchEntry[]> {
  if (!list.length) throw new RemoraError("treasury.no_watch", "Watch at least one address.");
  if (list.length > TREASURY_MAX_WATCH)
    throw new RemoraError("treasury.too_many", "A Treasurer watches 10 addresses at most.");
  const out: WatchEntry[] = [];
  for (const w of list) {
    const raw = String(w.address ?? "").trim();
    const label = String(w.label ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, 40);
    let entry: WatchEntry;
    if (isSuiName(raw)) entry = await resolveOrThrow(core, raw);
    else if (/^0x[0-9a-fA-F]{1,64}$/.test(raw)) entry = { address: normalizeSuiAddress(raw) };
    else
      throw new RemoraError("funds.bad_address", `${raw || "That"} isn't a Sui address or name.`);
    if (out.some((x) => x.address === entry.address))
      throw new RemoraError("treasury.duplicate", `${raw} is listed twice.`);
    out.push({ ...entry, ...(label ? { label } : {}) });
  }
  return out;
}

/** Contacts as "name + 0x… or name.sui"; a name is resolved and kept with the address. */
export async function resolveContacts(
  core: NameCore,
  list: { name?: string; address?: string }[],
): Promise<Contact[]> {
  if (list.length > 20) throw new RemoraError("contact.too_many", "At most 20 contacts.");
  const out: Contact[] = [];
  for (const c of list) {
    const raw = String(c.address ?? "").trim();
    const by = isSuiName(raw) ? await resolveOrThrow(core, raw) : null;
    try {
      out.push(
        toContact(
          String(c.name ?? ""),
          by?.address ?? raw,
          by ? { suins: by.suins, resolvedAt: by.resolvedAt } : undefined,
        ),
      );
    } catch (err) {
      throw new RemoraError("contact.invalid", (err as Error).message);
    }
  }
  if (new Set(out.map((c) => c.ref)).size !== out.length)
    throw new RemoraError("contact.invalid", "Two contacts have the same name.");
  return out;
}

const capOf = (v: unknown, what: string) => {
  if (v === undefined || v === null || v === "") return undefined;
  const s = String(v);
  if (!/^\d{1,15}$/.test(s) || BigInt(s) <= 0n)
    throw new RemoraError("treasury.bad_limit", `The ${what} must be a positive amount.`);
  return s;
};

export interface TreasurySetup {
  watch: WatchIn[];
  contacts?: { name?: string; address?: string }[];
  perRequestCap?: string;
  monthlyCap?: string;
}

/** Resolves and checks a setup before anything is written, so a bad name leaves nothing behind. */
export async function resolveSetup(core: NameCore, s: TreasurySetup, current: Contact[] = []) {
  const watch = await resolveWatch(core, s.watch ?? []);
  const contacts = s.contacts ? await resolveContacts(core, s.contacts) : current;
  const perRequestCap = capOf(s.perRequestCap, "per-request limit");
  const monthlyCap = capOf(s.monthlyCap, "monthly limit");
  if (perRequestCap && monthlyCap && BigInt(perRequestCap) > BigInt(monthlyCap))
    throw new RemoraError("treasury.bad_limit", "The per-request limit is above the monthly one.");
  const treasury: TreasuryConfig = {
    watch,
    ...(perRequestCap ? { perRequestCap } : {}),
    ...(monthlyCap ? { monthlyCap } : {}),
  };
  return { treasury, contacts };
}

/**
 * Writes the watch list (and the `chain` trigger the watcher reads), the contacts and the limits as
 * one config version. No signature: the Treasurer has no Disc, and the owner signs every payment.
 */
export async function saveSetup(
  deps: Pick<RuntimeDeps, "db">,
  r: Remora,
  s: { treasury: TreasuryConfig; contacts: Contact[] },
) {
  if (!isTreasurer(r)) throw new RemoraError("treasury.only", `${r.name} isn't a Treasurer.`);
  const { treasury, contacts } = s;
  const n = treasury.watch.length;
  const chain = {
    kind: "chain",
    addresses: treasury.watch.map((w) => w.address),
    objects: [],
    eventTypes: [],
  };
  return saveConfig(
    deps.db,
    r.id,
    (c) => {
      const triggers = ((c.triggers as { kind: string }[] | undefined) ?? []).filter(
        (t) => t.kind !== "chain",
      );
      return { ...c, treasury, contacts, triggers: [chain, ...triggers] };
    },
    {
      summary: () =>
        `${r.name} watches ${n} address${n === 1 ? "" : "es"} and may prepare payments to ${contacts.length} contact${contacts.length === 1 ? "" : "s"}.`,
      payload: { watch: chain.addresses, contacts: contacts.map((c) => c.name) },
    },
  );
}

export async function setupTreasury(
  deps: Pick<RuntimeDeps, "db" | "networks">,
  r: Remora,
  s: TreasurySetup,
) {
  if (!isTreasurer(r)) throw new RemoraError("treasury.only", `${r.name} isn't a Treasurer.`);
  const resolved = await resolveSetup(deps.networks.client(r.network).core, s, contactsOf(r));
  return saveSetup(deps, r, resolved);
}

/** Its weekly report rides the review's job (Monday 09:00, the owner's timezone). */
export const queueTreasuryReport = (deps: Pick<RuntimeDeps, "db">, r: Remora, timezone = "UTC") =>
  queueWeeklyReview(deps, r, nextMonday9(new Date(), timezone));

// ── Flows from the checkpoint stream ────────────────────────────────────────

export interface Flow {
  address: string;
  direction: "in" | "out";
  coinType: string;
  /** Smallest units, absolute. */
  amount: bigint;
  counterparty: string | null;
  digest: string;
}

/** A watched address's balance change, kept as an `episode`; a redelivered one is kept once. */
export async function onTreasuryFlow(
  deps: Pick<RuntimeDeps, "db">,
  r: Remora,
  e: ChainEvent & { counterparty?: string },
  checkpoint?: number,
) {
  if (r.status !== "active" && r.status !== "shadow") return null;
  const coinType = normalizeStructTag(e.coinType);
  const address = normalizeSuiAddress(e.address);
  const [seen] = await deps.db
    .select({ id: remoraEvents.id })
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, r.id),
        eq(remoraEvents.type, "episode"),
        sql`${remoraEvents.payload}->>'digest' = ${e.digest}`,
        sql`${remoraEvents.payload}->>'address' = ${address}`,
        sql`${remoraEvents.payload}->>'coinType' = ${coinType}`,
      ),
    )
    .limit(1);
  if (seen) return null;
  const w = treasuryOf(r).watch.find((x) => normalizeSuiAddress(x.address) === address);
  const who = w?.label ?? w?.suins ?? shortAddress(address);
  const amount = fmtUnits(e.amount, e.decimals);
  const other = e.counterparty ? shortAddress(e.counterparty) : "someone";
  const [ev] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "episode",
      summary:
        e.direction === "in"
          ? `${who} received ${amount} ${symbolOf(coinType)} from ${other}`
          : `${who} sent ${amount} ${symbolOf(coinType)} to ${other}`,
      payload: {
        flow: true,
        address,
        direction: e.direction,
        coinType,
        amount: e.amount.toString(),
        decimals: e.decimals,
        digest: e.digest,
        counterparty: e.counterparty ? normalizeSuiAddress(e.counterparty) : null,
        ...(checkpoint ? { checkpoint } : {}),
      },
    })
    .returning({ id: remoraEvents.id });
  return ev?.id ?? null;
}

const flowOf = (p: Record<string, unknown>): Flow[] =>
  p.flow === true &&
  typeof p.address === "string" &&
  (p.direction === "in" || p.direction === "out") &&
  typeof p.coinType === "string" &&
  typeof p.amount === "string" &&
  /^\d+$/.test(p.amount)
    ? [
        {
          address: p.address,
          direction: p.direction,
          coinType: p.coinType,
          amount: BigInt(p.amount),
          counterparty: typeof p.counterparty === "string" ? p.counterparty : null,
          digest: String(p.digest ?? ""),
        },
      ]
    : [];

// ── The report ──────────────────────────────────────────────────────────────

export interface CoinFlow {
  coinType: string;
  symbol: string;
  decimals: number;
  in: string;
  out: string;
}

export interface TreasuryReport {
  from: string;
  to: string;
  days: number;
  /** Distinct transactions touching a watched address. */
  transfers: number;
  /**
   * The team as one wallet: `in` from outside, `out` to outside (gas included), `internal` moved
   * between watched addresses, `balance` across them (null when a read failed), the burn per day and
   * the runway at that burn (null with no outflow).
   */
  coins: (CoinFlow & {
    internal: string;
    balance: string | null;
    burnPerDay: string;
    runwayDays: number | null;
  })[];
  addresses: {
    address: string;
    label: string | null;
    suins: string | null;
    flows: CoinFlow[];
    balances: { coinType: string; symbol: string; decimals: number; balance: string }[];
  }[];
  /** Who the team moved money with, most transfers first; `team` names a watched address. */
  counterparties: (CoinFlow & { address: string; team: string | null; transfers: number })[];
}

const coinRank = (c: string) => (c === SUI ? 0 : symbolOf(c) === "USDC" ? 1 : 2);

/** The numbers, from the kept flows and the balances read now. */
export function treasuryReport(i: {
  watch: WatchEntry[];
  flows: Flow[];
  balances: { address: string; coinType: string; balance: bigint | null }[];
  from: Date;
  to: Date;
}): TreasuryReport {
  const watched = new Map(i.watch.map((w) => [normalizeSuiAddress(w.address), w]));
  const flows = i.flows
    .map((f) => ({
      ...f,
      address: normalizeSuiAddress(f.address),
      coinType: normalizeStructTag(f.coinType),
      counterparty: f.counterparty ? normalizeSuiAddress(f.counterparty) : null,
    }))
    .filter((f) => watched.has(f.address));
  const balances = i.balances.map((b) => ({
    ...b,
    address: normalizeSuiAddress(b.address),
    coinType: normalizeStructTag(b.coinType),
  }));
  const coins = [...new Set([...flows.map((f) => f.coinType), ...balances.map((b) => b.coinType)])]
    .filter(
      (c) =>
        flows.some((f) => f.coinType === c) ||
        balances.some((b) => b.coinType === c && (b.balance ?? 0n) > 0n),
    )
    .sort((a, b) => coinRank(a) - coinRank(b) || (a < b ? -1 : 1));
  const days = Math.max(1, Math.round((i.to.getTime() - i.from.getTime()) / DAY_MS));
  const sum = (xs: { amount: bigint }[]) => xs.reduce((s, x) => s + x.amount, 0n);
  const internal = (f: (typeof flows)[number]) => !!f.counterparty && watched.has(f.counterparty);
  const meta = (c: string) => ({ coinType: c, symbol: symbolOf(c), decimals: decimalsOf(c) });

  const coinRows = coins.map((c) => {
    const of = flows.filter((f) => f.coinType === c);
    const ins = of.filter((f) => f.direction === "in");
    const outs = of.filter((f) => f.direction === "out");
    const inInternal = sum(ins.filter(internal));
    // An internal transfer's out is its amount plus gas, its in the amount: the team lost the gas.
    const teamOut = sum(outs) > inInternal ? sum(outs) - inInternal : 0n;
    const held = balances.filter((b) => b.coinType === c);
    const balance = held.some((b) => b.balance === null)
      ? null
      : held.reduce((s, b) => s + (b.balance ?? 0n), 0n);
    return {
      ...meta(c),
      in: sum(ins.filter((f) => !internal(f))).toString(),
      out: teamOut.toString(),
      internal: inInternal.toString(),
      balance: balance === null ? null : balance.toString(),
      burnPerDay: (teamOut / BigInt(days)).toString(),
      runwayDays:
        balance === null || teamOut === 0n
          ? null
          : Math.round(((Number(balance) * days) / Number(teamOut)) * 10) / 10,
    };
  });

  const addresses = [...watched.values()].map((w) => {
    const a = normalizeSuiAddress(w.address);
    const of = flows.filter((f) => f.address === a);
    return {
      address: a,
      label: w.label ?? null,
      suins: w.suins ?? null,
      flows: coins
        .filter((c) => of.some((f) => f.coinType === c))
        .map((c) => ({
          ...meta(c),
          in: sum(of.filter((f) => f.coinType === c && f.direction === "in")).toString(),
          out: sum(of.filter((f) => f.coinType === c && f.direction === "out")).toString(),
        })),
      balances: balances
        .filter((b) => b.address === a && b.balance !== null && b.balance > 0n)
        .sort((x, y) => coinRank(x.coinType) - coinRank(y.coinType))
        .map((b) => ({ ...meta(b.coinType), balance: (b.balance ?? 0n).toString() })),
    };
  });

  const byParty = new Map<
    string,
    { address: string; coinType: string; in: bigint; out: bigint; digests: Set<string> }
  >();
  for (const f of flows) {
    if (!f.counterparty) continue;
    const key = `${f.counterparty}|${f.coinType}`;
    const p = byParty.get(key) ?? {
      address: f.counterparty,
      coinType: f.coinType,
      in: 0n,
      out: 0n,
      digests: new Set<string>(),
    };
    if (f.direction === "in") p.in += f.amount;
    else p.out += f.amount;
    p.digests.add(f.digest);
    byParty.set(key, p);
  }
  const counterparties = [...byParty.values()]
    .sort(
      (a, b) =>
        b.digests.size - a.digests.size ||
        (b.in + b.out > a.in + a.out ? 1 : b.in + b.out < a.in + a.out ? -1 : 0),
    )
    .slice(0, 5)
    .map((p) => {
      const w = watched.get(p.address);
      return {
        ...meta(p.coinType),
        address: p.address,
        team: w ? (w.label ?? w.suins ?? shortAddress(p.address)) : null,
        in: p.in.toString(),
        out: p.out.toString(),
        transfers: p.digests.size,
      };
    });

  return {
    from: i.from.toISOString().slice(0, 10),
    to: i.to.toISOString().slice(0, 10),
    days,
    transfers: new Set(flows.map((f) => f.digest)).size,
    coins: coinRows,
    addresses,
    counterparties,
  };
}

/** The report in a few plain lines, from its numbers only. */
export function reportLines(rep: TreasuryReport, pending = 0): string[] {
  const lines = [
    `${rep.addresses.length} team address${rep.addresses.length === 1 ? "" : "es"}, ${rep.from} to ${rep.to}: ${rep.transfers} transfer${rep.transfers === 1 ? "" : "s"}.`,
  ];
  for (const c of rep.coins) {
    const f = (v: string) => fmtUnits(v, c.decimals);
    const moved = BigInt(c.internal) > 0n ? `, ${f(c.internal)} moved inside the team` : "";
    const runway =
      c.balance === null
        ? "balance unavailable"
        : c.runwayDays === null
          ? `balance ${f(c.balance)}, no outflow so no burn`
          : `balance ${f(c.balance)}, runway ${c.runwayDays} days at ${f(c.burnPerDay)} a day`;
    lines.push(`${c.symbol}: ${f(c.in)} in, ${f(c.out)} out${moved}; ${runway}.`);
  }
  for (const a of rep.addresses.filter((x) => x.flows.length)) {
    const name = a.label ?? a.suins ?? shortAddress(a.address);
    lines.push(
      `${name}: ${a.flows.map((x) => `${fmtUnits(x.in, x.decimals)} ${x.symbol} in, ${fmtUnits(x.out, x.decimals)} out`).join("; ")}.`,
    );
  }
  if (rep.counterparties.length)
    lines.push(
      `Top counterparties: ${rep.counterparties
        .map(
          (p) =>
            `${p.team ? `${p.team} (team)` : shortAddress(p.address)} ${p.transfers}x ${p.symbol}`,
        )
        .join(", ")}.`,
    );
  if (pending) lines.push(`${pending} request${pending === 1 ? "" : "s"} wait for your signature.`);
  return lines;
}

type BalanceOf = (address: string, coinType: string) => Promise<bigint>;

const readBalance =
  (deps: Pick<RuntimeDeps, "networks">, r: Remora): BalanceOf =>
  async (owner, coinType) => {
    const res = await deps.networks.client(r.network).core.getBalance({ owner, coinType });
    return BigInt((res as unknown as { balance: { balance: string } }).balance.balance);
  };

const pendingOf = (deps: Pick<RuntimeDeps, "db">, r: Pick<Remora, "id">) =>
  deps.db
    .select()
    .from(approvals)
    .where(
      and(
        eq(approvals.remoraId, r.id),
        eq(approvals.status, "pending"),
        sql`${approvals.payload}->>'treasurer' = 'true'`,
      ),
    )
    .orderBy(desc(approvals.createdAt));

/**
 * Writes a report over the last 7 days: an event (`review`, the weekly review's type, marked
 * `treasury`), a memory, and a notice. Balances are read now over gRPC.
 */
export async function writeTreasuryReport(
  deps: RuntimeDeps,
  r: Remora,
  o: { now?: Date; balanceOf?: BalanceOf } = {},
) {
  const now = o.now ?? new Date();
  const from = new Date(now.getTime() - 7 * DAY_MS);
  const t = treasuryOf(r);
  const rows = await deps.db
    .select({ payload: remoraEvents.payload })
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, r.id),
        eq(remoraEvents.type, "episode"),
        gt(remoraEvents.createdAt, from),
      ),
    )
    .orderBy(desc(remoraEvents.createdAt))
    .limit(2_000);
  const flows = rows.flatMap((x) => flowOf(x.payload));
  const usdcType = deps.networks.config(r.network).usdcCoinType;
  const coins = [...new Set([SUI, normalizeStructTag(usdcType), ...flows.map((f) => f.coinType)])];
  const balanceOf = o.balanceOf ?? readBalance(deps, r);
  const balances = await Promise.all(
    t.watch.flatMap((w) =>
      coins.map(async (coinType) => ({
        address: w.address,
        coinType,
        balance: await balanceOf(w.address, coinType).catch((err) => {
          deps.log.warn("treasury.balance_failed", { remora: r.id, error: err });
          return null;
        }),
      })),
    ),
  );
  const report = treasuryReport({ watch: t.watch, flows, balances, from, to: now });
  const pending = (await pendingOf(deps, r)).length;
  const lines = reportLines(report, pending);
  const text = `TREASURY ${report.from}..${report.to} · ${lines.join(" · ")}`;
  const saved = await deps.memory
    .remember(r, "episodes", "episode", text.slice(0, 1_800), { dedupe: false })
    .catch((err) => {
      deps.log.warn("treasury.memory_failed", { remora: r.id, error: err });
      return null;
    });
  const [e] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "review",
      summary: `${r.name}'s treasury report, ${report.from} to ${report.to}`,
      payload: {
        treasury: true,
        lines,
        report,
        model: "remora/no-model",
        ...(saved?.indexId ? { memoryId: saved.indexId } : {}),
      },
    })
    .returning();
  await deps.notifier
    .send(r.ownerAddress, {
      text: `${r.name}'s treasury report:\n${lines.map((l) => `• ${l}`).join("\n")}`,
      buttons: [{ label: "Open", url: `${deps.webBase}/remoras/${r.id}` }],
    })
    .catch((err) => deps.log.warn("treasury.notify_failed", { remora: r.id, error: err }));
  return e;
}

const isReport = sql`${remoraEvents.payload}->>'treasury' = 'true'`;

/** The last few reports, newest first. */
export async function reportsOf(deps: Pick<RuntimeDeps, "db" | "webBase">, r: Pick<Remora, "id">) {
  const rows = await deps.db
    .select()
    .from(remoraEvents)
    .where(and(eq(remoraEvents.remoraId, r.id), eq(remoraEvents.type, "review"), isReport))
    .orderBy(desc(remoraEvents.createdAt))
    .limit(4);
  return rows.map((x) => {
    const p = x.payload as { lines: string[]; report: TreasuryReport; shareToken?: string };
    return {
      id: x.id,
      at: x.createdAt.toISOString(),
      lines: p.lines,
      report: p.report,
      shareUrl: p.shareToken ? publicReportUrl(deps.webBase, p.shareToken) : null,
    };
  });
}

// ── Sharing a report (G6's pattern) ─────────────────────────────────────────

export const publicReportUrl = (webBase: string, token: string) =>
  `${webBase.replace(/\/$/, "")}/t/${token}`;

async function ownedReport(deps: Pick<RuntimeDeps, "db">, owner: string, eventId: string) {
  const [row] = await deps.db
    .select({ e: remoraEvents, owner: remoras.ownerAddress })
    .from(remoraEvents)
    .innerJoin(remoras, eq(remoras.id, remoraEvents.remoraId))
    .where(and(eq(remoraEvents.id, eventId), eq(remoraEvents.type, "review"), isReport));
  if (!row || normalizeSuiAddress(row.owner) !== normalizeSuiAddress(owner))
    throw new RemoraError("treasury.report_not_found", "No such report.", 404);
  return row.e;
}

/** Idempotent: a shared report answers with its token. */
export async function shareReport(
  deps: Pick<RuntimeDeps, "db" | "webBase">,
  owner: string,
  eventId: string,
) {
  const e = await ownedReport(deps, owner, eventId);
  let token = (e.payload as { shareToken?: string }).shareToken;
  if (!token) {
    token = randomBytes(16).toString("base64url");
    await deps.db
      .update(remoraEvents)
      .set({ payload: { ...e.payload, shareToken: token, sharedAt: new Date().toISOString() } })
      .where(eq(remoraEvents.id, e.id));
  }
  return { token, url: publicReportUrl(deps.webBase, token) };
}

export async function unshareReport(deps: Pick<RuntimeDeps, "db">, owner: string, eventId: string) {
  const e = await ownedReport(deps, owner, eventId);
  const { shareToken: _t, sharedAt: _s, ...rest } = e.payload as Record<string, unknown>;
  await deps.db.update(remoraEvents).set({ payload: rest }).where(eq(remoraEvents.id, e.id));
  return { ok: true as const };
}

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;

/**
 * The allow-listed view: the period, the team's totals and runway, each address by its label and a
 * shortened address with its in and out, and the counterparties shortened. Never full addresses,
 * `.sui` names, per-address balances, requests, memos or the owner.
 */
export function redactReport(name: string, network: string, rep: TreasuryReport) {
  return {
    v: 1 as const,
    remora: name.slice(0, 64),
    network,
    from: rep.from,
    to: rep.to,
    days: rep.days,
    transfers: rep.transfers,
    coins: rep.coins.map((c) => ({
      symbol: c.symbol,
      decimals: c.decimals,
      in: c.in,
      out: c.out,
      internal: c.internal,
      balance: c.balance,
      burnPerDay: c.burnPerDay,
      runwayDays: c.runwayDays,
    })),
    addresses: rep.addresses.map((a, i) => ({
      label: (a.label ?? `Address ${i + 1}`).slice(0, 40),
      address: shortAddress(a.address),
      flows: a.flows.map((f) => ({
        symbol: f.symbol,
        decimals: f.decimals,
        in: f.in,
        out: f.out,
      })),
    })),
    counterparties: rep.counterparties.map((p) => ({
      who: p.team ? "a team address" : shortAddress(p.address),
      symbol: p.symbol,
      decimals: p.decimals,
      in: p.in,
      out: p.out,
      transfers: p.transfers,
    })),
  };
}

export type PublicReport = ReturnType<typeof redactReport>;

export async function publicReport(deps: Pick<RuntimeDeps, "db">, token: string) {
  if (!TOKEN.test(token)) return null;
  const [row] = await deps.db
    .select({ e: remoraEvents, name: remoras.name })
    .from(remoraEvents)
    .innerJoin(remoras, eq(remoras.id, remoraEvents.remoraId))
    .where(
      and(
        eq(remoraEvents.type, "review"),
        isReport,
        sql`${remoraEvents.payload}->>'shareToken' = ${token}`,
      ),
    )
    .limit(1);
  if (!row) return null;
  return redactReport(
    row.name,
    row.e.network,
    (row.e.payload as { report: TreasuryReport }).report,
  );
}

// ── Spend requests ──────────────────────────────────────────────────────────

export interface SpendRequest {
  who: string;
  /** Smallest USDC units. */
  amount: bigint;
  memo: string;
}

const units = (v: string) => {
  const [w = "0", f = ""] = v.replace(",", ".").split(".");
  return BigInt(w) * 1_000_000n + BigInt(`${f}000000`.slice(0, 6));
};

const VERB = "(?:please\\s+)?(?:pay|send|give|transfer|trả|gửi|chuyển)";
const AMOUNT = "\\$?(\\d{1,6}(?:[.,]\\d{1,6})?)\\s*(?:usdc|usd|\\$)?";
const MEMO = "(?:\\s+(?:for|as|cho|tiền|về)\\s+(.+))?";
const AMOUNT_FIRST = new RegExp(`^${VERB}\\s+${AMOUNT}\\s+(?:to|cho)\\s+(.+?)${MEMO}$`, "iu");
const WHO_FIRST = new RegExp(`^${VERB}\\s+(?:to\\s+)?(.+?)\\s+${AMOUNT}${MEMO}$`, "iu");

/**
 * "pay 0.30 to huy.sui for design", "pay Huy 0.3 USDC for the logo", or a JSON body: `{"text": …}`
 * or `{"to", "amount", "memo"}`. Plain words only; anything else is null, never a guess.
 */
export function parseSpendRequest(input: string): SpendRequest | null {
  const raw = input.trim();
  if (raw.startsWith("{")) {
    let j: Record<string, unknown> | null = null;
    try {
      j = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      return null;
    }
    if (!j || typeof j !== "object") return null;
    if (typeof j.text === "string") return parseSpendRequest(j.text.slice(0, 500));
    const to = j.to ?? j.payee;
    const amount = typeof j.amount === "number" ? String(j.amount) : j.amount;
    const memo = j.memo ?? j.reason ?? j.for;
    if (typeof to !== "string" || typeof amount !== "string") return null;
    if (!/^\d{1,6}(?:[.,]\d{1,6})?$/.test(amount.trim())) return null;
    return {
      who: to.trim().slice(0, 80),
      amount: units(amount.trim()),
      memo: typeof memo === "string" ? memo.trim().slice(0, 140) : "",
    };
  }
  const t = raw.replace(/\s+/g, " ").replace(/[.!]+$/, "");
  const a = AMOUNT_FIRST.exec(t);
  if (a?.[1] && a[2])
    return { who: a[2].trim(), amount: units(a[1]), memo: (a[3] ?? "").trim().slice(0, 140) };
  const b = WHO_FIRST.exec(t);
  if (b?.[1] && b[2])
    return { who: b[1].trim(), amount: units(b[2]), memo: (b[3] ?? "").trim().slice(0, 140) };
  return null;
}

/** A contact by name, by the `.sui` name it was added by, or by its address. */
export function findPayee(r: { config: unknown }, who: string): Contact | null {
  const w = who.trim();
  if (isSuiName(w)) {
    const name = canonicalName(w);
    return contactsOf(r).find((c) => c.suins === name) ?? null;
  }
  if (/^0x[0-9a-fA-F]{1,64}$/.test(w)) {
    const a = normalizeSuiAddress(w);
    return contactsOf(r).find((c) => c.address === a) ?? null;
  }
  return findContact(r, w);
}

export type RequestFrom =
  | { kind: "owner"; channel: "web" | "telegram" }
  | { kind: "webhook"; hookId: string; name?: string };

export const fromLabel = (f: RequestFrom) =>
  f.kind === "owner"
    ? f.channel === "telegram"
      ? "you, in Telegram"
      : "you"
    : `webhook ${f.name ?? f.hookId.slice(0, 8)}`;

export interface Check {
  ok: boolean;
  text: string;
}

export interface TreasuryRequestResult {
  answer: string;
  outcome: "asked" | "declined" | "unclear";
  eventId: string;
  approvalId?: string;
  checks: Check[];
}

/** What this Treasurer has asked for this calendar month (UTC), pending or paid. */
async function askedThisMonth(deps: Pick<RuntimeDeps, "db">, r: Pick<Remora, "id">, now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const rows = await deps.db
    .select({ payload: approvals.payload, status: approvals.status })
    .from(approvals)
    .where(
      and(
        eq(approvals.remoraId, r.id),
        gt(approvals.createdAt, start),
        sql`${approvals.payload}->>'treasurer' = 'true'`,
      ),
    );
  return rows
    .filter((x) => x.status === "pending" || x.status === "approved")
    .reduce((s, x) => s + BigInt(String((x.payload as { amount?: string }).amount ?? "0")), 0n);
}

/**
 * A spend request, from the owner or from outside. It never pays: a request that passes the checks
 * becomes an approval the owner pays from their own wallet; one that doesn't is declined with why.
 * A webhook's text is data, read only by `parseSpendRequest`; it can't add a contact or change a limit.
 */
export async function spendRequest(
  deps: RuntimeDeps,
  r: Remora,
  text: string,
  from: RequestFrom,
  now = new Date(),
): Promise<TreasuryRequestResult> {
  const question = text.trim().slice(0, 500);
  const who = fromLabel(from);
  const fromPayload =
    from.kind === "owner"
      ? { kind: "owner", channel: from.channel }
      : { kind: "webhook", hookId: from.hookId, ...(from.name ? { name: from.name } : {}) };
  const checks: Check[] = [];

  const decline = async (
    outcome: "declined" | "unclear",
    code: string,
    answer: string,
    extra: Record<string, unknown> = {},
  ): Promise<TreasuryRequestResult> => {
    const [e] = await deps.db
      .insert(remoraEvents)
      .values(
        from.kind === "owner"
          ? {
              remoraId: r.id,
              network: r.network,
              type: "answer",
              summary: question.slice(0, 140),
              payload: { question, answer, code, from: fromPayload, ...extra },
            }
          : {
              remoraId: r.id,
              network: r.network,
              type: "blocked",
              summary: `Didn't take a request from ${who}: ${answer}`.slice(0, 280),
              payload: { code, from: fromPayload, text: question.slice(0, 200), ...extra },
            },
      )
      .returning({ id: remoraEvents.id });
    // Someone else asked: the owner hears that it was turned down, not urgently.
    if (from.kind === "webhook")
      await deps.notifier
        .send(r.ownerAddress, {
          text: `${r.name} turned down a request from ${who}: ${answer}`,
          buttons: [{ label: "Open", url: `${deps.webBase}/remoras/${r.id}` }],
        })
        .catch((err) => deps.log.warn("treasury.notify_failed", { remora: r.id, error: err }));
    return { answer, outcome, eventId: e?.id ?? "", checks };
  };

  if (r.status !== "active" && r.status !== "shadow")
    return decline("declined", "remora.not_active", `${r.name} is ${r.status}.`);
  const parsed = parseSpendRequest(question);
  const names = contactsOf(r)
    .map((c) => (c.suins ? `${c.name} (${c.suins})` : c.name))
    .join(", ");
  if (!parsed || parsed.amount <= 0n)
    return decline(
      "unclear",
      "treasury.unclear",
      `I read requests like "pay 0.30 to ${contactsOf(r)[0]?.suins ?? "huy.sui"} for design". I can prepare payments to: ${names || "nobody yet"}.`,
    );
  const contact = findPayee(r, parsed.who);
  if (!contact)
    return decline(
      "declined",
      "treasury.not_contact",
      `${parsed.who.slice(0, 80)} isn't one of my contacts, so I can't prepare a payment to them. I can prepare payments to: ${names || "nobody yet"}.`,
      { who: parsed.who.slice(0, 80) },
    );
  checks.push({
    ok: true,
    text: `${contact.name}${contact.suins ? ` (${contact.suins})` : ""} is a contact.`,
  });
  // ADR-0144: a contact added by name is paid only while the name points where it did.
  if (contact.suins) {
    const moved = await nameMoved(deps.networks.client(r.network).core, contact).catch(
      () => "unchecked" as const,
    );
    if (moved === "unchecked")
      return decline(
        "declined",
        "name.unchecked",
        `I couldn't check where ${contact.suins} points right now. Try again in a minute.`,
      );
    if (moved)
      return decline(
        "declined",
        "name.moved",
        `${moved.name} now points to ${moved.now ? shortAddress(moved.now) : "nobody"}, not ${shortAddress(contact.address)}, the address you added. Add ${contact.name} again if that's right.`,
        { name: contact.suins, now: moved.now },
      );
    checks.push({
      ok: true,
      text: `${contact.suins} still points to ${shortAddress(contact.address)}.`,
    });
  }
  const { perRequestCap, monthlyCap } = limitsOf(treasuryOf(r));
  if (parsed.amount > perRequestCap)
    return decline(
      "declined",
      "treasury.over_request_limit",
      `${usdc(parsed.amount)} USDC is over the ${usdc(perRequestCap)} limit for one request.`,
      { amount: parsed.amount.toString() },
    );
  checks.push({
    ok: true,
    text: `${usdc(parsed.amount)} USDC is within the ${usdc(perRequestCap)} limit for one request.`,
  });
  const month = await askedThisMonth(deps, r, now);
  if (month + parsed.amount > monthlyCap)
    return decline(
      "declined",
      "treasury.over_monthly_limit",
      `${usdc(parsed.amount)} USDC would take this month's requests to ${usdc(month + parsed.amount)}, over the ${usdc(monthlyCap)} monthly limit.`,
      { amount: parsed.amount.toString() },
    );
  checks.push({
    ok: true,
    text: `This month: ${usdc(month + parsed.amount)} of ${usdc(monthlyCap)} USDC with this one.`,
  });
  checks.push(
    from.kind === "owner"
      ? { ok: true, text: `Asked by ${who}. It still waits for your signature.` }
      : { ok: false, text: `Asked by ${who}, not you, so only your signature pays it.` },
  );

  const memo = parsed.memo;
  const summary = `Pay ${usdc(parsed.amount)} USDC to ${contact.name}${memo ? ` for ${memo}` : ""}? Asked by ${who}.`;
  const [a] = await deps.db
    .insert(approvals)
    .values({
      remoraId: r.id,
      network: r.network,
      kind: "over_limit_payment",
      summary: summary.slice(0, 280),
      payload: {
        // Paid by `approvalPay`'s contact path: the owner's own transfer to the contact's address.
        payee: contact.ref,
        payTo: contact.address,
        amount: parsed.amount.toString(),
        url: contactPayUrl(contact, memo),
        reason: memo,
        question,
        contact: true,
        treasurer: true,
        from: fromPayload,
        checks,
        ...(contact.suins ? { suins: contact.suins } : {}),
      },
    })
    .returning({ id: approvals.id });
  const approvalId = a?.id ?? "";
  const answer = `${summary.replace(/\?.*$/, "")}: it waits for your signature. Pay it from your wallet on my page or in Approvals.`;
  const [e] = await deps.db
    .insert(remoraEvents)
    .values({
      remoraId: r.id,
      network: r.network,
      type: "approval_needed",
      summary: summary.slice(0, 280),
      payload: {
        approvalId,
        payee: contact.ref,
        amount: parsed.amount.toString(),
        from: fromPayload,
        ...(from.kind === "owner" ? { question, answer } : {}),
      },
    })
    .returning({ id: remoraEvents.id });
  await deps.notifier
    .send(r.ownerAddress, {
      text: `${r.name}: ${summary}`,
      urgent: true,
      buttons: [
        { label: "Pay from my wallet", url: `${deps.webBase}/remoras/${r.id}` },
        { label: "Approvals", url: `${deps.webBase}/approvals` },
      ],
    })
    .catch((err) => deps.log.warn("treasury.notify_failed", { remora: r.id, error: err }));
  return { answer, outcome: "asked", approvalId, eventId: e?.id ?? "", checks };
}

/** A webhook delivery's body as a request (`{"text": …}`, `{"to", "amount", "memo"}` or plain text). */
export const hookRequestText = (body: string) => body.trim().slice(0, 2_000);

// ── What the card shows ─────────────────────────────────────────────────────

export async function treasuryView(deps: RuntimeDeps, r: Remora, now = new Date()) {
  const t = treasuryOf(r);
  const { perRequestCap, monthlyCap } = limitsOf(t);
  const pending = await pendingOf(deps, r);
  const reports = await reportsOf(deps, r);
  return {
    watch: t.watch.map((w) => ({
      address: w.address,
      label: w.label ?? null,
      suins: w.suins ?? null,
    })),
    contacts: contactsOf(r).map((c) => ({
      name: c.name,
      address: c.address,
      suins: c.suins ?? null,
    })),
    limits: {
      perRequestCap: perRequestCap.toString(),
      monthlyCap: monthlyCap.toString(),
      askedThisMonth: (await askedThisMonth(deps, r, now)).toString(),
    },
    reports,
    pending: pending.map((a) => {
      const p = a.payload as {
        payee?: string;
        payTo?: string;
        amount?: string;
        reason?: string;
        from?: { kind?: string; channel?: string; name?: string; hookId?: string };
        checks?: Check[];
        suins?: string;
      };
      return {
        approvalId: a.id,
        summary: a.summary,
        payTo: p.payTo ?? "",
        amount: p.amount ?? "0",
        reason: p.reason ?? "",
        suins: p.suins ?? null,
        from:
          p.from?.kind === "webhook"
            ? `webhook ${p.from.name ?? String(p.from.hookId ?? "").slice(0, 8)}`
            : p.from?.channel === "telegram"
              ? "you, in Telegram"
              : "you",
        checks: (p.checks ?? []).slice(0, 8),
        createdAt: a.createdAt.toISOString(),
      };
    }),
  };
}
