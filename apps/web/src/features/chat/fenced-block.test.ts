import { createElement } from "react";
import { describe, expect, it } from "vitest";
import { fencedBlock } from "./fenced-block";

describe("fencedBlock", () => {
  it("reads the language and the code, without the trailing newline", () => {
    const block = fencedBlock(
      createElement("code", { className: "language-tsx" }, "const n = 1\n"),
    );
    expect(block).toEqual({ language: "tsx", text: "const n = 1" });
  });

  it("has no language label when the fence does not name one", () => {
    const block = fencedBlock(createElement("code", { className: "font-mono" }, "plain"));
    expect(block.language).toBeNull();
    expect(block.text).toBe("plain");
  });
});
