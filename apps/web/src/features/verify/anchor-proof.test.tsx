/**
 * ADR-0139: the verify page rechecks a Merkle anchor in the browser: the proof from the Wake it shows,
 * and the root against the `Anchored` event it reads from Sui itself.
 */
import { fromHex } from "@mysten/sui/utils";
import { AnchoredBcs } from "@remora/disc-sdk";
import {
  type AnchorProof,
  DEPLOYMENTS,
  merkleProof,
  merkleRoot,
  type Wake,
  wakeLeaf,
} from "@remora/schema";
import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AnchorProofCard } from "./anchor-proof";

const AGENT = `0x${"5c".repeat(32)}`;
const PKG = DEPLOYMENTS.testnet.anchorPackageId as string;

const getTransaction = vi.fn();
vi.mock("@mysten/dapp-kit", () => ({ useSuiClient: () => ({ core: { getTransaction } }) }));

const wake = (i: number): Wake => ({
  v: 1,
  remora: "8f0c2a50-4c1d-4d6e-9a43-2b2d9b0f7a11",
  agent: AGENT,
  ts: `2026-11-05T0${i}:00:00.000Z`,
  intent: {
    trigger: { kind: "message", ref: "web" },
    inputs: { via: "tatum", objects: [], sha256: "1".repeat(64) },
    memories: [],
    model: { id: "google/gemini-2.5-flash", promptSha256: "2".repeat(64) },
    decision: { action: "answer", reason: `answered question ${i}` },
    sonar: { verdict: "allow", reasons: [] },
  },
  result: { responseSha256: "3".repeat(64) },
});

const wakes = [0, 1, 2, 3, 4].map(wake);
const leaves = wakes.map(wakeLeaf);
const root = merkleRoot(leaves);
const anchor: AnchorProof = {
  network: "testnet",
  packageId: PKG,
  digest: "8e7xNd69jvuY42tYAnQW4ZenJZYYbRjtWtJqtiLe5a7T",
  root,
  leaf: leaves[2] as string,
  index: 2,
  count: 5,
  proof: merkleProof(leaves, 2),
  anchoredAt: "2026-11-05T05:00:00.000Z",
};

const anchoredTx = (r: string) => ({
  Transaction: {
    effects: { status: { success: true } },
    events: [
      {
        eventType: `${PKG}::anchor::Anchored`,
        bcs: AnchoredBcs.serialize({
          anchorer: AGENT,
          root: Array.from(fromHex(r)),
          count: 5n,
          from_ms: 1n,
          to_ms: 2n,
          at_ms: 3n,
        }).toBytes(),
      },
    ],
  },
});

const states = () =>
  Array.from(screen.getByTestId("anchor-proof").querySelectorAll("li")).map((li) =>
    li.getAttribute("data-state"),
  );

beforeEach(() => {
  getTransaction.mockReset();
  // The digest measures its container; jsdom has no ResizeObserver.
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

describe("the anchor on the verify page (ADR-0139)", () => {
  it("shows the digest and the steps, and checks the proof and the root itself", async () => {
    getTransaction.mockResolvedValue(anchoredTx(root));
    render(<AnchorProofCard wake={wakes[2] as Wake} anchor={anchor} />);
    expect(screen.getByTestId("anchor-proof").textContent).toContain("proof of 3 steps");
    await waitFor(() => expect(screen.getByText(/Read from Sui: 5 records/)).toBeTruthy());
    expect(getTransaction).toHaveBeenCalledWith(expect.objectContaining({ digest: anchor.digest }));
    expect(states()).toEqual(["pass", "pass", "pass"]);
  });

  it("a tampered Wake fails its proof, and a root that isn't onchain fails too", async () => {
    getTransaction.mockResolvedValue(anchoredTx("ab".repeat(32)));
    const tampered = { ...(wakes[2] as Wake), ts: "2026-11-05T09:00:00.000Z" };
    render(<AnchorProofCard wake={tampered} anchor={anchor} />);
    await waitFor(() => expect(screen.getByText(/No Anchored event with this root/)).toBeTruthy());
    expect(states()).toEqual(["fail", "fail", "skip"]);
  });

  it("says when it isn't anchored yet", () => {
    render(<AnchorProofCard wake={wakes[0] as Wake} anchor={null} />);
    expect(screen.getByText(/Not anchored yet/)).toBeTruthy();
    expect(getTransaction).not.toHaveBeenCalled();
  });
});
