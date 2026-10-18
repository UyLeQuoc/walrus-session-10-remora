import { describe, expect, it } from "vitest";
import { questionBefore } from "./use-compare.ts";

describe("questionBefore", () => {
  const thread = [
    { id: "u1", role: "user" },
    { id: "a1", role: "assistant" },
    { id: "a2", role: "assistant" },
    { id: "u2", role: "user" },
    { id: "a3", role: "assistant" },
  ];

  it("finds the message an answer replied to", () => {
    expect(questionBefore(thread, 1)).toBe("u1");
    expect(questionBefore(thread, 4)).toBe("u2");
  });

  it("gives nothing when another answer sits in between, or there is no question", () => {
    expect(questionBefore(thread, 2)).toBeNull();
    expect(questionBefore(thread, 0)).toBeNull();
  });
});
