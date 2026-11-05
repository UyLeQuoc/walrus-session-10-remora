/**
 * G3 `remora verify`: checks a Wake against the chain (spec §9).
 * 1. the recomputed intent hash equals the stored one (and, for payments, `Paid.intent` onchain);
 * 2. a payment's balance change to `payTo` matches the amount;
 * 3. the transaction succeeded and was signed by the remora's key;
 * 4. the Wake's timestamp is before the transaction's (it was decided before paying).
 * A Wake that didn't pay is checked against its Merkle anchor once its batch is onchain (ADR-0139):
 * its leaf, recomputed here, reaches the batch's root through the proof, and the transaction holds
 * an `Anchored` event of our `remora_anchor` package with that root, signed by the remora's key.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { type Db, eq, or, receipts, remoras } from "@remora/db";
import { anchoredEvents, paidEvents } from "@remora/disc-sdk";
import {
  type AnchorProof,
  DEPLOYMENTS,
  intentHash,
  verifyMerkleProof,
  Wake,
  wakeLeaf,
} from "@remora/schema";
import type { Networks } from "../money/networks.ts";
import { type FoundAnchor, findAnchor } from "./anchors.ts";

export interface Check {
  name: string;
  ok: boolean | null;
  detail: string;
}

export async function verifyWake(deps: { db: Db; networks: Networks }, idOrDigest: string) {
  const [row] = await deps.db
    .select()
    .from(receipts)
    .where(
      /^[0-9a-f-]{36}$/.test(idOrDigest)
        ? or(eq(receipts.id, idOrDigest), eq(receipts.txDigest, idOrDigest))
        : eq(receipts.txDigest, idOrDigest),
    );
  if (!row) return { found: false as const, checks: [] as Check[] };
  const wake = Wake.parse(row.wake);
  const checks: Check[] = [];
  const recomputed = intentHash(wake.intent);
  checks.push({ name: "intent hash", ok: recomputed === row.intentHash, detail: recomputed });
  const d = wake.intent.decision;
  if (d.action === "pay" && row.txDigest) {
    const net = deps.networks.config(row.network);
    const res = await deps.networks.client(row.network).core.getTransaction({
      digest: row.txDigest,
      include: { effects: true, events: true, balanceChanges: true, transaction: true },
    });
    const tx = res.Transaction ?? res.FailedTransaction;
    checks.push({
      name: "transaction succeeded",
      ok: !!tx.effects?.status.success,
      detail: row.txDigest,
    });
    const paid = paidEvents(
      { packageId: net.packageId ?? "", registryId: "", coinType: net.usdcCoinType },
      tx.events,
    );
    const anchor = paid.find((p) => Buffer.from(p.intent).toString("hex") === recomputed);
    checks.push({
      name: "Paid.intent matches",
      ok: !!anchor,
      detail: anchor ? "saved onchain" : "no matching Paid event",
    });
    const credited = (tx.balanceChanges ?? [])
      .filter((b) => normalizeSuiAddress(b.address) === normalizeSuiAddress(d.payTo))
      .reduce((s, b) => s + BigInt(b.amount), 0n);
    checks.push({
      name: "payTo balance change",
      ok: credited === BigInt(d.amount),
      detail: `${credited} of ${d.amount}`,
    });
    // The Wake (intent) was written before the money moved, not reconstructed afterwards.
    const paidAt = tx.timestampMs ? Number(tx.timestampMs) : null;
    const decidedAt = Date.parse(wake.ts);
    checks.push({
      name: "decided before paying",
      ok: paidAt === null ? null : decidedAt <= paidAt + 5_000,
      detail: `Receipt ${wake.ts}${paidAt ? `, tx ${new Date(paidAt).toISOString()}` : ""}, stored ${row.createdAt.toISOString()}`,
    });
    const sender = tx.transaction?.sender ? normalizeSuiAddress(tx.transaction.sender) : "";
    checks.push({
      name: "signed by the remora",
      ok: sender === normalizeSuiAddress(wake.agent),
      detail: sender,
    });
  }
  let anchor: AnchorProof | null = null;
  if (!(d.action === "pay" && row.txDigest)) {
    const found = await findAnchor(deps.db, wake.remora, "wake", row.id);
    if (found) {
      anchor = proofOf(found, row.network);
      checks.push(...(await anchorChecks(deps, wake, found)));
    } else {
      checks.push({ name: "saved onchain", ok: null, detail: `${d.action}: not anchored yet` });
    }
  }
  return { found: true as const, wake, receiptId: row.id, anchored: row.anchored, anchor, checks };
}

const proofOf = (f: FoundAnchor, network: "mainnet" | "testnet"): AnchorProof => ({
  network,
  packageId: f.batch.packageId,
  digest: f.batch.digest,
  root: f.batch.root,
  leaf: f.batch.leaves[f.index]?.leaf ?? "",
  index: f.index,
  count: f.batch.count,
  proof: f.proof,
  anchoredAt: f.anchoredAt.toISOString(),
});

/** "anchored in <digest>, proof of N steps", the line `remora verify` and the web print. */
export const anchorLine = (a: Pick<AnchorProof, "digest" | "proof">) =>
  `anchored in ${a.digest}, proof of ${a.proof.length} step${a.proof.length === 1 ? "" : "s"}`;

async function anchorChecks(
  deps: { db: Db; networks: Networks },
  wake: Wake,
  found: FoundAnchor,
): Promise<Check[]> {
  const { batch, proof } = found;
  const leaf = wakeLeaf(wake);
  const checks: Check[] = [
    {
      name: "in its anchored batch",
      ok: batch.leaves[found.index]?.leaf === leaf && verifyMerkleProof(leaf, proof, batch.root),
      detail: `${anchorLine({ digest: batch.digest, proof })} to root ${batch.root}`,
    },
  ];
  const ours = DEPLOYMENTS[batch.network].anchorPackageId;
  if (!ours || normalizeSuiAddress(ours) !== normalizeSuiAddress(batch.packageId)) {
    checks.push({ name: "root onchain", ok: false, detail: "not our remora_anchor package" });
    return checks;
  }
  const res = await deps.networks.client(batch.network).core.getTransaction({
    digest: batch.digest,
    include: { effects: true, events: true },
  });
  const tx = res.Transaction ?? res.FailedTransaction;
  const event = tx.effects?.status.success
    ? anchoredEvents(ours, tx.events).find((e) => e.root === batch.root)
    : undefined;
  checks.push({
    name: "root onchain",
    ok: !!event && event.count === batch.count,
    detail: event
      ? `Anchored ${event.count} at ${new Date(event.atMs).toISOString()} in ${batch.digest}`
      : `no Anchored event with this root in ${batch.digest}`,
  });
  const by = event ? normalizeSuiAddress(event.anchorer) : "";
  // After a key rotation, older Wakes are anchored by the remora's current key.
  const now =
    by && by !== normalizeSuiAddress(wake.agent) ? await currentKey(deps.db, wake.remora) : null;
  checks.push({
    name: "anchored by the remora",
    ok: !!by && (by === normalizeSuiAddress(wake.agent) || by === now),
    detail: by ? (by === now ? `${by} (its current key)` : by) : "no anchor event",
  });
  return checks;
}

async function currentKey(db: Db, remoraId: string): Promise<string | null> {
  if (!/^[0-9a-f-]{36}$/.test(remoraId)) return null;
  const [r] = await db
    .select({ address: remoras.address })
    .from(remoras)
    .where(eq(remoras.id, remoraId));
  return r?.address ? normalizeSuiAddress(r.address) : null;
}
