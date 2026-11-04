import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { StatsPage } from "./stats-page";

beforeEach(() => {
  const m = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  });
});
afterEach(() => vi.unstubAllGlobals());

const rails = (n: number) => ({
  remoras: n,
  activeRemoras: 3,
  paidCalls: 1043,
  usdcMoved: "6795000",
  anchored: 1012,
  blocked: 61,
  sales: 2,
});

describe("stats (U17 D3)", () => {
  it("shows the rails' numbers and the latest dated load run, from the API only", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          rails: { testnet: rails(87), mainnet: rails(0) },
          loadRun: {
            at: "2026-11-05T02:00:00.000Z",
            label: "The payment rails under load, with the model out of the loop.",
            remoras: 50,
            steps: [
              {
                concurrency: 1,
                calls: 40,
                paid: 40,
                seconds: 260,
                paymentsPerMinute: 9.2,
                p50Ms: 6400,
                p95Ms: 8100,
                p99Ms: 9000,
              },
            ],
            paidCalls: 1000,
            paidUsdc: "6250000",
            mustFail: { attempts: 50, stopped: 50 },
            overspends: 0,
          },
        }),
      ),
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <StatsPage />
      </QueryClientProvider>,
    );
    const stats = await screen.findByTestId("stats");
    expect(stats.textContent).toContain("1043");
    expect(stats.textContent).toContain("6.795");
    const load = screen.getByTestId("stats-load");
    expect(load.textContent).toContain("50/50");
    expect(within(load).getAllByTestId("stats-step")[0]?.textContent).toContain("9.2");
  });
});
