/**
 * A9·be (ADR-0026): one deployment serves both Sui networks. Everything chain-related is looked up
 * per network here; nothing reads one global network.
 */
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import {
  createTatumSuiClient,
  type SuiNetwork,
  suiFallbackUrl,
  type TatumSuiOptions,
} from "@remora/chain";
import { DEPLOYMENTS } from "@remora/schema";

export const NETWORKS = ["testnet", "mainnet"] as const satisfies readonly SuiNetwork[];
/** Sent by the web app on every API call (ADR-0026); the contract lives in `@remora/schema`. */
export { NETWORK_HEADER } from "@remora/schema";

export interface NetworkEnv {
  SUI_NETWORK?: string;
  TATUM_API_KEY?: string;
  TATUM_API_KEY_TESTNET?: string;
  TATUM_SUI_GRPC?: string;
  TATUM_SUI_GRPC_TESTNET?: string;
  /** ADR-0097: where calls go while Tatum answers 402; `off` turns it off. */
  SUI_GRPC_FALLBACK?: string;
  SUI_GRPC_FALLBACK_TESTNET?: string;
  FACILITATOR_URL?: string;
  FACILITATOR_URL_TESTNET?: string;
}

export interface NetworkConfig {
  network: SuiNetwork;
  available: boolean;
  /** Why it's unavailable, for `/api/networks` and the typed refusal. */
  reason?: string;
  packageId: string | null;
  discRegistryId: string | null;
  /** `remora_hatchery` (M6, ADR-0047); null where it isn't published. */
  hatcheryPackageId: string | null;
  hatcheryRegistryId: string | null;
  usdcCoinType: string;
  facilitatorUrl: string | null;
}

export interface Networks {
  readonly default: SuiNetwork;
  list(): NetworkConfig[];
  config(network: SuiNetwork): NetworkConfig;
  /** Lazily built Tatum client; throws for an unavailable network. */
  client(network: SuiNetwork): SuiGrpcClient;
}

type Deployments = Record<
  string,
  {
    remoraPackageId: string | null;
    discRegistryId: string | null;
    hatcheryPackageId?: string | null;
    hatcheryRegistryId?: string | null;
    usdcCoinType: string;
  }
>;

export function createNetworks(
  env: NetworkEnv,
  deployments: Deployments = DEPLOYMENTS,
  makeClient: (o: TatumSuiOptions) => SuiGrpcClient = createTatumSuiClient,
): Networks {
  const configs = new Map<SuiNetwork, NetworkConfig>();
  const tatum = new Map<SuiNetwork, TatumSuiOptions>();
  for (const network of NETWORKS) {
    const suffix = network === "testnet" ? "_TESTNET" : "";
    const d = deployments[network];
    const apiKey = env[`TATUM_API_KEY${suffix}` as keyof NetworkEnv];
    const url = env[`TATUM_SUI_GRPC${suffix}` as keyof NetworkEnv];
    const facilitatorUrl = env[`FACILITATOR_URL${suffix}` as keyof NetworkEnv] ?? null;
    const reason = !d?.remoraPackageId
      ? `remora isn't published on ${network} yet`
      : !d.discRegistryId
        ? `no Disc registry on ${network}`
        : !apiKey
          ? `no Tatum key for ${network}`
          : undefined;
    configs.set(network, {
      network,
      available: !reason,
      ...(reason ? { reason } : {}),
      packageId: d?.remoraPackageId ?? null,
      discRegistryId: d?.discRegistryId ?? null,
      hatcheryPackageId: d?.hatcheryPackageId ?? null,
      hatcheryRegistryId: d?.hatcheryRegistryId ?? null,
      usdcCoinType: d?.usdcCoinType ?? "",
      facilitatorUrl,
    });
    if (apiKey) {
      const fallbackUrl = suiFallbackUrl(network, env as Record<string, string | undefined>);
      tatum.set(network, { network, apiKey, ...(url ? { url } : {}), fallbackUrl });
    }
  }
  const preferred = env.SUI_NETWORK as SuiNetwork | undefined;
  const firstAvailable = NETWORKS.find((n) => configs.get(n)?.available) ?? "testnet";
  const fallback = preferred && configs.get(preferred)?.available ? preferred : firstAvailable;

  const clients = new Map<SuiNetwork, SuiGrpcClient>();
  return {
    default: fallback,
    list: () => NETWORKS.map((n) => configs.get(n) as NetworkConfig),
    config: (n) => configs.get(n) as NetworkConfig,
    client(n) {
      const c = configs.get(n);
      const opts = tatum.get(n);
      if (!c?.available || !opts) throw new NetworkUnavailableError(n, c?.reason);
      let client = clients.get(n);
      if (!client) {
        client = makeClient(opts);
        clients.set(n, client);
      }
      return client;
    },
  };
}

export class NetworkUnavailableError extends Error {
  readonly code = "network.unavailable";
  constructor(
    readonly network: string,
    readonly reason = "unknown network",
  ) {
    super(`${network} is unavailable: ${reason}`);
  }
}

/** Resolves the session's network from the header; unknown or unavailable networks are refused. */
export function resolveNetwork(networks: Networks, header: string | undefined | null): SuiNetwork {
  if (!header) return networks.default;
  if (!(NETWORKS as readonly string[]).includes(header)) {
    throw new NetworkUnavailableError(header, "unknown network");
  }
  const c = networks.config(header as SuiNetwork);
  if (!c.available) throw new NetworkUnavailableError(header, c.reason);
  return header as SuiNetwork;
}
