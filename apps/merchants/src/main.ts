/** Starts the demo merchants: `MERCHANTS_PORT=8799 tsx src/main.ts` (ports 8787/5173 belong to another project). */
import { serve } from "@hono/node-server";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { createLogger, createTatumSuiClient } from "@remora/chain";
import type { SuiNetworkName } from "@remora/disc-sdk";
import { loadEnv } from "@remora/memory";
import type { X402Options } from "@remora/merchant";
import { DEPLOYMENTS } from "@remora/schema";
import { createSuiRiskApp } from "./sui-risk.ts";

loadEnv();
const log = createLogger({ service: "merchants" });
const networks: X402Options["networks"] = {};
const clients: Partial<Record<SuiNetworkName, SuiGrpcClient>> = {};
for (const network of ["testnet", "mainnet"] as const) {
  const suffix = network === "testnet" ? "_TESTNET" : "";
  const payTo = process.env[`MERCHANT_PAYTO${suffix}`];
  const facilitatorUrl = process.env[`FACILITATOR_URL${suffix}`];
  const apiKey = process.env[`TATUM_API_KEY${suffix}`];
  const d = DEPLOYMENTS[network as keyof typeof DEPLOYMENTS] as
    | { usdcCoinType: string }
    | undefined;
  if (!payTo || !facilitatorUrl || !apiKey || !d) continue;
  networks[network] = { payTo, asset: d.usdcCoinType, facilitatorUrl };
  clients[network] = createTatumSuiClient({ network, apiKey });
}
const app = createSuiRiskApp({
  pay: {
    amount: process.env.SUI_RISK_PRICE ?? "10000",
    description: "Sui object risk report",
    networks,
    disc: true,
  },
  clients,
});
const port = Number(process.env.MERCHANTS_PORT ?? 8799);
serve({ fetch: app.fetch, port }, (i) =>
  log.info("merchants.up", { port: i.port, networks: Object.keys(networks) }),
);
