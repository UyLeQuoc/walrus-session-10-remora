import { describe, expect, it } from "vitest";
import { accessCounter, documentSealId } from "./seal-id.ts";

const OWNER = "0xf8a4da3a751fba566508deb5166196ec5530602a924b3b0c132963e98188fb04";

describe("documentSealId", () => {
  it("matches the identity the mainnet spike decrypted", () => {
    const id = documentSealId(OWNER, 0n);
    expect(id.startsWith("686970706f2d646f63f8a4da")).toBe(true);
    expect(id.endsWith("fb040000000000000000")).toBe(true);
    expect(id).toHaveLength((9 + 32 + 8) * 2);
  });

  it("writes the counter little-endian", () => {
    expect(documentSealId(OWNER, 1n).endsWith("0100000000000000")).toBe(true);
  });
});

describe("accessCounter", () => {
  it("reads the counter as the chain returns it", () => {
    expect(accessCounter({ access_counter_version: "3" })).toBe(3n);
    expect(accessCounter({ access_counter_version: 0 })).toBe(0n);
    expect(accessCounter({})).toBeNull();
    expect(accessCounter(null)).toBeNull();
  });
});
