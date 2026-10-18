/**
 * API shapes from the U3 contract PR (#4). They mirror `@remora/schema` `network.ts`; switch these
 * to imports from `@remora/schema` once #4 merges.
 */
import { DetectFundsResult } from "@remora/schema";
import { z } from "zod";

export const NetworkName = z.enum(["testnet", "mainnet"]);
export const NetworksResponse = z.object({
  default: NetworkName,
  networks: z.array(
    z.object({
      network: NetworkName,
      available: z.boolean(),
      reason: z.string().optional(),
      packageId: z.string().nullable(),
      usdcCoinType: z.string(),
    }),
  ),
});
export const DetectFundsResponse = DetectFundsResult.extend({ network: NetworkName });
export const FundsTxResponse = z.object({ network: NetworkName, transaction: z.string().min(1) });

export type NetworksResponse = z.infer<typeof NetworksResponse>;
export type DetectFundsResponse = z.infer<typeof DetectFundsResponse>;
