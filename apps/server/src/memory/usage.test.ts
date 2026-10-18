import { describe, expect, it } from "vitest";
import { memoryUsage } from "./usage.ts";

describe("memoryUsage", () => {
  it("counts answers, the ones that used memory, and each memory once per answer", () => {
    expect(
      memoryUsage([
        { injected: [{ blobId: "a" }, { blobId: "b" }] },
        { injected: [{ blobId: "a" }, { blobId: "a" }] },
        { injected: [] },
        { injected: null },
      ]),
    ).toEqual({ answers: 4, withMemory: 2, uses: { a: 2, b: 1 } });
  });

  it("says nothing was used before anyone has asked", () => {
    expect(memoryUsage([])).toEqual({ answers: 0, withMemory: 0, uses: {} });
  });
});
