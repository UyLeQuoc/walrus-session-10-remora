import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Button } from "@/components/ui/button";
import { ConfirmAction } from "./confirm-action";

beforeEach(() => {
  if (!HTMLElement.prototype.hasPointerCapture) {
    HTMLElement.prototype.hasPointerCapture = () => false;
    HTMLElement.prototype.setPointerCapture = () => undefined;
    HTMLElement.prototype.releasePointerCapture = () => undefined;
  }
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
});

function mount(onConfirm: () => Promise<void>) {
  render(
    <ConfirmAction
      trigger={<Button>Open</Button>}
      title="Retire Scout?"
      description="Its Disc is revoked and it stops for good."
      confirmLabel="Retire"
      onConfirm={onConfirm}
    />,
  );
}

describe("ConfirmAction", () => {
  it("runs the action once and closes on confirm", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    mount(onConfirm);

    await user.click(screen.getByRole("button", { name: "Open" }));
    expect(await screen.findByText("Retire Scout?")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Retire" }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByText("Retire Scout?")).toBeNull());
  });

  it("does nothing on cancel", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    mount(onConfirm);

    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(onConfirm).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText("Retire Scout?")).toBeNull());
  });

  it("keeps the dialog open and shows the error when the action fails", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error("Wallet refused."));
    mount(onConfirm);

    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(await screen.findByRole("button", { name: "Retire" }));

    expect(await screen.findByText("Wallet refused.")).toBeTruthy();
    expect(screen.getByText("Retire Scout?")).toBeTruthy();
  });
});
