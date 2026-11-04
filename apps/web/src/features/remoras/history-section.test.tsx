/**
 * N11 (ADR-0122): Settings → History on a fake API: the versions, a version against now, and a
 * restore whose spending limit the wallet signs and the usual confirm applies.
 */
import type { ConfigFieldDiff } from "@remora/schema";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_SCOUT } from "./fixtures";
import { restorePlan, valueLine } from "./history";
import { HistorySection } from "./history-section";

// The wallet signs in the browser; here it just hands back a digest.
vi.mock("@/features/funds/sign", () => ({ useSignAndRun: () => async () => "S1gnedD1g3st" }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const r = FIXTURE_SCOUT;
const budget = r.config.budget ?? {
  coinType: "0x2::usdc::USDC",
  windowLimit: "1000000",
  window: "month" as const,
  perPaymentCap: "50000",
  payees: ["reef:sui-risk"],
};
const V2 = "22222222-2222-4222-8222-222222222222";
const V3 = "33333333-3333-4333-8333-333333333333";
const versions = [
  {
    id: V3,
    revision: 3,
    at: "2026-11-05T10:00:00.000Z",
    summary: "Scout B's budget changed.",
    fields: ["budget"],
    current: true,
  },
  {
    id: V2,
    revision: 2,
    at: "2026-11-05T09:00:00.000Z",
    summary: "Scout B's settings changed (revision 2).",
    fields: ["name", "persona"],
    current: false,
  },
  {
    id: "initial",
    revision: 1,
    at: "2026-11-05T08:00:00.000Z",
    summary: "First version",
    fields: [],
    current: false,
  },
];
const changes: ConfigFieldDiff[] = [
  { field: "name", label: "Name", current: "Scout B", version: "Scout", restore: "direct" },
  {
    field: "budget",
    label: "Spending limit",
    current: { ...budget, payees: undefined, windowLimit: "2000000" },
    version: { ...budget, payees: undefined },
    restore: "signature",
  },
];

function serve() {
  const calls: { key: string; body: unknown }[] = [];
  const routes: Record<string, unknown> = {
    [`GET /api/remoras/${r.id}/history`]: { versions },
    [`GET /api/remoras/${r.id}/history/initial`]: { version: versions[2], changes },
    [`POST /api/remoras/${r.id}/history/initial/restore`]: {
      remora: r,
      applied: ["name"],
      skipped: [],
      sign: { kind: "budget", transaction: "dHg=", budget },
    },
    [`POST /api/remoras/${r.id}/budget/confirm`]: { remora: r },
  };
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${String(input).split("?")[0]}`;
      calls.push({ key, body: init?.body ? JSON.parse(String(init.body)) : null });
      const hit = routes[key];
      return hit === undefined
        ? Response.json({ error: { code: "x", message: "nope" } }, { status: 404 })
        : Response.json(hit);
    }),
  );
  return calls;
}

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("config history (N11)", () => {
  it("lists the versions, compares one with now and restores it, the limit with a signature", async () => {
    const calls = serve();
    const reload = vi.fn();
    render(<HistorySection r={r} reload={reload} />);
    const rows = await screen.findAllByTestId("history-version");
    expect(rows.map((x) => x.textContent?.match(/Revision \d/)?.[0])).toEqual([
      "Revision 3",
      "Revision 2",
      "Revision 1",
    ]);
    expect(rows[0]?.textContent).toContain("Now");
    expect(within(rows[0] as HTMLElement).queryByRole("button", { name: "Compare" })).toBeNull();

    fireEvent.click(within(rows[2] as HTMLElement).getByRole("button", { name: "Compare" }));
    const diff = await screen.findByTestId("history-diff");
    expect(diff.querySelector('[data-field="name"]')?.textContent).toMatch(/NameScout B.*Scout$/);
    expect(diff.querySelector('[data-field="budget"]')?.textContent).toMatch(
      /^Spending limitsignature2\.00 USDC a month, 0\.50 a payment20\.00 USDC a month/,
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore revision 1" }));
    expect(
      await screen.findByText("Name changes now. Spending limit: you sign one transaction."),
    ).toBeDefined();
    fireEvent.click(screen.getByRole("button", { name: "Restore" }));
    await vi.waitFor(() =>
      expect(calls.some((c) => c.key === `POST /api/remoras/${r.id}/budget/confirm`)).toBe(true),
    );
    expect(calls.find((c) => c.key.endsWith("/budget/confirm"))?.body).toEqual({
      digest: "S1gnedD1g3st",
      budget,
    });
    expect(reload).toHaveBeenCalledTimes(2);
  });

  it("reads a retired remora's history without Restore", async () => {
    serve();
    render(<HistorySection r={r} reload={vi.fn()} readOnly />);
    const rows = await screen.findAllByTestId("history-version");
    fireEvent.click(within(rows[2] as HTMLElement).getByRole("button", { name: "Compare" }));
    await screen.findByTestId("history-diff");
    expect(screen.queryByRole("button", { name: /Restore/ })).toBeNull();
  });
});

describe("history lines (N11)", () => {
  it("says each value in a few words", () => {
    expect(valueLine("model", undefined)).toBe("Default");
    expect(valueLine("persona", undefined)).toBe("—");
    expect(valueLine("payees", ["reef:sui-risk", "reef:remora-uy"])).toBe("Sui risk check, @uy");
    expect(valueLine("sell", { on: true, slug: "uy", price: "20000" })).toBe(
      "On sale as @uy · 0.02 USDC",
    );
    expect(valueLine("triggers", [{ kind: "chain", addresses: [`0x${"ab".repeat(32)}`] }])).toBe(
      "Watches 0xabab…abab",
    );
    expect(restorePlan([])).toBe("");
  });
});
