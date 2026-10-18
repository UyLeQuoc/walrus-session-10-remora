import { describe, expect, it } from "vitest";
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
