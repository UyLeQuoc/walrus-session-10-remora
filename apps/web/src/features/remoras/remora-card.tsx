/**
 * A remora as an object: its face, name, kind, status and how much of its budget is left (D1).
 * ADR-0103: the budget is a meter, and a remora that never pays says so in two words.
 */
import type { RemoraView } from "@remora/schema";
import { EyeOff } from "lucide-react";
import { Link } from "react-router";
import { BudgetMeter } from "@/components/app/budget-meter";
import { RemoraAvatar, remoraMood } from "@/components/app/remora-avatar";
import { StatusBadge } from "@/components/app/status-badge";
import { kindName } from "@/lib/kind";
import { GalleryCard } from "@/openbot/pages";
import { useBudget } from "./use-budget";

export function RemoraCard({ remora }: { remora: RemoraView }) {
  const budget = remora.config.budget;
  const meter = useBudget(remora.id, Boolean(budget && remora.discId));
  const readable = Boolean(meter.meter?.window && BigInt(meter.meter.window.limit) > 0n);

  return (
    <Link
      to={`/remoras/${remora.id}`}
      className="block min-w-0 rounded-ob-card focus-visible:shadow-[0_0_0_1px_var(--openbot-border-focus)] focus-visible:outline-none"
      data-testid="remora-card"
    >
      <GalleryCard
        as="div"
        interactive
        media={<RemoraAvatar id={remora.id} mood={remoraMood(remora)} size={36} />}
        bareMedia
        title={<span className="min-w-0 truncate">{remora.name}</span>}
        byline={kindName(remora.template)}
        action={<StatusBadge status={remora.status} />}
        clamp={false}
      >
        {!budget ? (
          <p className="flex items-center gap-1.5 text-xs text-ob-muted">
            <EyeOff className="size-3.5" aria-hidden /> Never pays
          </p>
        ) : readable ? (
          <BudgetMeter meter={meter.meter} window={budget.window} compact />
        ) : meter.loading ? (
          <BudgetMeter meter={null} window={budget.window} compact />
        ) : (
          <p className="text-xs text-ob-muted">
            {remora.status === "retired" ? "Limit revoked" : "Limit not readable now"}
          </p>
        )}
      </GalleryCard>
    </Link>
  );
}
