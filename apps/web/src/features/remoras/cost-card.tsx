/**
 * N15/H3: what this remora cost in a month, split into the model, sponsored gas and purchases.
 * It sits beside the budget on Overview. The numbers are the server's; if the endpoint is missing
 * or fails, the card says cost isn't available and the rest of the page is untouched.
 */
import { CircleHelp } from "lucide-react";
import { useState } from "react";
import { Term } from "@/components/app/glossary";
import { Section } from "@/components/app/page";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { SurfaceCard } from "@/openbot/pages";
import {
  COST_PARTS,
  type CostResponse,
  costTotal,
  formatCost,
  formatShare,
  monthLabel,
  recentMonths,
} from "./cost";
import { useRemoraCost } from "./hooks";

function Rows({ cost }: { cost: CostResponse }) {
  const total = costTotal(cost);
  if (total === 0n)
    return (
      <p className="text-md text-ob-muted" data-testid="cost-empty">
        No spend this month
      </p>
    );
  return (
    <>
      <p className="text-3xl font-semibold tabular-nums" data-testid="cost-total">
        {formatCost(total)}
      </p>
      <dl className="flex flex-col gap-2 border-t border-ob-border-grouped pt-3">
        {COST_PARTS.map(({ key, label }) => {
          const part = BigInt(cost[key]);
          return (
            <div
              key={key}
              className="flex items-baseline justify-between gap-3 text-md"
              data-testid="cost-row"
            >
              <dt className="min-w-0 text-ob-secondary">
                {key === "gasUsdc" ? (
                  <>
                    Gas (<Term name="sponsored gas">sponsored</Term>)
                  </>
                ) : (
                  label
                )}
              </dt>
              <dd className="shrink-0 tabular-nums">
                {formatCost(part)}
                <span className="ml-2 inline-block w-10 text-right text-ob-muted">
                  {formatShare(part, total)}
                </span>
              </dd>
            </div>
          );
        })}
      </dl>
    </>
  );
}

export function CostCard({ remoraId }: { remoraId: string }) {
  const months = recentMonths();
  const [month, setMonth] = useState(months[0] ?? "");
  const query = useRemoraCost(remoraId, month);

  return (
    <Section
      title="Cost"
      description="What this remora spent, from its recorded turns, gas and payments."
      actions={
        <Select value={month} onValueChange={setMonth}>
          <SelectTrigger aria-label="Month" className="w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {months.map((m) => (
              <SelectItem key={m} value={m}>
                {monthLabel(m)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    >
      <SurfaceCard>
        {query.isPending ? (
          <div data-testid="cost-loading" className="flex flex-col gap-3">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
          </div>
        ) : query.isError ? (
          <p className="flex items-center gap-2 text-md text-ob-muted" data-testid="cost-error">
            <CircleHelp className="size-4 shrink-0" aria-hidden />
            Cost isn't available yet
          </p>
        ) : (
          <Rows cost={query.data} />
        )}
      </SurfaceCard>
    </Section>
  );
}
