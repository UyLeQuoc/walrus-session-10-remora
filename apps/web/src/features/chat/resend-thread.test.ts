import type { UIMessage } from "ai";
import { describe, expect, it } from "vitest";
import { resendThread } from "./resend-thread";

function turn(id: string, role: "user" | "assistant", text: string): UIMessage {
  return { id, role, parts: [{ type: "text", text }] };
}

const thread = [
  turn("u1", "user", "first"),
  turn("a1", "assistant", "one"),
  turn("u2", "user", "second"),
  turn("a2", "assistant", "two"),
];

describe("resendThread", () => {
  it("retries the last user line and drops the answer", () => {
    const next = resendThread(thread, "second");
    expect(next?.userMessageId).toBe("u2");
    expect(next?.messages.map((message) => message.id)).toEqual(["u1", "a1", "u2"]);
    expect(next?.messages.filter((message) => message.role === "user")).toHaveLength(2);
  });

  it("replaces the last user line with the edited text", () => {
    const next = resendThread(thread, "  second, revised  ");
    const last = next?.messages.at(-1);
    expect(last?.id).toBe("u2");
    expect(last?.parts).toEqual([{ type: "text", text: "second, revised" }]);
    expect(next?.messages.some((message) => message.id === "a2")).toBe(false);
  });

  it("does nothing without a user line or without text", () => {
    expect(resendThread([turn("a1", "assistant", "hi")], "again")).toBeNull();
    expect(resendThread(thread, "   ")).toBeNull();
  });
});
