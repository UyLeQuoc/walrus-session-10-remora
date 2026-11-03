/**
 * A flow as a picture (ADR-0103): nodes in a row (a column on a phone) joined by edges. A dot runs
 * along the `active` edge while the diagram is on screen, to show what moves; reduced motion leaves
 * it at the end of the edge. The list of nodes is the text alternative.
 */
import { motion } from "motion/react";
import { type ReactNode, useRef } from "react";
import { cn } from "@/lib/utils";
import { useCalm, useOnScreen } from "./motion";

export type FlowNode = {
  id: string;
  label: string;
  icon?: ReactNode;
  /** A short second line: an amount, a rule, a name. */
  sub?: ReactNode;
  tone?: "default" | "accent" | "success" | "danger";
};

const NODE_TONE = {
  default: "border-ob-border bg-ob-raised text-ob-text",
  accent: "border-ob-accent/40 bg-ob-accent-soft text-ob-accent-text",
  success: "border-ob-success/40 bg-ob-success-soft text-ob-success-text",
  danger: "border-ob-danger/40 bg-ob-danger-soft text-ob-danger-text",
} as const;

/** The moving dot: along x in the desktop row, along y in the phone column. */
function Dot({ axis, blocked, moving }: { axis: "x" | "y"; blocked: boolean; moving: boolean }) {
  const prop = axis === "x" ? "left" : "top";
  const end = blocked ? "50%" : "calc(100% - 8px)";
  return (
    <motion.span
      className={cn(
        "absolute size-2 rounded-full",
        blocked ? "bg-ob-danger" : "bg-ob-accent",
        axis === "x" ? "top-1/2 -mt-1 hidden md:block" : "left-1/2 -ml-1 md:hidden",
      )}
      initial={false}
      animate={
        moving
          ? { [prop]: ["0%", end], opacity: [0, 1, 1, blocked ? 0 : 1] }
          : { [prop]: end, opacity: 1 }
      }
      transition={
        moving
          ? { duration: 1.6, repeat: Number.POSITIVE_INFINITY, repeatDelay: 0.8, ease: "easeInOut" }
          : { duration: 0 }
      }
    />
  );
}

function Edge({ label, active, blocked }: { label?: string; active: boolean; blocked: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const on = useOnScreen(ref);
  const calm = useCalm();
  return (
    <div
      ref={ref}
      aria-hidden
      className="relative flex min-h-6 min-w-6 flex-1 items-center justify-center self-stretch md:min-h-0 md:self-auto"
    >
      <div
        className={cn(
          "absolute md:inset-x-0 md:top-1/2 md:h-px md:w-auto md:-translate-y-1/2 inset-y-0 left-1/2 w-px -translate-x-1/2 md:left-0 md:translate-x-0",
          blocked ? "bg-ob-danger/60" : active ? "bg-ob-accent/60" : "bg-ob-border-strong",
        )}
      />
      {label ? (
        <span className="relative z-10 rounded-full bg-ob-canvas px-1.5 font-mono text-[10px] text-ob-muted md:-translate-y-3">
          {label}
        </span>
      ) : null}
      {active ? (
        <>
          <Dot axis="x" blocked={blocked} moving={!calm && on} />
          <Dot axis="y" blocked={blocked} moving={!calm && on} />
        </>
      ) : null}
    </div>
  );
}

export function Flow({
  nodes,
  edges = [],
  active,
  blockedAt,
  label,
  className,
}: {
  nodes: FlowNode[];
  /** A label per edge (`edges[i]` sits between `nodes[i]` and `nodes[i + 1]`). */
  edges?: Array<string | undefined>;
  /** The edge the dot runs along. */
  active?: number;
  /** The edge where the flow stops (the dot fades halfway, the edge turns red). */
  blockedAt?: number;
  /** The accessible name of the whole diagram. */
  label: string;
  className?: string;
}) {
  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <ol
        aria-label={label}
        className="flex flex-col items-stretch gap-0 md:flex-row md:items-center"
      >
        {nodes.map((n, i) => (
          <li key={n.id} className="contents">
            <div
              className={cn(
                "flex min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 md:flex-col md:items-center md:gap-1.5 md:px-3 md:py-3 md:text-center",
                NODE_TONE[n.tone ?? "default"],
              )}
            >
              {n.icon ? (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-ob-canvas/60 [&_svg]:size-4">
                  {n.icon}
                </span>
              ) : null}
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium leading-tight">{n.label}</span>
                {n.sub ? <span className="text-xs text-ob-muted tabular-nums">{n.sub}</span> : null}
              </span>
            </div>
            {i < nodes.length - 1 ? (
              <Edge
                label={edges[i]}
                active={active === i || blockedAt === i}
                blocked={blockedAt === i}
              />
            ) : null}
          </li>
        ))}
      </ol>
    </figure>
  );
}
