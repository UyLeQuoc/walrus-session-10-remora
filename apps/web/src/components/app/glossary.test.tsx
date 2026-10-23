import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { GLOSSARY, Term } from "./glossary";

// Radix measures the tooltip in a layout effect; jsdom has no ResizeObserver.
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

describe("Term", () => {
  it("renders its children and marks the term", () => {
    render(<Term name="Disc">spending limit</Term>);
    const term = screen.getByTestId("glossary-term");
    expect(term.textContent).toBe("spending limit");
    expect(term.getAttribute("data-term")).toBe("Disc");
    expect(term.tagName).toBe("BUTTON");
  });

  it("falls back to the term name when there are no children", () => {
    render(<Term name="Sonar" />);
    expect(screen.getByTestId("glossary-term").textContent).toBe("Sonar");
  });

  it("shows the glossary text on hover", async () => {
    const user = userEvent.setup();
    render(<Term name="Wake" />);
    await user.hover(screen.getByTestId("glossary-term"));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain(GLOSSARY.Wake);
  });

  it("shows the glossary text on keyboard focus", async () => {
    const user = userEvent.setup();
    render(<Term name="shadow mode" />);
    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId("glossary-term"));
    const tooltip = await screen.findByRole("tooltip");
    expect(tooltip.textContent).toContain(GLOSSARY["shadow mode"]);
  });
});
