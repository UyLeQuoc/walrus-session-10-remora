/**
 * U19 B1 (ADR-0145): auditor access, through the capsule policy of ADR-0130 with no Move change.
 * - The owner picks a date range, an auditor (an address or a `.sui` name), 1–30 days, and whether
 *   question text goes in (off by default).
 * - The server builds the Wake bundle as canonical JSON: per Wake the stored Wake (its intent and
 *   result), the payment's fields, the cited memory ids and, for a Wake that didn't pay, its Merkle
 *   anchor (ADR-0139). It Seal-encrypts the bundle to a fresh capsule key id, stores it on Walrus
 *   testnet and returns `remora_capsule::create` with the auditor as the grantee, for the owner to sign.
 * - The confirm reads the transaction and records an `audit.shared` action; revoke is the capsule's
 *   own `revoke` (one owner signature) and records `audit.revoked`.
 * - The auditor's page decrypts in the browser and checks every receipt against Sui itself. The
 *   server never sends the plaintext anywhere but Walrus, sealed.
 */
import { bcs } from "@mysten/sui/bcs";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress, toHex } from "@mysten/sui/utils";
import { and, asc, type Db, desc, eq, lt, receipts, remoraEvents, remoras, sql } from "@remora/db";
import { normalizeType } from "@remora/disc-sdk";
import { sealToFreshKey, storeOnWalrus } from "@remora/memory";
import {
  type AnchorProof,
  AUDIT_LIMITS,
  type AuditAccess,
  type AuditBundle,
  AuditDraft,
  type AuditShare,
  type AuditWake,
  canonicalJson,
  DEPLOYMENTS,
  merkleProof,
  Wake,
  WakesAnchored,
} from "@remora/schema";
import { canonicalName, isSuiName, type NameCore, resolveName } from "../money/names.ts";
import type { Networks } from "../money/networks.ts";
import { ANCHOR_EVENT } from "./anchors.ts";
import { revokeTx } from "./capsules.ts";
import { type Remora, RemoraError } from "./remoras.ts";

export const AUDIT_SHARED = "audit.shared";
export const AUDIT_REVOKED = "audit.revoked";

const DAY_MS = 86_400_000;
/** `capsule::create` allows at most 30 days from the chain's clock; keep a margin for the signing. */
const MAX_EXPIRY_MS = AUDIT_LIMITS.days * DAY_MS - 10 * 60_000;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CAPSULE_ID = /^0x[0-9a-fA-F]{64}$/;

export interface AuditDeps {
  db: Db;
  networks: Networks;
  fetch?: typeof fetch;
}

type Network = "mainnet" | "testnet";

const capsulePackage = (network: string) => {
  const id = DEPLOYMENTS[network as Network]?.capsulePackageId ?? null;
  if (!id) throw new RemoraError("audit.unavailable", `Auditor access isn't on ${network} yet.`);
  return id;
};

/** `[from, to)`. A plain date `to` includes that whole day (UTC). */
export function auditRange(from: string, to: string, now = Date.now()): { from: Date; to: Date } {
  const start = DATE.test(from) ? Date.parse(`${from}T00:00:00.000Z`) : Date.parse(from);
  const end = DATE.test(to) ? Date.parse(`${to}T00:00:00.000Z`) + DAY_MS : Date.parse(to);
  if (!Number.isFinite(start) || !Number.isFinite(end))
    throw new RemoraError("audit.range", "Pick a start and an end date.");
  if (end <= start) throw new RemoraError("audit.range", "The end must be after the start.");
  if (start > now) throw new RemoraError("audit.range", "The range starts in the future.");
  if (end - start > 366 * DAY_MS)
    throw new RemoraError("audit.range", "Share at most a year of Wakes at a time.");
  return { from: new Date(start), to: new Date(end) };
}

/** An address, or a `.sui` name resolved over gRPC NameService (C1, ADR-0144). */
export async function auditorOf(
  core: NameCore,
  raw: string,
): Promise<{ address: string; name: string | null }> {
  const t = raw.trim();
  if (isSuiName(t)) {
    const name = canonicalName(t);
    const at = await resolveName(core, name).catch(() => {
      throw new RemoraError("name.unreachable", `Couldn't look up ${name} just now.`, 409);
    });
    if (!at) throw new RemoraError("name.unknown", `${name} doesn't point to an address.`);
    return { address: at, name };
  }
  if (/^0x[0-9a-fA-F]{1,64}$/.test(t)) return { address: normalizeSuiAddress(t), name: null };
  throw new RemoraError("audit.auditor", "The auditor is a Sui address or a .sui name.");
}

export interface AuditReceiptRow {
  id: string;
  remoraId: string;
  network: string;
  wake: unknown;
  intentHash: string;
  txDigest: string | null;
  createdAt: Date;
}

export interface AuditEventRow {
  id: string;
  receiptId: string | null;
  payload: Record<string, unknown>;
}

/**
 * The owner's question behind each Wake: an answer event carries it, its own Wake by `receiptId`,
 * the payments it made by their event ids (`outcomes`) and their digests.
 */
export function questionsByReceipt(
  events: AuditEventRow[],
  receiptByDigest: ReadonlyMap<string, string>,
): Map<string, string> {
  const receiptOfEvent = new Map<string, string>();
  for (const e of events) if (e.receiptId) receiptOfEvent.set(e.id, e.receiptId);
  const out = new Map<string, string>();
  for (const e of events) {
    const q = e.payload.question;
    if (typeof q !== "string" || !q.trim()) continue;
    const outcomes = Array.isArray(e.payload.outcomes)
      ? (e.payload.outcomes as { eventId?: unknown }[]).map((o) =>
          typeof o?.eventId === "string" ? receiptOfEvent.get(o.eventId) : undefined,
        )
      : [];
    const digests = Array.isArray(e.payload.digests)
      ? (e.payload.digests as unknown[]).map((d) =>
          typeof d === "string" ? receiptByDigest.get(d) : undefined,
        )
      : [];
    for (const id of [e.receiptId, ...outcomes, ...digests])
      if (id && !out.has(id)) out.set(id, q.slice(0, 2_000));
  }
  return out;
}

/** Where each anchored leaf is: `wake:<receipt id>` to its batch and index. */
function anchorIndex(batches: { payload: unknown; createdAt: Date }[]) {
  const at = new Map<string, { batch: WakesAnchored; index: number; anchoredAt: Date }>();
  for (const row of batches) {
    const b = WakesAnchored.safeParse(row.payload);
    if (!b.success) continue;
    b.data.leaves.forEach((l, index) => {
      const key = `${l.kind}:${l.ref}`;
      if (!at.has(key)) at.set(key, { batch: b.data, index, anchoredAt: row.createdAt });
    });
  }
  return at;
}

/**
 * The bundle, from rows already read. Only this remora's receipts on its network inside `[from, to)`
 * go in, oldest first; question text only when `includeQuestions`. The same rows and `now` always give
 * the same canonical JSON.
 */
export function buildAuditBundle(input: {
  remora: Pick<Remora, "id" | "name" | "address" | "ownerAddress" | "network">;
  range: { from: Date; to: Date };
  includeQuestions: boolean;
  receipts: AuditReceiptRow[];
  anchors: { payload: unknown; createdAt: Date }[];
  events: AuditEventRow[];
  now: Date;
}): AuditBundle {
  const { remora: r, range } = input;
  const rows = input.receipts
    .filter(
      (x) =>
        x.remoraId === r.id &&
        x.network === r.network &&
        x.createdAt >= range.from &&
        x.createdAt < range.to,
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id));
  const anchored = anchorIndex(input.anchors);
  const questions = input.includeQuestions
    ? questionsByReceipt(
        input.events,
        new Map(rows.flatMap((x) => (x.txDigest ? [[x.txDigest, x.id] as const] : []))),
      )
    : new Map<string, string>();
  const wakes: AuditWake[] = [];
  for (const row of rows) {
    const parsed = Wake.safeParse(row.wake);
    if (!parsed.success) continue;
    const wake = parsed.data;
    const d = wake.intent.decision;
    const paid = d.action === "pay" && !!row.txDigest;
    const found = paid ? undefined : anchored.get(`wake:${row.id}`);
    const anchor: AnchorProof | null = found
      ? {
          network: found.batch.network,
          packageId: found.batch.packageId,
          digest: found.batch.digest,
          root: found.batch.root,
          leaf: found.batch.leaves[found.index]?.leaf ?? "",
          index: found.index,
          count: found.batch.count,
          proof: merkleProof(
            found.batch.leaves.map((l) => l.leaf),
            found.index,
          ),
          anchoredAt: found.anchoredAt.toISOString(),
        }
      : null;
    const question = questions.get(row.id);
    wakes.push({
      receiptId: row.id,
      at: row.createdAt.toISOString(),
      intentHash: row.intentHash,
      wake,
      payment:
        d.action === "pay" && row.txDigest
          ? {
              digest: row.txDigest,
              amount: d.amount,
              payee: d.payee,
              payTo: normalizeSuiAddress(d.payTo),
              coinType: d.coinType,
            }
          : null,
      memories: wake.intent.memories.map((m) => m.blobId),
      anchor,
      ...(input.includeQuestions && question ? { question } : {}),
    });
  }
  return {
    v: 1,
    kind: "remora.audit",
    remora: {
      id: r.id,
      name: r.name,
      agent: normalizeSuiAddress(r.address),
      owner: normalizeSuiAddress(r.ownerAddress),
      network: r.network as Network,
    },
    range: { from: range.from.toISOString(), to: range.to.toISOString() },
    includesQuestions: input.includeQuestions,
    madeAt: input.now.toISOString(),
    count: wakes.length,
    wakes,
  };
}

/** The bytes that are sealed: the bundle's canonical JSON. */
export const bundleBytes = (b: AuditBundle) => new TextEncoder().encode(canonicalJson(b));

const since = (col: typeof receipts.createdAt | typeof remoraEvents.createdAt, d: Date) =>
  sql`${col} >= ${d.toISOString()}::timestamptz`;

/** Reads this remora's Wakes in range, their anchors and (when asked) the questions behind them. */
export async function loadAuditBundle(
  db: Db,
  r: Remora,
  range: { from: Date; to: Date },
  includeQuestions: boolean,
  now = new Date(),
): Promise<AuditBundle> {
  const rows = await db
    .select({
      id: receipts.id,
      remoraId: receipts.remoraId,
      network: receipts.network,
      wake: receipts.wake,
      intentHash: receipts.intentHash,
      txDigest: receipts.txDigest,
      createdAt: receipts.createdAt,
    })
    .from(receipts)
    .where(
      and(
        eq(receipts.remoraId, r.id),
        eq(receipts.network, r.network),
        since(receipts.createdAt, range.from),
        lt(receipts.createdAt, range.to),
      ),
    )
    .orderBy(asc(receipts.createdAt), asc(receipts.id))
    .limit(AUDIT_LIMITS.wakes + 1);
  if (rows.length > AUDIT_LIMITS.wakes)
    throw new RemoraError(
      "audit.too_many",
      `More than ${AUDIT_LIMITS.wakes} Wakes in that range; pick a shorter one.`,
    );
  const anchors = await db
    .select({ payload: remoraEvents.payload, createdAt: remoraEvents.createdAt })
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, r.id),
        eq(remoraEvents.type, ANCHOR_EVENT),
        since(remoraEvents.createdAt, range.from),
      ),
    )
    .orderBy(asc(remoraEvents.createdAt));
  // A payment's event lands just after its Wake, and the answer after the payments.
  const events = includeQuestions
    ? await db
        .select({
          id: remoraEvents.id,
          receiptId: remoraEvents.receiptId,
          payload: remoraEvents.payload,
        })
        .from(remoraEvents)
        .where(
          and(
            eq(remoraEvents.remoraId, r.id),
            since(remoraEvents.createdAt, range.from),
            lt(remoraEvents.createdAt, new Date(range.to.getTime() + 10 * 60_000)),
            sql`(${remoraEvents.receiptId} is not null or ${remoraEvents.type} = 'answer')`,
          ),
        )
        .limit(10_000)
    : [];
  return buildAuditBundle({
    remora: r,
    range,
    includeQuestions,
    receipts: rows,
    anchors,
    events,
    now,
  });
}

/** Step 1: build, seal and store the bundle, and return the owner's `create` (grantee: the auditor). */
export async function auditShareTx(
  deps: AuditDeps,
  r: Remora,
  input: { from: string; to: string; auditor: string; days: number; includeQuestions?: boolean },
  now = Date.now(),
) {
  const pkg = capsulePackage(r.network);
  const days = Math.round(Number(input.days));
  if (!(days >= 1 && days <= AUDIT_LIMITS.days))
    throw new RemoraError("audit.days", `Share for 1 to ${AUDIT_LIMITS.days} days.`);
  const range = auditRange(input.from, input.to, now);
  const sui = deps.networks.client(r.network);
  const auditor = await auditorOf(sui.core, input.auditor);
  const includeQuestions = input.includeQuestions === true;
  const bundle = await loadAuditBundle(deps.db, r, range, includeQuestions, new Date(now));
  if (!bundle.count) throw new RemoraError("audit.empty", "No Wakes in that range.");
  const { keyId, ciphertext } = await sealToFreshKey(sui, pkg, bundleBytes(bundle));
  const blobId = await storeOnWalrus(ciphertext, days + 1, deps.fetch);
  const expiresMs = now + Math.min(days * DAY_MS, MAX_EXPIRY_MS);
  const tx = new Transaction();
  tx.setSender(r.ownerAddress);
  tx.moveCall({
    target: `${pkg}::capsule::create`,
    arguments: [
      tx.pure.address(auditor.address),
      tx.pure.vector("u8", Array.from(keyId)),
      tx.pure.string(blobId),
      tx.pure.u64(bundle.count),
      tx.pure.u64(expiresMs),
      tx.object.clock(),
    ],
  });
  const draft: AuditDraft = {
    keyId: toHex(keyId),
    blobId,
    count: bundle.count,
    expiresMs,
    auditor: auditor.address,
    auditorName: auditor.name,
    range: bundle.range,
    includeQuestions,
  };
  return { transaction: await tx.toJSON(), draft };
}

const CapsuleCreatedBcs = bcs.struct("CapsuleCreated", {
  capsule: bcs.Address,
  owner: bcs.Address,
  grantee: bcs.Address,
  blob_id: bcs.string(),
  count: bcs.u64(),
  expires_ms: bcs.u64(),
});
const CapsuleRevokedBcs = bcs.struct("CapsuleRevoked", {
  capsule: bcs.Address,
  owner: bcs.Address,
});

type TxEvents = { eventType: string; bcs: Uint8Array }[] | null | undefined;
const eventsOf = <T>(events: TxEvents, type: string, parse: (b: Uint8Array) => T): T[] =>
  (events ?? [])
    .filter((e) => normalizeType(e.eventType) === normalizeType(type))
    .map((e) => parse(e.bcs));

/** The owner's transaction: it succeeded and the owner sent it. */
async function ownerTx(deps: AuditDeps, r: Remora, digest: string) {
  const res = await deps.networks.client(r.network).core.getTransaction({
    digest,
    include: { effects: true, events: true, transaction: true },
  });
  const tx = res.Transaction ?? res.FailedTransaction;
  if (!tx.effects?.status.success) throw new RemoraError("tx.failed", "That transaction failed.");
  if (normalizeSuiAddress(tx.transaction?.sender ?? "") !== normalizeSuiAddress(r.ownerAddress))
    throw new RemoraError("tx.not_owner", "That transaction wasn't sent by the owner.", 403);
  return tx as { events?: TxEvents };
}

async function sharedEvent(db: Db, r: Remora, capsuleId: string) {
  const [row] = await db
    .select()
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, r.id),
        sql`${remoraEvents.payload}->>'kind' = ${AUDIT_SHARED}`,
        sql`${remoraEvents.payload}->>'capsuleId' = ${capsuleId}`,
      ),
    )
    .limit(1);
  return row;
}

const capsuleIdOf = (raw: string) => {
  if (!CAPSULE_ID.test(raw))
    throw new RemoraError("audit.not_found", "No such auditor share.", 404);
  return normalizeSuiAddress(raw);
};

export const auditPath = (capsuleId: string) => `/audit/${capsuleId}`;

/** Step 2: the signed `create` landed with the draft's grantee, blob, count and expiry; record it. */
export async function confirmAuditShare(
  deps: AuditDeps,
  r: Remora,
  digest: string,
  draftIn: unknown,
) {
  const parsed = AuditDraft.safeParse(draftIn);
  if (!parsed.success) throw new RemoraError("audit.draft", "Send the share you signed for.");
  const draft = parsed.data;
  const pkg = capsulePackage(r.network);
  const tx = await ownerTx(deps, r, digest);
  const made = eventsOf(tx.events, `${pkg}::capsule::CapsuleCreated`, (b) =>
    CapsuleCreatedBcs.parse(b),
  ).find(
    (e) =>
      e.blob_id === draft.blobId &&
      normalizeSuiAddress(e.grantee) === normalizeSuiAddress(draft.auditor) &&
      Number(e.count) === draft.count &&
      Number(e.expires_ms) === draft.expiresMs,
  );
  if (!made) throw new RemoraError("tx.not_audit", "That transaction didn't create this share.");
  const capsuleId = normalizeSuiAddress(made.capsule);
  const path = auditPath(capsuleId);
  if (await sharedEvent(deps.db, r, capsuleId)) return { capsuleId, digest, path };
  const until = new Date(draft.expiresMs).toISOString().slice(0, 10);
  const who = draft.auditorName ?? `${draft.auditor.slice(0, 6)}…${draft.auditor.slice(-4)}`;
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    // An action, so the feed (whose types are a closed list) shows it like a capsule.
    type: "action",
    summary: `Shared ${draft.count} Wakes with an auditor (${who}) until ${until}.`,
    payload: { kind: AUDIT_SHARED, capsuleId, digest, ...draft },
  });
  return { capsuleId, digest, path };
}

/** Revoke: the capsule's own `revoke`, only for a share of this remora. */
export async function auditRevokeTx(deps: Pick<AuditDeps, "db">, r: Remora, raw: string) {
  const capsuleId = capsuleIdOf(raw);
  if (!(await sharedEvent(deps.db, r, capsuleId)))
    throw new RemoraError("audit.not_found", "No such auditor share.", 404);
  return revokeTx(r, capsuleId);
}

export async function confirmAuditRevoke(deps: AuditDeps, r: Remora, raw: string, digest: string) {
  const capsuleId = capsuleIdOf(raw);
  if (!(await sharedEvent(deps.db, r, capsuleId)))
    throw new RemoraError("audit.not_found", "No such auditor share.", 404);
  const pkg = capsulePackage(r.network);
  const tx = await ownerTx(deps, r, digest);
  const revoked = eventsOf(tx.events, `${pkg}::capsule::CapsuleRevoked`, (b) =>
    CapsuleRevokedBcs.parse(b),
  ).some((e) => normalizeSuiAddress(e.capsule) === capsuleId);
  if (!revoked)
    throw new RemoraError("tx.not_revoke", "That transaction didn't revoke this share.");
  await deps.db.insert(remoraEvents).values({
    remoraId: r.id,
    network: r.network,
    type: "action",
    summary: "Took back an auditor's access.",
    payload: { kind: AUDIT_REVOKED, capsuleId, digest },
  });
  return { capsuleId, digest };
}

/** The owner's card: every share of this remora, newest first, and whether it was taken back. */
export async function auditShares(db: Db, r: Remora): Promise<AuditShare[]> {
  const rows = await db
    .select()
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.remoraId, r.id),
        sql`${remoraEvents.payload}->>'kind' in (${AUDIT_SHARED}, ${AUDIT_REVOKED})`,
      ),
    )
    .orderBy(desc(remoraEvents.createdAt))
    .limit(200);
  const revoked = new Map<string, string>();
  for (const e of rows) {
    const p = e.payload as { kind?: string; capsuleId?: string; digest?: string };
    if (p.kind === AUDIT_REVOKED && p.capsuleId && p.digest) revoked.set(p.capsuleId, p.digest);
  }
  const out: AuditShare[] = [];
  for (const e of rows) {
    const p = e.payload as Record<string, unknown>;
    if (p.kind !== AUDIT_SHARED) continue;
    const draft = AuditDraft.safeParse(p);
    const capsuleId = String(p.capsuleId ?? "");
    if (!draft.success || !CAPSULE_ID.test(capsuleId)) continue;
    out.push({
      capsuleId,
      auditor: draft.data.auditor,
      auditorName: draft.data.auditorName,
      range: draft.data.range,
      count: draft.data.count,
      expiresMs: draft.data.expiresMs,
      includeQuestions: draft.data.includeQuestions,
      blobId: draft.data.blobId,
      digest: String(p.digest ?? ""),
      at: e.createdAt.toISOString(),
      revoked: revoked.get(capsuleId) ?? null,
      path: auditPath(capsuleId),
    });
  }
  return out;
}

/**
 * Public: what the auditor's page needs to fetch and decrypt the bundle, never the bundle. Null for
 * an id that isn't an auditor share.
 */
export async function auditAccess(db: Db, raw: string): Promise<AuditAccess | null> {
  if (!CAPSULE_ID.test(raw)) return null;
  const capsuleId = normalizeSuiAddress(raw);
  const [row] = await db
    .select({ e: remoraEvents, name: remoras.name })
    .from(remoraEvents)
    .innerJoin(remoras, eq(remoras.id, remoraEvents.remoraId))
    .where(
      and(
        eq(remoraEvents.type, "action"),
        sql`${remoraEvents.payload}->>'kind' = ${AUDIT_SHARED}`,
        sql`${remoraEvents.payload}->>'capsuleId' = ${capsuleId}`,
      ),
    )
    .limit(1);
  if (!row) return null;
  const draft = AuditDraft.safeParse(row.e.payload);
  const packageId = DEPLOYMENTS[row.e.network as Network]?.capsulePackageId;
  if (!draft.success || !packageId) return null;
  return {
    capsuleId,
    network: row.e.network as Network,
    packageId,
    blobId: draft.data.blobId,
    keyId: draft.data.keyId,
    remora: row.name.slice(0, 64),
    auditor: draft.data.auditor,
    count: draft.data.count,
    expiresMs: draft.data.expiresMs,
    range: draft.data.range,
  };
}
