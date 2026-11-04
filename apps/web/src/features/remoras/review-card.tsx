/**
 * ADR-0128 (F10): what a remora learned this week, from its own numbers, written back to its memory.
 * Mondays at 09:00 your time, or now; the next one reads this one.
 */
import type { RemoraView } from "@remora/schema";
import { Brain, NotebookPen } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Section } from "@/components/app/page";
import { Time } from "@/components/app/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Problem } from "@/components/visual";
import { usdc } from "@/lib/usdc";
import { api, type ReviewsView } from "./api";
import { useLoad } from "./hooks";

type Review = ReviewsView["reviews"][number];

function SpendBars({ days }: { days: Review["facts"]["days"] }) {
  const max = Math.max(1, ...days.map((d) => Number(d.spent)));
  return (
    <div
      className="flex h-16 items-end gap-1"
      role="img"
      aria-label={`Spend per day: ${days.map((d) => `${d.date.slice(5)} ${usdc(d.spent)}`).join(", ")} USDC`}
    >
      {days.map((d) => (
        <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
          <div
            className="w-full rounded-sm bg-ob-accent/70"
            style={{ height: `${Math.max(2, (Number(d.spent) / max) * 48)}px` }}
          />
          <span className="text-[10px] text-ob-muted tabular-nums">{d.date.slice(8)}</span>
        </div>
      ))}
    </div>
  );
}

export function ReviewCard({ r }: { r: RemoraView }) {
  const view = useLoad(() => api.reviews(r.id), [r.id]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (view.error) return <Problem title="Can't load its reviews." detail={view.error} />;
  const reviews = view.data?.reviews ?? [];
  const [last, ...older] = reviews;

  const write = async () => {
    setBusy(true);
    setError("");
    const out = await api.writeReview(r.id);
    setBusy(false);
    if (!out.ok) return setError(out.error);
    void view.refresh();
  };

  return (
    <Section
      title="What it learned this week"
      hint="Written every Monday at 9:00 your time from its own numbers, then saved to its memory. The next one reads this one."
      actions={
        r.status === "retired" ? null : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-mr-3"
            disabled={busy}
            onClick={() => void write()}
            data-testid="review-write"
          >
            {busy ? <Spinner /> : <NotebookPen className="size-4" aria-hidden />} Write it now
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4" data-testid="review-card">
        {last ? (
          <div className="grid gap-4 md:grid-cols-[1fr_14rem]">
            <ul className="flex flex-col gap-1.5 text-md" data-testid="review-lines">
              {last.lines.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <div className="flex flex-col gap-2">
              <SpendBars days={last.facts.days} />
              <div className="flex flex-wrap gap-1.5 text-xs">
                <Badge variant="secondary">
                  {usdc(last.facts.spent)}
                  {last.facts.limit ? ` of ${usdc(last.facts.limit)}` : ""} USDC
                </Badge>
                <Badge variant="outline">{last.facts.useful} useful</Badge>
                <Badge variant="outline">{last.facts.noise} noise</Badge>
              </div>
              <p className="flex items-center gap-1.5 text-xs text-ob-muted">
                <Brain className="size-3.5" aria-hidden />
                {last.blobId ? (
                  <Link
                    to={`/memory?remora=${r.id}&blob=${encodeURIComponent(last.blobId)}`}
                    className="hover:underline"
                    data-testid="review-blob"
                  >
                    in its memory
                  </Link>
                ) : (
                  "saving to its memory…"
                )}
                · <Time value={last.at} />
              </p>
            </div>
          </div>
        ) : (
          <p className="text-md text-ob-secondary">No review yet. The first comes next Monday.</p>
        )}
        {older.length ? (
          <p className="text-xs text-ob-muted">
            {older.length} earlier: {older.map((o) => o.facts.from).join(", ")}
          </p>
        ) : null}
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
      </div>
    </Section>
  );
}
