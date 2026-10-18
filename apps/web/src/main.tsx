import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router";
import "./index.css";
import { AppLayout } from "./app/app-layout";
import { NotFoundPage } from "./app/not-found";
import { Providers } from "./app/providers";
import { APP_ROUTES } from "./app/routes";

const root = document.getElementById("root");
if (!root) throw new Error("#root missing");

createRoot(root).render(
  <StrictMode>
    <Providers>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            {APP_ROUTES.map((r) =>
              r.path ? (
                <Route key={r.path} path={r.path} element={r.element} />
              ) : (
                <Route key="index" index element={r.element} />
              ),
            )}
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </Providers>
  </StrictMode>,
);
