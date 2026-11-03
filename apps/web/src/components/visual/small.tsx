/**
 * The kit's small pieces (ADR-0103): a memory's days left, a trend line, a status dot, the one
 * empty state, the `?` hint that holds the words a page no longer shows, and one way to write money,
 * addresses and digests.
 */
import { CircleHelp } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { RemoraAvatar, type RemoraMood } from "@/components/app/remora-avatar";
import { Hash } from "@/components/hash";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { explorerTx, usdc } from "@/lib/usdc";
import { cn } from "@/lib/utils";

/** Walrus keeps a memory about 210 days at write time (docs/tech-reference.md §1.11). */
export const MEMORY_DAYS = 210;

export function ExpiryBar({
  days,
  of = MEMORY_DAYS,
  className,
}: {
  days: number;
  of?: number;
  className?: string;
}) {
  const ratio = Math.max(0, Math.min(1, days / of));
  const tone = days <= 30 ? "bg-ob-danger" : days <= 60 ? "bg-ob-warning" : "bg-ob-success";
  return (
    <span className={cn("inline-flex items-center gap-1.5", className)}>
      {/* biome-ignore lint/a11y/useSemanticElements: a styled bar whose fill animates; <meter> can't. */}
      <span
        role="meter"
        aria-label={`${days} days left on Walrus`}
        aria-valuemin={0}
        aria-valuemax={of}
        aria-valuenow={days}
        className="relative h-1.5 w-12 overflow-hidden rounded-full bg-ob-control"
      >
        <span
          className={cn("absolute inset-y-0 left-0 rounded-full", tone)}
          style={{ width: `${ratio * 100}%` }}
        />
      </span>
      <span className="text-xs tabular-nums text-ob-muted">{days}d</span>
    </span>
  );
}

export function Spark({
  values,
  label,
  width = 72,
  height = 22,
  tone = "accent",
  className,
}: {
  values: number[];
  /** Says what the line shows, e.g. "Score over the last 8 answers: 0.4 to 0.9". */
  label: string;
  width?: number;
  height?: number;
  tone?: "accent" | "success" | "danger";
  className?: string;
}) {
  if (values.length === 0) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = values.length > 1 ? (width - 4) / (values.length - 1) : 0;
  const pts = values.map(
    (v, i) => [2 + i * step, height - 2 - ((v - min) / span) * (height - 4)] as const,
  );
  const last = pts[pts.length - 1] ?? [2, height / 2];
  const stroke =
    tone === "success"
      ? "stroke-ob-success"
      : tone === "danger"
        ? "stroke-ob-danger"
        : "stroke-ob-accent";
  const fill =
    tone === "success"
      ? "fill-ob-success"
      : tone === "danger"
        ? "fill-ob-danger"
        : "fill-ob-accent";
  return (
    <svg
      role="img"
      aria-label={label}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={cn("shrink-0 overflow-visible", className)}
    >
      <polyline
        points={pts.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        strokeWidth={1.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={stroke}
      />
      <circle cx={last[0]} cy={last[1]} r={2.5} className={fill} />
    </svg>
  );
}

export type DotState = "ok" | "degraded" | "down" | "off";

const DOT: Record<DotState, string> = {
  ok: "bg-ob-success",
  degraded: "bg-ob-warning",
  down: "bg-ob-danger",
  off: "bg-ob-muted",
};

export function StatusDot({
  state,
  label,
  className,
}: {
  state: DotState;
  /** Read by screen readers and shown on hover, e.g. "Tatum: degraded". */
  label: string;
  className?: string;
}) {
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      data-state={state}
      className={cn("inline-block size-2 shrink-0 rounded-full", DOT[state], className)}
    />
  );
}

export function Empty({
  title,
  action,
  mood = "idle",
  face = "empty",
  className,
}: {
  /** One line. */
  title: ReactNode;
  action?: ReactNode;
  mood?: RemoraMood;
  /** Seeds the face's tint and shape. */
  face?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-xl border border-dashed border-ob-border px-6 py-8 text-center",
        className,
      )}
    >
      <RemoraAvatar id={face} mood={mood} size={56} />
      <p className="max-w-sm text-sm text-ob-secondary">{title}</p>
      {action}
    </div>
  );
}

export function Hint({
  children,
  to = "/guide",
  label = "What's this?",
  className,
}: {
  /** One or two sentences. */
  children: ReactNode;
  /** Where the guide explains it in full. */
  to?: string;
  label?: string;
  className?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={cn(
            "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-ob-muted transition-colors hover:text-ob-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [&_svg]:size-3.5",
            className,
          )}
        >
          <CircleHelp aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent className="flex max-w-xs flex-col gap-2 text-sm" align="start">
        <div className="text-ob-secondary">{children}</div>
        <Link className="link text-xs" to={to}>
          More in the guide
        </Link>
      </PopoverContent>
    </Popover>
  );
}

/** Money in USDC's smallest unit, written one way everywhere: "0.01 USDC". */
export function Amount({
  value,
  unit = "USDC",
  className,
}: {
  value: string | bigint;
  unit?: string | null;
  className?: string;
}) {
  return (
    <span className={cn("tabular-nums", className)}>
      {usdc(value)}
      {unit ? <span className="ml-1 text-[0.85em] text-ob-muted">{unit}</span> : null}
    </span>
  );
}

/** A transaction digest: short, copyable, and linked to the explorer. */
export function Digest({ value, network = "testnet" }: { value: string; network?: string }) {
  return <Hash value={value} href={explorerTx(network, value)} label="digest" />;
}

/** An address: short and copyable. */
export function Address({ value, href }: { value: string; href?: string }) {
  return <Hash value={value} href={href} label="address" />;
}
