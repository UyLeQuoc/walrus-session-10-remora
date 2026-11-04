/**
 * ADR-0106 `price`: token prices in USD from CoinGecko's public API (no key). The price is read before
 * the payment (`sourceFirst`), so a source that doesn't answer costs nothing, and every answer names
 * the source and when it priced each token. The source itself lives in `@remora/merchant` (ADR-0121),
 * because the server's price trigger reads it too, unpaid.
 */
import {
  type PaidContext,
  type Prices,
  pricesOf,
  retryingFetch,
  SourceInputError,
  sourceFirst,
  symbolsIn,
  type X402Options,
  x402,
} from "@remora/merchant";
import { Hono } from "hono";

export { type Prices, pricesOf, symbolsIn, TOKENS } from "@remora/merchant";

export function createPriceApp(o: { pay: X402Options; fetch?: typeof fetch }) {
  const app = new Hono<{ Variables: { x402: PaidContext; source: Prices } }>();
  const http = retryingFetch(o.fetch);
  app.get(
    "/price",
    sourceFirst(
      async (c) => pricesOf(symbolsIn(c.req.query("symbols") ?? c.req.query("q") ?? ""), http),
      (c) => {
        if ((c.req.query("q") ?? "").length > 300)
          throw new SourceInputError("too_long", "Ask about at most 300 characters.");
      },
      { early: true },
    ),
    x402(o.pay),
    (c) => c.json({ ...c.get("source"), paid: c.get("x402") }),
  );
  return app;
}
