import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Page } from "./page";

describe("Page", () => {
  afterEach(() => {
    document.title = "";
  });

  it("sets the tab title to '<name> · Remora' and uses the full-width column", () => {
    const { container } = render(
      <Page title="Funds">
        <p>Ready to spend</p>
      </Page>,
    );
    expect(document.title).toBe("Funds · Remora");
    expect(screen.getByText("Ready to spend")).toBeTruthy();
    const scroller = container.firstElementChild as HTMLElement;
    expect(scroller.className).toContain("overflow-y-auto");
    const column = scroller.firstElementChild as HTMLElement;
    expect(column.className).toContain("w-full");
    expect(column.className).toContain("px-4 md:px-8");
    expect(column.className).not.toContain("max-w-");
    expect(column.className).not.toContain("mx-auto");
  });

  it("uses just 'Remora' for the home page", () => {
    render(
      <Page title="Remora">
        <p>Set up</p>
      </Page>,
    );
    expect(document.title).toBe("Remora");
  });
});
