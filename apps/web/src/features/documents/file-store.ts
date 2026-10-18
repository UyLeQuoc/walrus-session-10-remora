import type { FileKind } from "@/features/documents/file-rules";

export interface RecordBody {
  blobId: string;
  blobObjectId?: string;
  sealId: string;
  ciphertextSha256: string;
  name: string;
  mediaType: FileKind;
  byteSize: number;
  endEpoch?: number;
}

export type StoreStage = "sealing" | "paying" | "saving";

export interface StoreDeps {
  encrypt: (sealId: string, plaintext: Uint8Array) => Promise<Uint8Array>;
  writeBlob: (
    ciphertext: Uint8Array,
  ) => Promise<{ blobId: string; blobObjectId: string; endEpoch: number }>;
  record: (body: RecordBody) => Promise<{ id: string }>;
  onStage?: (stage: StoreStage) => void;
}

export interface OpenDeps {
  fetchBlob: (blobId: string) => Promise<Uint8Array>;
  decrypt: (ciphertext: Uint8Array) => Promise<Uint8Array>;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Seal in the browser, store the ciphertext from the person's wallet, then tell
 * hippo where it is. The plaintext never leaves this function except as the
 * input to `encrypt`; hippo receives ids, a hash, a size and the name.
 */
export async function storeFile(
  deps: StoreDeps,
  input: { name: string; kind: FileKind; bytes: Uint8Array; sealId: string },
): Promise<{ id: string; blobId: string }> {
  deps.onStage?.("sealing");
  const ciphertext = await deps.encrypt(input.sealId, input.bytes);
  deps.onStage?.("paying");
  const written = await deps.writeBlob(ciphertext);
  deps.onStage?.("saving");
  const { id } = await deps.record({
    blobId: written.blobId,
    blobObjectId: written.blobObjectId,
    sealId: input.sealId,
    ciphertextSha256: await sha256Hex(ciphertext),
    name: input.name,
    mediaType: input.kind,
    byteSize: input.bytes.byteLength,
    endEpoch: written.endEpoch,
  });
  return { id, blobId: written.blobId };
}

export async function openFile(deps: OpenDeps, blobId: string): Promise<string> {
  const ciphertext = await deps.fetchBlob(blobId);
  return new TextDecoder().decode(await deps.decrypt(ciphertext));
}
