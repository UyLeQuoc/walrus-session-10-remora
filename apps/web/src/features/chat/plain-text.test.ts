import { describe, expect, it } from "vitest";
import { plainText } from "./plain-text";

describe("plainText", () => {
  it("leaves a sentence alone", () => {
    expect(plainText("Hi.")).toBe("Hi.");
  });

  it("drops emphasis, code ticks, and link destinations", () => {
    expect(plainText("Say **yes**, *now*, ~~later~~, and `no`.")).toBe(
      "Say yes, now, later, and no.",
    );
    expect(plainText("See [docs](https://example.com).")).toBe("See docs.");
    expect(plainText("https://example.com")).toBe("https://example.com");
  });

  it("keeps line breaks and the body of a fence", () => {
    expect(plainText("a\nb")).toBe("a\nb");
    expect(plainText("Hi.\n\n```ts\nconst n = 1\n```")).toBe("Hi.\n\nconst n = 1");
  });

  it("keeps heading and list words without their markers", () => {
    expect(plainText("# Title\n\n- one\n- [x] two")).toBe("Title\n\none\ntwo");
  });

  it("reads a table as rows of cells", () => {
    expect(plainText("| A | B |\n| - | - |\n| 1 | 2 |")).toBe("A\tB\n1\t2");
  });
});
