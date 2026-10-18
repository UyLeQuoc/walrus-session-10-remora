const WALRUS_AGGREGATOR = "https://aggregator.walrus-mainnet.walrus.space";

/** Anyone can fetch a blob's ciphertext; only its owner's Seal policy opens it. */
export async function walrusRead(blobId: string): Promise<Uint8Array> {
  const res = await fetch(`${WALRUS_AGGREGATOR}/v1/blobs/${encodeURIComponent(blobId)}`);
  if (!res.ok) throw new Error(`Walrus could not return that blob just now (${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
}
