/** A labelled number for Funds, Home and Memory (ADR-0036 §2.2), as openbot's usage total. */
import type { ReactNode } from "react";
import { StatCard } from "@/openbot/pages";

export function StatTile({
  label,
  value,
  hint,
  tone = "default",
  action,
  "data-testid": testId,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: "default" | "warning" | "success";
  action?: ReactNode;
  "data-testid"?: string;
}) {
  return (
    <StatCard
      label={label}
      value={value}
      hint={hint}
      tone={tone}
      action={action}
      data-testid={testId}
    />
  );
}
