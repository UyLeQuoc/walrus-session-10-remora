/**
 * W1 pages (U4): the fixture skeletons paint, the network store drives the API header, and the
 * funds page shows the split. Wallets and the chain are stubbed; the e2e suite covers the real ones.
 */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { currentNetwork, setNetwork } from "@/lib/network";
import { formatUsdc, parseUsdc } from "@/lib/usdc";
import { ApprovalsPage } from "./approvals/approvals-page";
import { FundsPage } from "./funds/funds-page";
import { MemoryInspectorPage } from "./memory-inspector/memory-page";
import { OnboardingPage } from "./onboarding/onboarding-page";
import { RemoraPage } from "./remoras/remora-page";
import { RemorasPage } from "./remoras/remoras-page";

const OWNER = `0x${"3d".repeat(32)}`;
let account: { address: string; chains: string[] } | null = null;

vi.mock("@mysten/dapp-kit", () => ({
  useCurrentAccount: () => account,
  useSuiClient: () => ({ core: {} }),
  useSignAndExecuteTransaction: () => ({ mutateAsync: vi.fn(async () => ({ digest: "D1" })) }),
  useWallets: () => [],
  useConnectWallet: () => ({ mutateAsync: vi.fn() }),
  useCurrentWallet: () => ({ currentWallet: null, isConnected: false }),
  useSignPersonalMessage: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

function at(path: string, routePath: string, element: React.ReactNode) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={routePath} element={element} />
      </Routes>
    </MemoryRouter>,
  );
}

/** This jsdom has no localStorage (see pages.test.tsx); give each test a fresh one. */
function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

beforeEach(() => {
  account = null;
  vi.stubGlobal("localStorage", fakeStorage());
});
afterEach(() => vi.unstubAllGlobals());

describe("usdc helpers", () => {
  it("formats and parses 6-decimal amounts", () => {
    expect(formatUsdc("1009000")).toBe("1.00");
    expect(formatUsdc(10_000n, 6)).toBe("0.010000");
    expect(parseUsdc("0.10")).toBe(100_000n);
    expect(parseUsdc("1")).toBe(1_000_000n);
    expect(parseUsdc("0")).toBeNull();
    expect(parseUsdc("1.1234567")).toBeNull();
    expect(parseUsdc("abc")).toBeNull();
  });
});

describe("network store (A9·ui)", () => {
  it("defaults to testnet, remembers a switch, and sends it on every API call", async () => {
    expect(currentNetwork()).toBe("testnet");
    const fetchStub = vi.fn(async () => new Response("{}"));
    vi.stubGlobal("fetch", fetchStub);
    setNetwork("mainnet");
    expect(localStorage.getItem("remora.network")).toBe("mainnet");
    await apiFetch("/api/funds");
    const headers = (fetchStub.mock.calls[0] as unknown as [string, RequestInit])[1]
      .headers as Headers;
    expect(headers.get("x-remora-network")).toBe("mainnet");
    setNetwork("testnet");
  });
});

describe("W1 skeleton pages (fixtures)", () => {
  it("lists the sample remoras with their budgets", () => {
    at("/remoras", "/remoras", <RemorasPage />);
    expect(screen.getByText("Scout")).toBeDefined();
    expect(screen.getByText(/Budget 20.00 USDC per month, at most 0.50 a payment/)).toBeDefined();
  });

  it("shows a remora's activity and opens the Why drawer on a payment", async () => {
    at("/remoras/scout", "/remoras/:id", <RemoraPage />);
    expect(screen.getByText(/Paid 0.05 USDC to reef:sui-risk/)).toBeDefined();
    await userEvent.click(screen.getAllByRole("button", { name: "Why?" })[0] as HTMLElement);
    expect(
      await screen.findByText(/sui-risk answered 8 of 9 risk questions usefully/),
    ).toBeDefined();
    expect(screen.getByText("anchored onchain")).toBeDefined();
  });

  it("renders the memory inspector, approvals and onboarding", () => {
    at("/memory", "/memory", <MemoryInspectorPage />);
    expect(screen.getByText(/sui-risk: 9 calls, 8 useful/)).toBeDefined();
    at("/approvals", "/approvals", <ApprovalsPage />);
    expect(screen.getByText(/Pay 2.00 USDC to reef:odds/)).toBeDefined();
    account = { address: OWNER, chains: ["sui:testnet"] };
    at("/onboarding", "/onboarding", <OnboardingPage />);
    expect(screen.getByText("Sign in with your wallet")).toBeDefined();
    expect(screen.getByText("done")).toBeDefined();
  });
});

describe("funds page (A4·ui)", () => {
  it("asks for a wallet first", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ mode: "guest" })),
    );
    at("/funds", "/funds", <FundsPage />);
    expect(screen.getByText(/Connect your wallet to see your funds/)).toBeDefined();
  });

  it("shows the address-balance / coins split from /api/funds", async () => {
    account = { address: OWNER, chains: ["sui:testnet"] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.startsWith("/api/funds")) {
          return Response.json({
            network: "testnet",
            splits: [
              {
                address: OWNER,
                role: "owner",
                coinType: "0xa1ec::usdc::USDC",
                addressBalance: "1009000",
                coins: { total: "16900000", count: 1 },
                settling: "0",
                checkedAt: "2026-10-19T00:00:00Z",
              },
            ],
            movable: "16900000",
          });
        }
        return Response.json({ mode: "guest" });
      }),
    );
    at("/funds", "/funds", <FundsPage />);
    await waitFor(() => expect(screen.getByTestId("ready").textContent).toContain("$1.00"));
    expect(screen.getByTestId("coins").textContent).toContain("$16.90");
    expect(screen.getByRole("button", { name: /Move \$16.90 to address balance/ })).toBeDefined();
  });
});
