import { z } from "zod";
import { ObjectId } from "./common.ts";

export const Deployment = z.object({
  network: z.enum(["mainnet", "testnet"]),
  /** The original `remora` package ID; null until published (testnet in U2, mainnet in Uy's pass, ADR-0024). */
  remoraPackageId: ObjectId.nullable(),
  /** Shared `remora::disc::Registry` (Disc key → ID, ADR-0020); null until published. */
  discRegistryId: ObjectId.nullable(),
  /** The `remora_hatchery` package (M6, ADR-0047), published apart from the Disc; null until published. */
  hatcheryPackageId: ObjectId.nullable().default(null),
  /** Shared `remora_hatchery::hatchery::Registry` (the version gate); null until published. */
  hatcheryRegistryId: ObjectId.nullable(),
  /** ADR-0130: the `remora_capsule` package (memory capsules, Seal); null until published. */
  capsulePackageId: ObjectId.nullable().default(null),
  usdcCoinType: z.string().min(1),
  memwalRelayer: z.url(),
  tatumSuiGrpc: z.url(),
});

/** Mainnet IDs stay null until Uy's mainnet pass (ADR-0024). Testnet: the U2 Disc and U7 hatchery publishes. */
export const DEPLOYMENTS = {
  mainnet: {
    network: "mainnet",
    remoraPackageId: null,
    discRegistryId: null,
    hatcheryPackageId: null,
    hatcheryRegistryId: null,
    capsulePackageId: null,
    usdcCoinType: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    memwalRelayer: "https://relayer.memory.walrus.xyz",
    tatumSuiGrpc: "https://sui-mainnet-grpc.gateway.tatum.io",
  },
  testnet: {
    network: "testnet",
    remoraPackageId: "0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95e3c69e88434a5d6d",
    discRegistryId: "0x479454d5ed1b44000b03948dc2935c656c031e09f1b9508f4af38c54bb83b371",
    // remora_hatchery, published in U7 (ADR-0047); its UpgradeCap stays with the spike key like the Disc's.
    hatcheryPackageId: "0x68c7df0db31b372c0d19fdddbd04527848ad2121fcec694b2bb9ba47369de9a9",
    hatcheryRegistryId: "0xb3d76fff500dcd341afefec1168a95fba516ec2e71bfa0e4228d0c03d20ad3d0",
    // remora_capsule, published in U18 (ADR-0130) with the spike key, like the others.
    capsulePackageId: "0x7e14e6d59133307d8d8e28880b708f9e0f5f7f3399a4daaffb516feadf237e43",
    // Circle's testnet USDC, a regulated coin (verified in U1).
    usdcCoinType: "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
    // Staging relayer; the hackathon's memory runs on mainnet (tech-reference §1.3).
    memwalRelayer: "https://relayer-staging.memory.walrus.xyz",
    tatumSuiGrpc: "https://sui-testnet-grpc.gateway.tatum.io",
  },
} as const satisfies Record<string, z.input<typeof Deployment>>;

export type Deployment = z.infer<typeof Deployment>;
