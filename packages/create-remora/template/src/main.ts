/**
 * Run it: `cp .env.example .env`, set `PAY_TO`, then `npm start`. List `https://<your host>/haiku`
 * in the Reef (https://getremora.vercel.app/reef/new) so remoras can buy it.
 */
import { existsSync } from "node:fs";
import { serve } from "@hono/node-server";
import { createApp, priceFrom } from "./app.ts";
import { publicSuiClient } from "./sui.ts";

if (existsSync(".env")) process.loadEnvFile(".env");
const payTo = process.env.PAY_TO;
if (!payTo) throw new Error("Set PAY_TO to the Sui address that gets paid (see .env.example).");
const app = createApp({
  payTo,
  facilitatorUrl: process.env.FACILITATOR_URL || "https://getremora.vercel.app/api/facilitator",
  price: priceFrom(process.env.PRICE),
  client: publicSuiClient("testnet"),
});
const port = Number(process.env.PORT || 8790);
serve({ fetch: app.fetch, port }, () =>
  console.log(`selling haiku on http://localhost:${port}/haiku`),
);
