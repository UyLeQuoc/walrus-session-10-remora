/**
 * G1/G2 + E2 on the server: a remora pays an x402 service through its Disc. The Wake intent is built
 * from the 402 itself (payTo, amount, coin), its hash goes onchain as `Paid.intent`, the Wake is stored
 * in `receipts`, and a D2 job confirms the anchor once the transaction is final.
 */
import { createHash } from "node:crypto";
import type { Transaction } from "@mysten/sui/transactions";
import type { Logger, SuiNetwork } from "@remora/chain";
import { type Db, eq, receipts } from "@remora/db";
import { discFetch, type PaymentRequirements, paidEvents } from "@remora/disc-sdk";
import { intentHash, Wake, WakeIntent } from "@remora/schema";
import type { RemoraSigner } from "@remora/signer";
import { enqueue, type JobHandler } from "../runtime/jobs.ts";
import type { Networks } from "./networks.ts";

export interface PayDeps {
  db: Db;
  signer: RemoraSigner;
  networks: Networks;
  log: Logger;
  fetch?: typeof fetch;
  /** Tests: skip resolving object refs against a live chain. */
  buildKind?: (tx: Transaction) => Promise<Uint8Array>;
}

type IntentDraft = Omit<WakeIntent, "decision"> & { decision: { payee: string; reason: string } };

export interface PayRequest {
  remoraId: string;
  network: SuiNetwork;
  url: string;
  init?: RequestInit;
  disc: { discId: string; allowanceId: string; funder: string };
  /** Soft budget for this call (Sonar may lower it below the Disc's per-payment cap). */
  maxAmount: bigint;
  intent: IntentDraft;
}

export const WAKE_ANCHOR = "wake.anchor";

export async function payWithDisc(deps: PayDeps, r: PayRequest) {
  const net = deps.networks.config(r.network);
  if (!net.packageId || !net.discRegistryId) throw new Error(`${r.network} has no Disc package`);
  const cfg = {
    packageId: net.packageId,
    registryId: net.discRegistryId,
    coinType: net.usdcCoinType,
  };
  const agent = await deps.signer.address(r.remoraId);
  const log = deps.log.child({ remora: r.remoraId, network: r.network });

  let intent: WakeIntent | null = null;
  let hash = "";
  const { response, payment } = await discFetch(
    {
      network: r.network,
      cfg,
      disc: r.disc,
      sender: agent,
      maxAmount: r.maxAmount,
      sign: (bytes) => deps.signer.signTransaction(r.remoraId, bytes),
      intentFor: (req: PaymentRequirements) => {
        intent = WakeIntent.parse({
          ...r.intent,
          decision: {
            action: "pay",
            payee: r.intent.decision.payee,
            payTo: req.payTo,
            amount: req.amount,
            coinType: req.asset,
            reason: r.intent.decision.reason,
          },
        });
        hash = intentHash(intent);
        return new Uint8Array(Buffer.from(hash, "hex"));
      },
      ...(deps.buildKind
        ? { buildKind: deps.buildKind }
        : { client: deps.networks.client(r.network) }),
      ...(deps.fetch ? { fetch: deps.fetch } : {}),
    },
    r.url,
    r.init,
  );
  if (!payment || !intent) return { response, receipt: null };

  const body = new Uint8Array(await response.clone().arrayBuffer());
  const digest = payment.settle?.success ? (payment.settle.transaction ?? null) : null;
  const wake = Wake.parse({
    v: 1,
    remora: r.remoraId,
    agent,
    ts: new Date().toISOString(),
    intent,
    result: response.ok
      ? {
          ...(digest ? { tx: digest } : {}),
          responseSha256: createHash("sha256").update(body).digest("hex"),
        }
      : { error: `HTTP ${response.status}` },
  });
  const [receipt] = await deps.db
    .insert(receipts)
    .values({
      network: r.network,
      remoraId: r.remoraId,
      agent,
      wake: wake as unknown as Record<string, unknown>,
      intentHash: hash,
      txDigest: digest,
    })
    .returning();
  if (digest && receipt) {
    await enqueue(deps.db, {
      kind: WAKE_ANCHOR,
      payload: { receiptId: receipt.id, network: r.network, digest },
      idempotencyKey: `${WAKE_ANCHOR}:${r.network}:${digest}`,
    });
  }
  log.info("pay.done", { url: r.url, status: response.status, digest, intentHash: hash });
  return { response, receipt: receipt ?? null };
}

/** D2 handler: confirms `Paid.intent == receipts.intent_hash` from the final transaction (G2). */
export function wakeAnchorHandler(deps: Pick<PayDeps, "db" | "networks" | "log">): JobHandler {
  return async (payload) => {
    const { receiptId, network, digest } = payload as {
      receiptId: string;
      network: SuiNetwork;
      digest: string;
    };
    const [row] = await deps.db.select().from(receipts).where(eq(receipts.id, receiptId));
    if (!row) throw new Error(`receipt ${receiptId} is gone`);
    if (row.anchored) return;
    const net = deps.networks.config(network);
    const res = await deps.networks
      .client(network)
      .core.getTransaction({ digest, include: { events: true } });
    const tx = res.Transaction ?? res.FailedTransaction;
    const cfg = { packageId: net.packageId ?? "", registryId: "", coinType: net.usdcCoinType };
    const match = paidEvents(cfg, tx.events).some(
      (p) => Buffer.from(p.intent).toString("hex") === row.intentHash,
    );
    if (!match) throw new Error(`no Paid with intent ${row.intentHash} in ${digest}`);
    await deps.db.update(receipts).set({ anchored: true }).where(eq(receipts.id, receiptId));
    deps.log.info("wake.anchored", { network, digest, receipt: receiptId });
  };
}
