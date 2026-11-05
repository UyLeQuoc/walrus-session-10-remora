/**
 * U19 B1 (ADR-0145): what the auditor's page checks itself. The bundle is the owner's claim; each
 * paid Wake is checked against the transaction read from Sui over gRPC-web: the intent hash
 * recomputed here, the `Paid` event carrying it, its amount and payee, the balance change to `payTo`,
 * and the remora's key as the sender. Nothing here takes the server's word.
 */
import { NoAccessError } from "@mysten/seal";
import { normalizeSuiAddress, toHex } from "@mysten/sui/utils";
import { normalizeType, paidEvents } from "@remora/disc-sdk";
import { type AuditBundle, type AuditWake, DEPLOYMENTS, intentHash } from "@remora/schema";
import { proofHolds } from "@/features/verify/use-anchor-check";

/** What the page reads of one transaction. */
export interface TxRead {
  success: boolean;
  sender: string | null;
  events: { eventType: string; bcs: Uint8Array }[];
  balanceChanges: { address: string; coinType: string; amount: string }[];
}

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

export interface ReceiptCheck {
  receiptId: string;
  digest: string;
  ok: boolean;
  checks: Check[];
}

const same = (a: string | null | undefined, b: string | null | undefined) =>
  !!a && !!b && normalizeSuiAddress(a) === normalizeSuiAddress(b);

/** The paid Wakes: the ones with a transaction to check. */
export const receiptsOf = (b: AuditBundle) => b.wakes.filter((w) => w.payment);

/**
 * One paid Wake against its transaction. `tx` null means it couldn't be read, which fails it: a
 * receipt matches only when every check passes.
 */
export function checkReceipt(
  w: AuditWake,
  tx: TxRead | null,
  network: "mainnet" | "testnet",
): ReceiptCheck {
  const claim = w.payment;
  const d = w.wake.intent.decision;
  const recomputed = intentHash(w.wake.intent);
  const checks: Check[] = [
    {
      name: "Its intent hash, recomputed here",
      ok: recomputed === w.intentHash,
      detail: recomputed,
    },
  ];
  const digest = claim?.digest ?? "";
  if (!claim || d.action !== "pay") {
    checks.push({ name: "It's a payment", ok: false, detail: "No payment in this Wake." });
    return { receiptId: w.receiptId, digest, ok: false, checks };
  }
  checks.push({
    name: "The bundle matches its Wake",
    ok:
      claim.amount === d.amount &&
      claim.payee === d.payee &&
      same(claim.payTo, d.payTo) &&
      (w.wake.result.tx ?? claim.digest) === claim.digest,
    detail: `${claim.amount} to ${claim.payTo} (${claim.payee})`,
  });
  if (!tx) {
    checks.push({ name: "Read from Sui", ok: false, detail: `Couldn't read ${digest}.` });
    return { receiptId: w.receiptId, digest, ok: false, checks };
  }
  checks.push({ name: "The transaction succeeded", ok: tx.success, detail: digest });
  const pkg = DEPLOYMENTS[network].remoraPackageId ?? "";
  const paid = pkg
    ? paidEvents({ packageId: pkg, registryId: "", coinType: claim.coinType }, tx.events).find(
        (p) => toHex(p.intent) === recomputed,
      )
    : undefined;
  checks.push({
    name: "Its Paid event carries the intent hash",
    ok: !!paid,
    detail: paid ? "Paid.intent matches" : "No Paid event with this intent hash.",
  });
  checks.push({
    name: "The amount",
    ok: !!paid && paid.amount === BigInt(d.amount),
    detail: `${paid ? paid.amount.toString() : "nothing"} of ${d.amount}`,
  });
  checks.push({
    name: "The payee",
    ok: !!paid && same(paid.payee, d.payTo),
    detail: paid ? normalizeSuiAddress(paid.payee) : "no payee",
  });
  const credited = tx.balanceChanges
    .filter(
      (b) =>
        same(b.address, d.payTo) && normalizeType(b.coinType) === normalizeType(claim.coinType),
    )
    .reduce((s, b) => s + BigInt(b.amount), 0n);
  checks.push({
    name: "The payee's balance moved by the amount",
    ok: credited === BigInt(d.amount),
    detail: `${credited} of ${d.amount}`,
  });
  checks.push({
    name: "The remora's own key signed",
    ok: same(tx.sender, w.wake.agent),
    detail: tx.sender ?? "no sender",
  });
  return { receiptId: w.receiptId, digest, ok: checks.every((c) => c.ok), checks };
}

/** "12 of 12 receipts match Sui". */
export function matchLine(results: (ReceiptCheck | null)[], total: number): string {
  const matched = results.filter((r) => r?.ok).length;
  const done = results.filter(Boolean).length;
  const noun = total === 1 ? "receipt" : "receipts";
  if (done < total) return `Checking ${done} of ${total} ${noun} against Sui…`;
  return `${matched} of ${total} ${noun} ${total === 1 ? "matches" : "match"} Sui`;
}

/** Anchored Wakes whose Merkle proof, hashed here from the Wake as shipped, reaches its root. */
export function anchorSummary(b: AuditBundle): { anchored: number; holding: number } {
  const anchored = b.wakes.filter((w) => w.anchor);
  return {
    anchored: anchored.length,
    holding: anchored.filter((w) => w.anchor && proofHolds(w.wake, w.anchor)).length,
  };
}

export const REFUSED = "Access was revoked or expired: the key servers refused.";

/** The key servers' refusal (revoked, expired, or another wallet), said plainly. */
export function refusalOf(err: unknown): string | null {
  const message = err instanceof Error ? err.message : String(err);
  return err instanceof NoAccessError || /does not have access|NoAccess/i.test(message)
    ? REFUSED
    : null;
}

const WALRUS_AGGREGATOR = {
  testnet: "https://aggregator.walrus-testnet.walrus.space",
  mainnet: "https://aggregator.walrus-mainnet.walrus.space",
} as const;

/** The sealed bundle from Walrus; anyone can fetch it, only the auditor can open it. */
export async function readBundleBlob(
  blobId: string,
  network: "mainnet" | "testnet",
  http: typeof fetch = fetch,
): Promise<Uint8Array> {
  const res = await http(`${WALRUS_AGGREGATOR[network]}/v1/blobs/${encodeURIComponent(blobId)}`);
  if (!res.ok) throw new Error(`Walrus couldn't return the bundle just now (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}
