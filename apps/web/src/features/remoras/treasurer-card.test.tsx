import { RemoraView } from "@remora/schema";
import scoutJson from "@remora/schema/fixtures/remora-view.scout.json";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TreasurerCard } from "./treasurer-card";
import { parseWatch, units } from "./treasury-api";

// The owner's wallet signs in the browser; here it hands back fixed bytes.
vi.mock("@mysten/dapp-kit", () => ({
  useSignTransaction: () => ({
    mutateAsync: async () => ({ bytes: "U2lnbmVkQnl0ZXM=", signature: "c2ln" }),
  }),
}));
vi.mock("@mysten/sui/transactions", () => ({ Transaction: { from: (x: string) => x } }));

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

const treasurer = { ...RemoraView.parse(scoutJson), template: "treasurer" };
const OPS = `0x${"a".repeat(64)}`;
const HUY = `0x${"4".repeat(64)}`;

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

const view = {
  watch: [{ address: OPS, label: "Ops", suins: null }],
  contacts: [{ name: "Huy", address: HUY, suins: "huy.sui" }],
  limits: { perRequestCap: "1000000", monthlyCap: "10000000", askedThisMonth: "300000" },
  reports: [
    {
      id: "rep1",
      at: "2026-11-05T02:00:00Z",
      lines: [],
      shareUrl: null,
      report: {
        from: "2026-10-29",
        to: "2026-11-05",
        days: 7,
        transfers: 1,
        coins: [
          {
            coinType: "0x2::sui::SUI",
            symbol: "SUI",
            decimals: 9,
            in: "0",
            out: "2000",
            internal: "10000000",
            balance: "3000000000",
            burnPerDay: "285",
            runwayDays: 10500,
          },
        ],
        addresses: [],
        counterparties: [],
      },
    },
  ],
  pending: [
    {
      approvalId: "ap1",
      summary: "Pay 0.30 USDC to Huy for design? Asked by webhook invoices.",
      payTo: HUY,
      amount: "300000",
      reason: "design",
      suins: "huy.sui",
      from: "webhook invoices",
      checks: [
        { ok: true, text: "Huy (huy.sui) is a contact." },
        { ok: false, text: "Asked by webhook invoices, not you, so only your signature pays it." },
      ],
      createdAt: "2026-11-05T03:00:00Z",
    },
  ],
};

describe("the Treasurer's card (ADR-0148)", () => {
  it("shows what it watches, the runway, and a request it never pays itself", async () => {
    const calls = serve({
      [`GET /api/remoras/${treasurer.id}/treasury`]: view,
      "POST /api/approvals/ap1/pay-tx": { transaction: "{}", requirements: null },
      "POST /api/approvals/ap1/pay": {
        answer: "You paid Huy 0.3 USDC for design.",
        digest: "PaidD1g3st",
        eventId: "e1",
      },
    });
    render(
      <MemoryRouter>
        <TreasurerCard r={treasurer} />
      </MemoryRouter>,
    );
    expect((await screen.findByTestId("treasury-watch")).textContent).toContain("Ops");
    expect(screen.getByTestId("treasury-runway").textContent).toBe(
      "Holds 3.00: 10500 days at 0.000000285 a day",
    );
    const request = screen.getByTestId("treasury-request");
    expect(request.textContent).toContain("Asked by webhook invoices");
    expect(request.textContent).toContain("only your signature pays it");
    await userEvent.click(screen.getByTestId("treasury-pay"));
    expect((await screen.findByTestId("treasury-answer")).textContent).toContain(
      "You paid Huy 0.3 USDC for design.",
    );
    // The owner's own wallet signed it; the server only sent it.
    expect(calls.find((c) => c.key === "POST /api/approvals/ap1/pay")?.body).toEqual({
      transaction: "U2lnbmVkQnl0ZXM=",
      signature: "c2ln",
    });
  });
});

describe("team addresses in plain lines", () => {
  it("reads a label and an address or a name per line", () => {
    expect(parseWatch(`Ops ${OPS}\nhuy.sui\nDesign: @linh\nnot an address`)).toEqual([
      { label: "Ops", address: OPS },
      { address: "huy.sui" },
      { label: "Design", address: "@linh" },
    ]);
    expect(units("300000", 6)).toBe("0.30");
  });
});
