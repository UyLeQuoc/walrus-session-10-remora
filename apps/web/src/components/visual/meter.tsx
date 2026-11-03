/**
 * Spent against a limit (ADR-0103). The bar turns amber at 80% and red at 100%; it fills once when
 * it appears and moves when the number changes. `Ring` is the same thing for a row.
 */
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EASE, SLOW, useCalm } from "./motion";

export function meterTone(ratio: number): "ok" | "high" | "over" {
  return ratio >= 1 ? "over" : ratio >= 0.8 ? "high" : "ok";
}

const FILL = {
  ok: "bg-ob-accent",
  high: "bg-ob-warning",
  over: "bg-ob-danger",
} as const;

const STROKE = {
  ok: "stroke-ob-accent",
  high: "stroke-ob-warning",
  over: "stroke-ob-danger",
} as const;

const ratioOf = (value: number, max: number) => (max > 0 ? Math.max(0, value / max) : 0);

export function Meter({
  value,
  max,
  label,
  left,
  right,
  size = "md",
  className,
  "data-testid": testId,
}: {
  value: number;
  max: number;
  /** The accessible name, e.g. "Spent this month". */
  label: string;
  /** Text under the bar's left end, e.g. "0.42 of 1.00 USDC". */
  left?: ReactNode;
  /** Text under the bar's right end, e.g. "this month". */
  right?: ReactNode;
  size?: "sm" | "md";
  className?: string;
  "data-testid"?: string;
}) {
  const calm = useCalm();
  const ratio = ratioOf(value, max);
  const tone = meterTone(ratio);
  const pct = Math.min(100, ratio * 100);
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)} data-testid={testId}>
      {/* biome-ignore lint/a11y/useSemanticElements: a styled bar whose fill animates; <meter> can't. */}
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.min(value, max)}
        aria-valuetext={`${Math.round(ratio * 100)}%`}
        data-tone={tone}
        className={cn(
          "relative w-full overflow-hidden rounded-full bg-ob-border-strong",
          size === "sm" ? "h-1.5" : "h-2.5",
        )}
      >
        <motion.div
          className={cn("absolute inset-y-0 left-0 rounded-full", FILL[tone])}
          initial={calm ? false : { width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: calm ? 0 : SLOW, ease: EASE }}
        />
      </div>
      {left || right ? (
        <div className="flex items-baseline justify-between gap-2 text-xs text-ob-muted tabular-nums">
          <span className="min-w-0 truncate">{left}</span>
          {right ? <span className="shrink-0">{right}</span> : null}
        </div>
      ) : null}
    </div>
  );
}

export function Ring({
  value,
  max,
  label,
  size = 28,
  stroke = 3.5,
  children,
  className,
}: {
  value: number;
  max: number;
  label: string;
  size?: number;
  stroke?: number;
  /** Centered inside, e.g. a face or a percentage. */
  children?: ReactNode;
  className?: string;
}) {
  const calm = useCalm();
  const ratio = ratioOf(value, max);
  const tone = meterTone(ratio);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const shown = Math.min(1, ratio);
  return (
    // biome-ignore lint/a11y/useSemanticElements: a styled bar whose fill animates; <meter> can't.
    <span
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.min(value, max)}
      aria-valuetext={`${Math.round(ratio * 100)}%`}
      data-tone={tone}
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-ob-control"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          className={STROKE[tone]}
          initial={calm ? false : { strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - shown) }}
          transition={{ duration: calm ? 0 : SLOW, ease: EASE }}
        />
      </svg>
      {children ? (
        <span className="absolute inset-0 flex items-center justify-center">{children}</span>
      ) : null}
    </span>
  );
}
