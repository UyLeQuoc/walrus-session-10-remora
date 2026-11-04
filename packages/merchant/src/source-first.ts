/**
 * ADR-0106: a merchant reads its source before `x402` settles. `x402` settles first and only then
 * runs the handler, so a service that fetched after the payment would charge for an answer it then
 * couldn't give. Put `sourceFirst` before `x402` on the route:
 *
 * - **No payment header** (the buyer's first call): it only runs `check`, the cheap input test, and
 *   lets `x402` answer 402 with the requirements.
 * - **With one:** it loads the source for the header's network and keeps the result as
 *   `c.var.source`. If the load fails, it answers 502 `source.unavailable` before any payment, so a
 *   failed source costs the buyer nothing.
 */
import {
  decodeHeader,
  fromX402Network,
  PAYMENT_HEADER,
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
  load: (c: Context, network: SuiNetworkName) => Promise<T>,
  check?: (c: Context) => void,
): MiddlewareHandler<{ Variables: { source: T } }> {
  return async (c, next) => {
    try {
      check?.(c);
    } catch (err) {
      if (err instanceof SourceInputError)
        return c.json({ error: { code: err.code, message: err.message } }, 400);
      throw err;
    }
    const header = c.req.header(PAYMENT_HEADER);
    if (!header) return next();
    let network: SuiNetworkName | null = null;
    try {
      network = fromX402Network(decodeHeader<{ network: string }>(header).network);
    } catch {
      // A malformed header is x402's to refuse.
    }
    if (!network) return next();
    try {
      c.set("source", await load(c, network));
    } catch (err) {
      if (err instanceof SourceInputError)
        return c.json({ error: { code: err.code, message: err.message } }, 400);
      return c.json(
        {
          error: {
            code: "source.unavailable",
            message: `The source didn't answer, so nothing was charged: ${(err as Error).message}`,
          },
        },
        502,
      );
    }
    return next();
  };
}
