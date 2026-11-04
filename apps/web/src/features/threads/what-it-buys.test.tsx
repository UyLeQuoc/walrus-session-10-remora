import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WhatItBuys } from "./what-it-buys";

afterEach(() => vi.unstubAllGlobals());

const show = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <WhatItBuys />
    </QueryClientProvider>,
  );

describe("what a Researcher can buy (ADR-0106)", () => {
  it("lists each service with the Reef's price", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json([
          {
            name: "wallet",
            category: "Onchain",
            priceUsdc: "10000",
            payTo: "0x3e",
            docsUrl: "https://x.test",
          },
          {
            name: "weather",
            category: "Everyday",
            priceUsdc: "5000",
            payTo: "0x3e",
            docsUrl: "https://x.test",
          },
        ]),
      ),
    );
    show();
    const list = within(await screen.findByRole("list", { name: "What it can buy" }));
    expect(list.getAllByRole("listitem").map((li) => li.textContent)).toEqual([
      "Wallet X-ray 0.01 USDC",
      "Weather 0.005 USDC",
    ]);
  });

  it("shows nothing until the Reef answers, rather than a guessed price", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    const { container } = show();
    expect(container.textContent).toBe("");
  });
});
