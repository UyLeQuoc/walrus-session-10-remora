/** F14·ui: the Connections page on a fake API answering from the contract fixtures. */
import { McpCall, McpToken, McpTokenCreated } from "@remora/schema";
import calls from "@remora/schema/fixtures/mcp.calls.json";
import token from "@remora/schema/fixtures/mcp.token.json";
import created from "@remora/schema/fixtures/mcp.token-created.json";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { FIXTURE_SCOUT } from "@/features/remoras/fixtures";
import { ConnectionsPage } from "./connections-page";

const OWNER = `0x${"3d".repeat(32)}`;
const TOKEN = McpToken.parse(token);
const CREATED = McpTokenCreated.parse(created);
const CALLS = z.array(McpCall).parse(calls);

vi.mock("@mysten/dapp-kit", () => ({
  useCurrentAccount: () => ({ address: OWNER, chains: ["sui:testnet"] }),
  useSuiClient: () => ({ core: {} }),
  useWallets: () => [],
  useConnectWallet: () => ({ mutateAsync: vi.fn() }),
  useCurrentWallet: () => ({ currentWallet: null, isConnected: false }),
  useSignPersonalMessage: () => ({ mutateAsync: vi.fn() }),
  useSignTransaction: () => ({ mutateAsync: vi.fn() }),
  useSignAndExecuteTransaction: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

function fakeStorage() {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    clear: () => m.clear(),
  };
}

function fakeApi(tokens: unknown[]) {
  const sent: { method: string; url: string; body: unknown }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input).split("?")[0] ?? "";
      const method = init?.method ?? "GET";
      const body = init?.body ? JSON.parse(String(init.body)) : undefined;
      sent.push({ method, url, body });
      const answers: Record<string, unknown> = {
        "GET /api/me": { mode: "owned", signedIn: true, walletAddress: OWNER },
        "GET /api/remoras": { remoras: [FIXTURE_SCOUT] },
        "GET /api/mcp/tokens": { tokens },
        "POST /api/mcp/tokens": CREATED,
        [`GET /api/mcp/tokens/${TOKEN.id}/calls`]: { calls: CALLS },
        [`POST /api/mcp/tokens/${TOKEN.id}/revoke`]: {
          token: { ...TOKEN, revokedAt: "2026-10-25T05:00:00Z" },
        },
      };
      const hit = answers[`${method} ${url}`];
      return hit === undefined
        ? Response.json({ error: { code: "x", message: "nope" } }, { status: 404 })
        : Response.json(hit, {
            status: method === "POST" && url === "/api/mcp/tokens" ? 201 : 200,
          });
    }),
  );
  return sent;
}

const page = () =>
  render(
    <MemoryRouter>
      <ConnectionsPage />
    </MemoryRouter>,
  );

beforeEach(() => {
  vi.stubGlobal("localStorage", fakeStorage());
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

describe("Connections (F14·ui)", () => {
  it("lists a token with its scopes, calls, spend and recent calls", async () => {
    fakeApi([TOKEN]);
    page();
    const card = await screen.findByTestId("token");
    expect(card.textContent).toContain("Claude Code on my laptop");
    expect(card.textContent).toContain("mcp:claude-code");
    expect(within(card).getByTestId("token-call-count").textContent).toBe("6");
    expect(within(card).getByTestId("token-spend").textContent).toBe("0.05 USDC");
    expect(card.textContent).not.toContain("EXAMPLEONLY");
    await userEvent.click(within(card).getByRole("button", { name: /Recent calls/ }));
    const list = await screen.findByTestId("token-calls");
    expect(list.textContent).toContain("remora_remember");
    expect(list.textContent).toContain("over the per-payment cap");
  });

  it("creates a token with the chosen scopes and shows the secret once", async () => {
    const sent = fakeApi([]);
    page();
    await screen.findByText("No agent is connected yet.");
    await userEvent.click(
      await screen.findByRole("checkbox", { name: "Pay within its spending limit" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Create token" }));
    const shown = await screen.findByTestId("token-created");
    expect(within(shown).getByTestId("token-secret").textContent).toBe(CREATED.secret);
    expect(within(shown).getByTestId("token-http").textContent).toBe(
      `claude mcp add --transport http remora ${CREATED.httpUrl} --header "Authorization: Bearer ${CREATED.secret}"`,
    );
    expect(within(shown).getByTestId("token-stdio").textContent).toBe(CREATED.stdio);
    const post = sent.find((s) => s.method === "POST" && s.url === "/api/mcp/tokens");
    expect(post?.body).toMatchObject({
      remora: FIXTURE_SCOUT.id,
      name: "Claude Code",
      scopes: ["memory:read", "pay"],
      days: 30,
    });
    await userEvent.click(screen.getByRole("button", { name: "I've copied it" }));
    await waitFor(() => expect(screen.queryByTestId("token-secret")).toBeNull());
  });

  it("revokes after a confirmation", async () => {
    const sent = fakeApi([TOKEN]);
    page();
    const card = await screen.findByTestId("token");
    await userEvent.click(within(card).getByRole("button", { name: "Revoke" }));
    await userEvent.click(await screen.findByRole("button", { name: "Revoke", hidden: false }));
    await waitFor(() =>
      expect(sent.some((s) => s.url === `/api/mcp/tokens/${TOKEN.id}/revoke`)).toBe(true),
    );
  });
});
