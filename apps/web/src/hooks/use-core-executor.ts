import { useSuiClient } from "@mysten/dapp-kit";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { fromBase64, toBase64 } from "@mysten/sui/utils";
import { useCallback } from "react";

export interface CoreExecuteResult {
  digest: string;
  rawEffects: number[];
  effects: string;
  bytes: string;
  signature: string;
}

/**
 * The broadcaster for `useSignAndExecuteTransaction({ execute })`. Without it
 * dApp Kit calls `executeTransactionBlock`, a JSON-RPC method the gRPC client
 * does not have and public fullnodes no longer serve, so a wallet-paid
 * transaction throws only at the moment a person signs it.
 */
export function useCoreExecutor(): (input: {
  bytes: string;
  signature: string;
}) => Promise<CoreExecuteResult> {
  const client = useSuiClient();
  return useCallback(
    async ({ bytes, signature }) => {
      if (!("core" in client)) throw new Error("Sui client is missing the core API.");
      const core = (client as unknown as ClientWithCoreApi).core;
      const result = await core.executeTransaction({
        transaction: fromBase64(bytes),
        signatures: [signature],
        include: { effects: true },
      });
      const tx = result.Transaction ?? result.FailedTransaction;
      const effects = tx?.effects?.bcs ?? null;
      return {
        digest: tx?.digest ?? "",
        rawEffects: effects ? Array.from(effects) : [],
        effects: effects ? toBase64(effects) : "",
        bytes,
        signature,
      };
    },
    [client],
  );
}
