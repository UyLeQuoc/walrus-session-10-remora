/**
 * A receipt as a ticket (ADR-0103): the amount, who was paid, when, and whether it checks out on Sui.
 * The notches are drawn with a CSS mask, so the ticket sits on any surface.
 */
import { BadgeCheck, CircleAlert, LoaderCircle } from "lucide-react";
import type { ReactNode } from "react";
import { Time } from "@/components/app/time";
import { cn } from "@/lib/utils";

const NOTCH =
  "radial-gradient(circle 7px at 0 50%, transparent 98%, #000) left / 51% 100% no-repeat, radial-gradient(circle 7px at 100% 50%, transparent 98%, #000) right / 51% 100% no-repeat";

export function Receipt({
  amount,
  unit = "USDC",
  payee,
  at,
  verified,
  proof,
  footer,
  compact = false,
  className,
  "data-testid": testId,
}: {
  amount: ReactNode;
  unit?: string;
  payee: ReactNode;
  at?: string;
  /** true: checks out onchain; false: it doesn't; null: not checked yet. */
  verified?: boolean | null;
  /** The digest or a link to the check. */
  proof?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
  className?: string;
  "data-testid"?: string;
}) {
  return (
    <div
      data-testid={testId}
      className={cn(
        "relative flex w-full max-w-sm flex-col border border-ob-border bg-ob-raised",
        compact ? "rounded-lg" : "rounded-xl",
        className,
      )}
      style={{ mask: NOTCH, WebkitMask: NOTCH }}
    >
      <div className={cn("flex items-start justify-between gap-3", compact ? "p-3" : "p-4")}>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-ob-muted">Paid to</span>
          <span className="truncate text-sm font-medium text-ob-text">{payee}</span>
          {at ? <Time value={at} className="text-ob-muted" /> : null}
        </div>
        <span className="flex shrink-0 items-baseline gap-1">
          <span
            className={cn(
              "font-semibold tracking-tight tabular-nums text-ob-text",
              compact ? "text-lg" : "text-2xl",
            )}
          >
            {amount}
          </span>
          <span className="text-xs font-medium text-ob-muted">{unit}</span>
        </span>
      </div>
      <div aria-hidden className="mx-3 border-t border-dashed border-ob-border-strong" />
      <div
        className={cn(
          "flex min-w-0 items-center gap-2 text-xs",
          compact ? "px-3 py-2" : "px-4 py-2.5",
        )}
      >
        {verified === true ? (
          <span className="flex shrink-0 items-center gap-1 font-medium text-ob-success-text">
            <BadgeCheck className="size-3.5" aria-hidden /> Checks out on Sui
          </span>
        ) : verified === false ? (
          <span className="flex shrink-0 items-center gap-1 font-medium text-ob-danger-text">
            <CircleAlert className="size-3.5" aria-hidden /> Doesn't check out
          </span>
        ) : verified === null ? (
          <span className="flex shrink-0 items-center gap-1 text-ob-muted">
            <LoaderCircle
              className="size-3.5 animate-spin motion-reduce:animate-none"
              aria-hidden
            />{" "}
            Checking
          </span>
        ) : null}
        {proof ? <span className="flex min-w-0 flex-1 justify-end">{proof}</span> : null}
      </div>
      {footer ? <div className="border-t border-ob-border px-4 py-2.5">{footer}</div> : null}
    </div>
  );
}
