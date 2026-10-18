import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GREETINGS, greetingAt } from "./greeting";
import { GREETING_ROTATE_MS, useGreeting } from "./use-greeting";

describe("greeting rotates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 15, 11, 59, 0));
    vi.spyOn(Math, "random").mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts on this hour's bank and changes every five seconds", () => {
    const { result } = renderHook(() => useGreeting());
    expect(result.current).toBe(greetingAt(new Date(), 0));
    expect(GREETINGS.morning).toContain(result.current);

    act(() => {
      vi.advanceTimersByTime(GREETING_ROTATE_MS - 1);
    });
    expect(result.current.id).toBe(GREETINGS.morning[0].id);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toBe(greetingAt(new Date(), 1));
    expect(result.current.id).not.toBe(GREETINGS.morning[0].id);
  });

  it("moves to the afternoon bank after noon", () => {
    const { result } = renderHook(() => useGreeting());

    act(() => {
      vi.setSystemTime(new Date(2026, 0, 15, 12, 0, 0));
      vi.advanceTimersByTime(GREETING_ROTATE_MS);
    });

    expect(result.current).toBe(greetingAt(new Date(), 1));
    expect(GREETINGS.afternoon).toContain(result.current);
    expect(GREETINGS.morning).not.toContain(result.current);
  });

  it("picks another line when a new chat starts", () => {
    const { result, rerender } = renderHook(({ visit }: { visit: number }) => useGreeting(visit), {
      initialProps: { visit: 0 },
    });
    expect(result.current.id).toBe(GREETINGS.morning[0].id);

    rerender({ visit: 1 });

    expect(result.current).toBe(greetingAt(new Date(), 1));
    expect(result.current.id).not.toBe(GREETINGS.morning[0].id);
  });

  it("does not rotate while a conversation is open", () => {
    const { result } = renderHook(() => useGreeting(0, false));
    const first = result.current;

    act(() => {
      vi.advanceTimersByTime(GREETING_ROTATE_MS * 3);
    });

    expect(result.current).toBe(first);
  });
});
