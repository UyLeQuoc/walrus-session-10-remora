/** N7: the command palette opens on Ctrl+K, filters the pages, navigates on Enter, and closes on Escape. */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { CommandPalette } from "@/components/app/command-palette";

vi.mock("@/features/remoras/api", () => ({
  api: { remoras: vi.fn(async () => ({ ok: true, data: { remoras: [] } })) },
}));

vi.mock("@/features/remoras/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/remoras/hooks")>();
  return {
    ...actual,
    useOwner: () => ({ owner: "0xabc", loading: false, reload: () => {} }),
  };
});

function LocationProbe() {
  const { pathname } = useLocation();
  return <p data-testid="location">{pathname}</p>;
}

function renderPalette() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <CommandPalette />
      <LocationProbe />
    </MemoryRouter>,
  );
}

describe("CommandPalette", () => {
  it("opens on Ctrl+K and shows the search input", async () => {
    renderPalette();
    expect(screen.queryByRole("textbox", { name: "Search pages and remoras" })).toBeNull();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(await screen.findByRole("textbox", { name: "Search pages and remoras" })).toBeDefined();
  });

  it("filters to Memory and navigates there on Enter", async () => {
    renderPalette();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    const input = await screen.findByRole("textbox", { name: "Search pages and remoras" });
    await userEvent.type(input, "memory");
    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(1);
    expect(options[0].getAttribute("aria-selected")).toBe("true");
    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("location").textContent).toBe("/memory");
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Search pages and remoras" })).toBeNull(),
    );
  });

  it("closes on Escape", async () => {
    renderPalette();
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    await screen.findByRole("textbox", { name: "Search pages and remoras" });
    await userEvent.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("textbox", { name: "Search pages and remoras" })).toBeNull(),
    );
  });
});
