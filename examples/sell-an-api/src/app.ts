/**
 * E13 (ADR-0111): an API you sell to remoras, in about 20 lines. `x402` from `@remora/merchant`
 * answers 402 with the price and your address, then verifies and settles each payment through
 * Remora's public facilitator on Sui testnet, and only then runs your handler.
 */
import { x402 } from "@remora/merchant";
import { Hono } from "hono";

/** Circle's USDC on Sui testnet. */
export const USDC_TESTNET =
  "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

export function createApp(o: {
  payTo: string;
  facilitatorUrl: string;
  price?: string;
  fetch?: typeof fetch;
}) {
  const app = new Hono();
  app.get(
    "/haiku",
    x402({
      amount: o.price ?? "5000", // 0.005 USDC
      description: "A haiku about your question",
      networks: {
        testnet: { payTo: o.payTo, asset: USDC_TESTNET, facilitatorUrl: o.facilitatorUrl },
      },
      ...(o.fetch ? { fetch: o.fetch } : {}),
    }),
    (c) => c.json({ haiku: haiku(c.req.query("q") ?? "the sea") }),
  );
  return app;
}

/** Your API goes here. This one writes three lines from the question's longest words. */
export function haiku(q: string): string {
  const words = q.toLowerCase().match(/[a-z]{3,}/g) ?? ["sea"];
  const [a = "sea", b = "light", c = "tide"] = [...new Set(words)].sort(
    (x, y) => y.length - x.length,
  );
  return `${a} on the water\nsmall fish carry ${b} along\n${c}, paid for, settles`;
}
