import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { ApprovalsPage } from "../features/approvals/approvals-page";
import { ChatPage } from "../features/chat/chat-page";
import { ConnectPage } from "../features/connect/connect-page";
import { FundsPage } from "../features/funds/funds-page";
import { GuidePage } from "../features/guide/guide-page";
import { HomePage } from "../features/home/home-page";
import { LabPage } from "../features/lab/lab-page";
import { MemoryInspectorPage } from "../features/memory-inspector/memory-page";
import { OnboardingPage } from "../features/onboarding/onboarding-page";
import { NewRemoraPage } from "../features/remoras/new-remora-page";
import { RemoraPage } from "../features/remoras/remora-page";
import { RemorasPage } from "../features/remoras/remoras-page";
import { SettingsPage } from "../features/settings/settings-page";
import { ImportTeamPage } from "../features/teams/import-page";
import { RoomPage } from "../features/threads/room-page";
import { ThreadPage } from "../features/threads/thread-page";
import { VerifyPage } from "../features/verify/verify-page";

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
  { element: <HomePage /> },
  { path: "chat", element: <ChatPage /> },
  { path: "connect/:token", element: <ConnectPage kind="connect" /> },
  { path: "disconnect/:token", element: <ConnectPage kind="disconnect" /> },
  { path: "me", element: <Navigate to="/memory?tab=chat" replace /> },
  { path: "guide", element: <GuidePage /> },
  { path: "lab/*", element: <LabPage /> },
  { path: "onboarding", element: <OnboardingPage /> },
  { path: "funds", element: <FundsPage /> },
  { path: "remoras", element: <RemorasPage /> },
  { path: "remoras/:id", element: <RemoraPage /> },
  { path: "memory", element: <MemoryInspectorPage /> },
  { path: "approvals", element: <ApprovalsPage /> },
  { path: "remoras/new", element: <NewRemoraPage /> },
  { path: "settings", element: <SettingsPage /> },
  { path: "verify", element: <VerifyPage /> },
  { path: "verify/:ref", element: <VerifyPage /> },
  { path: "chat/r/:id", element: <ThreadPage /> },
  { path: "chat/room/:id", element: <RoomPage /> },
  { path: "remoras/import", element: <ImportTeamPage /> },
];
