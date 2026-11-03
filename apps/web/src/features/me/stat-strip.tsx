import { Activity, Database } from "lucide-react";
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
    <div className={cn("ob-stat gap-2 p-3 sm:p-4", className)}>
      <div className="flex items-center gap-2 text-md text-ob-muted [&_svg]:size-4 [&_svg]:text-ob-dim">
        {icon}
        {label}
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold tracking-tight text-ob-text tabular-nums sm:text-2xl">
          {value}
        </span>
        {note ? <span className="text-md text-ob-muted">{note}</span> : null}
      </div>
      {progress === undefined ? null : <Progress value={progress} aria-label={label} />}
    </div>
  );
}

export function StatStrip({
  stored,
  total,
  usage,
}: {
  stored: number;
  total: number;
  usage: MemoryUsage | null;
}) {
  const answered = usage && usage.answers > 0 ? usage : null;
  // Nothing to measure yet: the list below says so with its own empty state.
  if (total === 0) return null;
  return (
    <div className={cn("grid grid-cols-2 gap-3", answered && "sm:grid-cols-3")}>
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
      {/* ADR-0103: who owns it is the chip above the strip; it isn't repeated here. */}
    </div>
  );
}
