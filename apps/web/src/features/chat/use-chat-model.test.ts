/** The model choice survives a reload, and an unknown stored id falls back to the default (§4). */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_MODEL_ID } from "./models";
import { readChatModelId, writeChatModelId } from "./use-chat-model";

let store: Map<string, string>;

beforeEach(() => {
  store = new Map();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
});

describe("the stored chat model", () => {
  it("defaults to the Remora default", () => {
    expect(readChatModelId()).toBe(DEFAULT_MODEL_ID);
  });

  it("round-trips a known id", () => {
    writeChatModelId("anthropic/claude-haiku-5.5");
    expect(store.get("remora.chat-model")).toBe("anthropic/claude-haiku-5.5");
    expect(readChatModelId()).toBe("anthropic/claude-haiku-5.5");
  });

  it("ignores an id that is not in the catalog", () => {
    store.set("remora.chat-model", "gone/model");
    expect(readChatModelId()).toBe(DEFAULT_MODEL_ID);
    writeChatModelId("gone/model");
    expect(store.get("remora.chat-model")).toBe("gone/model");
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
    expect(readChatModelId()).toBe(DEFAULT_MODEL_ID);
    expect(() => writeChatModelId("z-ai/glm-5.3-flash")).not.toThrow();
  });
});
