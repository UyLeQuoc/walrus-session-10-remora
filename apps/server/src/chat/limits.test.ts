/**
 * The inbound size guard.
 *
 * Only pure helpers here: importing the whole turn handler would open a
 * database connection, and the decision worth testing is "refuse or truncate",
 * not the plumbing.
 */
import { describe, expect, it } from "vitest";
import { MAX_INBOUND_CHARS, tooLong } from "./limits.ts";

describe("oversized messages", () => {
  it("lets an ordinary message through", () => {
    expect(tooLong("I only use pnpm")).toBeNull();
    expect(tooLong("x".repeat(MAX_INBOUND_CHARS))).toBeNull();
  });

  it("refuses rather than truncating", () => {
    const message = tooLong("x".repeat(MAX_INBOUND_CHARS + 1));
    expect(message).not.toBeNull();
    // Refusing is the point: a truncated message that gets answered anyway
    // leaves the person believing the whole thing was read.
    expect(message).toMatch(/split it|send the part/i);
  });

  it("tells the person both numbers, so the limit is actionable", () => {
    const message = tooLong("x".repeat(10_000)) ?? "";
    expect(message).toContain("10,000");
    expect(message).toContain("4,000");
  });

  it("holds a limit a real paste would exceed but a real question would not", () => {
    // A long question, a stack trace, and a pasted file.
    expect(tooLong("Why does this fail? ".repeat(20))).toBeNull();
    expect(tooLong("at Object.<anonymous> (/app/src/index.ts:1:1)\n".repeat(40))).toBeNull();
    expect(tooLong("const x = 1;\n".repeat(1000))).not.toBeNull();
  });
});
