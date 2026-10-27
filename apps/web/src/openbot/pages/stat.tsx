/*
 * Ported from nightly-labs/openbot packages/ui/src/features/usage/AgentUsageReport.tsx and
 * agent-usage-report.css (the totals and the hero number) @ aa3c498.
 * PolyForm Noncommercial 1.0.0, see ../LICENSE.
 *
 * A labelled total on the group's surface: a muted label (with a tone dot), the number, a line
 * under it and an optional action.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function StatCard({
  label,
  value,
  hint,
  tone,
  action,
  className,
  "data-testid": testId,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "warning" | "success";
  action?: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <div
      data-slot="stat"
      data-testid={testId}
      data-tone={tone && tone !== "default" ? tone : undefined}
      className={cn("ob-stat", className)}
    >
      <p className="ob-stat-label">{label}</p>
      <p className="ob-stat-value">{value}</p>
      {hint ? <p className="ob-stat-hint">{hint}</p> : null}
      {action ? <div className="ob-stat-action">{action}</div> : null}
    </div>
  );
}
