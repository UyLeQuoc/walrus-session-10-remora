import { z } from "zod";
import { ObjectId } from "./common.ts";

export const Deployment = z.object({
  network: z.enum(["mainnet", "testnet"]),
  /** The original `remora` package ID; null until published (testnet in U2, mainnet in Uy's pass, ADR-0024). */
  remoraPackageId: ObjectId.nullable(),
  /** Shared `remora::disc::Registry` (Disc key → ID, ADR-0020); null until published. */
  discRegistryId: ObjectId.nullable(),
  /** Shared object of `remora::hatchery`; null until M6 lands. */
  hatcheryRegistryId: ObjectId.nullable(),
  usdcCoinType: z.string().min(1),
  memwalRelayer: z.url(),
  tatumSuiGrpc: z.url(),
});

/** Mainnet IDs stay null until Uy's mainnet pass (ADR-0024). Testnet is the U2 publish. */
export const DEPLOYMENTS = {
  mainnet: {
    network: "mainnet",
    remoraPackageId: null,
    discRegistryId: null,
    hatcheryRegistryId: null,
    usdcCoinType: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    memwalRelayer: "https://relayer.memory.walrus.xyz",
    tatumSuiGrpc: "https://sui-mainnet-grpc.gateway.tatum.io",
  },
  testnet: {
    network: "testnet",
    remoraPackageId: "0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95e3c69e88434a5d6d",
    discRegistryId: "0x479454d5ed1b44000b03948dc2935c656c031e09f1b9508f4af38c54bb83b371",
    hatcheryRegistryId: null,
    // Circle's testnet USDC, a regulated coin (verified in U1).
    usdcCoinType: "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
    // Staging relayer; the hackathon's memory runs on mainnet (tech-reference §1.3).
    memwalRelayer: "https://relayer-staging.memory.walrus.xyz",
    tatumSuiGrpc: "https://sui-testnet-grpc.gateway.tatum.io",
  },
} as const satisfies Record<string, z.input<typeof Deployment>>;

export type Deployment = z.infer<typeof Deployment>;
