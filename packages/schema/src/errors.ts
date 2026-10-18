/**
 * Stable error codes the backend returns and the UI turns into sentences (N6).
 * `@remora/disc-sdk` `toDiscError` maps Move aborts and validator rejections onto these;
 * the copy text for `error.<code>` lives in apps/server/src/copy/.
 */
export const ERROR_CODES = [
  "disc.paused",
  "disc.payee_not_allowed",
  "disc.over_per_payment_cap",
  "disc.not_owner",
  "disc.not_spender",
  "disc.wrong_disc",
  "disc.exists",
  "disc.bad_intent",
  "disc.outdated",
  "network.unavailable",
  "funds.bad_address",
  "funds.bad_request",
  "funds.no_coins",
  "x402.no_matching_requirements",
  "x402.over_soft_budget",
  "x402.gas_station_refused",
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
