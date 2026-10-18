import type { ReactNode } from "react";
import { ChatPage } from "../features/chat/chat-page";
import { ConnectPage } from "../features/connect/connect-page";
import { GuidePage } from "../features/guide/guide-page";
import { LabPage } from "../features/lab/lab-page";
import { MePage } from "../features/me/me-page";

export interface AppRoute {
  /** Omit for the index route. */
  path?: string;
  element: ReactNode;
}

/**
 * Every page inside the app layout. **Append-only**: add one import and one
 * line per page (docs/team-split.md §9). Uy adds only `lab/*` entries. The
 * not-found route is added by `main.tsx` after these.
 */
export const APP_ROUTES: AppRoute[] = [
  { element: <ChatPage /> },
  { path: "connect/:token", element: <ConnectPage kind="connect" /> },
  { path: "disconnect/:token", element: <ConnectPage kind="disconnect" /> },
  { path: "me", element: <MePage /> },
  { path: "guide", element: <GuidePage /> },
  { path: "lab/*", element: <LabPage /> },
];
