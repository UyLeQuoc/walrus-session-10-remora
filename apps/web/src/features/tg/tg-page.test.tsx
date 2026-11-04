import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { launchData, TgPage } from "./tg-page";

const overview = (status: string) => ({
  remoras: [{ id: "r1", name: "Researcher", template: "scout", status }],
  receipts: [
    {
      remora: "Researcher",
      payee: "reef:price",
      amount: "5000",
      digest: "D1g3st",
      at: "2026-11-05T01:00:00Z",
    },
  ],
  approvals: [{ id: "a1", remora: "Researcher", summary: "Pay 0.02 USDC to Odds" }],
  web: "https://getremora.vercel.app",
});

beforeEach(() => {
  window.history.replaceState(
    null,
    "",
    "/tg#tgWebAppData=auth_date%3D1%26hash%3Dabc&tgWebAppVersion=8.0",
  );
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

describe("the Telegram Mini App (H3, ADR-0115)", () => {
  it("reads Telegram's launch data from the URL", () => {
    expect(launchData("#tgWebAppData=auth_date%3D1%26hash%3Dabc&tgWebAppVersion=8.0")).toBe(
      "auth_date=1&hash=abc",
    );
    expect(launchData("")).toBe("");
  });

  it("sends the launch data, shows remoras, receipts and approvals, and pauses all in one tap", async () => {
    const calls: { path: string; header: string | null; body: string | null }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const path = new URL(String(input), "http://x").pathname;
        calls.push({
          path,
          header: new Headers(init?.headers).get("x-telegram-init-data"),
          body: init?.body ? String(init.body) : null,
        });
        return Response.json(overview(path.endsWith("/pause") ? "paused" : "active"));
      }),
    );
    render(
      <MemoryRouter>
        <TgPage />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId("tg-receipt")).toBeTruthy();
    expect(screen.getByText(/Pay 0.02 USDC to Odds/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: /Pause all/ }));
    expect(await screen.findByRole("button", { name: /Resume all/ })).toBeTruthy();
    expect(calls.map((c) => c.path)).toEqual(["/api/tg/me", "/api/tg/pause"]);
    expect(calls.every((c) => c.header === "auth_date=1&hash=abc")).toBe(true);
    expect(calls[1]?.body).toBe(JSON.stringify({ paused: true }));
  });
});
