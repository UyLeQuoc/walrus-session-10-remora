import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { HatcheryPage } from "@/features/hatchery/gallery-page";
import { SharePage } from "@/features/hatchery/share-page";
import { TemplatePage } from "@/features/hatchery/template-page";
import { PlaygroundPage } from "@/features/playground/playground-page";
import { ApprovalsPage } from "../features/approvals/approvals-page";
import { ChangesPage } from "../features/changes/changes-page";
import { ChatPage } from "../features/chat/chat-page";
import { ConnectPage } from "../features/connect/connect-page";
import { ConnectionsPage } from "../features/connections/connections-page";
import { FundsPage } from "../features/funds/funds-page";
import { GuidePage } from "../features/guide/guide-page";
import { HomePage } from "../features/home/home-page";
import { LabPage } from "../features/lab/lab-page";
import { MemoryInspectorPage } from "../features/memory-inspector/memory-page";
import { OnboardingPage } from "../features/onboarding/onboarding-page";
import { PublicRemoraPage } from "../features/public-remora/public-remora-page";
import { ListApiPage } from "../features/reef/list-api-page";
import { ReefPage } from "../features/reef/reef-page";
import { NewRemoraPage } from "../features/remoras/new-remora-page";
import { RemoraPage } from "../features/remoras/remora-page";
import { RemorasPage } from "../features/remoras/remoras-page";
import { SettingsPage } from "../features/settings/settings-page";
import { StatementsPage } from "../features/statements/statements-page";
import { StatsPage } from "../features/status/stats-page";
import { StatusPage } from "../features/status/status-page";
import { ImportTeamPage } from "../features/teams/import-page";
import { TgPage } from "../features/tg/tg-page";
import { RoomPage } from "../features/threads/room-page";
import { ThreadPage } from "../features/threads/thread-page";
import { PublicWakePage } from "../features/verify/public-wake-page";
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
  { path: "remoras/:id/share", element: <SharePage /> },
  { path: "playground", element: <PlaygroundPage /> },
  { path: "hatchery", element: <HatcheryPage /> },
  { path: "hatchery/:id", element: <TemplatePage /> },
  { path: "connections", element: <ConnectionsPage /> },
  { path: "status", element: <StatusPage /> },
  { path: "reef", element: <ReefPage /> },
  { path: "reef/new", element: <ListApiPage /> },
  { path: "stats", element: <StatsPage /> },
  { path: "tg", element: <TgPage /> },
  { path: "p/:token", element: <PublicWakePage /> },
  { path: "r/:slug", element: <PublicRemoraPage /> },
  { path: "statements", element: <StatementsPage /> },
  { path: "changes/:id", element: <ChangesPage /> },
];
