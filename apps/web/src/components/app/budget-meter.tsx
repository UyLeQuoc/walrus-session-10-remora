/**
 * A Disc's remaining budget, drawn the same way on the remora page and on Home (N5). ADR-0103: a
 * meter of what this window has spent, with what's left and when it runs out under it.
 */
import type { BudgetMeter as Meter } from "@remora/schema";
import { Meter as Bar } from "@/components/visual";
import { usdc } from "@/lib/usdc";

/** `2027-10-09` → "Oct 9, 2027". The forecast is a calendar day, so it's read in UTC. */
export const calendarDay = (iso: string) => {
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      });
};

export function BudgetMeter({
  meter,
  window,
  compact = false,
  loading = true,
}: {
  meter: Meter | null;
  window: "day" | "week" | "month" | null;
  /** A card: the bar and one line, no forecast or total. */
  compact?: boolean;
  /** False once the read is done: a missing limit then says so instead of loading forever. */
  loading?: boolean;
}) {
  if (!meter?.window) {
    // ADR-0103: the same bar in every state: loading pulses, unreadable is an empty track that says so.
    return (
      <div className="flex flex-col gap-1.5" data-testid="budget-meter-unknown">
        <div
          className={`h-2.5 w-full rounded-full bg-ob-border-strong/50 ${loading ? "animate-pulse motion-reduce:animate-none" : ""}`}
        />
        <p className="text-xs text-ob-muted">
          {loading ? "Reading its spending limit" : "Spending limit can't be read right now"}
        </p>
      </div>
    );
  }
  const limit = BigInt(meter.window.limit);
  const spent = BigInt(meter.window.spent);
  const left = limit > spent ? limit - spent : 0n;
  const per = window ?? "window";
  return (
    <div className="flex flex-col gap-1.5" data-testid="budget-meter">
      <Bar
        value={Number(spent)}
        max={Number(limit)}
        label={`Spent this ${per}`}
        size={compact ? "sm" : "md"}
        left={
          <>
            <span className="font-semibold text-ob-text">{usdc(left)}</span> of {usdc(limit)} USDC
            left
          </>
        }
        right={`this ${per}`}
      />
      {compact ? null : (
        <p className="flex flex-wrap justify-between gap-x-3 text-xs text-ob-muted tabular-nums">
          <span>
            {usdc(spent)} spent in total{meter.paused ? " · paused" : ""}
          </span>
          {meter.forecast?.runsOutOn ? (
            <span>runs out around {calendarDay(meter.forecast.runsOutOn)}</span>
          ) : null}
        </p>
      )}
    </div>
  );
}
