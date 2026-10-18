/**
 * Signs with the connected wallet and executes over gRPC (dApp Kit's default executor is JSON-RPC,
 * which the gRPC client doesn't have), then waits for finality and fails loudly on an aborted tx.
 */
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useCallback } from "react";
import { useCoreExecutor } from "@/hooks/use-core-executor";

export function useSignAndRun() {
  const execute = useCoreExecutor();
  const { mutateAsync } = useSignAndExecuteTransaction({ execute });
  const client = useSuiClient() as unknown as {
    core: {
      waitForTransaction(o: { digest: string; include?: { effects: true } }): Promise<{
        Transaction?: {
          effects?: { status: { success: boolean; error: { message?: string } | null } };
        };
        FailedTransaction?: {
          effects?: { status: { success: boolean; error: { message?: string } | null } };
        };
      }>;
    };
  };
  return useCallback(
    async (tx: Transaction | string): Promise<string> => {
      const transaction = typeof tx === "string" ? Transaction.from(tx) : tx;
      const { digest } = (await mutateAsync({ transaction: transaction as never })) as {
        digest: string;
      };
      if (!digest) throw new Error("The transaction wasn't executed.");
      const done = await client.core.waitForTransaction({ digest, include: { effects: true } });
      const status = (done.Transaction ?? done.FailedTransaction)?.effects?.status;
      if (status && !status.success)
        throw new Error(status.error?.message ?? "The transaction failed.");
      return digest;
    },
    [mutateAsync, client],
  );
}
