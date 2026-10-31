/*
 * Ported from nightly-labs/openbot packages/ui/src/features/window/PageRail.tsx @ aa3c498.
 * PolyForm Noncommercial 1.0.0, see ../LICENSE.
 *
 * The page rail: a column of 36px icon buttons, the current page filled, a tooltip naming each one.
 * Remora (ADR-0095): `labeled` widens it and shows each page's name under its icon.
 */
import { Slot } from "radix-ui";
import { type ComponentProps, forwardRef, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function PageRail({
  logo,
  top,
  bottom,
  label,
  labeled = false,
}: {
  logo?: ReactNode;
  top: ReactNode;
  bottom?: ReactNode;
  label: string;
  labeled?: boolean;
}) {
  return (
    <nav className={cn("window-rail", labeled && "window-rail-labeled")} aria-label={label}>
      {logo ? <div className="window-rail-logo">{logo}</div> : null}
      <div className="window-rail-group">{top}</div>
      {bottom ? <div className="window-rail-group">{bottom}</div> : null}
    </nav>
  );
}

type RailButtonProps = ComponentProps<"button"> & {
  /** The page's name: the accessible label and the tooltip. */
  label: string;
  current?: boolean;
  /** A count on the button, such as the approvals that wait. */
  count?: number;
  asChild?: boolean;
};

export const RailButton = forwardRef<HTMLButtonElement, RailButtonProps>(function RailButton(
  { label, current = false, count, asChild = false, className, children, ...props },
  ref,
) {
  const Comp = asChild ? Slot.Root : "button";
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Comp
          ref={ref}
          className={cn("window-rail-button", className)}
          aria-label={count ? `${label} (${count})` : label}
          aria-current={current ? "page" : undefined}
          {...props}
        >
          {children}
        </Comp>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
});

/** The count for a rail button, drawn on its corner. */
export function RailCount({ value }: { value: number }) {
  if (!value) return null;
  return (
    <span className="window-rail-count" aria-hidden>
      {value > 99 ? "99+" : value}
    </span>
  );
}
