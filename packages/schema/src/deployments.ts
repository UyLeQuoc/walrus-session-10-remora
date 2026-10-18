import { z } from "zod";
import { ObjectId } from "./common.ts";

export const Deployment = z.object({
  network: z.enum(["mainnet", "testnet"]),
  /** Published by Uy only; null until E1 lands (ADR-0003). */
  remoraPackageId: ObjectId.nullable(),
  /** Shared object of `remora::hatchery`; null until M6 lands. */
  hatcheryRegistryId: ObjectId.nullable(),
  usdcCoinType: z.string().min(1),
  memwalRelayer: z.url(),
  tatumSuiGrpc: z.url(),
});

/** Placeholder IDs until the U1 spike and E1 publish. Verify the USDC type in U1 before use. */
export const DEPLOYMENTS = {
  mainnet: {
    network: "mainnet",
    remoraPackageId: null,
    hatcheryRegistryId: null,
    usdcCoinType: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    memwalRelayer: "https://relayer.memory.walrus.xyz",
    tatumSuiGrpc: "https://sui-mainnet-grpc.gateway.tatum.io",
  },
} as const satisfies Record<string, z.input<typeof Deployment>>;

export type Deployment = z.infer<typeof Deployment>;
