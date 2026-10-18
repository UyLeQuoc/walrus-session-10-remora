import { z } from "zod";
import { Amount, IsoDateTime, SuiAddress } from "./common.ts";

/** One address's USDC split between coin objects and its address balance (ADR-0004, A4). */
export const FundsSplit = z.object({
  address: SuiAddress,
  role: z.enum(["owner", "remora", "merchant"]),
  coinType: z.string().min(1),
  /** Spendable by allowances. */
  addressBalance: Amount,
  /** Sitting in Coin objects: needs "Move to address balance" before allowances can use it. */
  coins: z.object({ total: Amount, count: z.number().int().nonnegative() }),
  /** Deposited but not yet settled by the accumulator. */
  settling: Amount,
  checkedAt: IsoDateTime,
});

export const DetectFundsResult = z.object({
  splits: z.array(FundsSplit),
  /** Total in coins across the owner's addresses that one tap can move. */
  movable: Amount,
});

export type FundsSplit = z.infer<typeof FundsSplit>;
export type DetectFundsResult = z.infer<typeof DetectFundsResult>;
