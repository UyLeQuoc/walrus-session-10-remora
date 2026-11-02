/** Builds the facilitator from env: one entry per network that is published, keyed and sponsored. */

import { createLogger, createTatumSuiClient, type Logger, suiFallbackUrl } from "@remora/chain";
import { createDb } from "@remora/db";
import type { SuiNetworkName } from "@remora/disc-sdk";
import { DEPLOYMENTS } from "@remora/schema";
import { Sponsor } from "@remora/signer";
import type { FacilitatorDeps, NetworkDeps } from "./facilitator.ts";
import { MemorySponsorLedger, PgSponsorLedger } from "./ledger.ts";

export function facilitatorDepsFromEnv(
  env: Record<string, string | undefined> = process.env,
  log: Logger = createLogger({ service: "facilitator" }),
): FacilitatorDeps {
  const networks: Partial<Record<SuiNetworkName, NetworkDeps>> = {};
  const maxGasBudget = BigInt(env.SPONSOR_MAX_GAS_BUDGET ?? 50_000_000);
  for (const network of ["testnet", "mainnet"] as const) {
    const suffix = network === "testnet" ? "_TESTNET" : "";
    const d = DEPLOYMENTS[network as keyof typeof DEPLOYMENTS] as
      | { remoraPackageId: string | null; usdcCoinType: string }
      | undefined;
    const apiKey = env[`TATUM_API_KEY${suffix}`];
    if (!d?.remoraPackageId || !apiKey) {
      log.info("network.skipped", {
        network,
        reason: !d?.remoraPackageId ? "not published" : "no Tatum key",
      });
      continue;
    }
    const url = env[`TATUM_SUI_GRPC${suffix}`];
    const sponsorKey = env[`SPONSOR_PRIVATE_KEY${suffix}`];
    networks[network] = {
      network,
      client: createTatumSuiClient({
        network,
        apiKey,
        ...(url ? { url } : {}),
        fallbackUrl: suiFallbackUrl(network, env),
      }),
      sponsor: sponsorKey
        ? new Sponsor(sponsorKey, {
            allowedPackages: [d.remoraPackageId, "0x1", "0x2"],
            maxGasBudget,
          })
        : null,
      packageId: d.remoraPackageId,
      usdcCoinType: d.usdcCoinType,
    };
  }
  const url = env.DATABASE_URL;
  if (!url)
    log.warn("ledger.memory", { reason: "DATABASE_URL unset; gas budgets reset on restart" });
  return {
    networks,
    ledger: url ? new PgSponsorLedger(createDb(url)) : new MemorySponsorLedger(),
    dailyGasBudget: BigInt(env.SPONSOR_DAILY_GAS_MIST ?? 200_000_000),
    log,
  };
}

/** D8: warns when a sponsor's SUI runs low. */
export async function checkSponsorBalances(deps: FacilitatorDeps, lowMist: bigint): Promise<void> {
  for (const n of Object.values(deps.networks)) {
    if (!n?.sponsor) continue;
    const { balance } = await n.client.core.getBalance({ owner: n.sponsor.address });
    const total = BigInt(balance.balance);
    if (total < lowMist) {
      deps.log.warn("sponsor.low_balance", {
        network: n.network,
        sponsor: n.sponsor.address,
        total,
      });
    }
  }
}
