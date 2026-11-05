/**
 * U19 B1 (ADR-0145): the auditor's page. Each paid Wake is checked against its transaction as read
 * from Sui ("N of N receipts match Sui"); the bundle renders as text only, never as HTML; and when the
 * key servers refuse, the page says so plainly.
 */
import { NoAccessError } from "@mysten/seal";
import { fromHex, normalizeSuiAddress } from "@mysten/sui/utils";
import { PaidBcs } from "@remora/disc-sdk";
import {
  type AuditBundle,
  type AuditWake,
  DEPLOYMENTS,
  intentHash,
  merkleProof,
  merkleRoot,
  type Wake,
  wakeLeaf,
} from "@remora/schema";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuditBundleView, AuditPage } from "./audit-page";
import { checkReceipt, matchLine, REFUSED, receiptsOf, type TxRead } from "./checks";
import { checkAll } from "./use-audit";

const AGENT = normalizeSuiAddress(`0x${"5c".repeat(32)}`);
const OWNER = normalizeSuiAddress(`0x${"0a".repeat(32)}`);
const AUDITOR = normalizeSuiAddress(`0x${"ad".repeat(32)}`);
const PAY_TO = normalizeSuiAddress(`0x${"3e".repeat(32)}`);
const USDC = DEPLOYMENTS.testnet.usdcCoinType;
const PKG = DEPLOYMENTS.testnet.remoraPackageId as string;
const CAPSULE = normalizeSuiAddress(`0x${"c0".repeat(32)}`);
const QUESTION = 'Weather in <b>Hanoi</b>? <img src=x onerror="alert(1)">';

const wake = (h: number, decision: Wake["intent"]["decision"], tx?: string): Wake => ({
  v: 1,
  remora: "8f0c2a50-4c1d-4d6e-9a43-2b2d9b0f7a11",
  agent: AGENT,
  ts: `2026-11-05T0${h}:00:00.000Z`,
  intent: {
    trigger: { kind: "message", ref: "web" },
    inputs: { via: "tatum", objects: [], sha256: "1".repeat(64) },
    memories: [{ blobId: "blob-abcdefgh", namespace: "sources", distance: 0.2 }],
    model: { id: "google/gemini-2.5-flash", promptSha256: "2".repeat(64) },
    decision,
    sonar: { verdict: "allow", reasons: ["<script>alert(2)</script> within budget"] },
  },
  result: tx ? { tx } : { responseSha256: "3".repeat(64) },
});

const digests = [
  "8e7xNd69jvuY42tYAnQW4ZenJZYYbRjtWtJqtiLe5a7T",
  "Fq8nB6Lrj5HHPpwbqPhwZ2CyGSL9xVLpnU1QZHGQ1gcs",
];
const paidWake = (i: number): AuditWake => {
  const w = wake(
    i + 1,
    {
      action: "pay",
      payee: "reef:weather",
      payTo: PAY_TO,
      amount: "10000",
      coinType: USDC,
      reason: `bought the forecast ${i}`,
    },
    digests[i],
  );
  return {
    receiptId: `00000000-0000-4000-8000-00000000000${i}`,
    at: w.ts,
    intentHash: intentHash(w.intent),
    wake: w,
    payment: {
      digest: digests[i] as string,
      amount: "10000",
      payee: "reef:weather",
      payTo: PAY_TO,
      coinType: USDC,
    },
    memories: ["blob-abcdefgh"],
    anchor: null,
    question: QUESTION,
  };
};
const answer = wake(4, { action: "answer", reason: "answered <i>from memory</i>" });
const leaves = [wakeLeaf(answer), "a".repeat(64)];
const answered: AuditWake = {
  receiptId: "00000000-0000-4000-8000-000000000009",
  at: answer.ts,
  intentHash: intentHash(answer.intent),
  wake: answer,
  payment: null,
  memories: ["blob-abcdefgh"],
  anchor: {
    network: "testnet",
    packageId: DEPLOYMENTS.testnet.anchorPackageId as string,
    digest: "5mBPsVmrtUTAtnmx6P3SfdrW4XtvgFfvnZzqmuaFcLuL",
    root: merkleRoot(leaves),
    leaf: leaves[0] as string,
    index: 0,
    count: 2,
    proof: merkleProof(leaves, 0),
    anchoredAt: "2026-11-05T05:00:00.000Z",
  },
};
const bundle: AuditBundle = {
  v: 1,
  kind: "remora.audit",
  remora: { id: answer.remora, name: "Researcher", agent: AGENT, owner: OWNER, network: "testnet" },
  range: { from: "2026-11-05T00:00:00.000Z", to: "2026-11-06T00:00:00.000Z" },
  includesQuestions: true,
  madeAt: "2026-11-06T01:00:00.000Z",
  count: 3,
  wakes: [paidWake(0), paidWake(1), answered],
};

/** The transaction as Sui would show it for a paid Wake, optionally tampered. */
const txFor = (
  w: AuditWake,
  o: { amount?: bigint; intent?: string; sender?: string } = {},
): TxRead => ({
  success: true,
  sender: o.sender ?? AGENT,
  events: [
    {
      eventType: `${PKG}::disc::Paid`,
      bcs: PaidBcs.serialize({
        disc: `0x${"d1".repeat(32)}`,
        payee: PAY_TO,
        amount: o.amount ?? 10000n,
        intent: Array.from(fromHex(o.intent ?? w.intentHash)),
        ts_ms: 1n,
      }).toBytes(),
    },
  ],
  balanceChanges: [{ address: PAY_TO, coinType: USDC, amount: String(o.amount ?? 10000n) }],
});

describe("receipt checks against Sui (B1)", () => {
  it("a paid Wake matches its transaction, and a tampered one doesn't", () => {
    const w = paidWake(0);
    expect(checkReceipt(w, txFor(w), "testnet").ok).toBe(true);
    expect(checkReceipt(w, txFor(w, { amount: 20000n }), "testnet").ok).toBe(false);
    expect(checkReceipt(w, txFor(w, { intent: "ab".repeat(32) }), "testnet").ok).toBe(false);
    expect(checkReceipt(w, txFor(w, { sender: PAY_TO }), "testnet").ok).toBe(false);
    expect(checkReceipt(w, null, "testnet").ok).toBe(false);
    // The bundle lies about its amount: its own Wake disagrees, so it fails here too.
    const lying = {
      ...w,
      payment: { ...(w.payment as NonNullable<AuditWake["payment"]>), amount: "1" },
    };
    expect(checkReceipt(lying, txFor(w), "testnet").ok).toBe(false);
  });

  it("counts N of N with every read, and says which don't match", async () => {
    const seen: number[] = [];
    const results = await checkAll(
      bundle,
      async (digest) => {
        const w = receiptsOf(bundle).find((x) => x.payment?.digest === digest) as AuditWake;
        return digest === digests[1] ? txFor(w, { amount: 1n }) : txFor(w);
      },
      (r) => seen.push(r.filter(Boolean).length),
    );
    expect(results.map((r) => r.ok)).toEqual([true, false]);
    expect(matchLine(results, 2)).toBe("1 of 2 receipts match Sui");
    expect(matchLine([results[0] as never, results[0] as never], 2)).toBe(
      "2 of 2 receipts match Sui",
    );
    expect(matchLine([results[0] as never, null], 2)).toBe("Checking 1 of 2 receipts against Sui…");
    expect(seen.at(-1)).toBe(2);
  });
});

const getTransaction = vi.fn();
vi.mock("@mysten/dapp-kit", () => ({
  useSuiClient: () => ({ core: { getTransaction } }),
  useCurrentAccount: () => ({ address: AUDITOR, chains: ["sui:testnet"] }),
  useSignPersonalMessage: () => ({ mutateAsync: vi.fn(async () => ({ signature: "sig" })) }),
}));
vi.mock("@/components/wallet-picker", () => ({ WalletPicker: () => null }));
const decrypt = vi.fn();
vi.mock("@/lib/seal", () => ({
  walletSession: vi.fn(async () => ({})),
  capsuleSealClient: vi.fn(() => ({})),
  decryptCapsuleBlob: (...a: unknown[]) => decrypt(...a),
}));

const ACCESS = {
  capsuleId: CAPSULE,
  network: "testnet",
  packageId: DEPLOYMENTS.testnet.capsulePackageId,
  blobId: "audit-blob-abcdefgh",
  keyId: "ab".repeat(32),
  remora: "Researcher",
  auditor: AUDITOR,
  count: 3,
  expiresMs: Date.parse("2026-11-12T00:00:00.000Z"),
  range: bundle.range,
};

beforeEach(() => {
  getTransaction.mockReset();
  decrypt.mockReset();
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
  );
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes(`/api/audit/${CAPSULE}`)) return Response.json(ACCESS);
      if (url.includes("aggregator.walrus-testnet")) return new Response(new Uint8Array([1, 2, 3]));
      return Response.json(
        { error: { code: "not_found", message: "Not found." } },
        { status: 404 },
      );
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

const openPage = () =>
  render(
    <MemoryRouter initialEntries={[`/audit/${CAPSULE}`]}>
      <Routes>
        <Route path="/audit/:capsuleId" element={<AuditPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe("the auditor's page (B1)", () => {
  it("renders the bundle as text only, never as HTML", () => {
    const { container } = render(
      <MemoryRouter>
        <AuditBundleView bundle={bundle} results={[null, null]} />
      </MemoryRouter>,
    );
    expect(container.querySelector("img, script, i")).toBeNull();
    expect(container.querySelector("b")).toBeNull();
    expect(screen.getAllByText(QUESTION, { exact: false })).toHaveLength(2);
    expect(screen.getByText("answered <i>from memory</i>")).toBeTruthy();
    expect(screen.getByTestId("audit-match").textContent).toBe(
      "Checking 0 of 2 receipts against Sui…",
    );
    expect(screen.getByTestId("audit-anchors").textContent).toMatch(/^1 of 1 anchored Wakes reach/);
  });

  it("decrypts in the browser, checks every receipt against Sui, and shows N of N", async () => {
    decrypt.mockResolvedValue(new TextEncoder().encode(JSON.stringify(bundle)));
    getTransaction.mockImplementation(async ({ digest }: { digest: string }) => {
      const w = receiptsOf(bundle).find((x) => x.payment?.digest === digest) as AuditWake;
      const t = txFor(w);
      return {
        Transaction: {
          effects: { status: { success: true } },
          transaction: { sender: t.sender },
          events: t.events,
          balanceChanges: t.balanceChanges,
        },
      };
    });
    openPage();
    fireEvent.click(await screen.findByTestId("audit-open"));
    await waitFor(() =>
      expect(screen.getByTestId("audit-match").textContent).toBe("2 of 2 receipts match Sui"),
    );
    expect(decrypt).toHaveBeenCalledWith(
      expect.objectContaining({ capsuleId: CAPSULE, packageId: ACCESS.packageId }),
    );
    expect(getTransaction).toHaveBeenCalledTimes(2);
    expect(screen.getAllByTestId("audit-wake")).toHaveLength(3);
  });

  it("says plainly when the key servers refuse (revoked or expired)", async () => {
    decrypt.mockRejectedValue(new NoAccessError("req-1"));
    openPage();
    fireEvent.click(await screen.findByTestId("audit-open"));
    await waitFor(() => expect(screen.getByTestId("audit-refused").textContent).toContain(REFUSED));
    expect(screen.queryByTestId("audit-match")).toBeNull();
  });
});
