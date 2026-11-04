import { RemoraView } from "@remora/schema";
import scoutJson from "@remora/schema/fixtures/remora-view.scout.json";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BuyFromCard, SellCard } from "./sell-card";

// The wallet signs in the browser; here it just hands back a digest.
vi.mock("@/features/funds/sign", () => ({ useSignAndRun: () => async () => "S1gnedD1g3st" }));

beforeEach(() =>
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
afterEach(() => vi.unstubAllGlobals());

const scout = RemoraView.parse(scoutJson);
const onSale = {
  sale: { on: true, slug: "uy-researcher", price: "20000", blurb: "Sui checks" },
  listed: true,
  ref: "reef:remora-uy-researcher",
  url: "http://api.test/api/x402/r/uy-researcher",
  path: "/api/x402/r/uy-researcher",
  sold: [
    { at: "2026-11-05T02:00:00Z", buyer: "0x5c24ba37ce51", amount: "20000", digest: "S0ldD1g3st" },
  ],
  earned: "20000",
};

function serve(routes: Record<string, unknown>, calls: { key: string; body: unknown }[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${String(input).split("?")[0]}`;
      calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : null });
      const hit = routes[key];
      return hit === undefined ? new Response("{}", { status: 404 }) : Response.json(hit);
    }),
  );
  return calls;
}

describe("selling answers (ADR-0111)", () => {
  it("shows the remora on sale, its paid door, and each sale's receipt", async () => {
    serve({ [`GET /api/remoras/${scout.id}/sell`]: onSale });
    render(
      <MemoryRouter>
        <SellCard r={scout} />
      </MemoryRouter>,
    );
    expect((await screen.findByTestId("sell-listed")).textContent).toContain(
      "On sale as @uy-researcher · 0.02 USDC an answer",
    );
    const sold = screen.getByTestId("sell-sold");
    expect(sold.textContent).toContain("1 sold · 0.02 USDC earned");
    expect(within(sold).getAllByTestId("sell-receipt")).toHaveLength(1);
  });

  it("puts it on sale with the name, price and line its owner typed", async () => {
    const calls = serve({
      [`GET /api/remoras/${scout.id}/sell`]: { ...onSale, sale: null, listed: false, sold: [] },
      [`PUT /api/remoras/${scout.id}/sell`]: onSale,
    });
    render(
      <MemoryRouter>
        <SellCard r={scout} />
      </MemoryRouter>,
    );
    await userEvent.type(await screen.findByLabelText("Its name in the Reef"), "@uy-researcher");
    await userEvent.type(screen.getByLabelText("Price per answer, USDC"), "0.02");
    await userEvent.click(screen.getByRole("button", { name: "Sell its answers" }));
    const put = calls.find((c) => c.key.startsWith("PUT"));
    expect(put?.body).toEqual({ on: true, slug: "uy-researcher", price: "20000", blurb: "" });
  });

  it("lists remoras on sale it may buy from, and which it already pays", async () => {
    serve({
      "GET /api/reef/services": [
        {
          name: "price",
          category: "Markets",
          priceUsdc: "5000",
          payTo: "0x99",
          docsUrl: "https://x.test",
          kind: "house",
        },
        {
          name: "@uy-researcher",
          category: "Remoras",
          priceUsdc: "20000",
          payTo: "0x0f",
          docsUrl: "https://x.test",
          kind: "remora",
          description: "Sui checks",
        },
      ],
    });
    render(
      <MemoryRouter>
        <BuyFromCard r={scout} onChanged={() => {}} />
      </MemoryRouter>,
    );
    const list = await screen.findByRole("list", { name: "Remoras on sale" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(1);
    expect(list.textContent).toContain("@uy-researcher");
    expect(within(list).getByRole("button", { name: "Let it pay" })).toBeTruthy();
  });
});
