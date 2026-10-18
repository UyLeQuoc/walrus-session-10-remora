import { describe, expect, it } from "vitest";
import { rememberDraft } from "./remember-request.ts";

describe("remember draft", () => {
  it("does not store until the fact is long enough to confirm", () => {
    expect(rememberDraft("no", "profile")).toBeNull();
    expect(rememberDraft("I use bun", "profile")).toEqual({ type: "profile", text: "I use bun" });
    expect(rememberDraft("I use bun", "correction", "blob_0123456789")).toEqual({
      type: "correction",
      text: "I use bun",
      replaces: "blob_0123456789",
    });
  });
});
