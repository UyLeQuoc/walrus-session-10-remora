/**
 * ADR-0106 `walrus`: checks a blob on Walrus through the public aggregators: whether it can be read
 * (and on which Walrus network), its size, what kind of file it is, and its first line. The
 * aggregators don't report a blob's end epoch, so this doesn't claim one. Read before the payment
 * (`sourceFirst`): a blob no aggregator has answers 400, before anything is charged.
 */
import {
  type PaidContext,
  SourceInputError,
  sourceFirst,
  type X402Options,
  x402,
} from "@remora/merchant";
import { Hono } from "hono";

export const AGGREGATORS = {
  testnet: "https://aggregator.walrus-testnet.walrus.space",
  mainnet: "https://aggregator.walrus-mainnet.walrus.space",
} as const;

export interface BlobCheck {
  source: "Walrus aggregator";
  blobId: string;
  walrus: keyof typeof AGGREGATORS;
  readable: true;
  bytes: number | null;
  kind: "json" | "markdown" | "text" | "binary";
  firstLine: string | null;
}

/** Walrus blob ids are 32 bytes in URL-safe base64: 43 characters. */
export const BLOB_ID = /^[A-Za-z0-9_-]{43}$/;

/** Control bytes other than tab, newline and carriage return mark a binary file. */
const isBinaryByte = (b: number) => b === 0 || (b < 32 && b !== 9 && b !== 10 && b !== 13);

export function kindOfBytes(head: Uint8Array): BlobCheck["kind"] {
  if (head.some(isBinaryByte)) return "binary";
  const text = new TextDecoder("utf-8", { fatal: false }).decode(head, { stream: true });
  if (text.includes("\uFFFD")) return "binary";
  const t = text.trimStart();
  if (t.startsWith("{") || t.startsWith("[")) return "json";
  if (t.startsWith("---") || t.startsWith("#") || /\n#{1,3} /.test(t)) return "markdown";
  return "text";
}

export async function checkBlob(blobId: string, http: typeof fetch = fetch): Promise<BlobCheck> {
  for (const [walrus, base] of Object.entries(AGGREGATORS) as [
    keyof typeof AGGREGATORS,
    string,
  ][]) {
    const res = await http(`${base}/v1/blobs/${blobId}`, { headers: { range: "bytes=0-511" } });
    if (res.status === 404) continue;
    if (!res.ok && res.status !== 206)
      throw new Error(`the ${walrus} aggregator answered ${res.status}`);
    const head = new Uint8Array(await res.arrayBuffer()).slice(0, 512);
    const total = /\/(\d+)$/.exec(res.headers.get("content-range") ?? "")?.[1];
    const kind = kindOfBytes(head);
    const first =
      kind === "binary"
        ? null
        : (
            new TextDecoder()
              .decode(head)
              .split("\n")
              .find((l) => l.trim() && l.trim() !== "---") ?? ""
          )
            .trim()
            .slice(0, 120);
    return {
      source: "Walrus aggregator",
      blobId,
      walrus,
      readable: true,
      bytes: total ? Number(total) : Number(res.headers.get("content-length")) || null,
      kind,
      firstLine: first || null,
    };
  }
  throw new SourceInputError("unknown_blob", "No Walrus aggregator has that blob.");
}

export function createWalrusApp(o: { pay: X402Options; fetch?: typeof fetch }) {
  const app = new Hono<{ Variables: { x402: PaidContext; source: BlobCheck } }>();
  app.get(
    "/walrus/:blobId",
    sourceFirst(
      async (c) => checkBlob(c.req.param("blobId") ?? "", o.fetch),
      (c) => {
        if (!BLOB_ID.test(c.req.param("blobId") ?? ""))
          throw new SourceInputError("bad_blob_id", "Give a Walrus blob id (43 characters).");
      },
    ),
    x402(o.pay),
    (c) => c.json({ ...c.get("source"), paid: c.get("x402") }),
  );
  return app;
}
