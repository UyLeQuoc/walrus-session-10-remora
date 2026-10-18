import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";
import { AppLayout } from "./app/app-layout";
import { NotFoundPage } from "./app/not-found";
import { Providers } from "./app/providers";
import { ChatPage } from "./features/chat/chat-page";
import { ConnectPage } from "./features/connect/connect-page";
import { GuidePage } from "./features/guide/guide-page";
import { MePage } from "./features/me/me-page";
import { TeamPage } from "./features/team/team-page";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

createRoot(root).render(
  <StrictMode>
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<ChatPage />} />
            <Route path="connect/:token" element={<ConnectPage kind="connect" />} />
            <Route path="disconnect/:token" element={<ConnectPage kind="disconnect" />} />
            <Route path="me" element={<MePage />} />
            <Route path="team" element={<TeamPage />} />
            <Route path="guide" element={<GuidePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Providers>
  </StrictMode>,
);
