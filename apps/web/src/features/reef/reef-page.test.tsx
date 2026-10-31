/**
 * E7/H4: the Reef directory on a fake `GET /api/reef/services`.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { REEF_SERVICES } from "./fixtures";
import { formatPrice } from "./reef";
import { ReefPage } from "./reef-page";

function stubMedia(phone: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: phone,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
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
  stubMedia(false);
});
afterEach(() => vi.unstubAllGlobals());

function fakeReef(body: unknown, init?: ResponseInit) {
  const fetchMock = vi.fn(async (_url: RequestInfo | URL) => Response.json(body, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <ReefPage />
      </QueryClientProvider>,
    ),
  };
}

const names = () =>
  screen.getAllByTestId("reef-row").map((r) => within(r).getAllByRole("cell")[0]?.textContent);

describe("Reef directory (H4)", () => {
  it("lists every service with price, address and docs link", async () => {
    const fetchMock = fakeReef(REEF_SERVICES);
    renderPage();

    await screen.findAllByTestId("reef-row");
    expect(names()).toEqual(REEF_SERVICES.map((s) => s.name));
    const first = screen.getAllByTestId("reef-row")[0] as HTMLElement;
    expect(first.textContent).toContain("$0.01");
    expect(screen.getByRole("columnheader", { name: "Price (USDC per call)" })).toBeDefined();
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/reef/services");

    const docs = within(first).getByRole("link");
    expect(docs.getAttribute("href")).toBe(REEF_SERVICES[0]?.docsUrl);
    expect(docs.getAttribute("target")).toBe("_blank");
    expect(docs.getAttribute("rel")).toContain("noopener");
    expect(screen.getAllByTestId("glossary-term")[0]?.dataset.term).toBe("services");
  });

  it("shows a skeleton while loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderPage();
    expect(screen.getByTestId("reef-loading")).toBeDefined();
  });

  it("search filters by name and by category", async () => {
    fakeReef(REEF_SERVICES);
    renderPage();
    await screen.findAllByTestId("reef-row");

    const search = screen.getByLabelText("Search services");
    fireEvent.change(search, { target: { value: "ODDS" } });
    expect(names()).toEqual(["odds"]);

    fireEvent.change(search, { target: { value: "secur" } });
    expect(names()).toEqual(["sui-risk", "contract-lint"]);
  });

  it("category chips filter, and pressing again clears", async () => {
    fakeReef(REEF_SERVICES);
    renderPage();
    await screen.findAllByTestId("reef-row");

    fireEvent.click(screen.getByRole("button", { name: "Filter by Markets" }));
    expect(names()).toEqual(["odds", "whale-watch"]);
    fireEvent.click(screen.getByRole("button", { name: "Filter by Markets" }));
    expect(names()).toHaveLength(REEF_SERVICES.length);
  });

  it("combines search and chip", async () => {
    fakeReef(REEF_SERVICES);
    renderPage();
    await screen.findAllByTestId("reef-row");

    fireEvent.click(screen.getByRole("button", { name: "Filter by Security" }));
    fireEvent.change(screen.getByLabelText("Search services"), { target: { value: "lint" } });
    expect(names()).toEqual(["contract-lint"]);
  });

  it("says No services match when nothing does", async () => {
    fakeReef(REEF_SERVICES);
    renderPage();
    await screen.findAllByTestId("reef-row");

    fireEvent.change(screen.getByLabelText("Search services"), { target: { value: "zzz" } });
    expect(screen.getByText("No services match")).toBeDefined();
    expect(screen.queryAllByTestId("reef-row")).toHaveLength(0);
  });

  it("copies the payTo address", async () => {
    fakeReef(REEF_SERVICES);
    const writeText = vi.fn(async (_v: string) => {});
    vi.stubGlobal("navigator", { clipboard: { writeText } });
    renderPage();

    const row = (await screen.findAllByTestId("reef-row"))[0] as HTMLElement;
    fireEvent.click(within(row).getByRole("button", { name: "Copy sui-risk address" }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(REEF_SERVICES[0]?.payTo));
  });

  it.each([
    ["404", { error: "not found" }, { status: 404 }],
    ["500", { error: "boom" }, { status: 500 }],
    ["a body that is not a list", { services: [] }, undefined],
  ])("degrades quietly on %s", async (_n, body, init) => {
    fakeReef(body, init);
    renderPage();

    expect((await screen.findByTestId("reef-error")).textContent).toContain(
      "The services directory isn't available yet",
    );
    expect(screen.queryAllByTestId("reef-row")).toHaveLength(0);
  });

  it("drops rows that fail the schema and keeps the rest", async () => {
    const bad = { ...REEF_SERVICES[1], priceUsdc: "1.5" };
    fakeReef([REEF_SERVICES[0], bad, { name: "x" }, null, REEF_SERVICES[2]]);
    renderPage();

    await screen.findAllByTestId("reef-row");
    expect(names()).toEqual([REEF_SERVICES[0]?.name, REEF_SERVICES[2]?.name]);
  });

  it("resets the category filter when its chip disappears from the data", async () => {
    fakeReef(REEF_SERVICES);
    const { client } = renderPage();
    await screen.findAllByTestId("reef-row");

    fireEvent.click(screen.getByRole("button", { name: "Filter by Markets" }));
    expect(names()).toEqual(["odds", "whale-watch"]);

    const security = REEF_SERVICES.filter((s) => s.category === "Security");
    fakeReef(security);
    await client.invalidateQueries();
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Filter by Markets" })).toBeNull(),
    );
    expect(names()).toEqual(security.map((s) => s.name));
  });

  it("says so when the Reef has no services", async () => {
    fakeReef([]);
    renderPage();
    expect(await screen.findByText("No services yet")).toBeDefined();
  });

  it("renders cards instead of a table on a phone", async () => {
    stubMedia(true);
    fakeReef(REEF_SERVICES);
    renderPage();

    expect(await screen.findAllByTestId("reef-card")).toHaveLength(REEF_SERVICES.length);
    expect(screen.queryByRole("table")).toBeNull();
    const card = screen.getAllByTestId("reef-card")[3] as HTMLElement;
    expect(card.textContent).toContain("whale-watch");
    expect(card.textContent).toContain("$0.015 per call");
    expect(within(card).getByRole("link").getAttribute("rel")).toContain("noopener");
  });
});

describe("formatPrice", () => {
  it("shows cents, sub-cent precision and free", () => {
    expect(formatPrice("10000")).toBe("$0.01");
    expect(formatPrice("15000")).toBe("$0.015");
    expect(formatPrice("2000000")).toBe("$2.00");
    expect(formatPrice("0")).toBe("Free");
  });
});
