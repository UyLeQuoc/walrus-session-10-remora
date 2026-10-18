import { afterEach, describe, expect, it } from "vitest";
import { clearActiveChat, readActiveChat, writeActiveChat } from "./active-chat.ts";

afterEach(() => {
  sessionStorage.clear();
});

describe("active chat id", () => {
  it("round-trips a conversation id and refuses anything else", () => {
    expect(readActiveChat()).toBeNull();
    const id = "11111111-1111-4111-8111-111111111111";
    writeActiveChat(id);
    expect(readActiveChat()).toBe(id);
    sessionStorage.setItem("hippo.activeChat", "not-an-id");
    expect(readActiveChat()).toBeNull();
    clearActiveChat();
    expect(readActiveChat()).toBeNull();
  });
});
