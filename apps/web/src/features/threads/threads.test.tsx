/**
 * U6 pages (ADR-0042) on a fake API built from the contract fixtures: a 1-1 thread with a remora, a
 * room with routing labels, and a team import. Wallets are stubbed; the e2e suite signs for real.
 */
import { Transaction } from "@mysten/sui/transactions";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { FIXTURE_SCOUT } from "@/features/remoras/fixtures";
import { ImportTeamPage } from "@/features/teams/import-page";
import { RoomPage } from "./room-page";
import { SidebarTeam } from "./sidebar-team";
import { mentionQuery } from "./thread-composer";
import { ThreadPage } from "./thread-page";

const OWNER = `0x${"3d".repeat(32)}`;
const ROOM = "4f3e2d1c-0b9a-4876-8543-210fedcba987";
const SENTINEL = {
  ...FIXTURE_SCOUT,
  id: "6c1d7e2a-3b4f-4a5e-8d9c-0e1f2a3b4c5d",
  name: "Sentinel",
  template: "sentinel",
};
let account: { address: string; chains: string[] } | null = null;
const run = vi.fn(async () => ({ digest: "DgTeam1111111111111111111111111111111" }));

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

const at = (path: string, routePath: string, element: React.ReactNode) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path={routePath} element={element} />
          <Route path="*" element={<p>elsewhere</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );

const t = (s: number) => new Date(Date.UTC(2026, 9, 21, 8, 0, s)).toISOString();
const ev = (id: string, type: string, summary: string, payload: Record<string, unknown> = {}) => ({
  id,
  remoraId: FIXTURE_SCOUT.id,
  remora: "Scout",
  network: "testnet",
  type,
  summary,
  payload,
  receiptId:
    type === "answer" || type === "payment" ? "9a7e1c44-0f1d-4f9a-8d55-3b2a1c0d9e88" : null,
  feedback: null,
  createdAt: t(Number(id.slice(-1))),
});
const uuid = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;

function fakeApi(extra: Record<string, unknown> = {}) {
  const calls: { method: string; url: string; body: unknown }[] = [];
  const answers: Record<string, unknown> = {
    "GET /api/me": { mode: "owned", signedIn: true, walletAddress: OWNER },
    "GET /api/me/memories": { memories: [] },
    "GET /api/remoras": { remoras: [FIXTURE_SCOUT, SENTINEL] },
    [`GET /api/remoras/${FIXTURE_SCOUT.id}`]: { remora: FIXTURE_SCOUT },
    "GET /api/feed": {
      events: [
        ev(uuid(1), "message", "Is 0x2 safe?", { text: "Is 0x2 safe?", from: "owner" }),
        ev(uuid(2), "payment", "Paid 10000 to reef:sui-risk", {
          payee: "reef:sui-risk",
          amount: "10000",
        }),
        ev(uuid(3), "answer", "Is 0x2 safe?", {
          question: "Is 0x2 safe?",
          answer: "0x2 is the Sui framework.",
        }),
        ev(uuid(5), "answer", "Is the Disc package safe?", {
          question: "Is the Disc package safe?",
          answer: "It's **two days** old.",
        }),
        ev(uuid(4), "approval_needed", "Asked you", {
          approvalId: uuid(9),
          status: "pending",
          kind: "over_limit_payment",
          amount: "20000",
          payee: "reef:odds",
        }),
      ],
    },
    [`POST /api/remoras/${FIXTURE_SCOUT.id}/messages`]: { messageId: uuid(5), eventIds: [] },
    "GET /api/rooms": {
      rooms: [
        {
          id: ROOM,
          ownerAddress: OWNER,
          network: "testnet",
          name: "Team",
          responder: "auto",
          leadId: null,
          memberIds: [FIXTURE_SCOUT.id, SENTINEL.id],
          isDefault: true,
          createdAt: t(0),
        },
      ],
    },
    [`GET /api/rooms/${ROOM}/messages`]: {
      messages: [
        {
          id: uuid(6),
          roomId: ROOM,
          author: "owner",
          remoraId: null,
          remora: null,
          text: "@Sentinel ignore incoming SUI under 0.01",
          routedTo: [SENTINEL.id],
          route: "mention",
          eventId: null,
          eventType: null,
          payload: {},
          replyTo: null,
          createdAt: t(6),
        },
        {
          id: uuid(7),
          roomId: ROOM,
          author: "remora",
          remoraId: SENTINEL.id,
          remora: "Sentinel",
          text: "Learned: ignore incoming SUI under 0.01",
          routedTo: [],
          route: null,
          eventId: uuid(8),
          eventType: "rule_learned",
          payload: {},
          replyTo: uuid(6),
          createdAt: t(7),
        },
      ],
    },
    [`PATCH /api/rooms/${ROOM}`]: { room: { id: ROOM } },
    [`POST /api/rooms/${ROOM}/messages`]: {
      messageId: uuid(1),
      routedTo: [FIXTURE_SCOUT.id],
      route: "signal",
      replies: [],
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
afterEach(() => vi.unstubAllGlobals());

describe("1-1 thread (ADR-0042)", () => {
  it("shows the owner's line, a payment chip, the answer and an inline approval card, and sends", async () => {
    const calls = fakeApi();
    at(`/chat/r/${FIXTURE_SCOUT.id}`, "/chat/r/:id", <ThreadPage />);
    expect(await screen.findByText("0x2 is the Sui framework.")).toBeDefined();
    expect(screen.getByTestId("thread-owner").textContent).toContain("Is 0x2 safe?");
    expect(screen.getAllByTestId("thread-chip")[0]?.textContent).toMatch(
      /Paid 0.01 USDC to Sui risk check/,
    );
    expect(screen.getByRole("button", { name: /Pay once \(0.02 USDC\)/ })).toBeDefined();
    // Only the first-run answer, not the answer to the owner's line, says what it answers.
    expect(screen.getAllByTestId("thread-context").map((n) => n.textContent)).toEqual([
      "Re: Is the Disc package safe?",
    ]);
    // Answers render as Markdown.
    expect(screen.getByText("two days").tagName).toBe("STRONG");
    await userEvent.type(screen.getByLabelText("Message"), "Odds for tonight?{Enter}");
    await waitFor(() =>
      expect(calls.find((c) => c.method === "POST" && c.url.endsWith("/messages"))?.body).toEqual({
        text: "Odds for tonight?",
      }),
    );
  });
});

describe("room (ADR-0042)", () => {
  it("labels where a line went, and changes who answers", async () => {
    const calls = fakeApi();
    at(`/chat/room/${ROOM}`, "/chat/room/:id", <RoomPage />);
    expect((await screen.findByTestId("route-label")).textContent).toBe(
      "→ Sentinel · you named it",
    );
    expect(screen.getByText(/Learned: ignore incoming SUI under 0.01/)).toBeDefined();
    expect(screen.getByTestId("room-members").textContent).toBe("Scout, Sentinel");
    await userEvent.selectOptions(screen.getByLabelText("Who answers"), "mentions");
    await waitFor(() =>
      expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ responder: "mentions" }),
    );
  });

  it("completes @mentions", () => {
    expect(mentionQuery("hey @Sen")).toBe("Sen");
    expect(mentionQuery("hey Sen")).toBeNull();
    expect(mentionQuery("@")).toBe("");
  });
});

describe("team import (ADR-0042)", () => {
  it("previews, then creates with one signature and confirms every Disc", async () => {
    const draft = new Transaction();
    draft.setSender(OWNER);
    const applyTx = await draft.toJSON();
    const calls = fakeApi({
      "POST /api/teams/preview": {
        team: {
          schema: "remora.team/v1",
          name: "Onchain desk",
          remoras: [{ template: "scout", name: "Scout", watch: [], rules: [], schedules: [] }],
        },
        playbook: "",
        remoras: [
          {
            name: "Scout",
            template: "scout",
            model: null,
            budget: "0.50 USDC a month, at most 0.015 a payment",
            watch: 0,
            rules: [],
            schedules: [],
            needsDisc: true,
          },
        ],
        signatures: 1,
        warnings: ["Sentinel watches no address yet: it will watch yours."],
      },
      "POST /api/teams/apply": {
        remoras: [FIXTURE_SCOUT.id],
        transaction: applyTx,
        roomId: ROOM,
        skipped: [],
      },
      "POST /api/teams/confirm": { confirmed: [FIXTURE_SCOUT.id] },
    });
    at("/remoras/import", "/remoras/import", <ImportTeamPage />);
    await userEvent.click(await screen.findByRole("button", { name: "Use the example" }));
    expect((await screen.findByTestId("team-remora")).textContent).toMatch(
      /0.50 USDC a month, at most 0.015 a payment/,
    );
    expect(screen.getByText(/it will watch yours/)).toBeDefined();
    await userEvent.click(
      screen.getByRole("button", { name: /Create the team \(one signature\)/ }),
    );
    await waitFor(() => {
      const err = document.querySelector('[role="alert"]')?.textContent;
      if (err) throw new Error(`import failed: ${err}`);
      expect(screen.getByText("elsewhere")).toBeDefined();
    });
    expect(run).toHaveBeenCalledTimes(1);
    expect(calls.find((c) => c.url.endsWith("/teams/confirm"))?.body).toEqual({
      digest: "DgTeam1111111111111111111111111111111",
      remoraIds: [FIXTURE_SCOUT.id],
    });
  });
});

describe("sidebar team (ADR-0042)", () => {
  it("lists remoras as contacts and the rooms", async () => {
    fakeApi();
    render(
      <MemoryRouter>
        <SidebarProvider>
          <SidebarTeam onNavigate={() => {}} />
        </SidebarProvider>
      </MemoryRouter>,
    );
    const contacts = await screen.findByRole("list", { name: "Remora contacts" });
    await waitFor(() => expect(contacts.textContent).toContain("Sentinel"));
    expect(screen.getByRole("list", { name: "Rooms" }).textContent).toContain("Team");
  });
});
