/**
 * G6 (ADR-0076): public proof links. The owner shares a Wake and gets a token, and anyone holding the
 * token sees an allow-listed view of it with the verify checks. Revoking clears the token.
 *
 * The public view holds only what the chain already shows or a reader needs to check it: the remora's
 * name, network, time, the action (for a payment, its Reef payee, `payTo` and amount), the digest, the
 * signing address, the intent hash, whether it's anchored, and the checks. Never the prompt or its hash,
 * the model, memories, the trigger, inputs, Sonar's reasons, the decision's reason (model prose can quote
 * private context), the owner, or the receipt id.
 */
import { randomBytes } from "node:crypto";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { and, type Db, eq, receipts, remoras, sql } from "@remora/db";
import { Wake } from "@remora/schema";
import type { Networks } from "../money/networks.ts";
import { RemoraError } from "./remoras.ts";
import { verifyWake } from "./verify.ts";

/** `receipts.remora_id` is text and `remoras.id` a uuid. */
const ownerJoin = sql`${remoras.id}::text = ${receipts.remoraId}`;

const notFound = () => new RemoraError("wake.not_found", "No receipt with that id.", 404);

async function ownedReceipt(db: Db, owner: string, receiptId: string) {
  const [row] = await db
    .select({ id: receipts.id, shareToken: receipts.shareToken })
    .from(receipts)
    .innerJoin(remoras, ownerJoin)
    .where(and(eq(receipts.id, receiptId), eq(remoras.ownerAddress, normalizeSuiAddress(owner))));
  if (!row) throw notFound();
  return row;
}

/** Idempotent: a Wake already shared answers with its existing token. */
export async function shareWake(
  deps: { db: Db; webBase: string },
  owner: string,
  receiptId: string,
): Promise<{ token: string; url: string }> {
  const row = await ownedReceipt(deps.db, owner, receiptId);
  let token = row.shareToken;
  if (!token) {
    token = randomBytes(16).toString("base64url");
    await deps.db
      .update(receipts)
      .set({ shareToken: token, sharedAt: new Date() })
      .where(eq(receipts.id, row.id));
  }
  return { token, url: `${deps.webBase.replace(/\/$/, "")}/p/${token}` };
}

export async function unshareWake(deps: { db: Db }, owner: string, receiptId: string) {
  const row = await ownedReceipt(deps.db, owner, receiptId);
  await deps.db
    .update(receipts)
    .set({ shareToken: null, sharedAt: null })
    .where(eq(receipts.id, row.id));
  return { ok: true as const };
}

const TOKEN = /^[A-Za-z0-9_-]{16,64}$/;
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; view: PublicWake }>();

export type PublicWake = Awaited<ReturnType<typeof buildPublicWake>>;

/** The allow-listed view, or null when the token is unknown or revoked. */
export async function publicWake(
  deps: { db: Db; networks: Networks },
  token: string,
  now = Date.now(),
): Promise<PublicWake | null> {
  if (!TOKEN.test(token)) return null;
  const [row] = await deps.db
    .select({ r: receipts, name: remoras.name })
    .from(receipts)
    .innerJoin(remoras, ownerJoin)
    .where(eq(receipts.shareToken, token));
  if (!row) {
    cache.delete(token);
    return null;
  }
  // The checks read the chain through Tatum, so a busy link doesn't re-read it on every view.
  const hit = cache.get(token);
  if (hit && now - hit.at < CACHE_MS) return hit.view;
  const view = await buildPublicWake(deps, row.r, row.name);
  cache.set(token, { at: now, view });
  return view;
}

async function buildPublicWake(
  deps: { db: Db; networks: Networks },
  r: typeof receipts.$inferSelect,
  remoraName: string,
) {
  const wake = Wake.parse(r.wake);
  const verified = await verifyWake(deps, r.id);
  const d = wake.intent.decision;
  return {
    v: 1 as const,
    remora: remoraName.slice(0, 64),
    network: r.network,
    ts: wake.ts,
    action:
      d.action === "pay"
        ? { kind: "pay" as const, payee: d.payee, payTo: d.payTo, amount: d.amount }
        : { kind: d.action },
    tx: r.txDigest,
    agent: wake.agent,
    intentHash: r.intentHash,
    anchored: r.anchored,
    checks: verified.checks
      .slice(0, 20)
      .map((c) => ({ name: c.name.slice(0, 64), ok: c.ok, detail: c.detail.slice(0, 200) })),
  };
}
