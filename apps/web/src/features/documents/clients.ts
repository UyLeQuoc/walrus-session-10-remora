import type { SealClient } from "@mysten/seal";
import type { ClientWithCoreApi } from "@mysten/sui/client";
import type { WalrusClient } from "@mysten/walrus";
import walrusWasmUrl from "@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url";
import { STORAGE_EPOCHS } from "@/features/documents/file-rules";
import type { WalletSigner } from "@/features/documents/wallet-signer";

const UPLOAD_RELAY = "https://upload-relay.mainnet.walrus.space";
/** 0.05 SUI: a ceiling on the relay tip, so a misconfigured relay cannot drain a wallet. */
const RELAY_TIP_MAX_MIST = 50_000_000;
export const WAL_COIN_TYPE =
  "0x356a26eb9e012a68958082340d4c4116e7f55615cf27affcff209cf0ae544f59::wal::WAL";

export interface FileChain {
  packageId: string;
  registryId: string;
  accountId: string;
  owner: string;
}

export async function sealEncrypt(
  seal: SealClient,
  packageId: string,
  sealId: string,
  plaintext: Uint8Array,
): Promise<Uint8Array> {
  const { encryptedObject } = await seal.encrypt({
    threshold: 1,
    packageId,
    id: sealId,
    data: plaintext,
  });
  return encryptedObject;
}

let walrus: Promise<WalrusClient> | null = null;

export function walrusClient(sui: ClientWithCoreApi): Promise<WalrusClient> {
  walrus ??= import("@mysten/walrus").then(
    ({ WalrusClient: Client }) =>
      new Client({
        network: "mainnet",
        suiClient: sui,
        wasmUrl: walrusWasmUrl,
        uploadRelay: { host: UPLOAD_RELAY, sendTip: { max: RELAY_TIP_MAX_MIST } },
      }),
  );
  return walrus;
}

export async function walrusWrite(
  client: WalrusClient,
  signer: WalletSigner,
  ciphertext: Uint8Array,
): Promise<{ blobId: string; blobObjectId: string; endEpoch: number }> {
  const { blobId, blobObject } = await client.writeBlob({
    blob: ciphertext,
    deletable: false,
    epochs: STORAGE_EPOCHS,
    signer,
  });
  return { blobId, blobObjectId: blobObject.id, endEpoch: blobObject.storage.end_epoch };
}
