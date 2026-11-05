/**
 * D2 (ADR-0149): a template's rating, rating it, and its author's numbers.
 * - The rating is weighted by real use: each owner's stars count more the more their copy paid for.
 * - Rating takes a personal-message signature (no transaction): the wallet signs the template, the
 *   stars and the text's hash, so anyone can check it later. One per address; the last one counts.
 * - Ratings are other owners' words: rendered as plain text, never as Markdown or HTML.
 * - Public pages show the counts; the texts and the numbers behind them are the author's view.
 */
import { useSignPersonalMessage } from "@mysten/dapp-kit";
import type { TemplateRatingSummary } from "@remora/schema";
import { Star } from "lucide-react";
import { useState } from "react";
import { Section } from "@/components/app/page";
import { Time } from "@/components/app/time";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Stat, StatRow } from "@/components/visual";
import { useLoad } from "@/features/remoras/hooks";
import { usdc } from "@/lib/usdc";
import { cn } from "@/lib/utils";
import { extrasApi } from "./extras-api";
import { shortAddress } from "./parts";

const MAX = 280;

/** "★ 4.3 · 2 ratings", or nothing before anyone rated it. */
export function RatingBadge({
  rating,
  className,
}: {
  rating: TemplateRatingSummary | null | undefined;
  className?: string;
}) {
  if (!rating) return null;
  return (
    <span
      className={cn("inline-flex items-center gap-1 tabular-nums", className)}
      title="Weighted by how much each owner's copy was used"
      data-testid="template-rating"
    >
      <Star className="size-3.5 fill-current text-ob-warning" aria-hidden />
      <span>{rating.stars.toFixed(1)}</span>
      <span className="text-ob-muted">
        · {rating.count} {rating.count === 1 ? "rating" : "ratings"}
      </span>
    </span>
  );
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1" role="radiogroup" aria-label="Stars">
      {[1, 2, 3, 4, 5].map((n) => (
        // biome-ignore lint/a11y/useSemanticElements: a row of star buttons reads better than radios.
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          className="rounded p-0.5 text-ob-warning focus-visible:shadow-[0_0_0_1px_var(--openbot-border-focus)] focus-visible:outline-none"
          onClick={() => onChange(n)}
          data-testid={`rate-star-${n}`}
        >
          <Star className={cn("size-6", n <= value ? "fill-current" : "opacity-50")} aria-hidden />
        </button>
      ))}
    </div>
  );
}

/** For an owner who made a copy of this template here: stars and a line, signed by their wallet. */
export function RateTemplate({
  templateId,
  onRated,
}: {
  templateId: string;
  onRated?: () => void;
}) {
  const me = useLoad(() => extrasApi.myRating(templateId), [templateId]);
  const { mutateAsync: signPersonalMessage } = useSignPersonalMessage();
  const [stars, setStars] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  if (!me.data?.canRate) return null;
  const mine = me.data.mine;

  const rate = async () => {
    setBusy(true);
    setError("");
    try {
      const m = await extrasApi.ratingMessage(templateId, stars, text);
      if (!m.ok) throw new Error(m.error);
      const { signature } = await signPersonalMessage({
        message: new TextEncoder().encode(m.data.message),
      });
      const done = await extrasApi.rate(templateId, {
        stars,
        text: m.data.text,
        at: m.data.at,
        signature,
      });
      if (!done.ok) throw new Error(done.error);
      setSaved(true);
      void me.refresh();
      onRated?.();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section
      title="Rate it"
      hint="You made a copy, so you can rate it. Your wallet signs the rating; it sends nothing."
    >
      <div className="flex max-w-xl flex-col gap-3" data-testid="rate-template">
        {mine ? (
          <p className="text-md text-ob-secondary" data-testid="rate-mine">
            You gave it {mine.stars} of 5 <Time value={mine.at} />
            {mine.text ? (
              <>
                : <span className="text-ob-text">“{mine.text}”</span>
              </>
            ) : (
              "."
            )}{" "}
            Rate it again to change it.
          </p>
        ) : null}
        <StarPicker value={stars} onChange={setStars} />
        <Textarea
          aria-label="What you'd tell another owner (optional)"
          placeholder="What you'd tell another owner (optional)"
          maxLength={MAX}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            disabled={busy || stars < 1}
            onClick={() => void rate()}
            data-testid="rate-send"
          >
            {busy ? <Spinner /> : <Star className="size-4" aria-hidden />} Sign and rate
          </Button>
          <span className="text-xs text-ob-muted tabular-nums">
            {text.length}/{MAX} · emails, handles and phone numbers are removed
          </span>
        </div>
        {saved && !error ? (
          <p className="text-md text-ob-success-text">Thanks. It counts now.</p>
        ) : null}
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
      </div>
    </Section>
  );
}

/** The author's view: hatches, active copies, sales and every rating with its weight. */
export function AuthorAnalytics({ templateId }: { templateId: string }) {
  const a = useLoad(() => extrasApi.analytics(templateId), [templateId]);
  if (a.error) return null;
  const d = a.data;
  return (
    <Section
      title="Your numbers"
      hint="Only you see these. Everyone else sees the hatch count and the rating."
    >
      {!d ? <Skeleton className="h-24 w-full rounded-ob-card" /> : null}
      {d ? (
        <div className="flex flex-col gap-4" data-testid="template-analytics">
          <StatRow>
            <Stat label="Hatches" value={d.hatches} of="onchain" />
            <Stat label="Active" value={d.active7d} of={`of ${d.remoras} in 7 days`} />
            <Stat
              label="Sales"
              value={usdc(d.salesRevenue)}
              unit="USDC"
              of={`${d.sales} answers sold`}
            />
            <Stat
              label="Rating"
              value={d.rating ? d.rating.stars.toFixed(1) : "—"}
              of={d.rating ? `${d.rating.count} weighted` : "none yet"}
            />
          </StatRow>
          {d.ratings.length ? (
            <ul className="ob-group" aria-label="Ratings">
              {d.ratings.map((r) => (
                <li
                  key={r.rater}
                  className="flex min-w-0 flex-col gap-1 px-4 py-3 text-md"
                  data-testid="template-rating-row"
                >
                  <span className="flex flex-wrap items-center gap-2 text-sm">
                    <b className="tabular-nums">{r.stars} of 5</b>
                    <span className="text-ob-muted">{shortAddress(r.rater)}</span>
                    <Badge variant="outline" title="1 + log2(1 + paid calls), at most 6">
                      weight {r.weight} · {r.paidCalls} paid {r.paidCalls === 1 ? "call" : "calls"}
                    </Badge>
                    <Time value={r.at} className="text-xs text-ob-muted" />
                  </span>
                  {/* Another owner's words: plain text only (ADR-0149). */}
                  {r.text ? (
                    <p className="whitespace-pre-wrap [overflow-wrap:anywhere]" data-ux-skip>
                      {r.text}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-md text-ob-muted">No ratings yet.</p>
          )}
        </div>
      ) : null}
    </Section>
  );
}
