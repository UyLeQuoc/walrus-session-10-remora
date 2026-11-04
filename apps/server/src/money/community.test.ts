import { normalizeSuiAddress } from "@mysten/sui/utils";
import { describe, expect, it } from "vitest";
import { listingMessage, listingsOf, probeX402 } from "./community.ts";

const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
const PAY_TO = normalizeSuiAddress("0x5e11");
const offer = (o: Record<string, unknown> = {}) => ({
  scheme: "exact",
  network: "sui:testnet",
  asset: USDC,
  payTo: PAY_TO,
  amount: "5000",
  description: "A haiku about your question",
  ...o,
});
const serving = (status: number, body: unknown) =>
  (async () => Response.json(body, { status })) as unknown as typeof fetch;
const probe = (url: string, f: typeof fetch, allowPrivate = true) =>
  probeX402(url, { usdc: USDC, allowPrivate, fetch: f, resolve: async () => ["93.184.216.34"] });

describe("listing an API (E8, ADR-0113)", () => {
  it("reads the price and the address from its 402", async () => {
    const p = await probe(
      "http://localhost:8790/haiku?q=x",
      serving(402, { accepts: [offer({ network: "sui:mainnet" }), offer()] }),
    );
    expect(p).toEqual({
      url: "http://localhost:8790/haiku",
      payTo: PAY_TO,
      price: "5000",
      description: "A haiku about your question",
    });
  });

  it("refuses what isn't a cheap, exact USDC payment on testnet", async () => {
    await expect(probe("http://x.test/a", serving(200, {}))).rejects.toMatchObject({
      code: "listing.not_x402",
    });
    await expect(
      probe("http://x.test/a", serving(402, { accepts: [offer({ asset: "0x2::sui::SUI" })] })),
    ).rejects.toMatchObject({ code: "listing.no_offer" });
    await expect(
      probe("http://x.test/a", serving(402, { accepts: [offer({ amount: "200000" })] })),
    ).rejects.toMatchObject({ code: "listing.too_dear" });
  });

  it("on a deployed host, lists public https only", async () => {
    const f = serving(402, { accepts: [offer()] });
    await expect(probe("http://example.com/a", f, false)).rejects.toMatchObject({
      code: "listing.bad_url",
    });
    await expect(
      probeX402("https://intranet.test/a", {
        usdc: USDC,
        allowPrivate: false,
        fetch: f,
        resolve: async () => ["10.0.0.7"],
      }),
    ).rejects.toMatchObject({ code: "listing.private" });
    expect((await probe("https://example.com/a", f, false)).payTo).toBe(PAY_TO);
  });

  it("the owner signs exactly what was found, and bad rows are ignored", () => {
    const m = listingMessage({
      url: "https://example.com/haiku",
      payTo: PAY_TO,
      price: "5000",
      description: "",
      slug: "haiku",
      lister: "0xabc",
    });
    expect(m).toContain("Name: @haiku");
    expect(m).toContain(`Paid to: ${PAY_TO}`);
    expect(m).toContain("This signs nothing else");
    expect(listingsOf({ listings: [{ slug: "Bad Name", url: "x", payTo: "y" }, null] })).toEqual(
      [],
    );
  });
});
