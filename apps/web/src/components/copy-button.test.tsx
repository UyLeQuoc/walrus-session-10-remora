import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CopyButton } from "@/components/copy-button";

function stubClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

describe("CopyButton", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a green tick for a second, and ignores clicks while it is up", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    const writeText = vi.fn().mockResolvedValue(undefined);
    stubClipboard(writeText);
    render(<CopyButton value="hippo" label="namespace" />);

    fireEvent.click(screen.getByRole("button", { name: "Copy namespace" }));
    await act(async () => {
      await Promise.resolve();
    });

    const copied = screen.getByRole("button", { name: "Copied" });
    expect(copied.hasAttribute("disabled")).toBe(true);
    expect(copied.querySelector("svg")?.getAttribute("class")).toContain("text-green-600");
    expect(writeText).toHaveBeenCalledTimes(1);
    expect(writeText).toHaveBeenCalledWith("hippo");

    fireEvent.click(copied);
    expect(writeText).toHaveBeenCalledTimes(1);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(screen.getByRole("button", { name: "Copy namespace" }).hasAttribute("disabled")).toBe(
      false,
    );
  });

  it("stays a copy button when the clipboard refuses", async () => {
    const writeText = vi.fn().mockRejectedValue(new Error("denied"));
    stubClipboard(writeText);
    render(<CopyButton value="hippo" label="namespace" />);
    fireEvent.click(screen.getByRole("button", { name: "Copy namespace" }));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("button", { name: "Copy namespace" }).hasAttribute("disabled")).toBe(
      false,
    );
    expect(screen.queryByRole("button", { name: "Copied" })).toBeNull();
  });
});
