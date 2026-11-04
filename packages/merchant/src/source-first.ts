/**
 * ADR-0106: a merchant reads its source before `x402` settles. `x402` settles first and only then
 * runs the handler, so a service that fetched after the payment would charge for an answer it then
 * couldn't give. Put `sourceFirst` before `x402` on the route:
 *
 * - **No payment header** (the buyer's first call): it runs `check`, the cheap input test. With
 *   `early`, it also loads the source (network `null`), so a source that's down fails before the
 *   buyer asks the gas station to sponsor anything; the merchant's own cache serves the paid call.
 *   Then `x402` answers 402 with the requirements.
 * - **With one:** it loads the source for the header's network and keeps the result as
 *   `c.var.source`. If the load fails, it answers 502 `source.unavailable` before any payment, so a
 *   failed source costs the buyer nothing. An MPP credential (`Authorization: Payment`, ADR-0120)
 *   counts as one; its network is in the challenge's request.
 */
import {
  decodeHeader,
  fromX402Network,
  MPP_CREDENTIAL_HEADER,
  mppNetwork,
  PAYMENT_HEADER,
  paymentCredentials,
  type SuiNetworkName,
} from "@remora/disc-sdk";
import type { Context, MiddlewareHandler } from "hono";

export class SourceInputError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function sourceFirst<T>(
  load: (c: Context, network: SuiNetworkName | null) => Promise<T>,
  check?: (c: Context) => void,
  /** `early`: load on the unpaid call too; a network name loads it for that network. */
  opts: { early?: boolean | SuiNetworkName } = {},
): MiddlewareHandler<{ Variables: { source: T } }> {
  const failed = (c: Context, err: unknown) =>
    err instanceof SourceInputError
      ? c.json({ error: { code: err.code, message: err.message } }, 400)
      : c.json(
          {
            error: {
              code: "source.unavailable",
              message: `The source didn't answer, so nothing was charged: ${(err as Error).message}`,
            },
          },
          502,
        );
  return async (c, next) => {
    try {
      check?.(c);
    } catch (err) {
      if (err instanceof SourceInputError)
        return c.json({ error: { code: err.code, message: err.message } }, 400);
      throw err;
    }
    const header = c.req.header(PAYMENT_HEADER);
    const credential = c.req.header(MPP_CREDENTIAL_HEADER);
    if (!header && paymentCredentials(credential).length === 0) {
      if (opts.early) {
        try {
          await load(c, typeof opts.early === "string" ? opts.early : null);
        } catch (err) {
          return failed(c, err);
        }
      }
      return next();
    }
    let network: SuiNetworkName | null = header ? null : mppNetwork(credential);
    try {
      if (header) network = fromX402Network(decodeHeader<{ network: string }>(header).network);
    } catch {
      // A malformed header (or credential: `mppNetwork` is null) is the payment gate's to refuse.
    }
    if (!network) return next();
    try {
      c.set("source", await load(c, network));
    } catch (err) {
      return failed(c, err);
    }
    return next();
  };
}

/**
 * A fetch that tries once more after a network error (not after an HTTP error): outside sources drop
 * the odd request, and a retry is cheaper than a failed purchase.
 */
export function retryingFetch(http: typeof fetch = fetch, delayMs = 400): typeof fetch {
  return (async (input: string | URL | Request, init?: RequestInit) => {
    try {
      return await http(input, init);
    } catch {
      await new Promise((r) => setTimeout(r, delayMs));
      return http(input, init);
    }
  }) as typeof fetch;
}
