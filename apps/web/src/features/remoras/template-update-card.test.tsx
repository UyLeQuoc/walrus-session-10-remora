/**
 * D3 (ADR-0150): the template update card shows the diff with the money part marked "sign"; Accept
 * applies the rest, then the wallet signs the limit and the usual confirm applies it; Decline sends
 * the owner's reason.
 */
import { RemoraView } from "@remora/schema";
import scoutJson from "@remora/schema/fixtures/remora-view.scout.json";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TemplateUpdateCard, updateLine } from "./template-update-card";

vi.mock("@/features/funds/sign", () => ({ useSignAndRun: () => async () => "S1gnedD1g3st" }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

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
const T1 = `0x${"1".repeat(64)}`;
const T2 = `0x${"2".repeat(64)}`;
const budget = {
  coinType: "0x2::usdc::USDC",
  windowLimit: "500000",
  window: "month",
  perPaymentCap: "25000",
  payees: ["reef:brief"],
};
const update = {
  id: "6c1d7e2a-3b4f-4a5e-8d9c-0e1f2a3b4c5d",
  status: "pending",
  template: "Docs digest",
  from: T1,
  to: T2,
  version: 2,
  changes: [
    {
      field: "persona",
      label: "Persona",
      apply: "direct",
      current: "Two lines.",
      next: "Two lines, source first.",
    },
    {
      field: "triggers",
      label: "Triggers",
      apply: "direct",
      current: [],
      next: [{ kind: "price", symbol: "SUI", above: 5, paused: true }],
    },
    {
      field: "budget",
      label: "Spending limit",
      apply: "signature",
      current: { monthlyUsd: 0.3, perPaymentUsd: 0.025 },
      next: { monthlyUsd: 0.5, perPaymentUsd: 0.025 },
    },
  ],
  createdAt: "2026-11-05T02:00:00Z",
  decidedAt: null,
  moneyOpen: false,
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

const base = `/api/remoras/${scout.id}/template-update`;

describe("template update card (D3)", () => {
  it("shows the diff, then accepts and signs the limit separately", async () => {
    const calls = serve({
      [`GET ${base}`]: { open: update, recent: [] },
      [`POST ${base}/${update.id}/accept`]: {
        applied: ["persona", "triggers"],
        skipped: [],
        sign: { kind: "budget", transaction: "TX", budget },
      },
      [`POST /api/remoras/${scout.id}/budget/confirm`]: { remora: scoutJson },
    });
    const onChanged = vi.fn();
    render(
      <MemoryRouter>
        <TemplateUpdateCard r={scout} onChanged={onChanged} />
      </MemoryRouter>,
    );
    const diff = await screen.findByTestId("update-diff");
    expect(diff.textContent).toContain("Two lines, source first.");
    expect(diff.textContent).toContain("SUI above 5 (paused)");
    expect(diff.textContent).toContain("0.50 USDC a month");
    expect(diff.querySelector('[data-field="budget"]')?.textContent).toContain("sign");
    await userEvent.click(screen.getByTestId("update-accept"));
    await waitFor(() =>
      expect(calls.some((c) => c.key === `POST /api/remoras/${scout.id}/budget/confirm`)).toBe(
        true,
      ),
    );
    expect(calls.find((c) => c.key.endsWith("/budget/confirm"))?.body).toEqual({
      digest: "S1gnedD1g3st",
      budget,
    });
    expect(onChanged).toHaveBeenCalled();
  });

  it("declines with a reason, and shows nothing when there's no update", async () => {
    const calls = serve({
      [`GET ${base}`]: { open: update, recent: [] },
      [`POST ${base}/${update.id}/decline`]: { ok: true },
    });
    render(
      <MemoryRouter>
        <TemplateUpdateCard r={scout} />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByTestId("update-decline"));
    await userEvent.type(screen.getByLabelText("Why not? (optional)"), "I like it short");
    await userEvent.click(screen.getByTestId("update-decline-send"));
    await waitFor(() =>
      expect(calls.find((c) => c.key.endsWith("/decline"))?.body).toEqual({
        reason: "I like it short",
      }),
    );

    serve({ [`GET ${base}`]: { open: null, recent: [] } });
    const { container } = render(
      <MemoryRouter>
        <TemplateUpdateCard r={scout} />
      </MemoryRouter>,
    );
    await waitFor(() => expect(container.textContent).toBe(""));
  });

  it("writes each field as a short line", () => {
    expect(updateLine({ field: "rules" }, ["ignore dust", "ping over 1 SUI"])).toBe(
      "ignore dust · ping over 1 SUI",
    );
    expect(updateLine({ field: "triggers" }, [{ kind: "webhook", name: "ci" }])).toBe(
      "Webhook “ci”",
    );
    expect(updateLine({ field: "budget" }, { monthlyUsd: 0.05, perPaymentUsd: 0.015 })).toBe(
      "0.05 USDC a month, at most 0.015 a payment",
    );
  });
});
