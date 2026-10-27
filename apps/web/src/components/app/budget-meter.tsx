/** A Disc's remaining budget, drawn the same way on the remora page and on Home (N5). */
import type { BudgetMeter as Meter } from "@remora/schema";
import { Progress } from "@/components/ui/progress";
import { usdc } from "@/lib/usdc";

export function BudgetMeter({
  meter,
  window,
}: {
  meter: Meter | null;
  window: "day" | "week" | "month" | null;
}) {
  if (!meter?.window) {
    return <p className="text-md text-ob-muted">Reading the Disc…</p>;
  }
  const limit = BigInt(meter.window.limit);
  const spent = BigInt(meter.window.spent);
  const left = limit > spent ? limit - spent : 0n;
  const used = limit > 0n ? Number((spent * 100n) / limit) : 0;
  return (
    <div className="flex flex-col gap-2" data-testid="budget-meter">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-md text-ob-secondary">
          <span className="text-base font-semibold tracking-tight text-ob-text tabular-nums">
            {usdc(left)}
          </span>{" "}
          of {usdc(limit)} USDC left this {window ?? "window"}
        </p>
        {meter.forecast?.runsOutOn ? (
          <p className="text-xs text-ob-muted">runs out around {meter.forecast.runsOutOn}</p>
        ) : null}
      </div>
      <Progress
        value={Math.min(100, Math.max(0, used))}
        aria-label={`${used}% of this ${window ?? "window"}'s budget spent`}
      />
      <p className="text-xs text-ob-muted tabular-nums">
        {usdc(spent)} spent in total{meter.paused ? " · paused" : ""}
      </p>
    </div>
  );
}
