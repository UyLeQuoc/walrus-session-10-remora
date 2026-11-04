import { RemoraView } from "@remora/schema";
import scoutJson from "@remora/schema/fixtures/remora-view.scout.json";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HooksCard } from "./hooks-card";

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
const base = `/api/remoras/${scout.id}/hooks`;
const SECRET = "a".repeat(64);
const view = {
  wakes: true,
  inbound: [{ id: "hook1234abcd", name: "github", url: `https://api.test${base}/hook1234abcd` }],
  price: [
    {
      id: "p1",
      symbol: "SUI",
      above: null,
      below: 0.85,
      paused: false,
      side: "inside",
      usd: 0.93,
      at: "2026-11-05T12:00:00Z",
    },
  ],
  out: [{ id: "o1", url: "https://hooks.example.com/remora", events: ["payment.settled"] }],
  deliveries: [
    {
      id: "e1",
      hookId: "o1",
      type: "payment.settled",
      status: "ok",
      code: 200,
      ms: 84,
      at: "2026-11-05T12:01:00Z",
      attempt: 1,
    },
    {
      id: "e0",
      hookId: "o1",
      type: "answer.ready",
      status: "failed",
      code: 503,
      ms: 120,
      at: "2026-11-05T11:59:00Z",
      attempt: 2,
    },
  ],
  symbols: ["SUI", "WAL", "BTC", "ETH"],
  events: ["payment.settled", "approval.asked", "answer.ready", "proposal.made", "price.hike"],
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

const mount = (r = scout) =>
  render(
    <MemoryRouter>
      <HooksCard r={r} />
    </MemoryRouter>,
  );

describe("the Hooks card (ADR-0121)", () => {
  it("shows the webhook URL, the price trigger with the last price, and the last deliveries", async () => {
    serve({ [`GET ${base}`]: view });
    mount();
    expect((await screen.findByTestId("hook-url")).textContent).toBe(
      `https://api.test${base}/hook1234abcd`,
    );
    const prices = screen.getByRole("list", { name: "Price triggers" });
    expect(prices.textContent).toContain("SUI");
    expect(prices.textContent).toContain("below 0.85");
    expect(prices.textContent).toContain("now 0.93");
    const rows = screen.getAllByTestId("hook-delivery");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.textContent).toContain("payment.settled");
    expect(rows[0]?.textContent).toContain("200 · 84 ms");
    expect(rows[1]?.textContent).toContain("503 · 120 ms · try 2");
    // No secret until the owner asks for it.
    expect(screen.queryByTestId("hook-secret")).toBeNull();
  });

  it("reveals a webhook's secret only when asked", async () => {
    const calls = serve({
      [`GET ${base}`]: view,
      [`GET ${base}/in/hook1234abcd/secret`]: {
        hook: { ...view.inbound[0], secret: SECRET },
      },
    });
    mount();
    const webhooks = await screen.findByRole("list", { name: "Webhooks" });
    await userEvent.click(within(webhooks).getByRole("button", { name: "Secret" }));
    expect((await screen.findByTestId("hook-secret")).textContent).toBe(SECRET);
    expect(calls.some((c) => c.key === `GET ${base}/in/hook1234abcd/secret`)).toBe(true);
    await userEvent.click(within(webhooks).getByRole("button", { name: "Hide" }));
    expect(screen.queryByTestId("hook-secret")).toBeNull();
  });

  it("adds a price trigger from the asset, the direction and the price", async () => {
    const calls = serve({ [`GET ${base}`]: view, [`POST ${base}/price`]: { trigger: {} } });
    mount();
    await userEvent.selectOptions(await screen.findByLabelText("Asset"), "WAL");
    await userEvent.selectOptions(screen.getByLabelText("Direction"), "above");
    await userEvent.type(screen.getByLabelText("Price in USD"), "0.05");
    const form = screen.getByLabelText("Price in USD").parentElement as HTMLElement;
    await userEvent.click(within(form).getByRole("button", { name: "Add" }));
    expect(calls.find((c) => c.key === `POST ${base}/price`)?.body).toEqual({
      symbol: "WAL",
      above: 0.05,
    });
  });

  it("adds an outbound URL with the events ticked, and sends a test", async () => {
    const calls = serve({
      [`GET ${base}`]: view,
      [`POST ${base}/out`]: {
        hook: { id: "o2", url: "https://example.com/in", events: ["payment.settled"] },
      },
      [`POST ${base}/out/o1/test`]: {
        delivery: { ...view.deliveries[0], type: "test", ms: 12 },
      },
    });
    mount();
    await userEvent.type(await screen.findByLabelText("URL to send to"), "https://example.com/in");
    await userEvent.click(screen.getByLabelText("Asks you"));
    await userEvent.click(screen.getByLabelText("Answered"));
    const events = screen.getByRole("group");
    await userEvent.click(within(events).getByRole("button", { name: "Add" }));
    expect(calls.find((c) => c.key === `POST ${base}/out`)?.body).toEqual({
      url: "https://example.com/in",
      events: ["payment.settled", "approval.asked"],
    });
    await userEvent.click(screen.getByRole("button", { name: "Send test" }));
    expect((await screen.findByTestId("hook-tested")).textContent).toBe("Test: 200 in 12 ms");
  });

  it("a Wallet watcher only sends hooks: it doesn't wake on a price or a webhook", async () => {
    serve({ [`GET ${base}`]: { ...view, wakes: false, inbound: [], price: [] } });
    mount(RemoraView.parse({ ...scoutJson, template: "sentinel" }));
    expect(await screen.findByLabelText("URL to send to")).toBeTruthy();
    expect(screen.queryByLabelText("Asset")).toBeNull();
    expect(screen.queryByRole("button", { name: /New webhook/ })).toBeNull();
  });
});
