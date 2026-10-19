/**
 * Reading a coin balance over the browser Sui client (gRPC-web, ADR-0021). The gRPC `GetBalance`
 * answer is `{ balance: { balance } }`; older shapes wrapped it differently, so both are accepted.
 */

export interface BalanceReader {
  getBalance?(input: { owner: string; coinType?: string }): Promise<unknown>;
}

/** The base units held for a coin, or null when the answer has no readable balance. */
export function balanceMist(value: unknown): bigint | null {
  if (typeof value !== "object" || value === null) return null;
  if ("totalBalance" in value && typeof value.totalBalance === "string") {
    return BigInt(value.totalBalance);
  }
  if (!("balance" in value)) return null;
  const balance = value.balance;
  const raw =
    typeof balance === "string"
      ? balance
      : typeof balance === "object" && balance !== null && "balance" in balance
        ? balance.balance
        : null;
  return typeof raw === "string" ? BigInt(raw) : null;
}

/** SUI has 9 decimals and shows two: 12_400_000_000 → "12.40". */
export function formatSui(mist: bigint, digits = 2): string {
  const whole = mist / 1_000_000_000n;
  const frac = (mist % 1_000_000_000n).toString().padStart(9, "0").slice(0, Math.max(digits, 0));
  return digits > 0 ? `${whole}.${frac}` : `${whole}`;
}

export const SUI_COIN_TYPE = "0x2::sui::SUI";
