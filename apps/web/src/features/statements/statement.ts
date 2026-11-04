/**
 * E6 (ADR-0122): what the statement page draws from `GET /api/statements`. Amounts stay integer
 * strings until a chart needs a number.
 */
import type { Statement, StatementFlag } from "@remora/schema";

/** One bar a day: the day of the month and the USDC spent. */
export function dayBars(s: Statement): { day: string; usdc: number; payments: number }[] {
  return s.days.map((d) => ({
    day: String(Number(d.day.slice(8))),
    usdc: Number(d.amount) / 1e6,
    payments: d.payments,
  }));
}

/** The months to pick from, newest first, always including the one shown. */
export const monthOptions = (shown: string | null, recent: string[]) =>
  [...new Set([...(shown ? [shown] : []), ...recent])].sort().reverse();

export const dayLabel = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

export const FLAG_TITLE: Record<StatementFlag["kind"], string> = {
  spike: "Big day",
  new_payee: "New payee",
  price_change: "Price changed",
  price_hike: "Price hike",
  failed_run: "Failures in a row",
};

/** A payee first paid this month: its first payment is one of the month's new-payee flags. */
export const isNew = (firstPaid: string, s: Statement) =>
  s.flags.some((f) => f.kind === "new_payee" && f.at === firstPaid);

export const csvPath = (month: string) => `/api/statements/csv?month=${encodeURIComponent(month)}`;
