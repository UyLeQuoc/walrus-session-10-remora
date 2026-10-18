import { z } from "zod";
import { ObjectId } from "./common.ts";
import { DetectFundsResult } from "./funds.ts";

/** The Sui network a session works on (ADR-0026). */
export const Network = z.enum(["testnet", "mainnet"]);

/** Sent by the web app on every API call. */
export const NETWORK_HEADER = "x-remora-network";

/** `GET /api/networks`: a network is available once published and keyed. */
export const NetworkInfo = z.object({
  network: Network,
  available: z.boolean(),
  reason: z.string().optional(),
  packageId: ObjectId.nullable(),
  usdcCoinType: z.string().min(1),
});
export const NetworksResponse = z.object({ default: Network, networks: z.array(NetworkInfo) });

/** `GET /api/funds`: the Detect funds split for the session's network. */
export const DetectFundsResponse = DetectFundsResult.extend({ network: Network });

/** `POST /api/funds/move` and `/withdraw`: an unsigned Transaction JSON for the owner's wallet. */
export const FundsTxResponse = z.object({ network: Network, transaction: z.string().min(1) });

/** Every API refusal: `{ error: { code, message } }` with a code from `ERROR_CODES`. */
export const ApiError = z.object({
  error: z.object({ code: z.string().min(1), message: z.string() }),
});

export type Network = z.infer<typeof Network>;
export type NetworkInfo = z.infer<typeof NetworkInfo>;
export type NetworksResponse = z.infer<typeof NetworksResponse>;
export type DetectFundsResponse = z.infer<typeof DetectFundsResponse>;
export type FundsTxResponse = z.infer<typeof FundsTxResponse>;
export type ApiError = z.infer<typeof ApiError>;
