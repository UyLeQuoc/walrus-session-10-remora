import { describe, expect, it } from "vitest";
import { createApp, haiku, USDC_TESTNET } from "./app.ts";

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
