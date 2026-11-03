/** A stepper (ADR-0103): where you are in a flow, with a check on every step that's done. */
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Step = { label: string; icon?: ReactNode };

export function Steps({
  steps,
  current,
  label,
  className,
}: {
  steps: Step[];
  /** The index of the step in progress; `steps.length` when all are done. */
  current: number;
  label: string;
  className?: string;
}) {
  return (
    <ol aria-label={label} className={cn("flex w-full items-center gap-1.5", className)}>
      {steps.map((s, i) => {
        const state = i < current ? "done" : i === current ? "now" : "next";
        return (
          <li
            key={s.label}
            aria-current={state === "now" ? "step" : undefined}
            data-state={state}
            className="flex min-w-0 flex-1 items-center gap-1.5 last:flex-none"
          >
            <span
              className={cn(
                "flex size-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-semibold transition-colors duration-300 [&_svg]:size-3.5",
                state === "done" && "border-ob-success bg-ob-success text-white",
                state === "now" && "border-ob-accent bg-ob-accent-soft text-ob-accent-text",
                state === "next" && "border-ob-border-strong text-ob-muted",
              )}
            >
              {state === "done" ? <Check aria-hidden /> : (s.icon ?? i + 1)}
            </span>
            <span
              className={cn(
                "truncate text-xs font-medium",
                state === "next" ? "text-ob-muted" : "text-ob-text",
                state !== "now" && "hidden sm:inline",
              )}
            >
              {s.label}
              {state === "done" ? <span className="sr-only"> (done)</span> : null}
            </span>
            {i < steps.length - 1 ? (
              <span
                aria-hidden
                className={cn(
                  "h-px min-w-3 flex-1 transition-colors duration-300",
                  i < current ? "bg-ob-success" : "bg-ob-border-strong",
                )}
              />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
