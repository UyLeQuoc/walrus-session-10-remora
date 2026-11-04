/**
 * ADR-0106: the five services added in U16. Each reads its source before the payment, so the tests
 * check both what it answers and that a source that fails never reaches the facilitator.
 */
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import type { X402Options } from "@remora/merchant";
import { describe, expect, it } from "vitest";
import { createGithubApp, healthOf } from "./github.ts";
import { createPriceApp, pricesOf, symbolsIn } from "./price.ts";
import { formatUnits, kindOf, xray } from "./wallet.ts";
import { checkBlob, createWalrusApp, kindOfBytes } from "./walrus.ts";
import { createWeatherApp, forecastFor, sky } from "./weather.ts";

const facilitatorCalls: string[] = [];
const pay: X402Options = {
  amount: "5000",
  networks: {
    testnet: { payTo: "0x3e", asset: "0xa1ec::usdc::USDC", facilitatorUrl: "http://fac.test" },
  },
  fetch: (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    facilitatorCalls.push(path);
    return Response.json(
      path === "/verify"
        ? { isValid: true, payer: "0xb0b" }
        : { success: true, network: "sui:testnet", transaction: "Dg1", payer: "0xb0b" },
    );
  }) as typeof fetch,
};
const paid = {
  "x-payment": Buffer.from(
    JSON.stringify({ x402Version: 1, scheme: "exact", network: "sui:testnet", payload: {} }),
  ).toString("base64"),
};
/** A fetch that answers by URL prefix. */
const web = (routes: [string, () => Response][]) =>
  (async (input: string | URL | Request) => {
    const url = String(input);
    const hit = routes.find(([prefix]) => url.startsWith(prefix));
    return hit ? hit[1]() : new Response("no", { status: 404 });
  }) as typeof fetch;
const down = (async () => new Response("busy", { status: 503 })) as typeof fetch;

describe("price (ADR-0106)", () => {
  it("reads the symbols a question names, or all of them", () => {
    expect(symbolsIn("what's SUI and walrus worth?")).toEqual(["SUI", "WAL"]);
    expect(symbolsIn("bitcoin price")).toEqual(["BTC"]);
    expect(symbolsIn("prices please")).toEqual(["SUI", "WAL", "BTC", "ETH"]);
  });

  it("names the source and when it priced each token", async () => {
    const out = await pricesOf(
      ["SUI"],
      web([
        [
          "https://api.coingecko.com",
          () => Response.json({ sui: { usd: 0.91, last_updated_at: 1_793_779_590 } }),
        ],
      ]),
      1,
    );
    expect(out).toEqual({
      source: "CoinGecko",
      prices: [{ symbol: "SUI", name: "Sui", usd: 0.91, pricedAt: "2026-11-04T08:06:30.000Z" }],
    });
  });

  it("says CoinGecko is down before asking for payment, so nothing is sponsored or charged", async () => {
    const app = createPriceApp({ pay, fetch: down });
    // The first, unpaid call already reads the source: a buyer never reaches the gas station.
    expect((await app.request("/price?symbols=ETH")).status).toBe(502);
    facilitatorCalls.length = 0;
    expect((await app.request("/price?symbols=ETH", { headers: paid })).status).toBe(502);
    expect(facilitatorCalls).toEqual([]);
  });

  it("asks for payment once the source has answered", async () => {
    const app = createPriceApp({
      pay,
      fetch: web([["https://api.coingecko.com", () => Response.json({ bitcoin: { usd: 1 } })]]),
    });
    expect((await app.request("/price?symbols=BTC")).status).toBe(402);
  });
});

describe("weather (ADR-0106)", () => {
  const meteo = web([
    [
      "https://geocoding-api.open-meteo.com",
      () =>
        Response.json({
          results: [{ name: "Hanoi", country: "Vietnam", latitude: 21, longitude: 105.8 }],
        }),
    ],
    [
      "https://api.open-meteo.com",
      () =>
        Response.json({
          timezone: "Asia/Bangkok",
          daily: {
            time: ["2026-11-05"],
            temperature_2m_max: [29],
            temperature_2m_min: [22],
            precipitation_probability_max: [70],
            weather_code: [61],
          },
        }),
    ],
  ]);

  it("names the sky in words", () => {
    expect([sky(0), sky(2), sky(61), sky(95)]).toEqual([
      "clear",
      "partly cloudy",
      "rain",
      "thunderstorms",
    ]);
  });

  it("finds the city, then its forecast", async () => {
    expect(await forecastFor("Hanoi", meteo)).toEqual({
      source: "Open-Meteo",
      place: "Hanoi, Vietnam",
      timezone: "Asia/Bangkok",
      days: [{ date: "2026-11-05", sky: "rain", minC: 22, maxC: 29, rainChance: 70 }],
    });
  });

  it("refuses an unknown city before any payment, and settles a known one", async () => {
    const none = web([["https://geocoding-api", () => Response.json({})]]);
    facilitatorCalls.length = 0;
    expect(
      (
        await createWeatherApp({ pay, fetch: none }).request("/weather?city=Nowhere", {
          headers: paid,
        })
      ).status,
    ).toBe(400);
    expect(facilitatorCalls).toEqual([]);
    const res = await createWeatherApp({ pay, fetch: meteo }).request("/weather?city=Hanoi", {
      headers: paid,
    });
    expect(res.status).toBe(200);
    expect(facilitatorCalls).toEqual(["/verify", "/settle"]);
  });
});

describe("github (ADR-0106)", () => {
  const repo = (o: Record<string, unknown>) =>
    web([
      [
        "https://api.github.com/repos/",
        () =>
          Response.json({
            full_name: "MystenLabs/sui",
            description: "Sui",
            stargazers_count: 7783,
            forks_count: 11000,
            open_issues_count: 864,
            license: { spdx_id: "Apache-2.0" },
            archived: false,
            pushed_at: "2026-11-04T03:57:56Z",
            ...o,
          }),
      ],
    ]);

  it("reports a healthy repo with no flags", async () => {
    const h = await healthOf("MystenLabs", "sui", repo({}), Date.parse("2026-11-04T12:00:00Z"));
    expect(h).toMatchObject({ stars: 7783, license: "Apache-2.0", daysSincePush: 0, flags: [] });
  });

  it("flags an archived repo with no license and an old push", async () => {
    const h = await healthOf(
      "old",
      "thing",
      repo({ archived: true, license: null, pushed_at: "2025-01-01T00:00:00Z" }),
      Date.parse("2026-11-04T00:00:00Z"),
    );
    expect(h.flags).toEqual([
      "archived: no longer maintained",
      "no clear license",
      "no push in 672 days",
    ]);
  });

  it("refuses a repo that doesn't exist before any payment", async () => {
    facilitatorCalls.length = 0;
    const app = createGithubApp({ pay, fetch: web([]) });
    expect((await app.request("/github/no/such-repo", { headers: paid })).status).toBe(400);
    expect((await app.request("/github/bad%20name/x")).status).toBe(400);
    expect(facilitatorCalls).toEqual([]);
  });
});

describe("wallet (ADR-0106)", () => {
  it("writes amounts in each coin's own decimals", () => {
    expect(formatUnits("1500000000", 9)).toBe("1.5");
    expect(formatUnits("19280000", 6)).toBe("19.28");
    expect(formatUnits("7", 0)).toBe("7");
    expect(kindOf("0x2::coin::Coin<0x2::sui::SUI>")).toBe("Coin");
  });

  it("lists what an address holds and the kinds of objects it owns", async () => {
    const client = {
      core: {
        listBalances: async () => ({
          balances: [
            { coinType: "0x2::sui::SUI", balance: "2500000000" },
            { coinType: "0xa1ec::usdc::USDC", balance: "19280000" },
            { coinType: "0xdead::x::X", balance: "0" },
          ],
        }),
        getCoinMetadata: async ({ coinType }: { coinType: string }) => ({
          coinMetadata: coinType.endsWith("SUI")
            ? { symbol: "SUI", decimals: 9 }
            : { symbol: "USDC", decimals: 6 },
        }),
        listOwnedObjects: async () => ({
          objects: [
            { type: "0x2::coin::Coin<0x2::sui::SUI>" },
            { type: "0x2::coin::Coin<0x2::sui::SUI>" },
            { type: "0x2::package::UpgradeCap" },
          ],
          hasNextPage: false,
        }),
      },
    } as unknown as SuiGrpcClient;
    const x = await xray(client, "testnet", "0x5");
    expect(x.coins.map((c) => `${c.amount} ${c.symbol}`)).toEqual(["2.5 SUI", "19.28 USDC"]);
    expect(x.objects).toEqual({
      count: 3,
      more: false,
      kinds: [
        { kind: "Coin", count: 2 },
        { kind: "UpgradeCap", count: 1 },
      ],
    });
  });
});

describe("walrus (ADR-0106)", () => {
  const id = "ZWTWU2C9j72KmioDHtoz236mLXlWs9rdIjY_UwgwL7Y";

  it("tells text, markdown, JSON and binary apart", () => {
    const enc = (s: string) => new TextEncoder().encode(s);
    expect(kindOfBytes(enc("---\nschema: remora.team/v1"))).toBe("markdown");
    expect(kindOfBytes(enc('{"a":1}'))).toBe("json");
    expect(kindOfBytes(enc("hello"))).toBe("text");
    expect(kindOfBytes(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 1]))).toBe("binary");
  });

  it("tries testnet, then mainnet, and reports where it read the blob", async () => {
    const out = await checkBlob(
      id,
      web([
        ["https://aggregator.walrus-testnet", () => new Response("no", { status: 404 })],
        [
          "https://aggregator.walrus-mainnet",
          () =>
            new Response("---\nschema: remora.team/v1\nname: Token desk\n", {
              status: 206,
              headers: { "content-range": "bytes 0-511/806" },
            }),
        ],
      ]),
    );
    expect(out).toMatchObject({ walrus: "mainnet", bytes: 806, kind: "markdown" });
    expect(out.firstLine).toBe("schema: remora.team/v1");
  });

  it("refuses a blob no aggregator has before any payment", async () => {
    facilitatorCalls.length = 0;
    const app = createWalrusApp({ pay, fetch: web([]) });
    const missing = "A".repeat(43);
    expect((await app.request(`/walrus/${missing}`)).status).toBe(400);
    expect((await app.request(`/walrus/${missing}`, { headers: paid })).status).toBe(400);
    expect((await app.request("/walrus/too-short")).status).toBe(400);
    expect(facilitatorCalls).toEqual([]);
  });
});

describe("the demo's attacker (ADR-0108)", () => {
  it("demands payment to the attacker, with an injected instruction, and never serves data", async () => {
    const { createAttackApp, ATTACKER, INJECTION } = await import("./attack.ts");
    const app = createAttackApp({ pay });
    for (const headers of [{}, paid]) {
      const res = await app.request("/market", { headers });
      expect(res.status).toBe(402);
      const body = (await res.json()) as { accepts: { payTo: string; description?: string }[] };
      expect(body.accepts.map((a) => a.payTo)).toEqual([ATTACKER]);
      expect(body.accepts[0]?.description).toBe(INJECTION);
    }
  });

  it("runs only when asked, and never on a deployed host", async () => {
    const { attackAllowed } = await import("./attack.ts");
    expect(attackAllowed({})).toBe(false);
    expect(attackAllowed({ DEMO_ATTACK: "1" })).toBe(true);
    expect(attackAllowed({ DEMO_ATTACK: "1", RAILWAY_ENVIRONMENT: "production" })).toBe(false);
    expect(attackAllowed({ DEMO_ATTACK: "1", NODE_ENV: "production" })).toBe(false);
  });
});
