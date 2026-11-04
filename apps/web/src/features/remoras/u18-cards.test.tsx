import { RemoraView } from "@remora/schema";
import scoutJson from "@remora/schema/fixtures/remora-view.scout.json";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrandCard } from "./errand-card";
import { ProposalCard } from "./proposal-card";

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
const budget = {
  coinType: "0x2::usdc::USDC",
  windowLimit: "30000",
  window: "month",
  perPaymentCap: "10000",
  payees: ["reef:sui-risk"],
};
const proposal = {
  id: "a1",
  status: "pending",
  summary: "Raise its monthly limit 0.03 → 0.09 USDC",
  createdAt: "2026-11-05T02:00:00Z",
  decidedAt: null,
  rule: "near_limit",
  from: budget,
  to: { ...budget, windowLimit: "90000" },
  numbers: { spent: "0.03", limit: "0.03", used: "100%", left: "87%" },
  cites: [
    {
      memoryId: "m1",
      blobId: "BYWd9Nk5",
      namespace: "receipts",
      label: "paid 0.01 USDC to Sui risk check",
      at: "2026-11-05",
    },
    {
      memoryId: "m2",
      blobId: "m20SbmPF",
      namespace: "receipts",
      label: "paid 0.01 USDC to Repo health",
      at: "2026-11-05",
    },
  ],
  reason: "I used all of my limit on day one; a raise keeps answering.",
  previous: { rule: "unused", outcome: "declined", reason: "a big month", at: "2026-10-30" },
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

describe("budget proposals (ADR-0124)", () => {
  it("shows the change, its reason, its numbers, the memories it cites and how the last one ended", async () => {
    serve({ [`GET /api/remoras/${scout.id}/proposals`]: { open: proposal, recent: [] } });
    render(
      <MemoryRouter>
        <ProposalCard r={scout} />
      </MemoryRouter>,
    );
    expect((await screen.findByTestId("proposal-summary")).textContent).toBe(proposal.summary);
    expect(screen.getByTestId("proposal-reason").textContent).toBe(proposal.reason);
    const cites = screen.getAllByTestId("proposal-cite");
    expect(cites).toHaveLength(2);
    expect(cites[0]?.getAttribute("href")).toBe(`/memory?remora=${scout.id}&blob=BYWd9Nk5`);
    expect(
      screen.getByText(/Last time \(2026-10-30\) you declined it: "a big month"/),
    ).toBeTruthy();
  });

  it("accepts with one signature, then confirms the digest", async () => {
    const calls = serve({
      [`GET /api/remoras/${scout.id}/proposals`]: { open: proposal, recent: [] },
      "POST /api/approvals/a1/proposal-tx": { transaction: "{}" },
      "POST /api/approvals/a1/proposal-confirm": { digest: "S1gnedD1g3st" },
    });
    render(
      <MemoryRouter>
        <ProposalCard r={scout} />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByTestId("proposal-accept"));
    await vi.waitFor(() =>
      expect(calls.find((c) => c.key === "POST /api/approvals/a1/proposal-confirm")?.body).toEqual({
        digest: "S1gnedD1g3st",
      }),
    );
  });

  it("declines with a reason it will remember", async () => {
    const calls = serve({
      [`GET /api/remoras/${scout.id}/proposals`]: { open: proposal, recent: [] },
      "POST /api/approvals/a1/reject": { ok: true },
    });
    render(
      <MemoryRouter>
        <ProposalCard r={scout} />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByTestId("proposal-decline"));
    await userEvent.type(screen.getByLabelText("Why not? (optional)"), "testing a big month");
    await userEvent.click(screen.getByTestId("proposal-decline-send"));
    await vi.waitFor(() =>
      expect(calls.find((c) => c.key === "POST /api/approvals/a1/reject")?.body).toEqual({
        reason: "testing a big month",
      }),
    );
  });
});

describe("the Errand (ADR-0125)", () => {
  const errand = { ...scout, template: "errand" };
  it("lists its contacts with their usual amount, and pays from one line", async () => {
    const calls = serve({
      [`GET /api/remoras/${scout.id}/contacts`]: {
        contacts: [
          {
            name: "Linh",
            address: `0x${"1".repeat(64)}`,
            ref: "reef:contact-linh",
            usual: "100000",
          },
        ],
      },
      [`POST /api/remoras/${scout.id}/ask`]: {
        answer: "Paid Linh 0.10 USDC for lunch.",
        eventId: "e1",
        outcome: "paid",
        digest: "PaidD1g3st",
      },
    });
    render(
      <MemoryRouter>
        <ErrandCard r={errand} />
      </MemoryRouter>,
    );
    expect((await screen.findByTestId("errand-contact")).textContent).toContain(
      "usually 0.10 USDC",
    );
    await userEvent.type(screen.getByLabelText("Who and how much"), "pay Linh 0.10 USDC for lunch");
    await userEvent.click(screen.getByTestId("errand-pay"));
    expect((await screen.findByTestId("errand-answer")).textContent).toContain(
      "Paid Linh 0.10 USDC for lunch.",
    );
    expect(calls.find((c) => c.key.startsWith("POST"))?.body).toEqual({
      question: "pay Linh 0.10 USDC for lunch",
    });
  });
});
