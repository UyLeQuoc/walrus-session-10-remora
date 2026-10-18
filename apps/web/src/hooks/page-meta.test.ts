import { describe, expect, it } from "vitest";
import { pageHead } from "./page-meta.ts";

describe("pageHead", () => {
  it("gives an indexable page an absolute canonical on the public domain", () => {
    const head = pageHead({
      title: "How hippo works",
      description: "d",
      path: "/guide",
      index: true,
    });
    expect(head.canonical).toBe("https://ask-hippo.vercel.app/guide");
    expect(head.robots).toBe("index, follow");
  });

  it("keeps a page out of the index and drops its canonical, so a token never becomes one", () => {
    const head = pageHead({
      title: "Connect your wallet",
      description: "d",
      path: "/connect/secret-token",
      index: false,
    });
    expect(head.robots).toBe("noindex, nofollow");
    expect(head.canonical).toBeNull();
  });
});
