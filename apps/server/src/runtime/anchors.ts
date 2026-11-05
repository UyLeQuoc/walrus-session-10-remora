/**
 * U19 B2 (ADR-0139): Merkle anchors for what a remora did without paying. A paid Wake is already
 * onchain as `Paid.intent`; this covers the rest:
 * - Wakes that aren't a settled payment (answers, pings, digests, refused or failed payments);
 * - config changes (`config_changed` events);
 * - memory writes that landed on Walrus.
 *
 * Each becomes a `sha256` leaf of its canonical JSON. A batch builds a sorted-pair Merkle tree, the
 * remora's own key calls `remora_anchor::anchor(root, …)` with the gas station's sponsor paying gas,
 * and a `wakes.anchored` event keeps the root, the leaves in order and the digest. Anchored Wakes
 * get `receipts.anchored`. An hourly job runs a batch for every remora with something new.
 */
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { Logger, SuiNetwork } from "@remora/chain";
import {
  and,
  asc,
  type Db,
  desc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  or,
  receipts,
  remoraEvents,
  remoraMemories,
  remoras,
  sql,
} from "@remora/db";
import { type AnchorArgs, anchoredEvents, buildAnchor } from "@remora/disc-sdk";
import {
  type AnchorLeaf,
  DEPLOYMENTS,
  merkleLeaf,
  merkleProof,
  merkleRoot,
  Wake,
  WakesAnchored,
  wakeLeaf,
} from "@remora/schema";
import { Sponsor } from "@remora/signer";
import type { Networks } from "../money/networks.ts";
import { enqueue, type JobHandler } from "./jobs.ts";
import type { Remora } from "./remoras.ts";

export const ANCHOR_EVENT = "wakes.anchored";
export const ANCHOR_JOB = "wakes.anchor_hourly";
/** A proof stays at most 8 steps; the rest waits for the next batch. */
export const ANCHOR_MAX_LEAVES = 256;
/** An owner's "anchor now" runs at most this often per remora. */
export const ANCHOR_MIN_GAP_MS = 5 * 60_000;
/** Remoras anchored per hourly run, so one busy hour can't drain the gas station. */
const ANCHOR_MAX_PER_RUN = 20;
const HOUR_MS = 3_600_000;

export interface Candidate extends AnchorLeaf {
  at: Date;
}

export interface AnchorSigner {
  network: SuiNetwork;
  /** The remora's signing key (B4), whose address becomes the event's `anchorer`. */
  keyId: string;
  address: string;
}

export interface AnchorChain {
  /** `remora_anchor` on this network, or null where it can't anchor (not published, no sponsor). */
  packageId(network: SuiNetwork): string | null;
  anchor(
    signer: AnchorSigner,
    a: AnchorArgs & { packageId: string },
  ): Promise<{ digest: string; anchorer: string }>;
}

export interface AnchorDeps {
  db: Db;
  log: Logger;
  chain: AnchorChain;
}

export type AnchorOutcome =
  | { ok: true; digest: string; root: string; count: number; fromMs: number; toMs: number }
  | {
      ok: false;
      reason: "unavailable" | "no_key" | "nothing_new" | "busy" | "too_soon";
      message: string;
    };

/** A config change's leaf: the event as stored, so an auditor holding it can recompute it. */
export const configLeaf = (e: {
  id: string;
  remoraId: string;
  createdAt: Date;
  payload: Record<string, unknown>;
}) =>
  merkleLeaf({
    kind: "config",
    id: e.id,
    remora: e.remoraId,
    at: e.createdAt.toISOString(),
    payload: e.payload,
  });

/** A memory write's leaf: its ids and hashes, never its text (the text stays on Walrus). */
export const memoryLeaf = (m: {
  id: string;
  remoraId: string;
  namespace: string;
  type: string | null;
  textSha256: string | null;
  blobId: string | null;
  createdAt: Date;
}) =>
  merkleLeaf({
    kind: "memory",
    id: m.id,
    remora: m.remoraId,
    namespace: m.namespace,
    type: m.type,
    textSha256: m.textSha256,
    blobId: m.blobId,
    at: m.createdAt.toISOString(),
  });

const keyOf = (l: { kind: string; ref: string }) => `${l.kind}:${l.ref}`;

/** The next batch: what isn't anchored yet, oldest first, at most `max`. */
export function pickBatch(
  candidates: Candidate[],
  anchored: ReadonlySet<string>,
  max = ANCHOR_MAX_LEAVES,
): Candidate[] {
  return candidates
    .filter((c) => !anchored.has(keyOf(c)))
    .sort(
      (a, b) =>
        a.at.getTime() - b.at.getTime() ||
        a.kind.localeCompare(b.kind) ||
        a.ref.localeCompare(b.ref),
    )
    .slice(0, max);
}

/** Every Wake but a payment with its transaction, which `Paid.intent` already anchors (G2). */
export function unpaidWakeCandidates(
  rows: { id: string; wake: unknown; txDigest: string | null; createdAt: Date }[],
): Candidate[] {
  const out: Candidate[] = [];
  for (const row of rows) {
    const wake = Wake.safeParse(row.wake);
    if (!wake.success) continue;
    if (row.txDigest && wake.data.intent.decision.action === "pay") continue;
    out.push({ kind: "wake", ref: row.id, leaf: wakeLeaf(wake.data), at: row.createdAt });
  }
  return out;
}

async function anchoredKeys(db: Db, remoraId: string): Promise<Set<string>> {
  const rows = await db
    .select({ payload: remoraEvents.payload })
    .from(remoraEvents)
    .where(and(eq(remoraEvents.remoraId, remoraId), eq(remoraEvents.type, ANCHOR_EVENT)));
  const keys = new Set<string>();
  for (const row of rows) {
    const batch = WakesAnchored.safeParse(row.payload);
    if (batch.success) for (const l of batch.data.leaves) keys.add(keyOf(l));
  }
  return keys;
}

/** Everything of this remora's that isn't anchored yet, oldest first. */
export async function pendingLeaves(db: Db, r: Remora, max = ANCHOR_MAX_LEAVES) {
  const [wakes, configs, memories, anchored] = await Promise.all([
    db
      .select({
        id: receipts.id,
        wake: receipts.wake,
        txDigest: receipts.txDigest,
        createdAt: receipts.createdAt,
      })
      .from(receipts)
      .where(
        and(
          eq(receipts.remoraId, r.id),
          eq(receipts.network, r.network),
          eq(receipts.anchored, false),
          or(
            isNull(receipts.txDigest),
            sql`${receipts.wake}->'intent'->'decision'->>'action' <> 'pay'`,
          ),
        ),
      )
      .orderBy(asc(receipts.createdAt))
      .limit(max),
    db
      .select()
      .from(remoraEvents)
      .where(and(eq(remoraEvents.remoraId, r.id), eq(remoraEvents.type, "config_changed")))
      .orderBy(asc(remoraEvents.createdAt)),
    db
      .select()
      .from(remoraMemories)
      .where(
        and(
          eq(remoraMemories.remoraId, r.id),
          eq(remoraMemories.status, "stored"),
          isNotNull(remoraMemories.blobId),
        ),
      )
      .orderBy(asc(remoraMemories.createdAt)),
    anchoredKeys(db, r.id),
  ]);
  const candidates: Candidate[] = [
    ...unpaidWakeCandidates(wakes),
    ...configs.map((e) => ({
      kind: "config" as const,
      ref: e.id,
      leaf: configLeaf(e),
      at: e.createdAt,
    })),
    ...memories.map((m) => ({
      kind: "memory" as const,
      ref: m.id,
      leaf: memoryLeaf(m),
      at: m.createdAt,
    })),
  ];
  return pickBatch(candidates, anchored, max);
}

const running = new Set<string>();

/** One batch for one remora: build the tree, anchor its root, record it. */
export async function anchorBatch(
  deps: AnchorDeps,
  r: Remora,
  opts: { minGapMs?: number; now?: Date } = {},
): Promise<AnchorOutcome> {
  const packageId = deps.chain.packageId(r.network);
  if (!packageId)
    return {
      ok: false,
      reason: "unavailable",
      message: `Anchoring isn't available on ${r.network}.`,
    };
  if (!r.address) return { ok: false, reason: "no_key", message: "This remora has no key yet." };
  if (running.has(r.id))
    return { ok: false, reason: "busy", message: "A batch for this remora is already running." };
  running.add(r.id);
  try {
    if (opts.minGapMs) {
      const [last] = await deps.db
        .select({ at: remoraEvents.createdAt })
        .from(remoraEvents)
        .where(and(eq(remoraEvents.remoraId, r.id), eq(remoraEvents.type, ANCHOR_EVENT)))
        .orderBy(desc(remoraEvents.createdAt))
        .limit(1);
      const now = (opts.now ?? new Date()).getTime();
      if (last && now - last.at.getTime() < opts.minGapMs)
        return {
          ok: false,
          reason: "too_soon",
          message: `It anchored less than ${Math.round(opts.minGapMs / 60_000)} minutes ago. Try again later.`,
        };
    }
    const batch = await pendingLeaves(deps.db, r);
    if (!batch.length)
      return {
        ok: false,
        reason: "nothing_new",
        message: "Everything it did is anchored already.",
      };
    const root = merkleRoot(batch.map((c) => c.leaf));
    const times = batch.map((c) => c.at.getTime());
    const fromMs = Math.min(...times);
    const toMs = Math.max(...times);
    const { digest, anchorer } = await deps.chain.anchor(
      {
        network: r.network,
        keyId: String((r.config as { keyId?: string }).keyId ?? r.id),
        address: r.address,
      },
      { packageId, root, count: batch.length, fromMs, toMs },
    );
    const payload: WakesAnchored = {
      network: r.network,
      packageId,
      anchorer,
      root,
      digest,
      count: batch.length,
      fromMs,
      toMs,
      leaves: batch.map(({ kind, ref, leaf }) => ({ kind, ref, leaf })),
    };
    const wakeIds = batch.filter((c) => c.kind === "wake").map((c) => c.ref);
    await deps.db.transaction(async (tx) => {
      await tx.insert(remoraEvents).values({
        remoraId: r.id,
        network: r.network,
        type: ANCHOR_EVENT,
        summary: `Anchored ${batch.length} record${batch.length === 1 ? "" : "s"} onchain`,
        payload,
      });
      if (wakeIds.length)
        await tx.update(receipts).set({ anchored: true }).where(inArray(receipts.id, wakeIds));
    });
    deps.log.info("anchor.done", {
      remora: r.id,
      network: r.network,
      digest,
      count: batch.length,
    });
    return { ok: true, digest, root, count: batch.length, fromMs, toMs };
  } finally {
    running.delete(r.id);
  }
}

export interface FoundAnchor {
  batch: WakesAnchored;
  index: number;
  proof: string[];
  anchoredAt: Date;
}

/** The batch that holds this record, with its proof; null while it isn't anchored. */
export async function findAnchor(
  db: Db,
  remoraId: string,
  kind: AnchorLeaf["kind"],
  ref: string,
): Promise<FoundAnchor | null> {
  if (!/^[0-9a-f-]{36}$/.test(remoraId)) return null;
  const rows = await db
    .select({ payload: remoraEvents.payload, createdAt: remoraEvents.createdAt })
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, remoraId),
        eq(remoraEvents.type, ANCHOR_EVENT),
        sql`${remoraEvents.payload}->'leaves' @> ${JSON.stringify([{ kind, ref }])}::jsonb`,
      ),
    )
    .orderBy(asc(remoraEvents.createdAt))
    .limit(1);
  const row = rows[0];
  const batch = row ? WakesAnchored.safeParse(row.payload) : null;
  if (!row || !batch?.success) return null;
  const index = batch.data.leaves.findIndex((l) => l.kind === kind && l.ref === ref);
  if (index < 0) return null;
  return {
    batch: batch.data,
    index,
    proof: merkleProof(
      batch.data.leaves.map((l) => l.leaf),
      index,
    ),
    anchoredAt: row.createdAt,
  };
}

export const nextHour = (now: Date) =>
  new Date(Math.floor(now.getTime() / HOUR_MS) * HOUR_MS + HOUR_MS);

/** Idempotent per hour, so every server start and every run can queue the next one. */
export const queueAnchorRun = (db: Db, at: Date) =>
  enqueue(db, {
    kind: ANCHOR_JOB,
    payload: {},
    idempotencyKey: `${ANCHOR_JOB}:${at.toISOString().slice(0, 13)}`,
    runAt: at,
    maxAttempts: 2,
  });

/** The hourly run: queues the next hour first, then one batch per remora with something new. */
export function anchorJobHandlers(deps: AnchorDeps): Record<string, JobHandler> {
  return {
    [ANCHOR_JOB]: async (_payload, job) => {
      await queueAnchorRun(deps.db, nextHour(new Date(Math.max(Date.now(), job.runAt.getTime()))));
      const live = await deps.db
        .select()
        .from(remoras)
        .where(
          and(
            eq(remoras.playground, false),
            isNotNull(remoras.address),
            ne(remoras.status, "retired"),
          ),
        );
      let anchored = 0;
      for (const r of live) {
        if (anchored >= ANCHOR_MAX_PER_RUN) break;
        if (!deps.chain.packageId(r.network)) continue;
        const out = await anchorBatch(deps, r).catch((err) => {
          deps.log.warn("anchor.failed", { remora: r.id, error: err });
          return null;
        });
        if (out?.ok) anchored += 1;
      }
    },
  };
}

type GasCoin = { objectId: string; version: string; digest: string; balance: string };

/**
 * The facilitator's gas pool only takes sponsor coins of at least `min(SPONSOR_MAX_GAS_BUDGET, 0.02
 * SUI)` (apps/facilitator). Anchors pay only with coins under that floor, so the two never sign the
 * same coin version: an owned coin signed twice can stay locked until the epoch ends.
 */
export const poolFloor = (maxGasBudget: bigint) =>
  maxGasBudget < 20_000_000n ? maxGasBudget : 20_000_000n;

export const ANCHOR_GAS_BUDGET = 5_000_000n;

/** The sponsor's coins under the pool's floor, largest first, while they're needed for the budget. */
export function anchorGas(coins: GasCoin[], floor: bigint, budget = ANCHOR_GAS_BUDGET) {
  const small = coins
    .filter((c) => BigInt(c.balance) > 0n && BigInt(c.balance) < floor)
    .sort((a, b) => (BigInt(b.balance) > BigInt(a.balance) ? 1 : -1))
    .slice(0, 32);
  const total = small.reduce((s, c) => s + BigInt(c.balance), 0n);
  return total >= budget
    ? small.map(({ objectId, version, digest }) => ({ objectId, version, digest }))
    : null;
}

/** The real chain: the remora's key signs, the gas station's sponsor co-signs as gas owner. */
export function createAnchorChain(o: {
  networks: Networks;
  signTransaction: (keyId: string, bytes: Uint8Array) => Promise<string>;
  /** The gas station's sponsor key per network (`SPONSOR_PRIVATE_KEY[_TESTNET]`). */
  sponsorKey: (network: SuiNetwork) => string | undefined;
  /** `SPONSOR_MAX_GAS_BUDGET`, which sets the facilitator pool's floor. */
  maxGasBudget: bigint;
  log: Logger;
}): AnchorChain {
  // One anchor at a time in this process: two would pick the same small coins.
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(f: () => Promise<T>): Promise<T> => {
    const run = queue.then(f, f);
    queue = run.catch(() => undefined);
    return run;
  };
  const floor = poolFloor(o.maxGasBudget);
  const packageId = (n: SuiNetwork) => {
    const id = DEPLOYMENTS[n].anchorPackageId;
    return id && o.sponsorKey(n) && o.networks.config(n).available ? id : null;
  };

  async function coinsOf(n: SuiNetwork, owner: string): Promise<GasCoin[]> {
    const { objects } = await o.networks
      .client(n)
      .core.listCoins({ owner, coinType: "0x2::sui::SUI" });
    return objects;
  }

  /**
   * Splits three coins under the floor off the sponsor's last big coin (the pool takes the first one
   * it finds), sent to the sponsor itself: it never pays anyone else.
   */
  async function refill(n: SuiNetwork, sponsor: Sponsor, key: string) {
    const client = o.networks.client(n);
    const each = (floor * 3n) / 4n;
    const big = (await coinsOf(n, sponsor.address))
      .filter((c) => BigInt(c.balance) >= floor + each * 3n + ANCHOR_GAS_BUDGET)
      .at(-1);
    if (!big) throw new Error("the gas station has no coin to split for anchors");
    const self = Ed25519Keypair.fromSecretKey(key);
    const tx = new Transaction();
    tx.setSender(sponsor.address);
    tx.setGasPayment([{ objectId: big.objectId, version: big.version, digest: big.digest }]);
    tx.setGasBudget(ANCHOR_GAS_BUDGET);
    const parts = tx.splitCoins(tx.gas, [each, each, each]);
    tx.transferObjects([parts[0], parts[1], parts[2]], sponsor.address);
    const bytes = await tx.build({ client });
    const { signature } = await self.signTransaction(bytes);
    const res = await client.core.executeTransaction({
      transaction: bytes,
      signatures: [signature],
      include: { effects: true },
    });
    const done = res.Transaction ?? res.FailedTransaction;
    if (!done.effects?.status.success) throw new Error(`anchor gas refill failed: ${done.digest}`);
    await client.core.waitForTransaction({ digest: done.digest });
    o.log.info("anchor.gas_refill", { network: n, digest: done.digest });
  }

  return {
    packageId,
    anchor: (signer, a) =>
      serial(async () => {
        const n = signer.network;
        const key = o.sponsorKey(n);
        if (!key || !packageId(n)) throw new Error(`anchoring is unavailable on ${n}`);
        const sponsor = new Sponsor(key, {
          allowedPackages: [a.packageId],
          maxGasBudget: ANCHOR_GAS_BUDGET,
        });
        let gas = anchorGas(await coinsOf(n, sponsor.address), floor);
        if (!gas) {
          await refill(n, sponsor, key);
          gas = anchorGas(await coinsOf(n, sponsor.address), floor);
        }
        if (!gas) throw new Error("no gas for an anchor after a refill");
        const client = o.networks.client(n);
        const tx = new Transaction();
        tx.setSender(signer.address);
        tx.setGasOwner(sponsor.address);
        tx.setGasPayment(gas);
        tx.setGasBudget(ANCHOR_GAS_BUDGET);
        buildAnchor(tx, a.packageId, a);
        const bytes = await tx.build({ client });
        const mine = await o.signTransaction(signer.keyId, bytes);
        const { signature } = await sponsor.cosign(bytes);
        const res = await client.core.executeTransaction({
          transaction: bytes,
          signatures: [mine, signature],
          include: { effects: true, events: true },
        });
        const done = res.Transaction ?? res.FailedTransaction;
        if (!done.effects?.status.success)
          throw new Error(`anchor failed: ${JSON.stringify(done.effects?.status.error ?? null)}`);
        await client.core.waitForTransaction({ digest: done.digest });
        const event = anchoredEvents(a.packageId, done.events).find((e) => e.root === a.root);
        if (!event) throw new Error(`no Anchored event in ${done.digest}`);
        return { digest: done.digest, anchorer: normalizeSuiAddress(event.anchorer) };
      }),
  };
}
