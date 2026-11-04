import { normalizeSuiAddress } from "@mysten/sui/utils";
import {
  encodeHeader,
  encodeMpp,
  MPP_CHALLENGE_HEADER,
  PAYMENT_HEADER,
  parseChallenges,
} from "@remora/disc-sdk";
import { Hono } from "hono";
import { describe, expect, it } from "vitest";
import { retryingFetch, SourceInputError, sourceFirst } from "./source-first.ts";
import { type PaidContext, x402 } from "./x402.ts";

const FACILITATOR = "http://facilitator.test";
const pay = (calls: string[]) => ({
  amount: "5000",
  networks: {
    testnet: {
      payTo: normalizeSuiAddress("0x3e"),
      asset: `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`,
      facilitatorUrl: FACILITATOR,
    },
  },
  fetch: (async (input: string | URL | Request) => {
    const path = new URL(String(input)).pathname;
    calls.push(path);
    return Response.json(
      path === "/verify"
        ? { isValid: true, payer: "0xpayer" }
        : { success: true, transaction: "D1g3st", payer: "0xpayer" },
    );
  }) as typeof fetch,
});
const header = encodeHeader({ x402Version: 2, network: "sui:testnet", payload: {} });

function app(load: () => Promise<string>, calls: string[]) {
  const a = new Hono<{ Variables: { source: string; x402: PaidContext } }>();
  a.get(
    "/thing",
    sourceFirst(load, (c) => {
      if (c.req.query("bad")) throw new SourceInputError("bad_input", "That isn't a thing.");
    }),
    x402(pay(calls)),
    (c) => c.json({ source: c.get("source") }),
  );
  return a;
}

describe("sourceFirst (ADR-0106)", () => {
  it("only checks the input on the first, unpaid call, and lets x402 answer 402", async () => {
    let loads = 0;
    const calls: string[] = [];
    const a = app(async () => {
      loads++;
      return "data";
    }, calls);
    expect((await a.request("/thing")).status).toBe(402);
    expect((await a.request("/thing?bad=1")).status).toBe(400);
    expect(loads).toBe(0);
  });

  it("answers 502 before any payment when the source fails, so nothing is charged", async () => {
    const calls: string[] = [];
    const a = app(async () => {
      throw new Error("upstream 503");
    }, calls);
    const res = await a.request("/thing", { headers: { [PAYMENT_HEADER]: header } });
    expect(res.status).toBe(502);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "source.unavailable",
    );
    expect(calls).toEqual([]);
  });

  it("loads first, then settles, then serves what it loaded", async () => {
    const calls: string[] = [];
    const order: string[] = [];
    const a = app(async () => {
      order.push(`load before ${calls.length} facilitator calls`);
      return "fresh data";
    }, calls);
    const res = await a.request("/thing", { headers: { [PAYMENT_HEADER]: header } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ source: "fresh data" });
    expect(order).toEqual(["load before 0 facilitator calls"]);
    expect(calls).toEqual(["/verify", "/settle"]);
  });

  it("treats an MPP credential as a payment: loads for its network, then MPP settles (ADR-0120)", async () => {
    const calls: string[] = [];
    const loaded: (string | null)[] = [];
    const a = new Hono<{ Variables: { source: string; x402: PaidContext } }>();
    a.get(
      "/thing",
      sourceFirst(async (_c, network) => {
        loaded.push(network);
        return "fresh data";
      }),
      x402(pay(calls)),
      (c) => c.json({ source: c.get("source") }),
    );
    const unpaid = await a.request("/thing");
    const [challenge] = parseChallenges(unpaid.headers.get(MPP_CHALLENGE_HEADER));
    const credential = encodeMpp({ challenge, payload: { transaction: "dHg", signature: "c2ln" } });
    const res = await a.request("/thing", { headers: { authorization: `Payment ${credential}` } });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ source: "fresh data" });
    expect(loaded).toEqual(["testnet"]);
    expect(calls).toEqual(["/verify", "/settle"]);
  });
});

describe("sourceFirst early, and retryingFetch (ADR-0106)", () => {
  it("with early, reads the source on the first call, before any sponsorship", async () => {
    let loads = 0;
    const a = new Hono<{ Variables: { source: string; x402: PaidContext } }>();
    a.get(
      "/thing",
      sourceFirst(
        async () => {
          loads++;
          throw new Error("down");
        },
        undefined,
        { early: true },
      ),
      x402(pay([])),
      (c) => c.json({}),
    );
    expect((await a.request("/thing")).status).toBe(502);
    expect(loads).toBe(1);
  });

  it("tries once more after a network error, not after an HTTP error", async () => {
    let calls = 0;
    const flaky = retryingFetch(
      (async () => {
        calls++;
        if (calls === 1) throw new TypeError("fetch failed");
        return new Response("ok");
      }) as typeof fetch,
      0,
    );
    expect(await (await flaky("http://x.test")).text()).toBe("ok");
    expect(calls).toBe(2);
    let errors = 0;
    const failing = retryingFetch(
      (async () => {
        errors++;
        return new Response("no", { status: 503 });
      }) as typeof fetch,
      0,
    );
    expect((await failing("http://x.test")).status).toBe(503);
    expect(errors).toBe(1);
  });
});
