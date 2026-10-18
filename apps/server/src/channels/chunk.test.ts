import { describe, expect, it } from "vitest";
import { chunk } from "./chunk.ts";

describe("telegram chunking", () => {
  it("leaves a short message alone", () => {
    expect(chunk("hello")).toEqual(["hello"]);
  });

  it("never emits a part over the limit", () => {
    const text = "x".repeat(10_000);
    for (const part of chunk(text, 100)) expect(part.length).toBeLessThanOrEqual(100);
  });

  it("keeps every character", () => {
    const text = Array.from({ length: 200 }, (_, i) => `line ${i}`).join("\n");
    expect(chunk(text, 90).join("\n")).toBe(text);
  });

  it("splits on a newline rather than mid-line when it can", () => {
    // A /memory listing: cutting mid-entry would show half a blob id.
    const lines = Array.from({ length: 40 }, (_, i) => `• [profile] 2026-09-22 · blob abcdef${i}`);
    const parts = chunk(lines.join("\n"), 200);
    expect(parts.length).toBeGreaterThan(1);
    for (const part of parts) {
      for (const line of part.split("\n")) {
        expect(lines).toContain(line);
      }
    }
  });
});
