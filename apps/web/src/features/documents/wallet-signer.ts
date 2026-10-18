import type { ClientWithCoreApi, SuiClientTypes } from "@mysten/sui/client";
import { type PublicKey, type SignatureScheme, Signer } from "@mysten/sui/cryptography";
import type { Transaction } from "@mysten/sui/transactions";

const NOT_FOUND = /not found|could not find the referenced transaction|TransactionNotFound/i;

/**
 * Lets the Walrus SDK, which wants a `Signer`, drive a browser wallet. Walrus
 * only calls `toSuiAddress` and `signAndExecuteTransaction`; a wallet never
 * hands over a key, so the raw signing members refuse. Ported from WalForm.
 */
export class WalletSigner extends Signer {
  constructor(
    private readonly address: string,
    private readonly signAndExecute: (transaction: Transaction) => Promise<{ digest: string }>,
  ) {
    super();
  }

  toSuiAddress(): string {
    return this.address;
  }

  override async signAndExecuteTransaction({
    transaction,
    client,
  }: {
    transaction: Transaction;
    client: ClientWithCoreApi;
  }): Promise<SuiClientTypes.TransactionResult<{ transaction: true; effects: true }>> {
    const { digest } = await this.signAndExecute(transaction);
    return waitForIndexed(client, digest);
  }

  async sign(): Promise<Uint8Array<ArrayBuffer>> {
    throw new Error("A wallet does not expose raw signing.");
  }

  getKeyScheme(): SignatureScheme {
    throw new Error("A wallet does not expose its key scheme.");
  }

  getPublicKey(): PublicKey {
    throw new Error("A wallet does not expose its public key.");
  }
}

/**
 * The wallet broadcasts through its own node, which can be ahead of ours, and
 * the upload relay checks the tip payment through yet another. Waiting for the
 * digest here and then a few seconds more is what WalForm measured it needs
 * before the relay stops answering "Could not find the referenced transaction".
 */
async function waitForIndexed(
  client: ClientWithCoreApi,
  digest: string,
): Promise<SuiClientTypes.TransactionResult<{ transaction: true; effects: true }>> {
  const started = Date.now();
  for (let attempt = 0; ; attempt++) {
    try {
      const result = await client.core.waitForTransaction({
        digest,
        include: { transaction: true, effects: true },
      });
      await new Promise((resolve) => setTimeout(resolve, 5_000));
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!NOT_FOUND.test(message) || Date.now() - started > 60_000) throw err;
      await new Promise((resolve) => setTimeout(resolve, Math.min(500 * (attempt + 1), 3_000)));
    }
  }
}
