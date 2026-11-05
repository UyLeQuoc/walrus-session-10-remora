import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { describe, expect, it } from "vitest";
import { AnchoredBcs, anchoredEvents, buildAnchor } from "./anchor.ts";

const PKG = normalizeSuiAddress("0x609c");
const REMORA = normalizeSuiAddress("0x5c");
const ROOT = "ab".repeat(32);

const event = (pkg: string, root = ROOT) => ({
  eventType: `${pkg}::anchor::Anchored`,
  bcs: AnchoredBcs.serialize({
    anchorer: REMORA,
    root: Array.from(Buffer.from(root, "hex")),
    count: 5n,
    from_ms: 1_000n,
    to_ms: 4_000n,
    at_ms: 5_000n,
  }).toBytes(),
});

describe("remora_anchor (B2, ADR-0139)", () => {
  it("builds one anchor call with the root, the count, the range and the clock", () => {
    const tx = new Transaction();
    buildAnchor(tx, PKG, { root: ROOT, count: 5, fromMs: 1_000, toMs: 4_000 });
    const [cmd] = tx.getData().commands;
    expect(cmd?.MoveCall?.function).toBe("anchor");
    expect(cmd?.MoveCall?.module).toBe("anchor");
    expect(normalizeSuiAddress(cmd?.MoveCall?.package ?? "")).toBe(PKG);
    expect(cmd?.MoveCall?.arguments).toHaveLength(5);
  });

  it("refuses a root that isn't 32 bytes", () => {
    expect(() =>
      buildAnchor(new Transaction(), PKG, { root: "ab", count: 1, fromMs: 0, toMs: 0 }),
    ).toThrow();
  });

  it("reads only this package's Anchored events, with a short package id too", () => {
    const short = "0x609c";
    const other = normalizeSuiAddress("0x77");
    const got = anchoredEvents(PKG, [event(short), event(other, "cd".repeat(32))]);
    expect(got).toEqual([
      { anchorer: REMORA, root: ROOT, count: 5, fromMs: 1_000, toMs: 4_000, atMs: 5_000 },
    ]);
    expect(anchoredEvents(PKG, null)).toEqual([]);
  });
});
