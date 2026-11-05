import { normalizeSuiAddress } from "@mysten/sui/utils";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import {
  bazaarExtension,
  type DoorDiscovery,
  exampleUrl,
  HOUSE_DOORS,
  houseDoor,
} from "./discovery.ts";
import { type DoorPaymentRequired, x402 } from "./x402.ts";

const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
const PAY_TO = normalizeSuiAddress("0x3e");

const door = (discovery?: DoorDiscovery) => {
  const app = new Hono();
  app.get(
    "/weather",
    x402({
      amount: "5000",
      networks: {
        testnet: { payTo: PAY_TO, asset: USDC, facilitatorUrl: "http://facilitator.test" },
      },
      mpp: false,
      ...(discovery ? { discovery } : {}),
    }),
    (c) => c.json({ ok: true }),
  );
  return app;
};

describe("the Bazaar discovery extension (ADR-0141)", () => {
  it("describes a door's input and output, with a schema for them", () => {
    const ext = bazaarExtension(HOUSE_DOORS.weather.discovery);
    expect(ext.info.input).toEqual({
      type: "http",
      method: "GET",
      queryParams: { city: "Lisbon" },
    });
    expect(ext.info.output).toMatchObject({ type: "json", example: { source: "Open-Meteo" } });
    expect(ext.schema).toMatchObject({
      $schema: "https://json-schema.org/draft/2020-12/schema",
      required: ["input"],
      properties: {
        input: {
          required: ["type", "method"],
          properties: {
            type: { const: "http" },
            queryParams: { properties: { city: { type: "string" } }, required: ["city"] },
          },
        },
      },
    });
    expect(ext.routeTemplate).toBeUndefined();
  });

  it("names path parameters and the route template, and leaves optional ones unrequired", () => {
    const github = bazaarExtension(HOUSE_DOORS.github.discovery);
    expect(github.info.input.pathParams).toEqual({ owner: "MystenLabs", repo: "sui" });
    expect(github.routeTemplate).toBe("/github/:owner/:repo");
    const odds = bazaarExtension(HOUSE_DOORS.odds.discovery);
    expect(odds.schema).not.toHaveProperty("properties.input.properties.queryParams.required");
    expect(bazaarExtension().info).toEqual({ input: { type: "http", method: "GET" } });
  });

  it("fills a listed URL's parameters from the examples, in order, and leaves the port alone", () => {
    expect(
      exampleUrl("http://127.0.0.1:8799/github/:owner/:repo", HOUSE_DOORS.github.discovery),
    ).toBe("http://127.0.0.1:8799/github/MystenLabs/sui");
    expect(exampleUrl("https://m.test/wallet/:id", HOUSE_DOORS.wallet.discovery)).toBe(
      "https://m.test/wallet/0x5",
    );
    expect(exampleUrl("https://m.test/weather")).toBe("https://m.test/weather");
  });

  it("covers every house door with a description and an example output", () => {
    expect(Object.keys(HOUSE_DOORS).sort()).toEqual(
      ["brief", "github", "odds", "price", "sui-risk", "walrus", "wallet", "weather"].sort(),
    );
    for (const d of Object.values(HOUSE_DOORS)) {
      expect(d.description.length).toBeGreaterThan(0);
      expect(d.discovery.output?.example).toBeTruthy();
    }
    expect(houseDoor("weather")?.description).toBe("Three-day forecast");
    expect(houseDoor("market")).toBeUndefined();
    expect(houseDoor("toString")).toBeUndefined();
  });

  it("goes in the 402's extensions only on a door that declares it", async () => {
    const declared = (await (
      await door(HOUSE_DOORS.weather.discovery).request("http://m.test/weather?city=Lisbon")
    ).json()) as DoorPaymentRequired;
    expect(declared.extensions?.bazaar).toEqual(bazaarExtension(HOUSE_DOORS.weather.discovery));
    expect(declared.accepts[0]).toMatchObject({ amount: "5000", payTo: PAY_TO });

    const bare = (await (await door().request("http://m.test/weather")).json()) as Record<
      string,
      unknown
    >;
    expect(bare).not.toHaveProperty("extensions");
  });
});
