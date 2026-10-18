import { afterEach, describe, expect, it, vi } from "vitest";
import { ago } from "./ago";

describe("ago", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("names how long ago a date was in the largest whole unit", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-06T12:00:00Z"));
    expect(ago("2026-10-06T11:59:45Z")).toBe("just now");
    expect(ago("2026-10-06T11:15:00Z")).toBe("45m ago");
    expect(ago("2026-10-06T07:00:00Z")).toBe("5h ago");
    expect(ago("2026-10-05T12:00:00Z")).toBe("yesterday");
    expect(ago("2026-10-01T12:00:00Z")).toBe("5d ago");
  });
});
