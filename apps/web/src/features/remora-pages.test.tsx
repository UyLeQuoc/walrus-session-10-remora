/**
 * The W2 pages on a fake API that answers from the contract fixtures, the network store driving the
 * API header, and the funds split. Wallets and the chain are stubbed; the e2e suite covers the real ones.
 */

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/api";
import { currentNetwork, setNetwork } from "@/lib/network";
import { formatUsdc, parseUsdc, usdc } from "@/lib/usdc";
import { ApprovalsPage } from "./approvals/approvals-page";
import { FundsPage } from "./funds/funds-page";
import { HomePage } from "./home/home-page";
import { MemoryInspectorPage } from "./memory-inspector/memory-page";
import { OnboardingPage } from "./onboarding/onboarding-page";
import {
  FIXTURE_APPROVAL,
  FIXTURE_FEED,
  FIXTURE_INSPECTOR,
  FIXTURE_METER,
  FIXTURE_PREVIEW,
  FIXTURE_SCOUT,
  FIXTURE_SETTINGS,
  FIXTURE_VERIFY,
  FIXTURE_WAKE,
} from "./remoras/fixtures";
import { RemoraPage } from "./remoras/remora-page";
import { RemorasPage } from "./remoras/remoras-page";
import { SettingsPage } from "./settings/settings-page";
import { VerifyPage } from "./verify/verify-page";

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
  useSignTransaction: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

function at(path: string, routePath: string, element: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
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
  // Hash measures its container; jsdom has no ResizeObserver.
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

describe("usdc helpers", () => {
  it("formats and parses 6-decimal amounts", () => {
    expect(formatUsdc("1009000")).toBe("1.00");
    expect(formatUsdc(10_000n, 6)).toBe("0.010000");
    expect(parseUsdc("0.10")).toBe(100_000n);
    expect(parseUsdc("1")).toBe(1_000_000n);
    expect(parseUsdc("0")).toBeNull();
    expect(parseUsdc("1.1234567")).toBeNull();
    expect(parseUsdc("abc")).toBeNull();
    expect(usdc("15000")).toBe("0.015");
    expect(usdc("2000000")).toBe("2.00");
    expect(usdc(10_000n)).toBe("0.01");
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

/** A fake W2 API answering from the contract fixtures; `owner` decides whether the session has a wallet. */
function fakeApi(owner: string | null, extra: Record<string, unknown> = {}) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const answers: Record<string, unknown> = {
    "GET /api/me": owner
      ? { mode: "owned", signedIn: true, walletAddress: owner }
      : { mode: "guest" },
    "GET /api/me/memories": { memories: [] },
    "GET /api/remoras": { remoras: [FIXTURE_SCOUT] },
    [`GET /api/remoras/${FIXTURE_SCOUT.id}`]: { remora: FIXTURE_SCOUT },
    "GET /api/feed": { events: FIXTURE_FEED },
    "GET /api/approvals": { approvals: [FIXTURE_APPROVAL] },
    [`GET /api/remoras/${FIXTURE_SCOUT.id}/budget`]: { meter: FIXTURE_METER },
    [`GET /api/remoras/${FIXTURE_SCOUT.id}/sources`]: {
      sources: [{ payee: "reef:sui-risk", calls: 9, useful: 8, noise: 1, spent: "90000" }],
    },
    [`GET /api/remoras/${FIXTURE_SCOUT.id}/schedules`]: { schedules: [] },
    [`GET /api/remoras/${FIXTURE_SCOUT.id}/memory`]: FIXTURE_INSPECTOR,
    "POST /api/schedule/preview": FIXTURE_PREVIEW,
    [`GET /api/events/${FIXTURE_FEED[0]?.id}/why`]: {
      event: FIXTURE_FEED[0],
      remora: "Scout",
      wake: {
        id: FIXTURE_FEED[0]?.receiptId,
        intentHash: "ab".repeat(32),
        txDigest: null,
        anchored: true,
        wakeBlobId: null,
        wake: FIXTURE_WAKE,
      },
    },
    [`POST /api/remoras/${FIXTURE_SCOUT.id}/ask`]: {
      answer: "0x2 is the Sui framework.",
      eventId: "e1",
      receiptId: null,
      outcomes: [],
    },
    "GET /api/verify/8PqTz4m9uWJ3xVhK1nR2cY7bL5dA6sE0fG3hJ9kM2pQ": FIXTURE_VERIFY,
    "GET /api/settings": { settings: FIXTURE_SETTINGS },
    "POST /api/telegram/link": {
      code: "ABC234",
      url: "https://t.me/remora_bot?start=link_ABC234",
      expiresInMinutes: 10,
    },
    ...extra,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input).split("?")[0] ?? "";
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const hit = answers[`${method} ${url}`];
      return hit === undefined
        ? Response.json({ error: { code: "x", message: "nope" } }, { status: 404 })
        : Response.json(hit);
    }),
  );
  return calls;
}

describe("W2 pages on the live API (contract fixtures)", () => {
  it("asks for a wallet session before showing remoras", async () => {
    fakeApi(null);
    at("/remoras", "/remoras", <RemorasPage />);
    expect(await screen.findByText(/Sign in with your wallet to see your remoras/)).toBeDefined();
  });

  it("dashboard: remoras, what's waiting, and the feed across all (H4, N1, N2)", async () => {
    fakeApi(OWNER);
    at("/remoras", "/remoras", <RemorasPage />);
    expect(await screen.findByText("1 approval waiting")).toBeDefined();
    const card = screen.getByTestId("remora-card");
    // The template shows once, capitalised ("Scout"), not again as a budget sentence.
    expect(card.textContent).toMatch(/Scout/);
    expect(card.textContent).not.toMatch(/Read-only: no budget/);
    const meter = await screen.findByTestId("budget-meter");
    expect(meter.textContent).toMatch(/0.97.*of.*1.00 USDC left this month/);
    expect(await screen.findByText(/Paid 0.01 USDC to reef:sui-risk/)).toBeDefined();
    expect(screen.getByText(/0x2 is the Sui framework/)).toBeDefined();
  });

  it("remora page: budget forecast, ask, schedule preview, and Why? on a payment (N4, N5, N12, C1)", async () => {
    const calls = fakeApi(OWNER);
    at(`/remoras/${FIXTURE_SCOUT.id}`, "/remoras/:id", <RemoraPage />);
    expect((await screen.findByTestId("budget-meter")).textContent).toMatch(
      /0.97 of 1.00 USDC left this month.*runs out around Feb 10, 2027/,
    );
    await userEvent.type(screen.getByLabelText("Question"), "Is 0x2 safe?");
    await userEvent.click(screen.getByRole("button", { name: "Ask" }));
    expect((await screen.findByTestId("answer")).textContent).toBe("0x2 is the Sui framework.");
    expect(calls.find((c) => c.url.endsWith("/ask"))?.body).toEqual({ question: "Is 0x2 safe?" });
    await userEvent.click(await screen.findByRole("tab", { name: "Settings" }));
    expect((await screen.findByTestId("schedule-preview")).textContent).toMatch(
      /weekdays at 8am UTC/,
    );
    await userEvent.click(await screen.findByRole("tab", { name: "Overview" }));
    await userEvent.click(
      (await screen.findAllByRole("button", { name: "Why?" }))[0] as HTMLElement,
    );
    expect(
      await screen.findByText(/sui-risk answered 8 of 9 risk questions usefully/),
    ).toBeDefined();
  });

  it("approvals: an over-limit payment offers to pay once (N2, E4)", async () => {
    fakeApi(OWNER);
    at("/approvals", "/approvals", <ApprovalsPage />);
    const card = await screen.findByTestId("approval");
    expect(card.textContent).toMatch(/2\.00 USDC/);
    expect(card.textContent).toMatch(/reef:odds/);
    expect(screen.getByRole("button", { name: /Pay once \(2.00 USDC\)/ })).toBeDefined();
  });

  it("memory inspector warns when the relayer has fewer than we wrote (F3, F6)", async () => {
    fakeApi(OWNER);
    at("/memory", "/memory", <MemoryInspectorPage />);
    expect((await screen.findByTestId("index-warning")).textContent).toMatch(
      /receipts has 3 of the 4 we wrote/,
    );
    expect(screen.getByText(/SOURCE reef:sui-risk · 9 calls/)).toBeDefined();
    // ADR-0086: writes skipped as duplicates are shown, not dropped silently.
    expect(screen.getAllByTestId("duplicate-writes")[0]?.textContent).toBe(
      "2 later writes matched this",
    );
    expect(screen.getAllByTestId("memory-duplicate")).toHaveLength(2);
    expect(screen.getByText("Skipped as already known")).toBeDefined();
  });

  it("signed-out Home offers Scout with no wallet, and a receipt to check (ADR-0088)", async () => {
    fakeApi(null);
    at("/", "/", <HomePage />);
    const tryIt = await screen.findByTestId("home-try-scout");
    expect(tryIt.getAttribute("href")).toBe("/playground");
    expect(screen.getByRole("link", { name: /Check a receipt/ }).getAttribute("href")).toBe(
      "/verify",
    );
  });

  it("verify page checks a digest without signing in (G3)", async () => {
    fakeApi(null);
    at("/verify/8PqTz4m9uWJ3xVhK1nR2cY7bL5dA6sE0fG3hJ9kM2pQ", "/verify/:ref", <VerifyPage />);
    expect((await screen.findByTestId("verify-verdict")).textContent).toMatch(/Verified/);
    expect(screen.getByText("Paid.intent matches")).toBeDefined();
  });

  it("settings: policy loads, Telegram gives a deep link (A7, H5, A5)", async () => {
    fakeApi(OWNER);
    at("/settings", "/settings", <SettingsPage />);
    expect(((await screen.findByLabelText("Timezone")) as HTMLInputElement).value).toBe(
      "Asia/Ho_Chi_Minh",
    );
    await userEvent.click(screen.getByRole("button", { name: "Link Telegram" }));
    expect((await screen.findByTestId("telegram-code")).textContent).toMatch(/10 minutes/);
  });

  it("onboarding ticks the wallet, funds and first remora from live state (A6)", async () => {
    fakeApi(OWNER, {
      "GET /api/funds": {
        network: "testnet",
        splits: [
          {
            address: OWNER,
            role: "owner",
            coinType: "0xa1ec::usdc::USDC",
            addressBalance: "1000000",
            coins: { total: "0", count: 0 },
            settling: "0",
            checkedAt: "2026-10-19T00:00:00Z",
          },
        ],
        movable: "0",
      },
    });
    account = { address: OWNER, chains: ["sui:testnet"] };
    at("/onboarding", "/onboarding", <OnboardingPage />);
    await waitFor(() => expect(screen.getByText("3 of 3 done")).toBeDefined());
  });
});

describe("funds page (A4·ui)", () => {
  it("asks for a wallet first", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ mode: "guest" })),
    );
    at("/funds", "/funds", <FundsPage />);
    // `/api/me` is one shared snapshot; an earlier test's wallet clears once this one's guest loads.
    expect(await screen.findByText(/Sign in with your wallet to see your funds/)).toBeDefined();
  });

  it("shows the address-balance / coins split from /api/funds", async () => {
    account = { address: OWNER, chains: ["sui:testnet"] };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/me") {
          return Response.json({ mode: "owned", signedIn: true, walletAddress: OWNER });
        }
        if (url === "/api/me/memories") return Response.json({ memories: [] });
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
