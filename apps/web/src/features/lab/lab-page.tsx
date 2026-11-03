/**
 * Uy's lab: demo and ops consoles built on Huấn's UI kit (docs/team-split.md §1). `/lab/health` is
 * the K2 status board (ADR-0052).
 */
import { Link, Route, Routes } from "react-router";
import { Page, PageHeader } from "@/components/app/page";
import { HealthBoard } from "./health-board";
import { VisualKit } from "./visual-kit";

function LabIndex() {
  return (
    <Page title="Lab">
      <PageHeader title="Lab" description="Ops consoles for Remora." />
      <ul className="ob-group max-w-2xl">
        <li className="px-4 py-3 text-md text-ob-secondary">
          <Link className="link font-medium" to="/lab/health">
            Health
          </Link>
          : every dependency's status, with the fix when one isn't ok.
        </li>
        <li className="px-4 py-3 text-md text-ob-secondary">
          <Link className="link font-medium" to="/lab/visual">
            Visual kit
          </Link>
          : every piece of the kit (U14).
        </li>
      </ul>
    </Page>
  );
}

export function LabPage() {
  return (
    <Routes>
      <Route index element={<LabIndex />} />
      <Route path="health" element={<HealthBoard />} />
      <Route path="visual" element={<VisualKit />} />
    </Routes>
  );
}
