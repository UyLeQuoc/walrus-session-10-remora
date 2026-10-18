import { Activity, Database, UserRound, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import { Progress } from "@/components/ui/progress";
import type { MemoryUsage } from "@/features/me/use-usage";
import { cn } from "@/lib/utils";

function share(part: number, whole: number): number {
  return whole > 0 ? Math.round((part / whole) * 100) : 0;
}

function Tile({
  icon,
  label,
  value,
  progress,
  note,
  className,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  progress?: number;
  note?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("flex flex-col gap-2 rounded-xl border bg-card p-3 sm:gap-3 sm:p-4", className)}
    >
      <div className="flex items-center gap-2 text-sm text-muted-foreground [&_svg]:size-4 [&_svg]:text-brand">
        {icon}
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-medium sm:text-2xl">{value}</span>
        {note ? <span className="text-sm text-muted-foreground">{note}</span> : null}
      </div>
      {progress === undefined ? null : (
        <Progress
          value={progress}
          aria-label={label}
          className="bg-brand/20 [&>[data-slot=progress-indicator]]:bg-brand"
        />
      )}
    </div>
  );
}

export function StatStrip({
  stored,
  total,
  usage,
  owned,
}: {
  stored: number;
  total: number;
  usage: MemoryUsage | null;
  owned: boolean;
}) {
  const answered = usage && usage.answers > 0 ? usage : null;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      <Tile
        icon={<Database />}
        label="On Walrus"
        value={`${stored} of ${total}`}
        progress={share(stored, total)}
      />
      {answered ? (
        <Tile
          icon={<Activity />}
          label="Answers that used your memory"
          value={`${answered.withMemory} of ${answered.answers}`}
          note={`${share(answered.withMemory, answered.answers)}%`}
          progress={share(answered.withMemory, answered.answers)}
        />
      ) : null}
      <Tile
        icon={owned ? <Wallet /> : <UserRound />}
        label="Owned by"
        value={owned ? "You" : "hippo, for now"}
        className={answered ? "col-span-2 sm:col-span-1" : undefined}
      />
    </div>
  );
}
