/**
 * Checks that light up one by one (ADR-0103): the safety layers, or what verifying a receipt
 * confirmed. Each row is text, so the list reads the same without the colours.
 */
import { Check, Minus, X } from "lucide-react";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { EASE, FAST, useCalm } from "./motion";

export type CheckState = "pass" | "fail" | "pending" | "skip";

export type CheckItem = {
  label: string;
  state: CheckState;
  /** One short line: what it checked, or why it failed. */
  detail?: ReactNode;
  icon?: ReactNode;
};

const MARK: Record<CheckState, { icon: ReactNode; tone: string; word: string }> = {
  pass: { icon: <Check />, tone: "bg-ob-success text-white", word: "passed" },
  fail: { icon: <X />, tone: "bg-ob-danger text-white", word: "failed" },
  pending: { icon: <Minus />, tone: "bg-ob-control text-ob-muted", word: "not checked yet" },
  skip: { icon: <Minus />, tone: "bg-ob-control text-ob-muted", word: "skipped" },
};

export function Checks({
  items,
  label,
  layout = "list",
  className,
}: {
  items: CheckItem[];
  label: string;
  /** `row`: side by side on a desktop (the safety layers). */
  layout?: "list" | "row";
  className?: string;
}) {
  const calm = useCalm();
  return (
    <ul
      aria-label={label}
      className={cn(
        layout === "row" ? "grid gap-2 md:grid-cols-3" : "flex flex-col gap-2",
        className,
      )}
    >
      {items.map((item, i) => {
        const mark = MARK[item.state];
        return (
          <motion.li
            key={item.label}
            data-state={item.state}
            initial={calm ? false : { opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: calm ? 0 : FAST, delay: calm ? 0 : i * 0.12, ease: EASE }}
            className={cn(
              "flex items-start gap-2.5 rounded-lg border px-3 py-2.5",
              item.state === "fail"
                ? "border-ob-danger/40 bg-ob-danger-soft"
                : item.state === "pass"
                  ? "border-ob-border bg-ob-raised"
                  : "border-ob-border bg-transparent",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full [&_svg]:size-3",
                mark.tone,
              )}
            >
              {mark.icon}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="flex items-center gap-1.5 text-sm font-medium text-ob-text [&_svg]:size-3.5 [&_svg]:text-ob-muted">
                {item.icon}
                {item.label}
                <span className="sr-only">: {mark.word}</span>
              </span>
              {item.detail ? <span className="text-xs text-ob-muted">{item.detail}</span> : null}
            </span>
          </motion.li>
        );
      })}
    </ul>
  );
}
