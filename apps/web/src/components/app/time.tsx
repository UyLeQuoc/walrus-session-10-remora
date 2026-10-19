/** "2h ago", with the full timestamp on hover and in the `title` (A8). */
import { ago } from "@/lib/ago";
import { cn } from "@/lib/utils";

export function Time({ value, className }: { value: string | Date; className?: string }) {
  const date = typeof value === "string" ? new Date(value) : value;
  const iso = date.toISOString();
  return (
    <time dateTime={iso} title={date.toLocaleString()} className={cn("text-xs", className)}>
      {ago(iso)}
    </time>
  );
}
