/** The shared page kit: one status map, relative time, the page title, and the confirm dialog. */
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ConfirmAction } from "@/components/app/confirm-action";
import { Page, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Time } from "@/components/app/time";

describe("StatusBadge", () => {
  it("maps live states to the semantic variants", () => {
    const { rerender } = render(<StatusBadge status="active" />);
    expect(screen.getByText("active").getAttribute("data-variant")).toBe("success");
    rerender(<StatusBadge status="shadow" />);
    expect(screen.getByText("shadow").getAttribute("data-variant")).toBe("warning");
    rerender(<StatusBadge status="paused" />);
    expect(screen.getByText("paused").getAttribute("data-variant")).toBe("outline");
    rerender(<StatusBadge status="retired" />);
    expect(screen.getByText("retired").getAttribute("data-variant")).toBe("outline");
    rerender(<StatusBadge status="failed" />);
    expect(screen.getByText("failed").getAttribute("data-variant")).toBe("destructive");
  });

  it("keeps the status text the E2E tests look for", () => {
    render(<StatusBadge status="live" />);
    expect(screen.getByText("live")).toBeDefined();
  });
});

describe("Time", () => {
  it("shows relative time and keeps the full timestamp on hover", () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60_000).toISOString();
    render(<Time value={twoHoursAgo} />);
    const el = screen.getByText("2h ago");
    expect(el.tagName).toBe("TIME");
    expect(el.getAttribute("datetime")).toBe(twoHoursAgo);
    expect(el.getAttribute("title")).toBeTruthy();
  });
});

describe("Page", () => {
  it("sets the document title and renders one h1", () => {
    render(
      <MemoryRouter initialEntries={["/remoras"]}>
        <Page title="Remoras">
          <PageHeader title="Remoras" description="2 on testnet" />
        </Page>
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Remoras");
    expect(document.title).toBe("Remoras · Remora");
    expect(document.querySelectorAll("h1")).toHaveLength(1);
  });

  it("leaves Home's title as just Remora", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <Page title="Remora">
          <PageHeader title="Always-on agents you own" />
        </Page>
      </MemoryRouter>,
    );
    expect(document.title).toBe("Remora");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Always-on agents you own");
  });
});

describe("ConfirmAction", () => {
  it("cancels without running the action", async () => {
    const onConfirm = vi.fn(async () => {});
    render(
      <ConfirmAction
        trigger={<button type="button">Retire</button>}
        title="Retire Scout?"
        description="It stops for good."
        confirmLabel="Retire"
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Retire" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("runs the action and closes on success", async () => {
    const onConfirm = vi.fn(async () => {});
    render(
      <ConfirmAction
        trigger={<button type="button">Pause all</button>}
        title="Pause all spending?"
        description="2 Discs stop paying."
        confirmLabel="Pause 2 Discs"
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Pause all" }));
    await userEvent.click(screen.getByRole("button", { name: "Pause 2 Discs" }));
    expect(onConfirm).toHaveBeenCalledOnce();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).toBeNull());
  });

  it("keeps an error inside the dialog", async () => {
    const onConfirm = vi.fn(async () => {
      throw new Error("The wallet refused.");
    });
    render(
      <ConfirmAction
        trigger={<button type="button">Rotate</button>}
        title="Rotate the key?"
        description="The old one stops working."
        confirmLabel="Rotate"
        onConfirm={onConfirm}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Rotate" }));
    await userEvent.click(screen.getByRole("button", { name: "Rotate" }));
    expect(await screen.findByText("The wallet refused.")).toBeDefined();
    expect(screen.getByRole("alertdialog")).toBeDefined();
  });
});
