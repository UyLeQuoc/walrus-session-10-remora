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
    expect(identityHeaders()["x-remora-session"]).toBe(sessionId);
  });

  it("sends nothing when there is no stored session", () => {
    expect(identityHeaders()["x-remora-session"]).toBeUndefined();
  });

  it("moves a session stored under the hippo name (D10)", () => {
    const sessionId = "cd".repeat(32);
    memory.set("hippo.session", sessionId);
    expect(identityHeaders()["x-remora-session"]).toBe(sessionId);
    expect(memory.get("remora.session")).toBe(sessionId);
    expect(memory.has("hippo.session")).toBe(false);
  });
});
