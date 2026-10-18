import { describe, expect, it } from "vitest";
import { hasPending, POLL_FOR_MS, shouldKeepPolling } from "./team-poll";

const pending = { status: "pending" };
const stored = { status: "stored" };
const failed = { status: "failed" };

describe("hasPending", () => {
  it("is true only while a row has not settled", () => {
    expect(hasPending([stored, pending])).toBe(true);
    expect(hasPending([stored, failed])).toBe(false);
    expect(hasPending([])).toBe(false);
  });
});

describe("shouldKeepPolling", () => {
  it("keeps going while a row is pending inside the window", () => {
    expect(shouldKeepPolling([pending], 0, POLL_FOR_MS - 1)).toBe(true);
  });

  it("stops once nothing is pending", () => {
    expect(shouldKeepPolling([stored, failed], 0, 1_000)).toBe(false);
  });

  it("stops after the window even if a row is still pending", () => {
    expect(shouldKeepPolling([pending], 0, POLL_FOR_MS)).toBe(false);
  });
});
