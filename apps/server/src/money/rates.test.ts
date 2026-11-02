import { describe, expect, it } from "vitest";
import { createSuiUsd, RateUnavailable } from "./rates.ts";

describe("SUI price from Tatum's Data API (N15, ADR-0076)", () => {
  it("fetches once per ttl, keeps the last price through a failure, and needs a key", async () => {
    let t = 0;
    let calls = 0;
    let fail = false;
    const http = (async (_url: string, init?: RequestInit) => {
      calls++;
      expect(((init?.headers ?? {}) as Record<string, string>)["x-api-key"]).toBe("k");
      if (fail) return new Response("no healthy upstream", { status: 503 });
      return Response.json({ value: "0.9", basePair: "USD", symbol: "SUI" });
    }) as typeof fetch;
    const price = createSuiUsd({
      apiKey: "k",
      publicUrl: null,
      fetch: http,
      ttlMs: 1_000,
      now: () => t,
    });
    expect(await price()).toBe(0.9);
    expect(await price()).toBe(0.9);
    expect(calls).toBe(1);
    t = 5_000;
    fail = true;
    expect(await price()).toBe(0.9);
    expect(calls).toBe(2);
    await expect(createSuiUsd({ apiKey: undefined, publicUrl: null })()).rejects.toBeInstanceOf(
      RateUnavailable,
    );
    const broken = createSuiUsd({
      apiKey: "k",
      fetch: (async () => Response.json({ value: "n/a" })) as unknown as typeof fetch,
    });
    await expect(broken()).rejects.toThrow(/no SUI price/);
  });

  it("asks the public price while Tatum answers 402, and reports Tatum's reason if both fail (ADR-0097)", async () => {
    const seen: string[] = [];
    let publicUp = true;
    const http = (async (url: string) => {
      seen.push(new URL(url).hostname);
      if (url.includes("tatum")) return new Response("plan limit exceeded", { status: 402 });
      if (!publicUp) return new Response("", { status: 429 });
      return Response.json({ sui: { usd: 0.91 } });
    }) as typeof fetch;
    expect(await createSuiUsd({ apiKey: "k", fetch: http, publicUrl: "https://p.test/x" })()).toBe(
      0.91,
    );
    expect(seen).toEqual(["api.tatum.io", "p.test"]);
    publicUp = false;
    await expect(
      createSuiUsd({ apiKey: "k", fetch: http, publicUrl: "https://p.test/x" })(),
    ).rejects.toThrow("Tatum's rate API answered 402.");
  });
});
