/**
 * N15 (ADR-0076): what one remora cost in a UTC month, from what we recorded. Every amount is micro-USDC
 * as an integer string.
 * - **Model:** the month's tokens (`remora_usage`) at the remora's model price. Only the total is
 *   recorded, so the price is the average of input and output per 1M tokens: an estimate.
 * - **Gas:** settled sponsored gas for the remora's key (`sponsor_ledger`), at Tatum's SUI price now.
 *   Testnet gas is priced as if it were mainnet SUI.
 * - **Purchases:** the payments its Wakes record with a transaction.
 */
import type { SuiNetwork } from "@remora/chain";
import { and, type Db, eq, receipts, remoraUsage, sponsorLedger, sql } from "@remora/db";
import { MODEL_CATALOG } from "@remora/schema";
import { RemoraError } from "./remoras.ts";

/** Models we run that aren't in the picker's catalog, USD per 1M tokens (OpenRouter list prices). */
const OFF_CATALOG: Record<string, { inputPerMillion: number; outputPerMillion: number }> = {
  "google/gemini-2.5-flash": { inputPerMillion: 0.3, outputPerMillion: 2.5 },
};
/** A model with no known price is charged at the catalog's ceiling, $1 per 1M tokens. */
const CEILING = 1;

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function blendedPerMillion(model: string): number {
  const p = MODEL_CATALOG.find((m) => m.id === model) ?? OFF_CATALOG[model];
  return p ? (p.inputPerMillion + p.outputPerMillion) / 2 : CEILING;
}

/** USD per 1M tokens × tokens = micro-USD. */
export const modelMicroUsdc = (tokens: number, perMillion: number) =>
  BigInt(Math.round(tokens * perMillion));

/** MIST (1e-9 SUI) at a USD price, in micro-USDC. */
export const gasMicroUsdc = (mist: bigint, suiUsd: number) =>
  (mist * BigInt(Math.round(suiUsd * 1e6))) / 1_000_000_000n;

export function monthRange(month: string): { from: Date; to: Date } {
  const m = MONTH.exec(month);
  if (!m) throw new RemoraError("cost.bad_month", "Pick a month as YYYY-MM.", 400);
  const from = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, 1));
  const to = new Date(Date.UTC(Number(m[1]), Number(m[2]), 1));
  return { from, to };
}

export async function remoraCost(
  deps: { db: Db; suiUsd?: () => Promise<number>; defaultModel: string },
  r: { id: string; address: string; network: SuiNetwork; model?: string | undefined },
  month: string,
) {
  const { from, to } = monthRange(month);
  const [usage] = await deps.db
    .select({ tokens: sql<string>`coalesce(sum(${remoraUsage.tokens}), 0)` })
    .from(remoraUsage)
    .where(and(eq(remoraUsage.remoraId, r.id), sql`${remoraUsage.day} like ${`${month}-%`}`));
  const tokens = Number(usage?.tokens ?? 0);

  const [gas] = await deps.db
    .select({ mist: sql<string>`coalesce(sum(${sponsorLedger.gasUsed}), 0)` })
    .from(sponsorLedger)
    .where(
      and(
        eq(sponsorLedger.network, r.network),
        eq(sponsorLedger.sender, r.address),
        eq(sponsorLedger.status, "settled"),
        sql`${sponsorLedger.day} >= ${from.toISOString().slice(0, 10)}`,
        sql`${sponsorLedger.day} < ${to.toISOString().slice(0, 10)}`,
      ),
    );
  const mist = BigInt(gas?.mist ?? 0);
  let gasUsdc = 0n;
  if (mist > 0n) {
    if (!deps.suiUsd) throw new RemoraError("cost.no_price", "There's no SUI price here.", 409);
    gasUsdc = gasMicroUsdc(
      mist,
      await deps.suiUsd().catch((err: Error) => {
        throw new RemoraError("cost.no_price", `No SUI price right now: ${err.message}`, 409);
      }),
    );
  }

  const decision = sql`${receipts.wake}->'intent'->'decision'`;
  const [paid] = await deps.db
    .select({ amount: sql<string>`coalesce(sum((${decision}->>'amount')::numeric), 0)::text` })
    .from(receipts)
    .where(
      and(
        eq(receipts.remoraId, r.id),
        eq(receipts.network, r.network),
        sql`${receipts.txDigest} is not null`,
        sql`${decision}->>'action' = 'pay'`,
        sql`${receipts.createdAt} >= ${from.toISOString()}`,
        sql`${receipts.createdAt} < ${to.toISOString()}`,
      ),
    );

  return {
    llmUsdc: modelMicroUsdc(tokens, blendedPerMillion(r.model ?? deps.defaultModel)).toString(),
    gasUsdc: gasUsdc.toString(),
    purchasesUsdc: BigInt(paid?.amount ?? "0").toString(),
  };
}
