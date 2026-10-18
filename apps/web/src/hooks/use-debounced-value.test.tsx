import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEBOUNCE_MS, useDebouncedValue } from "./use-debounced-value";

function Probe({ value }: { value: string }) {
  const debounced = useDebouncedValue(value);
  return <output>{debounced}</output>;
}

describe("useDebouncedValue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the previous value until 300ms after the last change", () => {
    vi.useFakeTimers();
    const view = render(<Probe value="a" />);
    expect(screen.getByRole("status").textContent).toBe("a");

    view.rerender(<Probe value="ab" />);
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    });
    expect(screen.getByRole("status").textContent).toBe("a");

    view.rerender(<Probe value="abc" />);
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    });
    expect(screen.getByRole("status").textContent).toBe("a");

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.getByRole("status").textContent).toBe("abc");
  });
});
