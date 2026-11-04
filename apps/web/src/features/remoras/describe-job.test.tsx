/**
 * C1 (ADR-0123) on a fake API: the job in words fills the create form, the owner hatches with one
 * signature, and the draft's persona and schedule follow; a refused job says why. Wallets are stubbed.
 */
import { Transaction } from "@mysten/sui/transactions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_SCOUT } from "./fixtures";
import { NewRemoraPage } from "./new-remora-page";

const OWNER = `0x${"3d".repeat(32)}`;
const USDC = `0x${"0".repeat(60)}a1ec::usdc::USDC`;
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

const kind = (name: string, perPaymentUsd: number, payees: string[]) => ({
  schema: "remora.template/v1",
  name,
  summary: `${name} summary.`,
  persona: `You are the owner's ${name}.`,
  tools: ["memory.recall", "notify"],
  triggers: [{ kind: "message" }],
  budgetSuggestion: { monthlyUsd: [1, 5], perPaymentUsd },
  payees,
  starterMemories: [],
  examples: [],
});
const ALL = ["reef:sui-risk", "reef:wallet", "reef:price"];
const JOB = "Every weekday at 8, tell me if any of my wallets moved more than 50 USDC";
const draft = {
  template: "briefer",
  name: "Wallet moves",
  persona: "You are the owner's Briefer. Mention only moves over 50 USDC.",
  tools: ["memory.recall", "notify"],
  triggers: [{ kind: "cron", cron: "0 8 * * 1-5", human: "weekdays at 08:00" }],
  namespaces: ["me", "sources", "feedback", "receipts"],
  budget: {
    coinType: USDC,
    windowLimit: "500000",
    window: "month",
    perPaymentCap: "10000",
    payees: ["reef:wallet"],
  },
  watch: [],
  items: [`wallet ${OWNER} moves over 50 USDC since yesterday`],
  rules: [],
  schedule: { when: "weekdays at 9am", question: "" },
  why: "A weekday brief that buys one wallet X-ray a day.",
};

async function fakeApi(answers: Record<string, unknown> = {}) {
  const tx = new Transaction();
  tx.setSender(OWNER);
  const calls: { method: string; url: string; body: unknown }[] = [];
  const all: Record<string, unknown> = {
    "GET /api/me": { mode: "owned", signedIn: true, walletAddress: OWNER },
    "GET /api/networks": {
      default: "testnet",
      networks: [{ network: "testnet", available: true, packageId: null, usdcCoinType: USDC }],
    },
    "GET /api/templates": {
      templates: {
        scout: kind("Researcher", 0.05, ALL),
        sentinel: kind("Wallet watcher", 0, []),
        briefer: kind("Briefer", 0.015, ALL),
      },
    },
    "POST /api/remoras/draft": { ok: true, draft, issues: [] },
    "POST /api/remoras": { remora: FIXTURE_SCOUT, transaction: await tx.toJSON() },
    [`POST /api/remoras/${FIXTURE_SCOUT.id}/confirm`]: { remora: FIXTURE_SCOUT },
    [`POST /api/remoras/${FIXTURE_SCOUT.id}/setup`]: { done: ["persona", "schedule"], skipped: [] },
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

const open = () =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={["/remoras/new"]}>
        <Routes>
          <Route path="/remoras/new" element={<NewRemoraPage />} />
          <Route path="/remoras/:id" element={<p>its page</p>} />
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
});
afterEach(() => {
  vi.unstubAllGlobals();
  run.mockClear();
});

describe("describe the job (C1)", () => {
  it("drafts the form, hatches with one signature, then sets the draft's persona and time", async () => {
    const calls = await fakeApi();
    open();
    await userEvent.type(await screen.findByLabelText(/What should it do/), JOB);
    await userEvent.click(screen.getByTestId("draft-job"));
    expect((await screen.findByTestId("draft-why")).textContent).toMatch(/wallet X-ray/);
    expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe("Wallet moves");
    expect((screen.getByLabelText(/Monthly limit/) as HTMLInputElement).value).toBe("0.50");
    expect((screen.getByLabelText("What to follow") as HTMLTextAreaElement).value).toContain(OWNER);
    expect((screen.getByLabelText("When") as HTMLInputElement).value).toBe("weekdays at 9am");
    await userEvent.click(screen.getByTestId("create-step"));
    expect(await screen.findByText("its page")).toBeDefined();
    expect(run).toHaveBeenCalledTimes(1);
    const create = calls.find((c) => c.method === "POST" && c.url === "/api/remoras");
    expect(create?.body).toMatchObject({
      template: "briefer",
      name: "Wallet moves",
      items: draft.items,
      budget: { windowLimit: "500000", perPaymentCap: "10000", payees: ["reef:wallet"] },
    });
    const setup = calls.find((c) => c.url === `/api/remoras/${FIXTURE_SCOUT.id}/setup`);
    expect(setup?.body).toEqual({
      persona: draft.persona,
      schedule: { when: "weekdays at 9am", question: "" },
    });
  });

  it("says why a job is refused and leaves the form as it was", async () => {
    await fakeApi({
      "POST /api/remoras/draft": {
        ok: false,
        refused: "Remoras don't trade or swap coins.",
      },
    });
    open();
    await userEvent.type(await screen.findByLabelText(/What should it do/), "trade my coins");
    await userEvent.click(screen.getByTestId("draft-job"));
    expect((await screen.findByTestId("draft-refused")).textContent).toMatch(/don't trade/);
    await waitFor(() => expect((screen.getByLabelText("Name") as HTMLInputElement).value).toBe(""));
  });
});
