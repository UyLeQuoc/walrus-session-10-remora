/**
 * Typed Disc errors for the "Why?" drawer and the bot's sentences (N4, N6). The codes match
 * `@remora/schema` `ERROR_CODES`. The `disc.*` owner-side ones are added there by the U2 contract PR.
 */
export type DiscErrorCode =
  | "disc.paused"
  | "disc.payee_not_allowed"
  | "disc.over_per_payment_cap"
  | "disc.not_owner"
  | "disc.not_spender"
  | "disc.wrong_disc"
  | "disc.exists"
  | "disc.bad_intent"
  | "disc.outdated"
  | "allowance.over_window_limit"
  | "allowance.over_lifetime_cap"
  | "allowance.not_started"
  | "allowance.expired"
  | "allowance.revoked"
  | "funds.insufficient_address_balance"
  | "sponsor.out_of_gas"
  | "rate_limited"
  | "unknown";

export interface DiscError {
  code: DiscErrorCode;
  /** The Move constant, when the chain aborted with a clever error. */
  constant?: string;
  message: string;
}

const BY_CONSTANT: Record<string, DiscErrorCode> = {
  EPaused: "disc.paused",
  EPayeeNotAllowed: "disc.payee_not_allowed",
  EOverPaymentCap: "disc.over_per_payment_cap",
  ENotOwner: "disc.not_owner",
  EWrongDisc: "disc.wrong_disc",
  EDiscExists: "disc.exists",
  EBadIntent: "disc.bad_intent",
  EWrongVersion: "disc.outdated",
  EExceedsRateLimit: "allowance.over_window_limit",
  EExceedsLifetimeCap: "allowance.over_lifetime_cap",
  ENotStarted: "allowance.not_started",
  EExpired: "allowance.expired",
  ENotSpender: "disc.not_spender",
};

/** Errors that never reach Move: the validator rejects the inputs at signing. */
const BY_TEXT: [RegExp, DiscErrorCode][] = [
  [/sender is not the spender/i, "disc.not_spender"],
  [/insufficient address balance/i, "funds.insufficient_address_balance"],
  [/Object 0x[0-9a-f]+ not found|deleted/i, "allowance.revoked"],
  [/InsufficientGas|GasBalanceTooLow|insufficient gas|No valid gas coins/i, "sponsor.out_of_gas"],
  [/HTTP status code 429|RESOURCE_EXHAUSTED/i, "rate_limited"],
];

/**
 * Maps whatever a Disc call failed with: an `ExecutionError` from `effects.status.error` (clever
 * errors carry `cleverError.constantName`), or the error `tx.build` / simulate threw ("MoveAbort …
 * 'EOverPaymentCap' …").
 */
export function toDiscError(err: unknown): DiscError {
  const e = err as {
    message?: string;
    MoveAbort?: { cleverError?: { constantName?: string } };
  } | null;
  const message = e?.message ?? String(err);
  const constant =
    e?.MoveAbort?.cleverError?.constantName ?? /'(E[A-Za-z]+)'/.exec(message)?.[1] ?? undefined;
  if (constant && BY_CONSTANT[constant]) {
    return { code: BY_CONSTANT[constant], constant, message };
  }
  for (const [pattern, code] of BY_TEXT) {
    if (pattern.test(message)) return { code, ...(constant ? { constant } : {}), message };
  }
  return { code: "unknown", ...(constant ? { constant } : {}), message };
}
