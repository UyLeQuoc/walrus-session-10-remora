/**
 * M3 (ADR-0048): template files on Walrus through the HTTP publisher and aggregator. Templates are
 * public by design (no memories, keys or addresses), so they're stored as plain blobs. Testnet uses
 * the public publisher; mainnet needs a publisher that pays in WAL, so it stays off until the mainnet
 * pass sets one (ADR-0024).
 */
import type { SuiNetwork } from "@remora/chain";
import { RemoraError } from "../runtime/remoras.ts";

export interface WalrusEndpoints {
  publisher: string | null;
  aggregator: string;
  epochs: number;
}

export function walrusEndpoints(
  network: SuiNetwork,
  env: Record<string, string | undefined> = process.env,
): WalrusEndpoints {
  return network === "testnet"
    ? {
        publisher: env.WALRUS_PUBLISHER_TESTNET || "https://publisher.walrus-testnet.walrus.space",
        aggregator:
          env.WALRUS_AGGREGATOR_TESTNET || "https://aggregator.walrus-testnet.walrus.space",
        epochs: Number(env.WALRUS_TEMPLATE_EPOCHS_TESTNET || 50),
      }
    : {
        publisher: env.WALRUS_PUBLISHER_MAINNET || null,
        aggregator:
          env.WALRUS_AGGREGATOR_MAINNET || "https://aggregator.walrus-mainnet.walrus.space",
        epochs: Number(env.WALRUS_TEMPLATE_EPOCHS_MAINNET || 26),
      };
}

export interface WalrusStore {
  put(network: SuiNetwork, body: string): Promise<{ blobId: string }>;
  get(network: SuiNetwork, blobId: string): Promise<string>;
}

const MAX_BYTES = 64_000;

export function createWalrusStore(
  fetcher: typeof fetch = fetch,
  env: Record<string, string | undefined> = process.env,
): WalrusStore {
  return {
    async put(network, body) {
      const w = walrusEndpoints(network, env);
      if (!w.publisher)
        throw new RemoraError(
          "hatchery.no_publisher",
          "Publishing to Walrus isn't set up on this network yet.",
          409,
        );
      const res = await fetcher(`${w.publisher}/v1/blobs?epochs=${w.epochs}&permanent=true`, {
        method: "PUT",
        body,
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok)
        throw new RemoraError(
          "hatchery.walrus_failed",
          `Walrus didn't store the file (${res.status}). Try again in a minute.`,
          409,
        );
      const out = (await res.json()) as {
        newlyCreated?: { blobObject?: { blobId?: string } };
        alreadyCertified?: { blobId?: string };
      };
      const blobId = out.newlyCreated?.blobObject?.blobId ?? out.alreadyCertified?.blobId;
      if (!blobId)
        throw new RemoraError("hatchery.walrus_failed", "Walrus didn't return a blob id.", 409);
      return { blobId };
    },
    async get(network, blobId) {
      if (!/^[A-Za-z0-9_-]{8,128}$/.test(blobId))
        throw new RemoraError("hatchery.bad_blob", "That isn't a Walrus blob id.");
      const w = walrusEndpoints(network, env);
      const res = await fetcher(`${w.aggregator}/v1/blobs/${blobId}`, {
        signal: AbortSignal.timeout(30_000),
      });
      if (!res.ok)
        throw new RemoraError(
          "hatchery.walrus_failed",
          `Walrus couldn't return that template just now (${res.status}).`,
          409,
        );
      const text = await res.text();
      if (text.length > MAX_BYTES)
        throw new RemoraError("hatchery.too_big", "That template is too big to read.", 409);
      return text;
    },
  };
}
