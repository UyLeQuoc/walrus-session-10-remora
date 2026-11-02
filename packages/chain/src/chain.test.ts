import { describe, expect, it } from "vitest";
import {
  FallbackTransport,
  isOutOfCredits,
  publicGrpcUrl,
  resetSuiFallback,
  suiFallback,
} from "./fallback.ts";
import { isRateLimited, PacedTransport, resetTatumUsage, tatumUsage } from "./paced.ts";
import { withRetry } from "./retry.ts";
import { suiFallbackUrl, tatumGrpcUrl, tatumSuiOptionsFromEnv } from "./tatum.ts";

describe("withRetry", () => {
  it("retries UNAVAILABLE and returns the first success", async () => {
    let calls = 0;
    const result = await withRetry(
      async () => {
        calls++;
        if (calls < 3) throw Object.assign(new Error("down"), { code: "UNAVAILABLE" });
        return "ok";
      },
      { baseDelayMs: 1 },
    );
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("doesn't retry errors the chain answered", async () => {
    let calls = 0;
    const failing = withRetry(
      async () => {
        calls++;
        throw Object.assign(new Error("bad"), { code: "INVALID_ARGUMENT" });
      },
      { baseDelayMs: 1 },
    );
    await expect(failing).rejects.toThrow("bad");
    expect(calls).toBe(1);
  });
});

describe("tatumSuiOptionsFromEnv", () => {
  it("uses the _TESTNET keys on testnet", () => {
    const opts = tatumSuiOptionsFromEnv("testnet", {
      TATUM_API_KEY: "main",
      TATUM_API_KEY_TESTNET: "test",
      TATUM_SUI_GRPC_TESTNET: "https://example.test",
    });
    expect(opts).toEqual({
      network: "testnet",
      apiKey: "test",
      url: "https://example.test",
      fallbackUrl: "https://fullnode.testnet.sui.io:443",
    });
  });

  it("falls back to the public fullnode unless SUI_GRPC_FALLBACK says otherwise (ADR-0097)", () => {
    expect(suiFallbackUrl("mainnet", {})).toBe(publicGrpcUrl("mainnet"));
    expect(suiFallbackUrl("testnet", { SUI_GRPC_FALLBACK_TESTNET: "off" })).toBeNull();
    expect(suiFallbackUrl("mainnet", { SUI_GRPC_FALLBACK: "https://node.example:443" })).toBe(
      "https://node.example:443",
    );
  });

  it("throws without an API key", () => {
    expect(() => tatumSuiOptionsFromEnv("mainnet", {})).toThrow("TATUM_API_KEY is not set");
  });

  it("builds the gateway URL per network", () => {
    expect(tatumGrpcUrl("mainnet")).toBe("https://sui-mainnet-grpc.gateway.tatum.io");
  });
});

describe("PacedTransport", () => {
  const method = { name: "GetBalance", service: { typeName: "sui.rpc.v2.StateService" } } as never;
  const ok = (value: object) =>
    ({
      headers: Promise.resolve({}),
      response: Promise.resolve(value),
      status: Promise.resolve({ code: "OK", detail: "" }),
      trailers: Promise.resolve({}),
    }) as never;
  const rejected = (err: Error) => {
    const p = Promise.reject(err);
    p.catch(() => {});
    return { headers: p, response: p, status: p, trailers: p } as never;
  };
  const tooMany = () =>
    Object.assign(new Error("Received HTTP status code 429"), { code: "UNAVAILABLE" });

  it("retries a 429 and resolves with the next answer", async () => {
    let calls = 0;
    const inner = {
      mergeOptions: (o: object) => o,
      unary: () => (++calls < 3 ? rejected(tooMany()) : ok({ answer: 42 })),
    } as never;
    const paced = new PacedTransport(inner, { maxRps: 1000, sleep: async () => {} });
    const call = paced.unary(method, {} as never, {} as never);
    expect(await call.response).toEqual({ answer: 42 });
    expect(calls).toBe(3);
  });

  it("passes other errors straight through", async () => {
    const inner = {
      mergeOptions: (o: object) => o,
      unary: () => rejected(Object.assign(new Error("nope"), { code: "NOT_FOUND" })),
    } as never;
    const paced = new PacedTransport(inner, { maxRps: 1000, sleep: async () => {} });
    await expect(paced.unary(method, {} as never, {} as never).response).rejects.toThrow("nope");
  });

  it("gives a server stream no deadline (it lives until aborted)", () => {
    let seen: { timeout?: unknown } = {};
    const inner = {
      mergeOptions: (o: object) => o,
      serverStreaming: (_m: unknown, _i: unknown, o: { timeout?: unknown }) => {
        seen = o;
        return { responses: { onMessage: () => () => {} } } as never;
      },
    } as never;
    const paced = new PacedTransport(inner, { maxRps: 1000, sleep: async () => {} });
    paced.serverStreaming(method, {} as never, { timeout: 30_000 } as never);
    expect(seen.timeout).toBe(Number.POSITIVE_INFINITY);
  });

  it("counts what it asks Tatum for: requests with retries, and stream frames (ADR-0058)", async () => {
    resetTatumUsage();
    let calls = 0;
    let deliver: (() => void) | null = null;
    const inner = {
      mergeOptions: (o: object) => o,
      unary: () => (++calls < 2 ? rejected(tooMany()) : ok({})),
      serverStreaming: () => ({
        responses: {
          onMessage: (fn: () => void) => {
            deliver = fn;
            return () => {};
          },
        },
      }),
    } as never;
    const paced = new PacedTransport(inner, { maxRps: 1000, sleep: async () => {} });
    await paced.unary(method, {} as never, {} as never).response;
    const stream = { name: "SubscribeCheckpoints" } as never;
    paced.serverStreaming(stream, {} as never, {} as never);
    for (let i = 0; i < 3; i++) (deliver as (() => void) | null)?.();
    expect(tatumUsage()).toEqual({
      GetBalance: 2,
      "SubscribeCheckpoints (frames)": 3,
      "SubscribeCheckpoints (opened)": 1,
    });
  });

  it("knows a 429 from other UNAVAILABLEs", () => {
    expect(isRateLimited(tooMany())).toBe(true);
    expect(
      isRateLimited(Object.assign(new Error("connection reset"), { code: "UNAVAILABLE" })),
    ).toBe(false);
  });
});

describe("FallbackTransport (ADR-0097)", () => {
  const method = { name: "GetObject", service: { typeName: "sui.rpc.v2.LedgerService" } } as never;
  const ok = (value: object) =>
    ({
      headers: Promise.resolve({}),
      response: Promise.resolve(value),
      status: Promise.resolve({ code: "OK", detail: "" }),
      trailers: Promise.resolve({}),
    }) as never;
  const rejected = (err: Error) => {
    const p = Promise.reject(err);
    p.catch(() => {});
    return { headers: p, response: p, status: p, trailers: p } as never;
  };
  const outOfCredits = () =>
    Object.assign(new Error("Received HTTP status code 402"), { code: "UNKNOWN" });
  const transport = (unary: () => unknown, onError?: (fn: (e: Error) => void) => void) => {
    const t = {
      calls: 0,
      streams: 0,
      mergeOptions: (o: object) => o,
      unary: () => {
        t.calls++;
        return unary();
      },
      serverStreaming: () => {
        t.streams++;
        return {
          responses: {
            onError: (fn: (e: Error) => void) => {
              onError?.(fn);
              return () => {};
            },
          },
        };
      },
    };
    return t;
  };

  it("sends a call Tatum refuses with 402 to the fallback, and the next ones until the cool-down ends", async () => {
    resetSuiFallback();
    let now = 1_000;
    let tatumDown = true;
    const tatum = transport(() => (tatumDown ? rejected(outOfCredits()) : ok({ from: "tatum" })));
    const pub = transport(() => ok({ from: "public" }));
    const switches: string[] = [];
    const t = new FallbackTransport(tatum as never, pub as never, {
      network: "testnet",
      coolDownMs: 60_000,
      now: () => now,
      onSwitch: (reason) => switches.push(reason),
    });

    expect(await t.unary(method, {} as never, {} as never).response).toEqual({ from: "public" });
    expect(await t.unary(method, {} as never, {} as never).response).toEqual({ from: "public" });
    expect([tatum.calls, pub.calls]).toEqual([1, 2]);
    expect(switches).toEqual(["Received HTTP status code 402"]);
    expect(suiFallback("testnet", now)).toMatchObject({ since: 1_000, calls: 2 });
    expect(suiFallback("mainnet", now)).toBeNull();

    now += 60_000;
    tatumDown = false;
    expect(await t.unary(method, {} as never, {} as never).response).toEqual({ from: "tatum" });
    expect(suiFallback("testnet", now)).toBeNull();
  });

  it("passes every other error through, and leaves Tatum the primary", async () => {
    resetSuiFallback();
    const tatum = transport(() =>
      rejected(Object.assign(new Error("nope"), { code: "NOT_FOUND" })),
    );
    const pub = transport(() => ok({}));
    const t = new FallbackTransport(tatum as never, pub as never, { network: "testnet" });
    await expect(t.unary(method, {} as never, {} as never).response).rejects.toThrow("nope");
    expect(pub.calls).toBe(0);
    expect(suiFallback("testnet")).toBeNull();
  });

  it("opens the next stream on the fallback once a Tatum stream ends with 402", () => {
    resetSuiFallback();
    let fail: ((e: Error) => void) | undefined;
    const tatum = transport(
      () => ok({}),
      (fn) => {
        fail = fn;
      },
    );
    const pub = transport(() => ok({}));
    const t = new FallbackTransport(tatum as never, pub as never, { network: "mainnet" });
    t.serverStreaming(method, {} as never, {} as never);
    fail?.(outOfCredits());
    t.serverStreaming(method, {} as never, {} as never);
    expect([tatum.streams, pub.streams]).toEqual([1, 1]);
  });

  it("knows Tatum's 402 from other errors", () => {
    expect(isOutOfCredits(outOfCredits())).toBe(true);
    expect(isOutOfCredits(new Error("plan limit exceeded"))).toBe(true);
    expect(isOutOfCredits(new Error("Received HTTP status code 429"))).toBe(false);
  });
});
