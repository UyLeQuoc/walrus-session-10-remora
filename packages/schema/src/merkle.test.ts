import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  merkleLeaf,
  merkleParent,
  merkleProof,
  merkleRoot,
  verifyMerkleProof,
  WakesAnchored,
  wakeLeaf,
} from "./merkle.ts";
import type { Wake } from "./wake.ts";

const h = (s: string) => createHash("sha256").update(s).digest("hex");
const pair = (a: string, b: string) =>
  createHash("sha256")
    .update(Buffer.concat([Buffer.from(a < b ? a : b, "hex"), Buffer.from(a < b ? b : a, "hex")]))
    .digest("hex");
const leaves = (n: number) => Array.from({ length: n }, (_, i) => h(`leaf ${i}`));

const wake = (i: number): Wake => ({
  v: 1,
  remora: "8f0c2a50-4c1d-4d6e-9a43-2b2d9b0f7a11",
  agent: `0x${"5c".repeat(32)}`,
  ts: `2026-11-05T0${i}:00:00.000Z`,
  intent: {
    trigger: { kind: "message", ref: "web" },
    inputs: { via: "tatum", objects: [], sha256: "1".repeat(64) },
    memories: [],
    model: { id: "google/gemini-2.5-flash", promptSha256: "2".repeat(64) },
    decision: { action: "answer", reason: `answered question ${i} from memory` },
    sonar: { verdict: "allow", reasons: [] },
  },
  result: { responseSha256: "3".repeat(64) },
});

describe("Merkle anchors (B2, ADR-0139)", () => {
  it("hashes a pair in sorted order, whichever comes first", () => {
    const [a, b] = leaves(2) as [string, string];
    expect(merkleParent(a, b)).toBe(pair(a, b));
    expect(merkleParent(b, a)).toBe(pair(a, b));
    expect(merkleRoot([a, b])).toBe(pair(a, b));
  });

  it("moves an odd node up unchanged", () => {
    const [a, b, c] = leaves(3) as [string, string, string];
    expect(merkleRoot([a, b, c])).toBe(pair(pair(a, b), c));
    expect(merkleProof([a, b, c], 2)).toEqual([pair(a, b)]);
    const five = leaves(5);
    expect(merkleProof(five, 4)).toHaveLength(1);
  });

  it("a single leaf is its own root, with a proof of no steps", () => {
    const [a] = leaves(1) as [string];
    expect(merkleRoot([a])).toBe(a);
    expect(merkleProof([a], 0)).toEqual([]);
    expect(verifyMerkleProof(a, [], a)).toBe(true);
  });

  it("proves every leaf of every tree size up to 33", () => {
    for (let n = 1; n <= 33; n++) {
      const l = leaves(n);
      const root = merkleRoot(l);
      for (let i = 0; i < n; i++) {
        const proof = merkleProof(l, i);
        expect(proof.length).toBeLessThanOrEqual(Math.ceil(Math.log2(n)));
        expect(verifyMerkleProof(l[i] as string, proof, root)).toBe(true);
      }
    }
  });

  it("a tampered Wake doesn't verify", () => {
    const wakes = [0, 1, 2, 3, 4].map(wake);
    const l = wakes.map(wakeLeaf);
    const root = merkleRoot(l);
    const proof = merkleProof(l, 3);
    expect(proof).toHaveLength(3);
    expect(verifyMerkleProof(wakeLeaf(wakes[3] as Wake), proof, root)).toBe(true);

    const tampered = structuredClone(wakes[3] as Wake);
    tampered.intent.decision = { action: "answer", reason: "answered question 3, and paid 0x…" };
    expect(verifyMerkleProof(wakeLeaf(tampered), proof, root)).toBe(false);
    const moved = { ...(wakes[3] as Wake), ts: "2026-11-05T09:00:00.000Z" };
    expect(verifyMerkleProof(wakeLeaf(moved), proof, root)).toBe(false);
    // Another batch member's proof doesn't fit this Wake either.
    expect(verifyMerkleProof(wakeLeaf(wakes[3] as Wake), merkleProof(l, 2), root)).toBe(false);
  });

  it("hashes canonical JSON, so key order doesn't matter", () => {
    expect(merkleLeaf({ b: 1, a: [2, { d: 3, c: 4 }] })).toBe(
      merkleLeaf({ a: [2, { c: 4, d: 3 }], b: 1 }),
    );
    expect(merkleLeaf({ a: 1 })).toBe(h('{"a":1}'));
  });

  it("refuses an empty tree, a bad index and malformed hashes", () => {
    expect(() => merkleRoot([])).toThrow();
    expect(() => merkleProof(leaves(2), 2)).toThrow();
    expect(() => merkleRoot(["not hex"])).toThrow();
    const l = leaves(4);
    const root = merkleRoot(l);
    expect(verifyMerkleProof(l[0] as string, ["zz"], root)).toBe(false);
    expect(verifyMerkleProof(l[0] as string, merkleProof(l, 0), "0".repeat(64))).toBe(false);
  });

  it("reads a batch's event payload", () => {
    const l = leaves(2);
    const parsed = WakesAnchored.parse({
      network: "testnet",
      packageId: `0x${"60".repeat(32)}`,
      anchorer: `0x${"5c".repeat(32)}`,
      root: merkleRoot(l),
      digest: "8e7xNd69jvuY42tYAnQW4ZenJZYYbRjtWtJqtiLe5a7T",
      count: 2,
      fromMs: 1,
      toMs: 2,
      leaves: l.map((leaf, i) => ({ kind: "wake", ref: `r${i}`, leaf })),
    });
    expect(parsed.leaves).toHaveLength(2);
  });
});
