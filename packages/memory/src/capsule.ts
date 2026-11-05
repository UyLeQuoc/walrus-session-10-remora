/**
 * U18 A4 (ADR-0130): memory capsules. A few memories, Seal-encrypted to a capsule's random key id under
 * the `remora_capsule` package, stored as one Walrus blob. Only the grantee can get the key, and only
 * while `capsule::seal_approve` holds onchain (not revoked, not expired), so each read asks again.
 */
import { SealClient, SessionKey } from "@mysten/seal";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import { Transaction } from "@mysten/sui/transactions";
import { fromHex, toHex } from "@mysten/sui/utils";

/** Mysten's open-mode testnet key servers (checked onchain on Nov 5, 2026); 2 of 2 must answer. */
export const TESTNET_KEY_SERVERS = [
  "0x73d05d62c18d9374e3ea529e8e0ed6161da1a141a94d3f76ae3fe4e99356db75",
  "0xf5d14a81a982144ae441cd7d64b09027f116a468bd36e7eca494f750591623c8",
] as const;

export const WALRUS_TESTNET = {
  publisher: "https://publisher.walrus-testnet.walrus.space",
  aggregator: "https://aggregator.walrus-testnet.walrus.space",
} as const;

export interface CapsuleMemory {
  text: string;
  blobId: string;
  namespace: string;
}

export interface CapsulePlain {
  v: 1;
  from: { remora: string; owner: string };
  memories: CapsuleMemory[];
}

const sealFor = (sui: ClientWithCoreApi) =>
  new SealClient({
    suiClient: sui,
    serverConfigs: TESTNET_KEY_SERVERS.map((objectId) => ({ objectId, weight: 1 })),
    verifyKeyServers: false,
  });

/** Encrypts the memories to a fresh 32-byte key id. */
export async function encryptCapsule(
  sui: ClientWithCoreApi,
  packageId: string,
  plain: CapsulePlain,
): Promise<{ keyId: Uint8Array; ciphertext: Uint8Array }> {
  return sealToFreshKey(sui, packageId, new TextEncoder().encode(JSON.stringify(plain)));
}

/**
 * Any bytes to a fresh 32-byte key id under the capsule package: the Seal id is the key id itself,
 * which `capsule::seal_approve` requires. U19 B1 (ADR-0145) seals an auditor's Wake bundle this way.
 */
export async function sealToFreshKey(
  sui: ClientWithCoreApi,
  packageId: string,
  data: Uint8Array,
): Promise<{ keyId: Uint8Array; ciphertext: Uint8Array }> {
  const keyId = crypto.getRandomValues(new Uint8Array(32));
  const { encryptedObject } = await sealFor(sui).encrypt({
    threshold: TESTNET_KEY_SERVERS.length,
    packageId,
    id: toHex(keyId),
    data,
  });
  return { keyId, ciphertext: encryptedObject };
}

/** Stores the ciphertext on Walrus testnet for `epochs` epochs (a day each); returns its blob id. */
export async function storeOnWalrus(
  bytes: Uint8Array,
  epochs: number,
  http: typeof fetch = fetch,
): Promise<string> {
  const res = await http(`${WALRUS_TESTNET.publisher}/v1/blobs?epochs=${epochs}`, {
    method: "PUT",
    // Plain bytes; some DOM lib versions don't list Uint8Array as a body type.
    body: bytes as unknown as NonNullable<RequestInit["body"]>,
  });
  if (!res.ok) throw new Error(`Walrus publisher answered ${res.status}`);
  const out = (await res.json()) as {
    newlyCreated?: { blobObject?: { blobId?: string } };
    alreadyCertified?: { blobId?: string };
  };
  const blobId = out.newlyCreated?.blobObject?.blobId ?? out.alreadyCertified?.blobId;
  if (!blobId) throw new Error("Walrus publisher returned no blob id");
  return blobId;
}

export async function readFromWalrus(
  blobId: string,
  http: typeof fetch = fetch,
): Promise<Uint8Array> {
  const res = await http(`${WALRUS_TESTNET.aggregator}/v1/blobs/${encodeURIComponent(blobId)}`);
  if (!res.ok) throw new Error(`Walrus aggregator answered ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Decrypts as the grantee. `signPersonalMessage` signs the session key's message with the grantee's
 * own key; the key servers dry-run `seal_approve` with that sender, so a revoked or expired capsule
 * (or anyone else) gets no key and this throws.
 */
export async function decryptCapsule(input: {
  sui: ClientWithCoreApi;
  packageId: string;
  capsuleId: string;
  keyId: string;
  grantee: string;
  ciphertext: Uint8Array;
  signPersonalMessage: (message: Uint8Array) => Promise<string>;
}): Promise<CapsulePlain> {
  const session = await SessionKey.create({
    address: input.grantee,
    packageId: input.packageId,
    ttlMin: 10,
    suiClient: input.sui as never,
  });
  await session.setPersonalMessageSignature(
    await input.signPersonalMessage(session.getPersonalMessage()),
  );
  const tx = new Transaction();
  tx.moveCall({
    target: `${input.packageId}::capsule::seal_approve`,
    arguments: [
      tx.pure.vector("u8", Array.from(fromHex(input.keyId))),
      tx.object(input.capsuleId),
      tx.object.clock(),
    ],
  });
  const txBytes = await tx.build({ client: input.sui, onlyTransactionKind: true });
  const bytes = await sealFor(input.sui).decrypt({
    data: input.ciphertext,
    sessionKey: session,
    txBytes,
  });
  return JSON.parse(new TextDecoder().decode(bytes)) as CapsulePlain;
}
