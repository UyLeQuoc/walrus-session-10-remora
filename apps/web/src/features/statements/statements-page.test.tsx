/**
 * E6 (ADR-0122): the statement page on a fake `GET /api/statements` and its CSV.
 */
import { type Statement, Statement as StatementSchema } from "@remora/schema";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recentMonths } from "@/features/remoras/cost";
import { dayBars, isNew, monthOptions } from "./statement";
import { StatementsPage } from "./statements-page";

const OWNER = `0x${"3d".repeat(32)}`;

vi.mock("@mysten/dapp-kit", () => ({
  useCurrentAccount: () => ({ address: OWNER, chains: ["sui:testnet"] }),
  useSuiClient: () => ({ core: {} }),
  useWallets: () => [],
  useConnectWallet: () => ({ mutateAsync: vi.fn() }),
  useCurrentWallet: () => ({ currentWallet: null, isConnected: false }),
  useSignPersonalMessage: () => ({ mutateAsync: vi.fn() }),
}));
const [MONTH = "2026-11", BEFORE = "2026-10"] = recentMonths();

function statement(month = MONTH): Statement {
  const [y, m] = month.split("-").map(Number);
  const n = new Date(Date.UTC(y ?? 2026, m ?? 11, 0)).getUTCDate();
  return StatementSchema.parse({
    month,
    timezone: "Asia/Ho_Chi_Minh",
    network: "testnet",
    total: "2015000",
    payments: 3,
    byRemoras: "15000",
    byOwner: "2000000",
    failed: 3,
    days: Array.from({ length: n }, (_, i) => ({
      day: `${month}-${String(i + 1).padStart(2, "0")}`,
      amount: i === 1 ? "15000" : i === 2 ? "2000000" : "0",
      payments: i === 1 ? 2 : i === 2 ? 1 : 0,
    })),
    remoras: [
      { id: "r2", name: "Keeper", amount: "2000000", payments: 1 },
      { id: "r1", name: "Researcher", amount: "15000", payments: 2 },
    ],
    payees: [
      {
        payee: "reef:odds",
        label: "Odds",
        amount: "2000000",
        payments: 1,
        firstPaid: `${month}-03T03:00:00.000Z`,
      },
      {
        payee: "reef:weather",
        label: "Weather",
        amount: "15000",
        payments: 2,
        firstPaid: "2025-01-01T00:00:00.000Z",
      },
    ],
    flags: [
      {
        kind: "new_payee",
        day: `${month}-03`,
        at: `${month}-03T03:00:00.000Z`,
        remoraId: "r2",
        remora: "Keeper",
        payee: "Odds",
        amount: "2000000",
        baseline: null,
        count: null,
        digest: null,
        summary: "First payment to Odds: 2.00 USDC from Keeper.",
      },
      {
        kind: "failed_run",
        day: `${month}-05`,
        at: `${month}-05T03:00:00.000Z`,
        remoraId: "r2",
        remora: "Keeper",
        payee: null,
        amount: null,
        baseline: null,
        count: 3,
        digest: null,
        summary: "Keeper: 3 payments in a row failed (x402.unsettled).",
      },
    ],
  });
}

function serve(routes: Record<string, unknown>) {
  const urls: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url === "/api/me")
        return Response.json({ mode: "owned", signedIn: true, walletAddress: OWNER });
      if (url === "/api/me/memories") return Response.json({ memories: [] });
      if (url.startsWith("/api/statements/csv"))
        return new Response("time,remora\r\n", { headers: { "content-type": "text/csv" } });
      const hit = routes[url];
      return hit === undefined
        ? Response.json({ error: { code: "x", message: "nope" } }, { status: 404 })
        : Response.json(hit);
    }),
  );
  return urls;
}

function renderPage() {
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <StatementsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => vi.unstubAllGlobals());

describe("statements page (E6)", () => {
  it("shows the month's total, what's worth a look, and who was paid, from the API only", async () => {
    serve({ "/api/statements": statement() });
    renderPage();
    expect((await screen.findByTestId("statement-total")).textContent).toMatch(
      /2\.015USDC3 payments/,
    );
    expect(screen.getByTestId("statement-failed").textContent).toContain("3");
    const flags = screen.getAllByTestId("statement-flag");
    expect(flags.map((f) => f.getAttribute("data-kind"))).toEqual(["new_payee", "failed_run"]);
    expect(flags[1]?.textContent).toContain("Keeper: 3 payments in a row failed");
    const payees = screen.getByTestId("statement-payees");
    const rows = within(payees).getAllByRole("row");
    expect(rows[1]?.textContent).toMatch(/Oddsnew12\.00/);
    expect(rows[2]?.textContent).toMatch(/Weather20\.015/);
    expect(within(screen.getByTestId("statement-remoras")).getAllByRole("row")).toHaveLength(3);
    expect(screen.getByText(/Days in Asia\/Ho_Chi_Minh/)).toBeDefined();
    expect(document.querySelector("[data-statement]")).not.toBeNull();
  });

  it("downloads the month's CSV and switches months", async () => {
    const urls = serve({
      "/api/statements": statement(),
      [`/api/statements?month=${BEFORE}`]: { ...statement(BEFORE), flags: [] },
    });
    const created = vi.fn(() => "blob:statement");
    vi.stubGlobal(
      "URL",
      Object.assign(URL, { createObjectURL: created, revokeObjectURL: vi.fn() }),
    );
    const saved = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    renderPage();
    await screen.findByTestId("statement-total");
    fireEvent.click(screen.getByRole("button", { name: /Download CSV/ }));
    await vi.waitFor(() => expect(saved).toHaveBeenCalled());
    expect(created).toHaveBeenCalled();
    expect((saved.mock.contexts[0] as HTMLAnchorElement).download).toBe(
      `remora-statement-testnet-${MONTH}.csv`,
    );
    saved.mockRestore();
    expect(urls).toContain(`/api/statements/csv?month=${MONTH}`);

    fireEvent.click(screen.getByRole("combobox", { name: "Month" }));
    fireEvent.click((await screen.findAllByRole("option"))[1] as HTMLElement);
    expect(await screen.findByTestId("statement-calm")).toBeDefined();
    expect(urls).toContain(`/api/statements?month=${BEFORE}`);
  });

  it("says when the statement can't be read", async () => {
    serve({});
    renderPage();
    expect(await screen.findByText("Can't read your statement right now.")).toBeDefined();
  });
});

describe("statement helpers (E6)", () => {
  it("draws a bar a day and marks a payee first paid this month", () => {
    const s = statement();
    expect(dayBars(s)[1]).toEqual({ day: "2", usdc: 0.015, payments: 2 });
    expect(isNew(`${MONTH}-03T03:00:00.000Z`, s)).toBe(true);
    expect(isNew("2025-01-01T00:00:00.000Z", s)).toBe(false);
    expect(monthOptions("2026-12", ["2026-11", "2026-10"])).toEqual([
      "2026-12",
      "2026-11",
      "2026-10",
    ]);
  });
});
