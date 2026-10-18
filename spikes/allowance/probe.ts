// U1 step 2: read-only probe through Tatum gRPC. Prints chain info and each spike key's funds split.
// Run from the repo root: bun --env-file=.env spikes/allowance/probe.ts [testnet|mainnet]
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import {
  createTatumSuiClient,
  readFunds,
  type SuiNetwork,
  tatumSuiOptionsFromEnv,
} from "@remora/chain";

const network = (process.argv[2] ?? "testnet") as SuiNetwork;
const USDC: Record<SuiNetwork, string | undefined> = {
  mainnet: process.env.USDC_COIN_TYPE,
  testnet: process.env.USDC_COIN_TYPE_TESTNET,
};

function address(envKey: string): string | undefined {
  const raw = process.env[envKey];
  if (!raw) return undefined;
  return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(raw).secretKey).toSuiAddress();
}

const client = createTatumSuiClient(tatumSuiOptionsFromEnv(network));
const t0 = performance.now();
const info = await client.ledgerService.getServiceInfo({});
const ms = Math.round(performance.now() - t0);
console.log(network, {
  chain: info.response.chain,
  epoch: info.response.epoch?.toString(),
  checkpoint: info.response.checkpointHeight?.toString(),
  server: info.response.server,
  latencyMs: ms,
});

const { protocolConfig } = await client.core.getProtocolConfig();
console.log("protocol", protocolConfig.protocolVersion, {
  addressBalances: protocolConfig.featureFlags.enable_accumulators,
  allowanceFlags: Object.entries(protocolConfig.featureFlags)
    .filter(([k]) => /allowance|accumulator|address_balance|funds/i.test(k))
    .map(([k, v]) => `${k}=${v}`),
});

for (const role of ["SPIKE_OWNER_KEY", "SPIKE_SPENDER_KEY", "SPIKE_SPONSOR_KEY"]) {
  const owner = address(role);
  if (!owner) continue;
  const coinTypes = ["0x2::sui::SUI", USDC[network]].filter((c): c is string => Boolean(c));
  for (const coinType of coinTypes) {
    const f = await readFunds(client, owner, coinType);
    console.log(role, owner, coinType.split("::").pop(), {
      total: f.total.toString(),
      addressBalance: f.addressBalance.toString(),
      coinBalance: f.coinBalance.toString(),
    });
  }
}
process.exit(0);
