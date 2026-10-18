import { describe, expect, it } from "vitest";
import { keyboardOf } from "./keyboard.ts";

describe("Telegram keyboard (H1)", () => {
  it("keeps public https links, falls back to callback data for local ones, drops the rest", () => {
    expect(
      keyboardOf([
        { label: "👍", data: "fb:1:u" },
        { label: "Why?", url: "http://localhost:5174/remoras/1", data: "why:1" },
        { label: "Review", url: "https://remora.app/approvals" },
        { label: "Open", url: "http://localhost:5174/x" },
      ]),
    ).toEqual({
      inline_keyboard: [
        [
          { text: "👍", callback_data: "fb:1:u" },
          { text: "Why?", callback_data: "why:1" },
          { text: "Review", url: "https://remora.app/approvals" },
        ],
      ],
    });
    expect(keyboardOf([])).toBeUndefined();
  });
});
