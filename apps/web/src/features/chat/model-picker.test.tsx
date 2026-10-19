/** The picker renders the catalog, the price, the capability count and the tooltip list (§4). */
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ModelPicker } from "./model-picker";

// Radix measures in a layout effect; jsdom has no ResizeObserver.
beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

function open(value = "anthropic/claude-haiku-5.5") {
  const onChange = vi.fn();
  const utils = render(
    <TooltipProvider>
      <ModelPicker value={value} onChange={onChange} />
    </TooltipProvider>,
  );
  return { onChange, ...utils };
}

describe("the model picker", () => {
  it("shows the selected model and one flat list without vendor headings", async () => {
    const user = userEvent.setup();
    open();
    expect(screen.getByRole("button", { name: "Model: Claude Haiku 5.5" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Model: Claude Haiku 5.5" }));
    expect(await screen.findByRole("menuitemradio", { name: /Claude Haiku 5.5/ })).toBeTruthy();
    expect(screen.queryByText("Anthropic")).toBeNull();
    expect(screen.getAllByText("$0.10 / $0.50 per 1M")).toHaveLength(2);
    expect(screen.getByText("$0.04 / $0.08 per 1M")).toBeTruthy();
  });

  it("badges the row with the count of input kinds", async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole("button", { name: "Model: Claude Haiku 5.5" }));
    const row = await screen.findByRole("menuitemradio", { name: /Claude Haiku 5.5/ });
    expect(within(row).getByLabelText("3 input types")).toBeTruthy();
    const omni = screen.getByRole("menuitemradio", { name: /Qwen3.8 Omni Flash/ });
    expect(within(omni).getByLabelText("4 input types")).toBeTruthy();
  });

  it("lists the input kinds and tool calling when the row is focused", async () => {
    const user = userEvent.setup();
    open();
    await user.click(screen.getByRole("button", { name: "Model: Claude Haiku 5.5" }));
    const row = await screen.findByRole("menuitemradio", { name: /Claude Haiku 5.5/ });
    row.focus();
    expect(await screen.findByText("Tool calling ✓")).toBeTruthy();
    expect(screen.getByText("Images")).toBeTruthy();
    expect(screen.getByText("Files/PDF")).toBeTruthy();
  });

  it("reports the picked id", async () => {
    const user = userEvent.setup();
    const { onChange } = open();
    await user.click(screen.getByRole("button", { name: "Model: Claude Haiku 5.5" }));
    await user.click(await screen.findByRole("menuitemradio", { name: /GLM-5.3 Flash/ }));
    expect(onChange).toHaveBeenCalledWith("z-ai/glm-5.3-flash");
  });
});
