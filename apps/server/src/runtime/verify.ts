/**
 * G3 `remora verify`: checks a Wake against the chain (spec §9).
 * 1. the recomputed intent hash equals the stored one (and, for payments, `Paid.intent` onchain);
 * 2. a payment's balance change to `payTo` matches the amount;
 * 3. the transaction succeeded and was signed by the remora's key.
 * Non-payment Wakes have no onchain anchor in the MVP; their hash check still runs.
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { type Db, eq, or, receipts } from "@remora/db";
import { paidEvents } from "@remora/disc-sdk";
import { intentHash, Wake } from "@remora/schema";
import type { Networks } from "../money/networks.ts";

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
      detail: anchor ? "anchored onchain" : "no matching Paid event",
    });
    const credited = (tx.balanceChanges ?? [])
      .filter((b) => normalizeSuiAddress(b.address) === normalizeSuiAddress(d.payTo))
      .reduce((s, b) => s + BigInt(b.amount), 0n);
    checks.push({
      name: "payTo balance change",
      ok: credited === BigInt(d.amount),
      detail: `${credited} of ${d.amount}`,
    });
    const sender = tx.transaction?.sender ? normalizeSuiAddress(tx.transaction.sender) : "";
    checks.push({
      name: "signed by the remora",
      ok: sender === normalizeSuiAddress(wake.agent),
      detail: sender,
    });
  } else {
    checks.push({
      name: "onchain anchor",
      ok: null,
      detail: `${d.action}: not anchored in the MVP`,
    });
  }
  return { found: true as const, wake, receiptId: row.id, anchored: row.anchored, checks };
}
