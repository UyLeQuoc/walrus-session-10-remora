/**
 * The app shell in openbot's layout (ADR-0069): the page rail, then one card with the roster (resizable,
 * snapping to 88px of faces), the main pane and a docked side panel a page can fill. At 720px and below
 * one pane shows at a time, switched by a bottom navigation.
 *
 * The network and panic controls sit in the roster's top row; when the roster is compact or hidden
 * (a phone), they move to the main pane's top row so the network is always in view.
 */

import { MessageCircle, PanelLeft, PanelRight, Users } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router";
import { AppRail } from "@/app/app-rail";
import { AppSidebar, ROSTER_ID } from "@/app/app-sidebar";
import type { SidePanelMeta } from "@/app/shell";
import { ShellContext, useShellState } from "@/app/shell";
import { AccountMenu } from "@/components/app/account-menu";
import { CommandPalette } from "@/components/app/command-palette";
import { NetworkSelect } from "@/components/app/network-select";
import { ThemeSync } from "@/components/app/theme-choice";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { clearActiveChat, writeActiveChat } from "@/features/chat/active-chat";
import { PanicButton } from "@/features/funds/panic-button";
import { api } from "@/features/remoras/api";
import { useLoad, useOwner } from "@/features/remoras/hooks";
import { usePhone } from "@/hooks/use-phone";
import { readStored, writeStored } from "@/lib/storage";
import {
  AppFrame,
  AppMain,
  AppWindow,
  MobileNavigation,
  type MobilePane,
  PaneHeader,
  PanelResizer,
  PaneTitle,
  SidebarIconButton,
  SidePanel,
} from "@/openbot";

const LEFT = { key: "remora.roster.width", def: 280, min: 128, max: 400, compact: 88 } as const;
const LEFT_COMPACT_KEY = "remora.roster.compact";
const SIDE = { key: "remora.panel.width", def: 360, min: 280, max: 640 } as const;
const SIDE_PANEL_ID = "remora-side-panel";

function storedWidth(key: string, fallback: number, min: number, max: number): number {
  const value = Number(readStored("local", key));
  return Number.isFinite(value) && value >= min && value <= max ? value : fallback;
}

export function AppLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const phone = usePhone();
  const {
    title,
    setTitle,
    newChatTick,
    setNewChatTick,
    activeChatId,
    setActiveChatId,
    openTick,
    setOpenTick,
  } = useShellState();
  const [mobilePane, setMobilePane] = useState<MobilePane>("main");
  const [leftWidth, setLeftWidth] = useState(() =>
    storedWidth(LEFT.key, LEFT.def, LEFT.min, LEFT.max),
  );
  const [compact, setCompact] = useState(() => readStored("local", LEFT_COMPACT_KEY) === "1");
  const [sideWidth, setSideWidth] = useState(() =>
    storedWidth(SIDE.key, SIDE.def, SIDE.min, SIDE.max),
  );
  const [sidePanel, setSidePanel] = useState<SidePanelMeta | null>(null);
  const [sidePanelNode, setSidePanelNode] = useState<HTMLElement | null>(null);
  const [headerStartNode, setHeaderStartNode] = useState<HTMLElement | null>(null);
  const [headerEndNode, setHeaderEndNode] = useState<HTMLElement | null>(null);
  const [headerClaims, setHeaderClaims] = useState(0);
  const claimHeader = useCallback((delta: number) => setHeaderClaims((n) => n + delta), []);

  const { owner } = useOwner();
  const inbox = useLoad(
    () =>
      owner
        ? api.approvals()
        : Promise.resolve({ ok: true as const, data: { approvals: [] as never[] } }),
    [owner],
    30_000,
  );
  const approvals = inbox.data?.approvals ?? [];

  const setRosterCompact = useCallback((next: boolean) => {
    setCompact(next);
    writeStored("local", LEFT_COMPACT_KEY, next ? "1" : "0");
  }, []);

  // A route change on a phone shows the page it opened.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only the route matters here.
  useEffect(() => {
    setMobilePane((pane) => (pane === "workspace" ? "main" : pane));
  }, [pathname]);
  // A side panel that opens on a phone takes the screen; a closed one hands it back to the page.
  const panelOwner = sidePanel?.owner ?? null;
  useEffect(() => {
    if (panelOwner) {
      if (phone) setMobilePane("panel");
    } else setMobilePane((pane) => (pane === "panel" ? "main" : pane));
  }, [panelOwner, phone]);
  // Cmd/Ctrl+B folds the roster to its faces and back.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        setRosterCompact(!compact);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [compact, setRosterCompact]);

  const requestNewChat = () => {
    clearActiveChat();
    setActiveChatId(null);
    setNewChatTick((n) => n + 1);
    setMobilePane("main");
    navigate("/chat");
  };

  const requestOpenChat = (id: string) => {
    writeActiveChat(id);
    setActiveChatId(id);
    setOpenTick((n) => n + 1);
    setMobilePane("main");
    navigate("/chat");
  };

  const adoptChat = (id: string) => {
    writeActiveChat(id);
    setActiveChatId(id);
  };

  const networkInHeader = phone || compact;
  const signedIn = Boolean(owner);

  const header = (
    <PaneHeader
      actions={
        <>
          <span ref={setHeaderEndNode} className="contents" />
          {networkInHeader ? (
            <>
              <NetworkSelect />
              <PanicButton />
            </>
          ) : null}
          {phone && !signedIn ? (
            <div className="flex items-center">
              <AccountMenu />
            </div>
          ) : null}
        </>
      }
    >
      {phone ? null : (
        <SidebarIconButton
          label={compact ? "Expand the roster" : "Collapse the roster"}
          aria-controls={ROSTER_ID}
          aria-expanded={!compact}
          onClick={() => setRosterCompact(!compact)}
        >
          <PanelLeft aria-hidden />
        </SidebarIconButton>
      )}
      {headerClaims > 0 ? null : <PaneTitle>{title}</PaneTitle>}
      <span ref={setHeaderStartNode} className="contents" />
    </PaneHeader>
  );

  return (
    <ShellContext.Provider
      value={{
        title,
        setTitle,
        newChatTick,
        requestNewChat,
        activeChatId,
        openTick,
        requestOpenChat,
        adoptChat,
        mobilePane,
        setMobilePane,
        sidePanelNode,
        sidePanel,
        setSidePanel,
        headerStartNode,
        headerEndNode,
        headerClaims,
        claimHeader,
      }}
    >
      <TooltipProvider delayDuration={250}>
        <AppWindow
          mobilePane={phone ? mobilePane : "main"}
          rail={<AppRail pending={approvals.length} onNavigate={() => setMobilePane("main")} />}
          navigation={
            phone ? (
              <MobileNavigation
                label="Panes"
                active={mobilePane}
                onChange={setMobilePane}
                items={[
                  {
                    id: "workspace",
                    label: "Remoras",
                    icon: <Users aria-hidden />,
                    count: approvals.length,
                  },
                  // A fixed name: the page title here would repeat page controls ("Verify").
                  { id: "main", label: "Page", icon: <MessageCircle aria-hidden /> },
                  ...(sidePanel
                    ? [
                        {
                          id: "panel" as const,
                          label: sidePanel.title,
                          icon: <PanelRight aria-hidden />,
                        },
                      ]
                    : []),
                ]}
              />
            ) : null
          }
        >
          <AppFrame
            leftWidth={compact ? LEFT.compact : leftWidth}
            sideWidth={sidePanel && !phone ? sideWidth : 0}
          >
            {/* On a phone the roster mounts only in its own pane, so nothing hidden repeats the page. */}
            {phone && mobilePane !== "workspace" ? null : (
              <AppSidebar
                compact={compact && !phone}
                onExpand={() => setRosterCompact(false)}
                networkHere={!networkInHeader}
                approvals={approvals}
                onNewChat={requestNewChat}
                onOpenChat={requestOpenChat}
                onNavigate={() => setMobilePane("main")}
                activeChatId={activeChatId}
              />
            )}
            <PanelResizer
              className="left-panel-resizer"
              label="Resize the roster"
              controls={ROSTER_ID}
              direction="left"
              value={leftWidth}
              defaultValue={LEFT.def}
              min={LEFT.min}
              max={LEFT.max}
              onResize={setLeftWidth}
              onResizeEnd={(value) => writeStored("local", LEFT.key, String(value))}
              snap={{
                compactValue: LEFT.compact,
                compact,
                collapseThreshold: 110,
                expandThreshold: 118,
                onCompactChange: setRosterCompact,
              }}
            />
            <AppMain header={header}>
              <Outlet />
            </AppMain>
            {sidePanel ? (
              <SidePanel
                id={SIDE_PANEL_ID}
                title={sidePanel.title}
                tabs={sidePanel.tabs}
                activeTab={sidePanel.activeTab}
                onTab={sidePanel.onTab}
                onClose={sidePanel.onClose}
                resizer={
                  phone ? null : (
                    <PanelResizer
                      className="right-panel-resizer"
                      label="Resize the side panel"
                      controls={SIDE_PANEL_ID}
                      direction="right"
                      value={sideWidth}
                      defaultValue={SIDE.def}
                      min={SIDE.min}
                      max={SIDE.max}
                      onResize={setSideWidth}
                      onResizeEnd={(value) => writeStored("local", SIDE.key, String(value))}
                    />
                  )
                }
              >
                <div ref={setSidePanelNode} className="contents" />
              </SidePanel>
            ) : null}
          </AppFrame>
        </AppWindow>
      </TooltipProvider>
      <Toaster />
      <ThemeSync />
      <CommandPalette />
    </ShellContext.Provider>
  );
}
