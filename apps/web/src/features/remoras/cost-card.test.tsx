/**
 * N15/H3: the cost card on a fake `GET /api/remoras/:id/cost`.
 */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { formatCost, formatShare, recentMonths } from "./cost";
import { COST_EMPTY, COST_NORMAL, COST_PURCHASES } from "./cost.fixture";
import { CostCard } from "./cost-card";

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
  // jsdom lacks what Radix Select calls when it opens.
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
});
afterEach(() => vi.unstubAllGlobals());

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <CostCard remoraId="r1" />
    </QueryClientProvider>,
  );
}

function fakeCost(body: unknown, init?: ResponseInit) {
  const fetchMock = vi.fn(async (_url: RequestInfo | URL) => Response.json(body, init));
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("cost card (H3)", () => {
  it("shows a skeleton while loading", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => {})),
    );
    renderCard();
    expect(screen.getByTestId("cost-loading")).toBeDefined();
  });

  it("shows the total and the three rows with their shares", async () => {
    const fetchMock = fakeCost(COST_NORMAL);
    renderCard();

    expect((await screen.findByTestId("cost-total")).textContent).toBe("$2.00");
    const rows = screen.getAllByTestId("cost-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]?.textContent).toContain("Model");
    expect(rows[0]?.textContent).toContain("$1.25");
    expect(rows[0]?.textContent).toContain("63%");
    expect(rows[1]?.textContent).toContain("Gas (sponsored)");
    expect(rows[1]?.textContent).toContain("$0.18");
    expect(rows[2]?.textContent).toContain("Purchases");
    expect(rows[2]?.textContent).toContain("$0.57");
    expect(within(rows[1] as HTMLElement).getByTestId("glossary-term").dataset.term).toBe(
      "sponsored gas",
    );
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(
      `/api/remoras/r1/cost?month=${recentMonths()[0]}`,
    );
  });

  it("shows tiny non-zero amounts as < $0.01, never $0.00", async () => {
    fakeCost(COST_PURCHASES);
    renderCard();

    await screen.findByTestId("cost-total");
    const rows = screen.getAllByTestId("cost-row");
    expect(rows[0]?.textContent).toContain("< $0.01");
    expect(rows[0]?.textContent).toContain("< 1%");
    expect(rows[1]?.textContent).toContain("$0.00");
    expect(rows[2]?.textContent).toContain("$4.50");
  });

  it("shows No spend this month for an empty month", async () => {
    fakeCost(COST_EMPTY);
    renderCard();

    expect((await screen.findByTestId("cost-empty")).textContent).toBe("No spend this month");
    expect(screen.queryAllByTestId("cost-row")).toHaveLength(0);
  });

  it("degrades quietly when the endpoint answers 404", async () => {
    fakeCost({ error: "not found" }, { status: 404 });
    renderCard();

    expect((await screen.findByTestId("cost-error")).textContent).toContain(
      "Cost isn't available yet",
    );
    expect(screen.queryByTestId("cost-total")).toBeNull();
  });

  it.each([
    ["a decimal string", { ...COST_NORMAL, llmUsdc: "1.5" }],
    ["a negative string", { ...COST_NORMAL, gasUsdc: "-1" }],
    ["a missing key", { llmUsdc: "1", gasUsdc: "1" }],
  ])("shows the error state for a malformed payload (%s)", async (_name, body) => {
    fakeCost(body);
    renderCard();

    expect((await screen.findByTestId("cost-error")).textContent).toContain(
      "Cost isn't available yet",
    );
    expect(screen.queryByTestId("cost-total")).toBeNull();
  });

  it("shows the error state when the endpoint answers 500", async () => {
    fakeCost({ error: "boom" }, { status: 500 });
    renderCard();

    expect((await screen.findByTestId("cost-error")).textContent).toContain(
      "Cost isn't available yet",
    );
  });

  it("refetches with the chosen month", async () => {
    const fetchMock = fakeCost(COST_NORMAL);
    renderCard();
    await screen.findByTestId("cost-total");

    const months = recentMonths();
    fireEvent.click(screen.getByRole("combobox", { name: "Month" }));
    const options = await screen.findAllByRole("option");
    expect(options).toHaveLength(6);
    fireEvent.click(options[2] as HTMLElement);

    await vi.waitFor(() => {
      const urls = fetchMock.mock.calls.map((c) => String(c[0]));
      expect(urls.some((u) => u.endsWith(`/cost?month=${months[2]}`))).toBe(true);
    });
  });
});

describe("cost formatting", () => {
  it("rounds to cents and never rounds a non-zero amount to zero", () => {
    expect(formatCost(0n)).toBe("$0.00");
    expect(formatCost(1n)).toBe("< $0.01");
    expect(formatCost(9_999n)).toBe("< $0.01");
    expect(formatCost(10_000n)).toBe("$0.01");
    expect(formatCost(1_996_000n)).toBe("$2.00");
    expect(formatShare(1n, 1_000_000n)).toBe("< 1%");
    expect(formatShare(0n, 0n)).toBe("0%");
  });
});

describe("recentMonths", () => {
  it("crosses into the previous year", () => {
    expect(recentMonths(new Date("2026-01-15T12:00:00Z"))).toEqual([
      "2026-01",
      "2025-12",
      "2025-11",
      "2025-10",
      "2025-09",
      "2025-08",
    ]);
  });

  it("is not thrown by the 31st of a month", () => {
    expect(recentMonths(new Date("2026-03-31T23:59:59Z"))).toEqual([
      "2026-03",
      "2026-02",
      "2026-01",
      "2025-12",
      "2025-11",
      "2025-10",
    ]);
  });
});
