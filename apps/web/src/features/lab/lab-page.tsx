/**
 * Uy's lab: demo and ops consoles built on Huấn's UI kit (docs/team-split.md §1). `/lab/health` is
 * the K2 status board (ADR-0052).
 */
import { Link, Route, Routes } from "react-router";
import { HealthBoard } from "./health-board";

function LabIndex() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-2 p-6">
      <h1 className="text-lg font-semibold">Lab</h1>
      <p className="text-sm text-muted-foreground">Ops consoles for Remora.</p>
      <ul className="list-disc pl-5 text-sm">
        <li>
          <Link className="link" to="/lab/health">
            Health
          </Link>
          : every dependency's status, with the fix when one isn't ok.
        </li>
      </ul>
    </div>
  );
}

export function LabPage() {
  return (
    <Routes>
      <Route index element={<LabIndex />} />
      <Route path="health" element={<HealthBoard />} />
    </Routes>
  );
}
