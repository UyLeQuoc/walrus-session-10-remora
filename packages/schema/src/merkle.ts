/**
 * U19 B2 (ADR-0139): Merkle anchors for the Wakes that didn't pay. A leaf is `sha256` of the canonical
 * JSON of what it covers (a Wake, a config change, a memory write). The tree is sorted-pair: a parent
 * is `sha256(min(a, b) || max(a, b))` over the raw 32 bytes, so a proof needs no left/right flags, and
 * an odd node at the end of a level moves up unchanged. The server, `remora verify` and the web verify
 * page all use these functions, so a proof checked in the browser is the one the server built.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex, hexToBytes, utf8ToBytes } from "@noble/hashes/utils.js";
import { z } from "zod";
import { IsoDateTime, Sha256Hex } from "./common.ts";
import { canonicalJson, Wake } from "./wake.ts";

/** `sha256(canonicalJson(value))`, as hex. */
export const merkleLeaf = (value: unknown): string =>
  bytesToHex(sha256(utf8ToBytes(canonicalJson(value))));

/** A Wake's leaf: the Wake as the schema reads it, so the server and a browser hash the same JSON. */
export const wakeLeaf = (wake: Wake): string => merkleLeaf(Wake.parse(wake));

function compare(a: Uint8Array, b: Uint8Array): number {
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    const d = (a[i] ?? 0) - (b[i] ?? 0);
    if (d) return d;
  }
  return a.length - b.length;
}

/** The parent of two nodes, in either order. */
export function merkleParent(a: string, b: string): string {
  const x = hexToBytes(a);
  const y = hexToBytes(b);
  const [lo, hi] = compare(x, y) <= 0 ? [x, y] : [y, x];
  const both = new Uint8Array(lo.length + hi.length);
  both.set(lo);
  both.set(hi, lo.length);
  return bytesToHex(sha256(both));
}

const checkLeaves = (leaves: string[]) => {
  if (!leaves.length) throw new Error("a Merkle tree needs at least one leaf");
  for (const l of leaves) if (!Sha256Hex.safeParse(l).success) throw new Error(`not a leaf: ${l}`);
};

/** Each level from the leaves up; the last level is `[root]`. */
function levels(leaves: string[]): string[][] {
  checkLeaves(leaves);
  const out = [leaves];
  let level = leaves;
  while (level.length > 1) {
    const next: string[] = [];
    for (let i = 0; i < level.length; i += 2) {
      const a = level[i] as string;
      const b = level[i + 1];
      next.push(b === undefined ? a : merkleParent(a, b));
    }
    out.push(next);
    level = next;
  }
  return out;
}

export function merkleRoot(leaves: string[]): string {
  return levels(leaves).at(-1)?.[0] as string;
}

/** The sibling at each level from leaf `index` to the root; a promoted level adds none. */
export function merkleProof(leaves: string[], index: number): string[] {
  if (!Number.isInteger(index) || index < 0 || index >= leaves.length)
    throw new Error(`no leaf ${index} of ${leaves.length}`);
  const proof: string[] = [];
  let i = index;
  for (const level of levels(leaves).slice(0, -1)) {
    const sibling = level[i ^ 1];
    if (sibling !== undefined) proof.push(sibling);
    i = Math.floor(i / 2);
  }
  return proof;
}

export function verifyMerkleProof(leaf: string, proof: string[], root: string): boolean {
  if (![leaf, root, ...proof].every((h) => Sha256Hex.safeParse(h).success)) return false;
  return proof.reduce((node, sibling) => merkleParent(node, sibling), leaf) === root;
}

/** What a leaf covers: a Wake (a receipt), a config change (an event) or a memory write. */
export const AnchorLeaf = z.object({
  kind: z.enum(["wake", "config", "memory"]),
  /** The receipt, event or memory row id. */
  ref: z.string().min(1),
  leaf: Sha256Hex,
});

/** The payload of a `wakes.anchored` event: one batch, in leaf order, and where its root is onchain. */
export const WakesAnchored = z.object({
  network: z.enum(["mainnet", "testnet"]),
  packageId: z.string().min(1),
  /** The remora's key, the transaction's sender and the event's `anchorer`. */
  anchorer: z.string().min(1),
  root: Sha256Hex,
  digest: z.string().min(1),
  count: z.number().int().positive(),
  fromMs: z.number().int().nonnegative(),
  toMs: z.number().int().nonnegative(),
  leaves: z.array(AnchorLeaf).min(1),
});

/** `GET /api/verify/:ref` for an anchored Wake: enough to recheck the proof against the chain. */
export const AnchorProof = z.object({
  network: z.enum(["mainnet", "testnet"]),
  packageId: z.string().min(1),
  digest: z.string().min(1),
  root: Sha256Hex,
  leaf: Sha256Hex,
  index: z.number().int().nonnegative(),
  count: z.number().int().positive(),
  proof: z.array(Sha256Hex),
  anchoredAt: IsoDateTime,
});

export type AnchorLeaf = z.infer<typeof AnchorLeaf>;
export type WakesAnchored = z.infer<typeof WakesAnchored>;
export type AnchorProof = z.infer<typeof AnchorProof>;
