/**
 * The ask has to survive a reload, because the reload is the demonstration.
 */

import type { RemoraView } from "@remora/schema";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exampleSet,
  fillOf,
  POOL,
  rememberPendingAsk,
  remoraFor,
  takePendingAsk,
} from "./examples";

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

describe("the example pool (ADR-0105)", () => {
  const view = (template: string, status: string, id: string) =>
    ({ id, template, status }) as unknown as RemoraView;

  it("deals one of each kind in the first sets, and every card over enough rounds", () => {
    const sets = [0, 1, 2].map((n) => exampleSet(POOL, n));
    for (const set of sets)
      expect(new Set(set.map((e) => e.kind))).toEqual(
        new Set(["pays", "learns", "remembers", "proves"]),
      );
    const seen = new Set(
      Array.from({ length: POOL.length }, (_, n) => exampleSet(POOL, n))
        .flat()
        .map((e) => e.text),
    );
    expect(seen.size).toBe(POOL.length);
  });

  it("asks about the owner's own wallet only when someone is signed in (ADR-0106)", () => {
    const xray = POOL.find((e) => e.text === "X-ray my wallet");
    if (!xray) throw new Error("no wallet card");
    expect(fillOf(xray, null)).toBeNull();
    expect(fillOf(xray, "0xabc")).toBe("What does wallet 0xabc hold?");
  });

  it("opens the live remora of a kind before one in practice, and none that is retired", () => {
    const roster = [
      view("scout", "shadow", "s1"),
      view("scout", "active", "s2"),
      view("sentinel", "retired", "w1"),
    ];
    expect(remoraFor(roster, "scout")?.id).toBe("s2");
    expect(remoraFor(roster, "sentinel")).toBeNull();
  });

  it("only says what each place can do", () => {
    // `/chat` remembers and recalls; paying and learning happen in a remora's own thread.
    for (const e of POOL) {
      if (e.kind === "pays") expect(e.target).toBe("scout");
      else if (e.kind === "learns") expect(e.target).toBe("sentinel");
      else if (e.kind === "briefs") expect(e.target).toBe("briefer");
      else expect(e.target).toBe("chat");
    }
    // A fill is a command, a full link, or a question about the owner's own wallet.
    for (const e of POOL)
      if (typeof e.fill === "string")
        expect(e.fill.startsWith("/") || e.fill.includes("https://")).toBe(true);
  });
});
