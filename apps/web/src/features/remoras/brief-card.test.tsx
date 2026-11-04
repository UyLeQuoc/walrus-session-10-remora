import { RemoraView } from "@remora/schema";
import scoutJson from "@remora/schema/fixtures/remora-view.scout.json";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BriefCard } from "./brief-card";

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

const briefer = RemoraView.parse({ ...scoutJson, template: "briefer", name: "Morning brief" });
const view = {
  items: ["SUI and WAL prices", "weather in Hanoi"],
  schedule: { id: "s1", human: "weekdays at 8am", paused: false, next: "2026-11-05T01:00:00Z" },
  last: {
    eventId: "e1",
    at: "2026-11-04T08:00:00Z",
    answer: "SUI 0.91 USD, WAL 0.03 USD. Hanoi: rain likely tomorrow. Cost 0.01 USDC.",
    paid: [
      { payee: "reef:price", amount: "5000", digest: "D1g3stPr1ce" },
      { payee: "reef:weather", amount: "5000", digest: "D1g3stWeather" },
    ],
  },
};

function serve(routes: Record<string, unknown>, calls: string[] = []) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const key = `${init?.method ?? "GET"} ${String(input).split("?")[0]}`;
      calls.push(key);
      const hit = routes[key];
      return hit === undefined ? new Response("{}", { status: 404 }) : Response.json(hit);
    }),
  );
  return calls;
}

describe("a Briefer's brief (ADR-0106)", () => {
  it("shows its list, its schedule, and the last brief with a receipt per purchase", async () => {
    serve({ [`GET /api/remoras/${briefer.id}/brief`]: view });
    render(
      <MemoryRouter>
        <BriefCard r={briefer} onDone={() => {}} />
      </MemoryRouter>,
    );
    const card = await screen.findByTestId("brief-card");
    expect(within(card).getByRole("list", { name: "What it follows" }).textContent).toContain(
      "weather in Hanoi",
    );
    expect(within(card).getByTestId("brief-schedule").textContent).toContain("weekdays at 8am");
    const last = within(card).getByTestId("brief-last");
    expect(last.textContent).toContain("2 paid · 0.01 USDC");
    expect(
      within(last)
        .getAllByTestId("brief-receipt")
        .map((r) => r.textContent),
    ).toEqual([expect.stringContaining("Prices"), expect.stringContaining("Weather")]);
  });

  it("runs now, then shows the new brief", async () => {
    const calls = serve({
      [`GET /api/remoras/${briefer.id}/brief`]: view,
      [`POST /api/remoras/${briefer.id}/brief/run`]: { answer: "ok", eventId: "e2" },
    });
    const onDone = vi.fn();
    render(
      <MemoryRouter>
        <BriefCard r={briefer} onDone={onDone} />
      </MemoryRouter>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /Run now/ }));
    expect(calls).toContain(`POST /api/remoras/${briefer.id}/brief/run`);
    expect(onDone).toHaveBeenCalled();
  });

  it("has nothing to press when it's retired", async () => {
    serve({ [`GET /api/remoras/${briefer.id}/brief`]: view });
    render(
      <MemoryRouter>
        <BriefCard r={briefer} onDone={() => {}} readOnly />
      </MemoryRouter>,
    );
    await screen.findByTestId("brief-card");
    expect(screen.queryByRole("button", { name: /Run now/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Edit list/ })).toBeNull();
  });
});
