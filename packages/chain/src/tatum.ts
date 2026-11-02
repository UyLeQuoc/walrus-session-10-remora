import { ChannelCredentials } from "@grpc/grpc-js";
import { SuiGrpcClient } from "@mysten/sui/grpc";
import { GrpcTransport } from "@protobuf-ts/grpc-transport";
import { FallbackTransport, publicGrpcUrl } from "./fallback.ts";
import { createLogger } from "./log.ts";
import { PacedTransport } from "./paced.ts";

export type SuiNetwork = "mainnet" | "testnet";

export interface TatumSuiOptions {
  network: SuiNetwork;
  apiKey: string;
  /** gRPC base URL. Defaults to `https://sui-<network>-grpc.gateway.tatum.io`. */
  url?: string;
  /** Per-call deadline. */
  timeoutMs?: number;
  /** Unary calls per second. Tatum's gateway answers 429 above the plan's limit (3/s is safe on free). */
  maxRps?: number;
  /**
   * Where calls go while Tatum answers 402, out of credits (ADR-0097). Defaults to the public fullnode
   * (`publicGrpcUrl`); null turns the fallback off.
   */
  fallbackUrl?: string | null;
}

export function tatumGrpcUrl(network: SuiNetwork): string {
  return `https://sui-${network}-grpc.gateway.tatum.io`;
}

/**
 * Tatum serves native gRPC (`application/grpc`), not gRPC-web, so Node needs the grpc-js transport
 * instead of SuiGrpcClient's default (ADR-0021). The API key rides as `x-api-key` metadata.
 */
export function createTatumTransport(opts: TatumSuiOptions): GrpcTransport {
  return grpcTransport(opts.url ?? tatumGrpcUrl(opts.network), opts.timeoutMs, {
    "x-api-key": opts.apiKey,
  });
}

function grpcTransport(base: string, timeoutMs = 30_000, meta: Record<string, string> = {}) {
  const url = new URL(base);
  return new GrpcTransport({
    host: `${url.hostname}:${url.port || 443}`,
    channelCredentials: ChannelCredentials.createSsl(),
    meta,
    timeout: timeoutMs,
  });
}

const log = createLogger({ service: "chain" });

export function createTatumSuiClient(opts: TatumSuiOptions): SuiGrpcClient {
  const maxRps = opts.maxRps ?? 3;
  const tatum = new PacedTransport(createTatumTransport(opts), { maxRps });
  const fallbackUrl =
    opts.fallbackUrl === undefined ? publicGrpcUrl(opts.network) : opts.fallbackUrl;
  const transport = fallbackUrl
    ? new FallbackTransport(
        tatum,
        new PacedTransport(grpcTransport(fallbackUrl, opts.timeoutMs), { maxRps, metered: false }),
        {
          network: opts.network,
          onSwitch: (reason) =>
            log.warn("tatum.fallback", { network: opts.network, to: fallbackUrl, reason }),
        },
      )
    : tatum;
  return new SuiGrpcClient({ network: opts.network, transport });
}

/** `SUI_GRPC_FALLBACK[_TESTNET]`: a gRPC URL, or `off`. Unset means the public fullnode (ADR-0097). */
export function suiFallbackUrl(
  network: SuiNetwork,
  env: Record<string, string | undefined> = process.env,
): string | null {
  const value = env[`SUI_GRPC_FALLBACK${network === "testnet" ? "_TESTNET" : ""}`]?.trim();
  if (value === "off") return null;
  return value || publicGrpcUrl(network);
}

/** Reads the `.env.example` keys: `TATUM_SUI_GRPC[_TESTNET]`, `TATUM_API_KEY[_TESTNET]` and `SUI_GRPC_FALLBACK[_TESTNET]`. */
export function tatumSuiOptionsFromEnv(
  network: SuiNetwork,
  env: Record<string, string | undefined> = process.env,
): TatumSuiOptions {
  const suffix = network === "testnet" ? "_TESTNET" : "";
  const apiKey = env[`TATUM_API_KEY${suffix}`];
  if (!apiKey) throw new Error(`TATUM_API_KEY${suffix} is not set`);
  return {
    network,
    apiKey,
    url: env[`TATUM_SUI_GRPC${suffix}`] || undefined,
    fallbackUrl: suiFallbackUrl(network, env),
  };
}
