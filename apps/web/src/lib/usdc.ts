/** USDC has 6 decimals. Amounts travel as integer strings in the smallest unit. */
export function formatUsdc(amount: string | bigint, digits = 2): string {
  const v = BigInt(amount);
  const whole = v / 1_000_000n;
  const frac = (v % 1_000_000n).toString().padStart(6, "0").slice(0, Math.max(digits, 0));
  return digits > 0 ? `${whole}.${frac}` : `${whole}`;
}

/** At least two decimals and as many as the amount needs: 15000 → "0.015", 2000000 → "2.00". */
export function usdc(amount: string | bigint): string {
  return formatUsdc(amount, 6).replace(/(\.\d{2}\d*?)0+$/, "$1");
}

/** "1.5" → 1500000n; returns null for anything that isn't a positive amount with ≤ 6 decimals. */
export function parseUsdc(input: string): bigint | null {
  const m = /^(\d+)(?:\.(\d{1,6}))?$/.exec(input.trim());
  if (!m) return null;
  const v = BigInt(m[1] ?? "0") * 1_000_000n + BigInt((m[2] ?? "").padEnd(6, "0") || "0");
  return v > 0n ? v : null;
}

export const explorerTx = (network: string, digest: string) =>
  `https://suiscan.xyz/${network}/tx/${digest}`;
