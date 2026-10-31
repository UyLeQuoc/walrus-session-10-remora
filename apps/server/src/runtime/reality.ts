/**
 * ADR-0077, the reality check: every `Paid` from a remora's Disc should have a Wake behind it, because
 * the runtime writes one for each payment it decides. Only the remora's key can call `disc::pay`, so a
 * `Paid` with no Wake means that key signed outside the runtime (a leaked key) or a Wake was lost. The
 * Disc still capped it; this tells the owner, so they can rotate the key or pause the remora.
 */
import { and, eq, receipts, remoraEvents, remoras } from "@remora/db";
import type { RuntimeDeps } from "./deps.ts";
import type { JobHandler } from "./jobs.ts";

interface PaidCheck {
  network: "testnet" | "mainnet";
  txDigest: string;
  discId: string;
  intent: string;
  amount: string;
  payTo: string;
}

const usdc = (micro: string) => (Number(micro) / 1e6).toFixed(Number(micro) % 10_000 ? 4 : 2);

export function paidCheckHandler(
  deps: Pick<RuntimeDeps, "db" | "log" | "notifier" | "webBase">,
): JobHandler {
  return async (payload) => {
    const p = payload as PaidCheck;
    const [wake] = await deps.db
      .select({ id: receipts.id })
      .from(receipts)
      .where(and(eq(receipts.network, p.network), eq(receipts.intentHash, p.intent)));
    if (wake) return; // the Wake landed after the indexer saw the payment
    const [r] = await deps.db
      .select()
      .from(remoras)
      .where(and(eq(remoras.network, p.network), eq(remoras.discId, p.discId)));
    if (!r) {
      deps.log.info("disc.paid_unknown_disc", { network: p.network, disc: p.discId });
      return;
    }
    const summary = `A payment from ${r.name}'s spending limit has no decision behind it: ${usdc(p.amount)} USDC to ${p.payTo.slice(0, 10)}…. If it wasn't you, rotate its key or pause it.`;
    await deps.db.insert(remoraEvents).values({
      remoraId: r.id,
      network: r.network,
      type: "action",
      summary,
      payload: { unexplained: true, digest: p.txDigest, amount: p.amount, payTo: p.payTo },
    });
    deps.log.warn("disc.unexplained_payment", {
      remora: r.id,
      network: p.network,
      digest: p.txDigest,
      amount: p.amount,
    });
    await deps.notifier.send(r.ownerAddress, {
      text: `${summary}\n${deps.webBase.replace(/\/$/, "")}/remoras/${r.id}`,
      urgent: true,
    });
  };
}
