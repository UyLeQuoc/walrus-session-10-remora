/**
 * N15/H3: what one remora cost in a month, from `GET /api/remoras/:id/cost?month=YYYY-MM`.
 *
 * Amounts are micro-USDC (6 decimals) as non-negative integer strings, like every other money field
 * the web app parses (budget `windowLimit`, `perPaymentCap`, `lib/usdc.ts`): no floats cross the
 * wire, and `BigInt` sums exactly. The server's numbers are the truth; the browser only adds them
 * up for the total and the shares.
 *
 * TODO: move `CostResponse` to `packages/schema` (and the fixtures to its fixtures) when Uy's U9
 * contract PR for this endpoint lands. Until then this is a local copy of the agreed shape.
 */
import { z } from "zod";
import { formatUsdc } from "@/lib/usdc";

const MicroUsdc = z.string().regex(/^\d+$/);

export const CostResponse = z.object({
  llmUsdc: MicroUsdc,
  gasUsdc: MicroUsdc,
  purchasesUsdc: MicroUsdc,
});
export type CostResponse = z.infer<typeof CostResponse>;

export const COST_PARTS = [
  { key: "llmUsdc", label: "Model" },
  { key: "gasUsdc", label: "Gas (sponsored)" },
  { key: "purchasesUsdc", label: "Purchases" },
] as const;

export function costTotal(c: CostResponse): bigint {
  return BigInt(c.llmUsdc) + BigInt(c.gasUsdc) + BigInt(c.purchasesUsdc);
}

const CENT = 10_000n;

/** "$1.25"; "$0.00" only for exactly zero; "< $0.01" for anything smaller than a cent. */
export function formatCost(amount: bigint): string {
  if (amount === 0n) return "$0.00";
  if (amount < CENT) return "< $0.01";
  return `$${formatUsdc(((amount + CENT / 2n) / CENT) * CENT)}`;
}

/** Whole-percent share of the total; "< 1%" for a non-zero share that would round to 0. */
export function formatShare(part: bigint, total: bigint): string {
  if (total === 0n || part === 0n) return "0%";
  const pct = Number((part * 100n * 100n) / total) / 100;
  return pct < 0.5 ? "< 1%" : `${Math.round(pct)}%`;
}

/** This month and the five before it, newest first, as `YYYY-MM` (UTC, like the server's months). */
export function recentMonths(now = new Date()): string[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

export function monthLabel(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, 1)).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
