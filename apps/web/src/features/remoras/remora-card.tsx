/** A remora as an object: name, status, template and how much of its budget is left (D1). */
import type { RemoraView } from "@remora/schema";
import { Link } from "react-router";
import { BudgetMeter } from "@/components/app/budget-meter";
import { RemoraAvatar, remoraMood } from "@/components/app/remora-avatar";
import { StatusBadge } from "@/components/app/status-badge";
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
        byline={remora.template.charAt(0).toUpperCase() + remora.template.slice(1)}
        action={<StatusBadge status={remora.status} />}
        clamp={false}
      >
        {!budget ? (
          <p className="text-md text-ob-muted">Read-only: no budget to spend.</p>
        ) : readable ? (
          <BudgetMeter meter={meter.meter} window={budget.window} />
        ) : (
          <p className="text-md text-ob-muted">
            {meter.loading
              ? "Reading its spending limit…"
              : meter.error || "Budget not readable just now."}
          </p>
        )}
      </GalleryCard>
    </Link>
  );
}
