import { describe, expect, it } from "vitest";
import { createApp, haiku, priceFrom, USDC_TESTNET } from "./app.ts";

const PAY_TO = `0x${"5e".repeat(32)}`;
const FAC = "http://facilitator.test";

describe("sell an API (E13)", () => {
  it("asks for 0.005 USDC at your address on testnet, with the facilitator's gas station", async () => {
    const res = await createApp({ payTo: PAY_TO, facilitatorUrl: FAC }).request("/haiku?q=walrus");
    expect(res.status).toBe(402);
    const body = (await res.json()) as { accepts: Record<string, unknown>[] };
    expect(body.accepts[0]).toMatchObject({
      network: "sui:testnet",
      amount: "5000",
      asset: USDC_TESTNET,
      payTo: PAY_TO,
      extra: { gasStation: `${FAC}/gas` },
    });
    // ADR-0120: the same 402 is an MPP challenge, in whole USDC as @suimpp/mpp reads it.
    const challenge = res.headers.get("www-authenticate") ?? "";
    expect(challenge).toMatch(
      /^Payment id="[^"]+", realm="localhost", method="sui", intent="charge"/,
    );
    const request = /request="([^"]+)"/.exec(challenge)?.[1] ?? "";
    expect(JSON.parse(Buffer.from(request, "base64url").toString())).toMatchObject({
      amount: "0.005",
      currency: USDC_TESTNET,
      recipient: PAY_TO,
    });
  });

  it("takes PRICE in USDC's smallest units, 5000 when unset, and refuses anything else", () => {
    expect(priceFrom(undefined)).toBe("5000");
    expect(priceFrom(" ")).toBe("5000");
    expect(priceFrom("7500")).toBe("7500");
    expect(priceFrom("007500")).toBe("7500");
    for (const bad of ["0.0075", "0", "-1", "5k"]) expect(() => priceFrom(bad)).toThrow(/PRICE/);
  });

  it("asks for the price it's given", async () => {
    const res = await createApp({
      payTo: PAY_TO,
      facilitatorUrl: FAC,
      price: priceFrom("7500"),
    }).request("/haiku?q=walrus");
    const body = (await res.json()) as { accepts: { amount: string }[] };
    expect(body.accepts[0]?.amount).toBe("7500");
  });

  it("answers once the facilitator verifies and settles the payment", async () => {
    const seen: string[] = [];
    const app = createApp({
      payTo: PAY_TO,
      facilitatorUrl: FAC,
      fetch: (async (input: string | URL | Request) => {
        const path = new URL(String(input)).pathname;
        seen.push(path);
        return Response.json(
          path === "/verify" ? { isValid: true } : { success: true, transaction: "D1g3st" },
        );
      }) as typeof fetch,
    });
    const header = btoa(JSON.stringify({ x402Version: 2, network: "sui:testnet", payload: {} }));
    const res = await app.request("/haiku?q=walrus memory", { headers: { "x-payment": header } });
    expect(res.status).toBe(200);
    expect(((await res.json()) as { haiku: string }).haiku).toBe(haiku("walrus memory"));
    expect(seen).toEqual(["/verify", "/settle"]);
  });
});
