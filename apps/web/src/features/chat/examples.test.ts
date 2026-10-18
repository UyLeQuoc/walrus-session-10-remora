/**
 * The ask has to survive a reload, because the reload is the demonstration.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { rememberPendingAsk, takePendingAsk } from "./examples";

describe("the question held across a reload", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("sessionStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
  });

  it("gives the question back exactly once", () => {
    rememberPendingAsk("What do you know about me?");
    expect(takePendingAsk()).toBe("What do you know about me?");
    // Taken, not borrowed: a second reload must not refill the box.
    expect(takePendingAsk()).toBeNull();
  });

  it("returns nothing when none was set", () => {
    expect(takePendingAsk()).toBeNull();
  });

  it("survives storage being unavailable", () => {
    vi.stubGlobal("sessionStorage", {
      getItem() {
        throw new Error("denied");
      },
      setItem() {
        throw new Error("denied");
      },
      removeItem() {
        throw new Error("denied");
      },
    });
    // Private browsing: the reload still happens, the box is just empty.
    expect(() => rememberPendingAsk("x")).not.toThrow();
    expect(takePendingAsk()).toBeNull();
  });
});
