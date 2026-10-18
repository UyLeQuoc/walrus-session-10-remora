import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { forgetSession, identityHeaders, rememberSession } from "@/lib/api";

describe("identityHeaders", () => {
  const memory = new Map<string, string>();

  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
      removeItem: (key: string) => void memory.delete(key),
    });
  });

  afterEach(() => {
    forgetSession();
    memory.clear();
    vi.unstubAllGlobals();
  });

  it("sends a stored session even when the page is same-origin", () => {
    const sessionId = "ab".repeat(32);
    rememberSession(sessionId);
    expect(identityHeaders()["x-hippo-session"]).toBe(sessionId);
  });

  it("sends nothing when there is no stored session", () => {
    expect(identityHeaders()["x-hippo-session"]).toBeUndefined();
  });
});
