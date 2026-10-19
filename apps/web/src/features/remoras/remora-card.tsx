/** A remora as an object: name, status, template and how much of its budget is left (D1). */
import type { RemoraView } from "@remora/schema";
import { ChevronRight } from "lucide-react";
import { Link } from "react-router";
import { BudgetMeter } from "@/components/app/budget-meter";
import { StatusBadge } from "@/components/app/status-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useBudget } from "./use-budget";

export function RemoraCard({ remora }: { remora: RemoraView }) {
  const budget = remora.config.budget;
  const meter = useBudget(remora.id, Boolean(budget && remora.discId));
  const readable = Boolean(meter.meter?.window && BigInt(meter.meter.window.limit) > 0n);

  return (
    <Link
      to={`/remoras/${remora.id}`}
      className="block rounded-xl focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
      data-testid="remora-card"
    >
      <Card className="h-full transition-colors hover:bg-muted/40">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {remora.name}
            <StatusBadge status={remora.status} />
            <ChevronRight aria-hidden className="ml-auto size-4 text-muted-foreground" />
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {remora.template.charAt(0).toUpperCase() + remora.template.slice(1)}
          </p>
        </CardHeader>
        <CardContent>
          {!budget ? (
            <p className="text-sm text-muted-foreground">Read-only: no budget to spend.</p>
          ) : readable ? (
            <BudgetMeter meter={meter.meter} window={budget.window} />
          ) : (
            <p className="text-sm text-muted-foreground">
              {meter.loading ? "Reading the Disc…" : meter.error || "Budget not readable just now."}
            </p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
