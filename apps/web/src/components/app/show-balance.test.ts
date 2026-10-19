/** "Show balance" is on unless the person turned it off (§6). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { readShowBalance, writeShowBalance } from "./show-balance";

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe("the show-balance preference", () => {
  it("defaults to on", () => {
    expect(readShowBalance()).toBe(true);
  });

  it("round-trips off and on", () => {
    writeShowBalance(false);
    expect(store.get("remora.show-balance")).toBe("0");
    expect(readShowBalance()).toBe(false);
    writeShowBalance(true);
    expect(readShowBalance()).toBe(true);
  });

  it("survives storage being unavailable", () => {
    vi.stubGlobal("localStorage", {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
    });
    expect(readShowBalance()).toBe(true);
    expect(() => writeShowBalance(false)).not.toThrow();
  });
});
