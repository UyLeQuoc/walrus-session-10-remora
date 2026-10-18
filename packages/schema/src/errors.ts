/**
 * Stable error codes the backend returns and the UI turns into sentences (N6).
 * Move abort numbers map onto these once the Disc lands (E1); the copy text for
 * `error.<code>` lives in apps/server/src/copy/.
 */
export const ERROR_CODES = [
  "disc.paused",
  "disc.payee_not_allowed",
  "disc.over_per_payment_cap",
  "allowance.over_window_limit",
  "allowance.over_lifetime_cap",
  "allowance.not_started",
  "allowance.expired",
  "allowance.revoked",
  "funds.insufficient_address_balance",
  "funds.settling",
  "relayer.slow",
  "relayer.write_failed",
  "relayer.recall_dropped",
  "sponsor.out_of_gas",
  "sonar.blocked",
  "rate_limited",
  "unknown",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export function errorCopyKey(code: ErrorCode): `error.${ErrorCode}` {
  return `error.${code}`;
}
