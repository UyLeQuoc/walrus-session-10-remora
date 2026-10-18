import { describe, expect, it } from "vitest";
import { isRateLimited, PacedTransport } from "./paced.ts";
import { withRetry } from "./retry.ts";
import { tatumGrpcUrl, tatumSuiOptionsFromEnv } from "./tatum.ts";

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
    expect(opts).toEqual({ network: "testnet", apiKey: "test", url: "https://example.test" });
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

  it("knows a 429 from other UNAVAILABLEs", () => {
    expect(isRateLimited(tooMany())).toBe(true);
    expect(
      isRateLimited(Object.assign(new Error("connection reset"), { code: "UNAVAILABLE" })),
    ).toBe(false);
  });
});
