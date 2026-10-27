/** The shell's moving parts (ADR-0069): the panel resizer, the docked side panel, the phone's nav. */
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ShellContext, ShellSidePanel, type SidePanelMeta } from "@/app/shell";
import { MobileNavigation, PanelResizer, SidePanel } from "@/openbot";

// jsdom has no PointerEvent; a mouse event with a pointer id is all the resizer reads.
class TestPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 0;
  }
}
vi.stubGlobal("PointerEvent", TestPointerEvent);

describe("panel resizer", () => {
  function Resizer({ onCompact }: { onCompact?: (compact: boolean) => void }) {
    const [value, setValue] = useState(280);
    const [compact, setCompact] = useState(false);
    return (
      <>
        <PanelResizer
          label="Resize the roster"
          controls="roster"
          direction="left"
          value={value}
          defaultValue={280}
          min={128}
          max={400}
          onResize={setValue}
          onResizeEnd={setValue}
          snap={{
            compactValue: 88,
            compact,
            collapseThreshold: 110,
            expandThreshold: 118,
            onCompactChange: (next) => {
              setCompact(next);
              onCompact?.(next);
            },
          }}
        />
        <output data-testid="width">{compact ? "compact" : value}</output>
      </>
    );
  }

  it("moves 12px a key, stops at its bounds, and snaps compact from its narrowest width", () => {
    const onCompact = vi.fn();
    render(<Resizer onCompact={onCompact} />);
    const handle = screen.getByRole("separator", { name: "Resize the roster" });
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(screen.getByTestId("width").textContent).toBe("268");
    fireEvent.keyDown(handle, { key: "End" });
    expect(screen.getByTestId("width").textContent).toBe("400");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(screen.getByTestId("width").textContent).toBe("400");
    fireEvent.keyDown(handle, { key: "Home" });
    expect(onCompact).toHaveBeenLastCalledWith(true);
    expect(screen.getByTestId("width").textContent).toBe("compact");
    expect(handle.getAttribute("aria-valuenow")).toBe("88");
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(onCompact).toHaveBeenLastCalledWith(false);
    expect(screen.getByTestId("width").textContent).toBe("128");
  });

  it("snaps to the compact width when dragged under the threshold, and back past the other", () => {
    render(<Resizer />);
    const handle = screen.getByRole("separator", { name: "Resize the roster" });
    fireEvent.pointerDown(handle, { button: 0, clientX: 280, pointerId: 1 });
    fireEvent.pointerMove(window, { clientX: 100, pointerId: 1 });
    fireEvent.pointerUp(window, { clientX: 100, pointerId: 1 });
    expect(screen.getByTestId("width").textContent).toBe("compact");
    fireEvent.pointerDown(handle, { button: 0, clientX: 88, pointerId: 2 });
    fireEvent.pointerUp(window, { clientX: 300, pointerId: 2 });
    expect(screen.getByTestId("width").textContent).toBe("300");
  });

  it("resets to its default width on a double click", () => {
    render(<Resizer />);
    const handle = screen.getByRole("separator", { name: "Resize the roster" });
    fireEvent.keyDown(handle, { key: "End" });
    fireEvent.doubleClick(handle);
    expect(screen.getByTestId("width").textContent).toBe("280");
  });
});

/** The slice of the app shell that hosts the side panel, as AppLayout wires it. */
function Shell({ children }: { children: React.ReactNode }) {
  const [sidePanel, setSidePanel] = useState<SidePanelMeta | null>(null);
  const [node, setNode] = useState<HTMLElement | null>(null);
  return (
    <ShellContext.Provider
      value={{
        title: "",
        setTitle: () => {},
        newChatTick: 0,
        requestNewChat: () => {},
        activeChatId: null,
        openTick: 0,
        requestOpenChat: () => {},
        adoptChat: () => {},
        sidePanel,
        setSidePanel,
        sidePanelNode: node,
      }}
    >
      {children}
      {sidePanel ? (
        <SidePanel
          id="side"
          title={sidePanel.title}
          tabs={sidePanel.tabs}
          activeTab={sidePanel.activeTab}
          onTab={sidePanel.onTab}
          onClose={sidePanel.onClose}
        >
          <div ref={setNode} />
        </SidePanel>
      ) : null}
    </ShellContext.Provider>
  );
}

function Opener({ name }: { name: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-pressed={open}>
        Open {name}
      </button>
      <ShellSidePanel open={open} title={name} onClose={() => setOpen(false)}>
        <p>{name} body</p>
      </ShellSidePanel>
    </>
  );
}

describe("docked side panel", () => {
  it("shows a page's content in the shell's panel, and closes from its own button", async () => {
    const user = userEvent.setup();
    render(
      <Shell>
        <Opener name="Why" />
      </Shell>,
    );
    expect(screen.queryByRole("complementary")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Open Why" }));
    const panel = await screen.findByRole("complementary", { name: "Why" });
    expect(within(panel).getByText("Why body")).toBeDefined();
    await user.click(within(panel).getByRole("button", { name: "Close Why" }));
    expect(screen.queryByRole("complementary")).toBeNull();
    expect(screen.getByRole("button", { name: "Open Why" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
  });

  it("hands the panel to the last opener, and the first can open it again", async () => {
    const user = userEvent.setup();
    render(
      <Shell>
        <Opener name="Why" />
        <Opener name="Memory" />
      </Shell>,
    );
    await user.click(screen.getByRole("button", { name: "Open Why" }));
    await screen.findByRole("complementary", { name: "Why" });
    await user.click(screen.getByRole("button", { name: "Open Memory" }));
    expect(await screen.findByRole("complementary", { name: "Memory" })).toBeDefined();
    expect(screen.queryByText("Why body")).toBeNull();
    expect(screen.getByRole("button", { name: "Open Why" }).getAttribute("aria-pressed")).toBe(
      "false",
    );
    await user.click(screen.getByRole("button", { name: "Open Why" }));
    expect(await screen.findByRole("complementary", { name: "Why" })).toBeDefined();
  });

  it("renders nothing outside the shell, so a page alone still works", () => {
    render(<Opener name="Why" />);
    act(() => screen.getByRole("button", { name: "Open Why" }).click());
    expect(screen.queryByRole("complementary")).toBeNull();
  });
});

describe("phone navigation", () => {
  it("marks the shown pane and switches on a tap", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MobileNavigation
        label="Panes"
        active="main"
        onChange={onChange}
        items={[
          { id: "workspace", label: "Remoras", icon: null, count: 2 },
          { id: "main", label: "Funds", icon: null },
        ]}
      />,
    );
    const nav = screen.getByRole("navigation", { name: "Panes" });
    const funds = within(nav).getByRole("button", { name: "Funds" });
    expect(funds.getAttribute("aria-pressed")).toBe("true");
    const remoras = within(nav).getByRole("button", { name: /Remoras/ });
    expect(remoras.getAttribute("aria-pressed")).toBe("false");
    expect(remoras.textContent).toContain("2");
    await user.click(remoras);
    expect(onChange).toHaveBeenCalledWith("workspace");
  });
});
