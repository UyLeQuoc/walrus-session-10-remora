/*
 * Ported from nightly-labs/openbot src/renderer/src/WorkspaceShell.tsx, WorkspaceFrame.tsx and
 * src/renderer/src/features/web-client/WebWorkspace.tsx (the window, the frame and the phone panes),
 * and packages/ui/src/features/conversation/ConversationHeader.tsx (the top row) @ aa3c498.
 * PolyForm Noncommercial 1.0.0, see ../LICENSE.
 */
import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

/** What a phone shows: the main pane, the workspace (rail and roster), or the side panel. */
export type MobilePane = "main" | "workspace" | "panel";

/** The window: the page rail, then the frame. On a phone, `mobilePane` decides what shows. */
export function AppWindow({
  mobilePane,
  rail,
  navigation,
  children,
  className,
}: {
  mobilePane: MobilePane;
  rail: ReactNode;
  navigation?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("app-window", className)} data-mobile-pane={mobilePane}>
      {rail}
      {children}
      {navigation}
    </div>
  );
}

/**
 * The frame: the roster, its resizer, the main pane and the side panel, as one card. Widths are CSS
 * variables, so a drag only rewrites two numbers.
 */
export function AppFrame({
  leftWidth,
  sideWidth,
  children,
}: {
  leftWidth: number;
  sideWidth: number;
  children: ReactNode;
}) {
  return (
    <div
      className="app-frame app-frame-edge"
      style={
        {
          "--left-panel-width": `${leftWidth}px`,
          "--side-panel-width": `${sideWidth}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

/** The main pane. `data-slot="sidebar-inset"` is the hook the layout checks measure against. */
export function AppMain({ header, children }: { header?: ReactNode; children: ReactNode }) {
  return (
    <main className="app-main" data-slot="sidebar-inset">
      {header}
      <div className="app-main-body">{children}</div>
    </main>
  );
}

/** The top row of the main pane: a heading group at the start, controls at the end. */
export function PaneHeader({
  children,
  actions,
  className,
}: {
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("conversation-header", className)}>
      <div className="conversation-heading-group">{children}</div>
      {actions ? <div className="conversation-header-actions">{actions}</div> : null}
    </header>
  );
}

/** The title in the top row: 13px, regular, truncated. Not a heading: the page owns its `h1`. */
export function PaneTitle({ icon, children }: { icon?: ReactNode; children: ReactNode }) {
  return (
    <p className="conversation-title">
      {icon}
      <span>{children}</span>
    </p>
  );
}
