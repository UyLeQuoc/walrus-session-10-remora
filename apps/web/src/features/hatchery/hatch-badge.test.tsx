/**
 * M12 badge (ADR-0149): the embeddable snippets show the live SVG (`/badge/:id.svg`) and link to
 * `/hatchery/:id`, the author's name is escaped in each, and the copy button writes the Markdown
 * snippet to the clipboard.
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

const renderBadge = (name = "Package checker") =>
  render(
    <MemoryRouter>
      <HatchBadge templateId="abc123" name={name} />
    </MemoryRouter>,
  );

describe("hatch badge (M12)", () => {
  it("renders the markdown and html snippets pointing at the template", () => {
    renderBadge();
    const origin = window.location.origin;
    expect(screen.getByTestId("hatch-badge").textContent).toContain("Use this remora");
    expect(screen.getByTestId("hatch-badge").textContent).toContain("Package checker");
    expect(screen.getByTestId("hatch-badge-markdown").textContent).toBe(
      `[![Use this remora: Package checker](${origin}/badge/abc123.svg)](${origin}/hatchery/abc123)`,
    );
    expect(screen.getByTestId("hatch-badge-html").textContent).toBe(
      `<a href="${origin}/hatchery/abc123"><img src="${origin}/badge/abc123.svg" alt="Use this remora: Package checker" /></a>`,
    );
    expect(screen.getByTestId("hatch-badge-svg").getAttribute("src")).toBe(
      `${origin}/badge/abc123.svg`,
    );
  });

  it("escapes the author's name in both snippets", () => {
    renderBadge(`Evil"><script>x</script> [a](b)`);
    const html = screen.getByTestId("hatch-badge-html").textContent ?? "";
    expect(html).not.toContain("<script>");
    expect(html).toContain("&#34;&#62;&#60;script&#62;");
    expect(screen.getByTestId("hatch-badge-markdown").textContent).toContain("\\[a\\](b)");
  });

  it("copies the markdown snippet when Copy Markdown is clicked", async () => {
    renderBadge();
    await userEvent.click(screen.getByTestId("hatch-badge-copy-markdown"));
    await waitFor(() => expect(writeText).toHaveBeenCalledTimes(1));
    const origin = window.location.origin;
    expect(writeText).toHaveBeenCalledWith(
      `[![Use this remora: Package checker](${origin}/badge/abc123.svg)](${origin}/hatchery/abc123)`,
    );
    expect(await screen.findByText("Copied")).toBeDefined();
  });
});
