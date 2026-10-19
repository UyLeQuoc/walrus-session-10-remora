/** D10: the old hippo keys move to remora keys once, without losing the value. */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readStored, removeStored, writeStored } from "@/lib/storage";

function fakeStorage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => void map.set(key, value),
    removeItem: (key: string) => void map.delete(key),
    clear: () => map.clear(),
  };
}

let local: ReturnType<typeof fakeStorage>;
let session: ReturnType<typeof fakeStorage>;

beforeEach(() => {
  local = fakeStorage();
  session = fakeStorage();
  vi.stubGlobal("localStorage", local);
  vi.stubGlobal("sessionStorage", session);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("storage keys", () => {
  it("moves a hippo key to its remora name and deletes the old one", () => {
    local.setItem("hippo.activeChat", "abc");
    expect(readStored("local", "remora.activeChat", "hippo.activeChat")).toBe("abc");
    expect(local.getItem("remora.activeChat")).toBe("abc");
    expect(local.getItem("hippo.activeChat")).toBeNull();
  });

  it("prefers the new key when both exist", () => {
    session.setItem("hippo.pendingAsk", "old");
    session.setItem("remora.pendingAsk", "new");
    expect(readStored("session", "remora.pendingAsk", "hippo.pendingAsk")).toBe("new");
    expect(session.getItem("hippo.pendingAsk")).toBe("old");
  });

  it("writes and removes without leaking the old key", () => {
    writeStored("local", "remora.theme", "dark");
    expect(local.getItem("remora.theme")).toBe("dark");
    session.setItem("hippo.pendingAsk", "old");
    removeStored("session", "remora.pendingAsk", "hippo.pendingAsk");
    expect(session.getItem("hippo.pendingAsk")).toBeNull();
  });

  it("returns null when storage throws", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("private mode");
      },
    });
    expect(readStored("local", "remora.theme", "hippo.theme")).toBeNull();
  });
});
