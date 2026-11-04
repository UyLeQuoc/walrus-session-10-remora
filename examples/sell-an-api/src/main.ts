/**
 * Run it: `PAY_TO=0x… bun run --filter @remora/example-sell-an-api start`, then list
 * `http://<host>:8790/haiku` in the Reef (`/reef/new`) so remoras can buy it.
 */
import { serve } from "@hono/node-server";
import { createPublicSuiClient } from "@remora/chain";
import { createApp, priceFrom } from "./app.ts";

const payTo = process.env.PAY_TO;
if (!payTo) throw new Error("Set PAY_TO to the Sui address that gets paid.");
const app = createApp({
  payTo,
  facilitatorUrl: process.env.FACILITATOR_URL ?? "https://getremora.vercel.app/api/facilitator",
  price: priceFrom(process.env.PRICE),
  client: createPublicSuiClient("testnet"),
});
const port = Number(process.env.PORT ?? 8790);
serve({ fetch: app.fetch, port }, () =>
  console.log(`selling haiku on http://localhost:${port}/haiku`),
);
