import { EncryptedObject, SealClient, SessionKey } from "@mysten/seal";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, normalizeSuiAddress } from "@mysten/sui/utils";
import { z } from "zod";

/** The committee key server Walrus Memory seals with on mainnet (docs/SPIKES.md §14). */
const COMMITTEE = "0x686098f1439237fff9f36b99c7329683c22979d2005c2465cb891acb012a7595";
const SEAL_AGGREGATOR = "https://seal-aggregator-mainnet.mystenlabs.com";

const SealEnv = z.object({ apiKey: z.string().min(1) });

export function sealApiKey(env: Record<string, unknown>): string | null {
  const parsed = SealEnv.safeParse({ apiKey: env.VITE_SEAL_API_KEY });
  return parsed.success ? parsed.data.apiKey : null;
}

export function sealClient(sui: ClientWithCoreApi, apiKey: string): SealClient {
  return new SealClient({
    suiClient: sui,
    serverConfigs: [
      {
        objectId: COMMITTEE,
        weight: 1,
        aggregatorUrl: SEAL_AGGREGATOR,
        apiKeyName: "X-API-Key",
        apiKey,
      },
    ],
    verifyKeyServers: true,
  });
}

/** The account whose `seal_approve` decides, and who is asking. */
export interface SealApproval {
  packageId: string;
  registryId: string;
  accountId: string;
  sender: string;
}

/** One wallet signature, good for every decrypt of that package for ten minutes. */
export async function walletSession(input: {
  sui: ClientWithCoreApi;
  address: string;
  packageId: string;
  signPersonalMessage: (message: Uint8Array) => Promise<string>;
}): Promise<SessionKey> {
  const session = await SessionKey.create({
    address: input.address,
    packageId: normalizeSuiAddress(input.packageId),
    ttlMin: 10,
    suiClient: input.sui,
  });
  await session.setPersonalMessageSignature(
    await input.signPersonalMessage(session.getPersonalMessage()),
  );
  return session;
}

export function sealedPackage(ciphertext: Uint8Array): string {
  return EncryptedObject.parse(ciphertext).packageId;
}

/**
 * Decrypt in the browser. The identity, package and threshold are read from
 * the ciphertext itself; `seal_approve` runs on the current package against
 * the account named in `approval`, sent as `approval.sender`.
 */
export async function decryptSealed(input: {
  seal: SealClient;
  sui: ClientWithCoreApi;
  approval: SealApproval;
  session: SessionKey;
  ciphertext: Uint8Array;
}): Promise<Uint8Array> {
  const parsed = EncryptedObject.parse(input.ciphertext);
  const tx = new Transaction();
  tx.setSender(input.approval.sender);
  tx.moveCall({
    target: `${input.approval.packageId}::account::seal_approve`,
    arguments: [
      tx.pure.vector("u8", Array.from(fromHex(parsed.id))),
      tx.object(input.approval.registryId),
      tx.object(input.approval.accountId),
    ],
  });
  const txBytes = await tx.build({ client: input.sui, onlyTransactionKind: true });
  await input.seal.fetchKeys({
    ids: [parsed.id],
    txBytes,
    sessionKey: input.session,
    threshold: parsed.threshold,
  });
  return input.seal.decrypt({ data: input.ciphertext, sessionKey: input.session, txBytes });
}
