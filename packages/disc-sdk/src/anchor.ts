/**
 * U19 B2 (ADR-0139): `remora_anchor::anchor`, the Merkle root of a batch of Wakes that didn't pay.
 * The builder and the event reader work with Tatum gRPC on the server and gRPC-web in the browser.
 */
import { bcs } from "@mysten/sui/bcs";
import type { Transaction } from "@mysten/sui/transactions";
import { fromHex, normalizeSuiAddress, toHex } from "@mysten/sui/utils";
import { CLOCK_ID } from "./config.ts";
import { normalizeType } from "./readers.ts";

export const AnchoredBcs = bcs.struct("Anchored", {
  anchorer: bcs.Address,
  root: bcs.vector(bcs.u8()),
  count: bcs.u64(),
  from_ms: bcs.u64(),
  to_ms: bcs.u64(),
  at_ms: bcs.u64(),
});

export interface AnchoredEvent {
  anchorer: string;
  /** The root as lowercase hex, the way `@remora/schema`'s Merkle functions write it. */
  root: string;
  count: number;
  fromMs: number;
  toMs: number;
  atMs: number;
}

export interface AnchorArgs {
  /** 32 bytes, as hex. */
  root: string;
  count: number;
  fromMs: number;
  toMs: number;
}

export const anchoredType = (packageId: string) =>
  `${normalizeSuiAddress(packageId)}::anchor::Anchored`;

export function buildAnchor(tx: Transaction, packageId: string, a: AnchorArgs): void {
  const root = fromHex(a.root);
  if (root.length !== 32) throw new Error("an anchor root is 32 bytes");
  tx.moveCall({
    target: `${packageId}::anchor::anchor`,
    arguments: [
      tx.pure.vector("u8", Array.from(root)),
      tx.pure.u64(a.count),
      tx.pure.u64(a.fromMs),
      tx.pure.u64(a.toMs),
      tx.object(CLOCK_ID),
    ],
  });
}

export function decodeAnchored(bytes: Uint8Array): AnchoredEvent {
  const e = AnchoredBcs.parse(bytes);
  return {
    anchorer: normalizeSuiAddress(e.anchorer),
    root: toHex(Uint8Array.from(e.root)),
    count: Number(e.count),
    fromMs: Number(e.from_ms),
    toMs: Number(e.to_ms),
    atMs: Number(e.at_ms),
  };
}

/** This package's `Anchored` events in a transaction's events (`getTransaction({ include: { events } })`). */
export function anchoredEvents(
  packageId: string,
  events: { eventType: string; bcs: Uint8Array }[] | null | undefined,
): AnchoredEvent[] {
  const type = normalizeType(anchoredType(packageId));
  return (events ?? [])
    .filter((e) => normalizeType(e.eventType) === type)
    .map((e) => decodeAnchored(e.bcs));
}
