/**
 * N20/H2: the public status page on a fake `/api/status`. It needs no wallet and no session.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STATUS_DEGRADED, STATUS_OK } from "./status.fixture";
import { StatusPage } from "./status-page";

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <StatusPage />
    </QueryClientProvider>,
  );
}

function fakeStatus(body: unknown, init?: ResponseInit) {
  const fetchMock = vi.fn(async (_url: RequestInfo | URL) => Response.json(body, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("status page (H2)", () => {
  it("shows a skeleton while loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderPage();
    expect(screen.getByTestId("status-loading")).toBeDefined();
  });

  it("shows the overall line and every item when all is ok", async () => {
    const fetchMock = fakeStatus(STATUS_OK);
    renderPage();

    const overall = await screen.findByTestId("status-overall");
    expect(overall.textContent).toContain("All systems operational");
    expect(overall.dataset.status).toBe("ok");
    expect(screen.getAllByTestId("status-item")).toHaveLength(STATUS_OK.items.length);
    expect(screen.getAllByText("Operational")).toHaveLength(STATUS_OK.items.length);

    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.every((u) => u.endsWith("/api/status"))).toBe(true);
    expect(urls.some((u) => u.includes("/api/health/deep"))).toBe(false);
  });

  it("names degraded and down items in text", async () => {
    fakeStatus(STATUS_DEGRADED);
    renderPage();

    expect((await screen.findByTestId("status-overall")).textContent).toContain("degraded");
    expect(screen.getByText("Degraded")).toBeDefined();
    expect(screen.getByText("Down")).toBeDefined();
  });

  it("shows Status unknown, with no error text, when the request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch secret-host.internal");
      }),
    );
    renderPage();

    expect(await screen.findByText("Status unknown")).toBeDefined();
    expect(screen.queryByText(/secret-host/)).toBeNull();
  });

  it("shows Status unknown on a 404", async () => {
    fakeStatus({ error: "not found", traceId: "trace-404" }, { status: 404 });
    renderPage();

    expect(await screen.findByText("Status unknown")).toBeDefined();
    expect(screen.queryByText(/trace-404/)).toBeNull();
  });

  it("renders the overall line and no rows when items is empty", async () => {
    fakeStatus({ status: "ok", items: [] });
    renderPage();

    const overall = await screen.findByTestId("status-overall");
    expect(overall.textContent).toContain("All systems operational");
    expect(screen.queryAllByTestId("status-item")).toHaveLength(0);
  });

  it("shows Status unknown when an item has a status value it does not know", async () => {
    fakeStatus({ status: "ok", items: [{ name: "Memory relayer", status: "weird" }] });
    renderPage();

    expect(await screen.findByText("Status unknown")).toBeDefined();
    expect(screen.queryByTestId("status-item")).toBeNull();
  });

  it("renders none of detail, fix, value or traceId", async () => {
    fakeStatus({
      status: "degraded",
      traceId: "trace-abc-123",
      items: [
        {
          name: "Memory relayer",
          status: "degraded",
          detail: "the relayer answered 429 (account_sustained)",
          fix: "Wait for the hourly budget",
          value: "balance 0.84 SUI",
          threshold: 500,
          traceId: "trace-item-9",
        },
      ],
    });
    renderPage();

    expect(await screen.findByText("Memory relayer")).toBeDefined();
    const html = document.body.textContent ?? "";
    for (const secret of ["429", "hourly budget", "0.84", "trace-abc-123", "trace-item-9"]) {
      expect(html).not.toContain(secret);
    }
  });
});
