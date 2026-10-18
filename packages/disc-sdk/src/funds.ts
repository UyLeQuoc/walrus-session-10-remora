/** The slice of `SuiGrpcClient.core` that reads balances (works over gRPC-web in the browser too). */
export interface BalanceReader {
  getBalance(o: { owner: string; coinType: string }): Promise<{
    balance: { coinType: string; balance: string; addressBalance: string; coinBalance: string };
  }>;
}

export interface FundsSplit {
  coinType: string;
  total: bigint;
  /** Spendable by allowances. */
  addressBalance: bigint;
  /** In `Coin` objects: needs "Move to address balance" (`coin::send_funds`) first. */
  coinBalance: bigint;
}

/** One `StateService.GetBalance` call gives the split (U1). */
export async function getFundsSplit(
  client: BalanceReader,
  owner: string,
  coinType: string,
): Promise<FundsSplit> {
  const { balance } = await client.getBalance({ owner, coinType });
  return {
    coinType: balance.coinType,
    total: BigInt(balance.balance),
    addressBalance: BigInt(balance.addressBalance),
    coinBalance: BigInt(balance.coinBalance),
  };
}
