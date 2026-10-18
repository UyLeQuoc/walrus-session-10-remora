import { describe, expect, it } from "vitest";
import {
  contextWindow,
  conversationTitle,
  gapExpired,
  MAX_CONTEXT_CHARS,
  MAX_CONTEXT_MESSAGES,
  SESSION_GAP_MS,
  sessionStartFor,
  type TranscriptLine,
} from "./transcript.ts";

function line(seq: number, text: string, kind: TranscriptLine["kind"] = "turn"): TranscriptLine {
  return { role: seq % 2 === 1 ? "user" : "assistant", kind, text, seq };
}

describe("conversationTitle", () => {
  it("uses the first line, and caps it so the rail stays one row", () => {
    expect(conversationTitle("Postgres on 5433\nand the rest")).toBe("Postgres on 5433");
    const long = "a".repeat(60);
    expect(conversationTitle(long)).toBe(`${"a".repeat(48)}…`);
    expect(conversationTitle("   ")).toBe("New chat");
  });
});

describe("session gap", () => {
  it("treats exactly six hours as the same session, and one millisecond later as a new one", () => {
    const last = 1_000;
    expect(gapExpired(last, last + SESSION_GAP_MS)).toBe(false);
    expect(gapExpired(last, last + SESSION_GAP_MS + 1)).toBe(true);
  });

  it("starts a session only when nothing earlier can answer, or the silence is long", () => {
    expect(sessionStartFor(0, null, 10)).toBe(true);
    expect(sessionStartFor(2, 10, 10 + SESSION_GAP_MS)).toBe(false);
    expect(sessionStartFor(2, 10, 10 + SESSION_GAP_MS + 1)).toBe(true);
  });
});

describe("contextWindow", () => {
  it("drops commands and keeps the newest turns, oldest first", () => {
    const lines = [
      line(1, "one"),
      line(2, "/help", "command"),
      line(3, "menu", "command"),
      line(4, "two"),
    ];
    expect(contextWindow(lines).map((l) => l.text)).toEqual(["one", "two"]);
  });

  it("stops at twenty turns", () => {
    const lines = Array.from({ length: 25 }, (_, i) => line(i + 1, `m${i + 1}`));
    const window = contextWindow(lines);
    expect(window).toHaveLength(MAX_CONTEXT_MESSAGES);
    expect(window[0]?.text).toBe("m6");
    expect(window.at(-1)?.text).toBe("m25");
  });

  it("keeps the question even when older lines would blow the character budget", () => {
    const older = "x".repeat(MAX_CONTEXT_CHARS);
    const lines = [line(1, older), line(2, "what did we pick?")];
    expect(contextWindow(lines).map((l) => l.text)).toEqual(["what did we pick?"]);
  });
});
