/**
 * One way to write a moment that's coming up (ADR-0103: the reviewers found seven date styles):
 * "Today 3:00 PM", "Tomorrow 3:00 PM", "Fri 3:00 PM" within a week, "Nov 12, 3:00 PM" after.
 * Past moments use `<Time>` ("2h ago", the full time on hover).
 */
export function soon(iso: string, now = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const days = Math.round((startOf(d) - startOf(now)) / 86_400_000);
  if (days === 0) return `Today ${time}`;
  if (days === 1) return `Tomorrow ${time}`;
  if (days > 1 && days < 7) return `${d.toLocaleDateString("en-US", { weekday: "short" })} ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric" })}, ${time}`;
}

/** A calendar day: "Nov 10". */
export const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
