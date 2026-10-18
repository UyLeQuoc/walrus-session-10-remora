import type { PaidContext, X402Options } from "@remora/merchant";
import { describe, expect, it } from "vitest";
import { createBriefApp, fetchPage, firstSentences, isPrivateAddress, textOf } from "./brief.ts";
import { createOddsApp, oddsFor, SNAPSHOT } from "./odds.ts";

const USDC = "0xa1ec::usdc::USDC";
const settled: string[] = [];
const facilitator = (async (input: string | URL | Request) => {
  const path = new URL(String(input)).pathname;
  settled.push(path);
  if (path === "/verify") return Response.json({ isValid: true, payer: "0xb0b" });
  return Response.json({
    success: true,
    network: "sui:testnet",
    transaction: "Dg1",
    payer: "0xb0b",
  });
}) as typeof fetch;
const pay: X402Options = {
  amount: "10000",
  networks: { testnet: { payTo: "0x3e", asset: USDC, facilitatorUrl: "http://fac.test" } },
  fetch: facilitator,
};
const paidHeader = {
  "x-payment": Buffer.from(
    JSON.stringify({
      x402Version: 1,
      scheme: "exact",
      network: "sui:testnet",
      payload: { signature: "s", transaction: "t" },
    }),
  ).toString("base64"),
};

describe("odds (E9)", () => {
  it("returns the fixtures a query names, or the whole snapshot", () => {
    expect(oddsFor("odds for Arsenal tonight?").map((f) => f.home)).toEqual(["Arsenal"]);
    expect(oddsFor("anything on Barcelona").map((f) => f.away)).toEqual(["Barcelona"]);
    expect(oddsFor("hello")).toHaveLength(SNAPSHOT.fixtures.length);
  });

  it("asks for payment, then answers with the labelled snapshot", async () => {
    const app = createOddsApp({ pay });
    expect((await app.request("/odds?q=Liverpool")).status).toBe(402);
    const res = await app.request("/odds?q=Liverpool", { headers: paidHeader });
    const body = (await res.json()) as { note: string; fixtures: unknown[]; paid: PaidContext };
    expect(body.note).toMatch(/not live/);
    expect(body.fixtures).toHaveLength(1);
    expect(body.paid.transaction).toBe("Dg1");
  });
});

describe("brief (E9)", () => {
  it("knows private addresses", () => {
    for (const ip of [
      "127.0.0.1",
      "10.1.2.3",
      "172.20.0.1",
      "192.168.1.1",
      "169.254.169.254",
      "100.64.0.1",
      "::1",
      "fd00::1",
      "fe80::1",
      "::ffff:127.0.0.1",
    ])
      expect(isPrivateAddress(ip), ip).toBe(true);
    for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700::1111"])
      expect(isPrivateAddress(ip), ip).toBe(false);
  });

  it("never fetches private or non-http targets", async () => {
    const never = (async () => {
      throw new Error("fetched");
    }) as unknown as typeof fetch;
    await expect(fetchPage("http://127.0.0.1/admin", { fetch: never })).rejects.toMatchObject({
      code: "private_address",
    });
    await expect(
      fetchPage("http://metadata.internal/", {
        fetch: never,
        resolve: async () => ["169.254.169.254"],
      }),
    ).rejects.toMatchObject({ code: "private_address" });
    await expect(fetchPage("file:///etc/passwd", { fetch: never })).rejects.toMatchObject({
      code: "bad_url",
    });
  });

  it("reads a public page as text", async () => {
    const page = (async () =>
      new Response(
        "<html><script>x()</script><p>Hello &amp; welcome.</p></html>",
      )) as unknown as typeof fetch;
    expect(
      await fetchPage("https://example.com", {
        fetch: page,
        resolve: async () => ["93.184.216.34"],
      }),
    ).toBe("Hello & welcome.");
    expect(textOf("<b>a</b>  b")).toBe("a b");
    expect(await firstSentences("One. Two! Three? Four.")).toBe("One. Two! Three?");
  });

  it("rejects an empty or bad request before asking for payment", async () => {
    settled.length = 0;
    const app = createBriefApp({ pay });
    expect((await app.request("/brief")).status).toBe(400);
    expect((await app.request("/brief?url=ftp://x")).status).toBe(400);
    expect(settled).toEqual([]);
  });

  it("summarizes text after payment, with the injected summarizer", async () => {
    const app = createBriefApp({ pay, summarize: async (t) => `• ${t.length} chars` });
    expect((await app.request("/brief?text=hello")).status).toBe(402);
    const res = await app.request("/brief?text=hello%20world", { headers: paidHeader });
    expect(await res.json()).toMatchObject({ summary: "• 11 chars", source: "text" });
  });
});
