/** A4·be: the Detect funds split and the unsigned transactions the owner's wallet signs (ADR-0004). */
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { getFundsSplit } from "@remora/disc-sdk";

export type FundsRole = "owner" | "remora" | "merchant";

export interface FundsSplitRow {
  address: string;
  role: FundsRole;
  coinType: string;
  addressBalance: string;
  coins: { total: string; count: number };
  /** Accumulator settlement: deposits were readable at finality on testnet (U1), so 0 for now. */
  settling: string;
  checkedAt: string;
}

/** Shaped as `@remora/schema` `DetectFundsResult`. */
export async function detectFunds(
  client: SuiGrpcClient,
  coinType: string,
  addresses: { address: string; role: FundsRole }[],
  now: () => Date = () => new Date(),
): Promise<{ splits: FundsSplitRow[]; movable: string }> {
  const splits: FundsSplitRow[] = [];
  let movable = 0n;
  for (const { address, role } of addresses) {
    const split = await getFundsSplit(client.core, address, coinType);
    const count = split.coinBalance > 0n ? await countCoins(client, address, coinType) : 0;
    if (role === "owner") movable += split.coinBalance;
    splits.push({
      address,
      role,
      coinType,
      addressBalance: split.addressBalance.toString(),
      coins: { total: split.coinBalance.toString(), count },
      settling: "0",
      checkedAt: now().toISOString(),
    });
  }
  return { splits, movable: movable.toString() };
}

async function countCoins(client: SuiGrpcClient, owner: string, coinType: string): Promise<number> {
  let count = 0;
  let cursor: string | null = null;
  do {
    const page = await client.core.listCoins({ owner, coinType, cursor });
    count += page.objects.length;
    cursor = page.hasNextPage ? page.cursor : null;
  } while (cursor);
  return count;
}

async function coinIds(client: SuiGrpcClient, owner: string, coinType: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;
  do {
    const page = await client.core.listCoins({ owner, coinType, cursor });
    ids.push(...page.objects.map((o) => o.objectId));
    cursor = page.hasNextPage ? page.cursor : null;
  } while (cursor);
  return ids;
}

/**
 * "Move to address balance": merge the owner's coins of `coinType`, then `coin::send_funds` all of it
 * (or `amount`) into their own address balance. Coins are named explicitly because `tx.coin` would
 * happily draw from the address balance itself.
 */
export async function buildMoveToAddressBalance(
  client: SuiGrpcClient,
  owner: string,
  coinType: string,
  amount?: bigint,
): Promise<Transaction> {
  const ids = await coinIds(client, owner, coinType);
  if (!ids.length) throw new FundsError("funds.no_coins", "No coins to move.");
  const tx = new Transaction();
  tx.setSender(owner);
  const [first, ...rest] = ids.map((id) => tx.object(id));
  if (!first) throw new FundsError("funds.no_coins", "No coins to move.");
  if (rest.length) tx.mergeCoins(first, rest);
  const coin = amount !== undefined ? tx.splitCoins(first, [amount])[0] : first;
  if (!coin) throw new FundsError("funds.no_coins", "No coins to move.");
  tx.moveCall({
    target: "0x2::coin::send_funds",
    typeArguments: [coinType],
    arguments: [coin, tx.pure.address(owner)],
  });
  return tx;
}

/** "Withdraw to coin" (Advanced): address balance → a `Coin` the owner holds. */
export function buildWithdrawToCoin(owner: string, coinType: string, amount: bigint): Transaction {
  if (amount <= 0n) throw new FundsError("funds.bad_amount", "Amount must be greater than zero.");
  const tx = new Transaction();
  tx.setSender(owner);
  const coin = tx.moveCall({
    target: "0x2::coin::redeem_funds",
    typeArguments: [coinType],
    arguments: [tx.withdrawal({ amount, type: coinType })],
  });
  tx.transferObjects([coin], owner);
  return tx;
}

export class FundsError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}
