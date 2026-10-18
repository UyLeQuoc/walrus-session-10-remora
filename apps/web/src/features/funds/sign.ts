/** Signs and executes with the connected wallet, then waits for finality on the session's network. */
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useCallback } from "react";

export function useSignAndRun() {
  const { mutateAsync } = useSignAndExecuteTransaction();
  const client = useSuiClient() as unknown as {
    core: { waitForTransaction(o: { digest: string }): Promise<unknown> };
  };
  return useCallback(
    async (tx: Transaction | string): Promise<string> => {
      const transaction = typeof tx === "string" ? Transaction.from(tx) : tx;
      const result = (await mutateAsync({ transaction: transaction as never })) as {
        digest: string;
      };
      await client.core.waitForTransaction({ digest: result.digest });
      return result.digest;
    },
    [mutateAsync, client],
  );
}
