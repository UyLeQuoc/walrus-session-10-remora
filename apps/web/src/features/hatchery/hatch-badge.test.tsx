/**
 * M12 badge: the embeddable snippets point at `/hatchery/:id`, and the copy button writes the
 * Markdown snippet to the clipboard.
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HatchBadge } from "./hatch-badge";

const writeText = vi.fn(async () => {});

beforeEach(() => {
  writeText.mockClear();
  Object.defineProperty(navigator, "clipboard", {
    value: { writeText },
    configurable: true,
  });
});
afterEach(() => {
  Reflect.deleteProperty(navigator, "clipboard");
});

const renderBadge = () =>
  render(
    <MemoryRouter>
      <HatchBadge templateId="abc123" name="Package checker" />
    </MemoryRouter>,
  );

describe("hatch badge (M12)", () => {
  it("renders the markdown and html snippets pointing at the template", () => {
    renderBadge();
    const origin = window.location.origin;
    expect(screen.getByTestId("hatch-badge").textContent).toContain("Hatch this remora");
    expect(screen.getByTestId("hatch-badge").textContent).toContain("Package checker");
    expect(screen.getByTestId("hatch-badge-markdown").textContent).toBe(
      `[Hatch this remora](${origin}/hatchery/abc123)`,
    );
    expect(screen.getByTestId("hatch-badge-html").textContent).toBe(
      `<a href="${origin}/hatchery/abc123">Hatch this remora</a>`,
    );
  });

  it("copies the markdown snippet when Copy Markdown is clicked", async () => {
    renderBadge();
    await userEvent.click(screen.getByTestId("hatch-badge-copy-markdown"));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    expect(writeText).toHaveBeenCalledWith(
      `[Hatch this remora](${window.location.origin}/hatchery/abc123)`,
    );
    expect(await screen.findByText("Copied")).toBeDefined();
  });
});
