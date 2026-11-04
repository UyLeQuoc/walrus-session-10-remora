/**
 * C2 (ADR-0123) on a fake API: a change card in a thread applies on a tap, and the sign link's page
 * builds the transaction, has the wallet sign it and confirms it. Wallets are stubbed.
 */
import { Transaction } from "@mysten/sui/transactions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_SCOUT } from "@/features/remoras/fixtures";
import { ThreadPage } from "@/features/threads/thread-page";
import { ChangesPage } from "./changes-page";

const OWNER = `0x${"3d".repeat(32)}`;
const CHANGE = "7b1e2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
const DIGEST = "Dg11111111111111111111111111111111111";
let account: { address: string; chains: string[] } | null = null;
const run = vi.fn(async () => ({ digest: DIGEST }));

vi.mock("@mysten/dapp-kit", () => ({
  useCurrentAccount: () => account,
  useSuiClient: () => ({
    core: {
      waitForTransaction: async () => ({ Transaction: { effects: { status: { success: true } } } }),
    },
  }),
  useSignAndExecuteTransaction: () => ({ mutateAsync: run }),
  useWallets: () => [],
  useConnectWallet: () => ({ mutateAsync: vi.fn() }),
  useCurrentWallet: () => ({ currentWallet: null, isConnected: false }),
  useSignPersonalMessage: () => ({ mutateAsync: vi.fn() }),
  useSignTransaction: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const card = (o: Record<string, unknown> = {}) => ({
  kind: "change",
  target: FIXTURE_SCOUT.id,
  remora: "Scout",
  title: "Raise Scout's limit",
  diff: [{ label: "Monthly limit", before: "0.5 USDC", after: "1 USDC" }],
  sign: true,
  note: "You sign one transaction: Sui revokes the old limit and issues the new one.",
  status: "pending",
  expiresAt: "2026-11-06T08:00:00.000Z",
  ...o,
});

function fakeApi(answers: Record<string, unknown>) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const all: Record<string, unknown> = {
    "GET /api/me": { mode: "owned", signedIn: true, walletAddress: OWNER },
    "GET /api/me/memories": { memories: [] },
    "GET /api/remoras": { remoras: [FIXTURE_SCOUT] },
    [`GET /api/remoras/${FIXTURE_SCOUT.id}`]: { remora: FIXTURE_SCOUT },
    ...answers,
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input).split("?")[0] ?? "";
      const method = init?.method ?? "GET";
      calls.push({ method, url, body: init?.body ? JSON.parse(String(init.body)) : undefined });
      const hit = all[`${method} ${url}`];
      return hit === undefined
        ? Response.json({ error: { code: "x", message: "nope" } }, { status: 404 })
        : Response.json(hit);
    }),
  );
  return calls;
}

const at = (path: string, routePath: string, element: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

beforeEach(() => {
  account = { address: OWNER, chains: ["sui:testnet"] };
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  vi.stubGlobal("matchMedia", (q: string) => ({
    matches: false,
    media: q,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
  run.mockClear();
});

describe("change cards (C2)", () => {
  it("the sign link shows the change, then signs and confirms it", async () => {
    const tx = new Transaction();
    tx.setSender(OWNER);
    const calls = fakeApi({
      [`GET /api/changes/${CHANGE}`]: { id: CHANGE, change: card() },
      [`POST /api/changes/${CHANGE}/tx`]: { transaction: await tx.toJSON() },
      [`POST /api/changes/${CHANGE}/confirm`]: {
        id: CHANGE,
        change: card({ status: "applied", digest: DIGEST }),
      },
    });
    at(`/changes/${CHANGE}`, "/changes/:id", <ChangesPage />);
    const shown = await screen.findByTestId("change-card");
    expect(shown.textContent).toMatch(/Raise Scout's limit/);
    expect(shown.textContent).toMatch(/Monthly limit.*0\.5 USDC.*1 USDC/);
    expect(shown.textContent).toMatch(/Needs your signature/);
    expect(screen.queryByRole("button", { name: "Apply" })).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "Sign" }));
    await waitFor(() => expect(screen.getByTestId("change-card").textContent).toMatch(/Done/));
    expect(run).toHaveBeenCalledTimes(1);
    expect(calls.find((c) => c.url === `/api/changes/${CHANGE}/confirm`)?.body).toEqual({
      digest: DIGEST,
    });
    expect(screen.getByRole("link", { name: /Signed onchain/ }).getAttribute("href")).toContain(
      DIGEST,
    );
  });

  it("a setting asked for in a thread applies on a tap, without the wallet", async () => {
    const rename = card({
      title: "Rename Scout",
      diff: [{ label: "Name", before: "Scout", after: "Sage" }],
      sign: false,
      note: undefined,
    });
    const calls = fakeApi({
      "GET /api/feed": {
        events: [
          {
            id: CHANGE,
            remoraId: FIXTURE_SCOUT.id,
            remora: "Scout",
            network: "testnet",
            type: "action",
            summary: "Rename Scout",
            payload: rename,
            receiptId: null,
            feedback: null,
            createdAt: "2026-11-05T08:00:00.000Z",
          },
        ],
      },
      [`POST /api/changes/${CHANGE}/apply`]: {
        id: CHANGE,
        change: { ...rename, status: "applied" },
      },
    });
    at(`/chat/r/${FIXTURE_SCOUT.id}`, "/chat/r/:id", <ThreadPage />);
    const shown = await screen.findByTestId("change-card");
    expect(shown.textContent).toMatch(/Name.*Scout.*Sage/);
    expect(screen.queryAllByTestId("thread-chip")).toHaveLength(0);
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(screen.getByTestId("change-card").textContent).toMatch(/Done/));
    expect(calls.some((c) => c.method === "POST" && c.url === `/api/changes/${CHANGE}/apply`)).toBe(
      true,
    );
    expect(run).not.toHaveBeenCalled();
  });
});
