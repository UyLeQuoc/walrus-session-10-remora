import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Time } from "./time";

describe("Time", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-19T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a relative time on a <time> whose tooltip carries the exact one", () => {
    render(<Time value="2026-10-19T10:00:00Z" />);
    const el = screen.getByText("2h ago");
    expect(el.tagName).toBe("TIME");
    expect(el.getAttribute("datetime")).toBe("2026-10-19T10:00:00.000Z");
    expect(el.getAttribute("title")).toContain("2026");
  });

  it("accepts a Date", () => {
    render(<Time value={new Date("2026-10-19T11:59:45Z")} />);
    expect(screen.getByText("just now")).toBeTruthy();
  });
});
