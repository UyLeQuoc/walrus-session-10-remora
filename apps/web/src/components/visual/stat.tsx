/**
 * A number that matters (ADR-0103): the biggest thing in its spot, with its unit, a one- or
 * two-word label and, when there is one, what it's measured against.
 */
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "default" | "accent" | "success" | "warning" | "danger";

const TONE: Record<Tone, string> = {
  default: "text-ob-text",
  accent: "text-ob-accent-text",
  success: "text-ob-success-text",
  warning: "text-ob-warning-text",
  danger: "text-ob-danger-text",
};

export function Stat({
  label,
  value,
  unit,
  of,
  icon,
  tone = "default",
  size = "md",
  children,
  className,
  "data-testid": testId,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  /** What the number is measured against, e.g. "of 1.00". */
  of?: ReactNode;
  icon?: ReactNode;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
  /** A meter, a sparkline or a link under the number. */
  children?: ReactNode;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)} data-testid={testId}>
      <span className="flex items-center gap-1.5 text-xs font-medium text-ob-muted [&_svg]:size-3.5">
        {icon}
        {label}
      </span>
      <span className="flex min-w-0 flex-wrap items-baseline gap-x-1.5">
        <span
          className={cn(
            "font-semibold tracking-tight tabular-nums",
            size === "lg" ? "text-3xl" : size === "md" ? "text-2xl" : "text-lg",
            TONE[tone],
          )}
        >
          {value}
        </span>
        {unit ? <span className="text-sm font-medium text-ob-muted">{unit}</span> : null}
        {of ? <span className="text-sm text-ob-muted tabular-nums">{of}</span> : null}
      </span>
      {children}
    </div>
  );
}

/** A number still loading: a bar the size of one, visible on a raised card. */
export function StatPending({ wide = false }: { wide?: boolean }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={`inline-block h-7 animate-pulse rounded-md bg-ob-border-strong/60 align-middle motion-reduce:animate-none ${wide ? "w-20" : "w-10"}`}
    />
  );
}

/** A row of `Stat`s in cards: four across on a desktop, two on a phone. */
export function StatRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 md:grid-cols-4 [&>*]:rounded-xl [&>*]:border [&>*]:border-ob-border [&>*]:bg-ob-raised [&>*]:p-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
