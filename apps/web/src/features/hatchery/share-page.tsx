/**
 * `/remoras/:id/share` (M1 + M3 + M7, ADR-0046): share a remora in the Hatchery. The review shows the
 * exact file that would be stored on Walrus, what each remora may do, what was taken out, and the
 * safety report; Publish stores it and records it onchain with one signature.
 */

import type { ShareReview } from "@remora/schema";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Checks } from "@/components/visual";
import { useSignAndRun } from "@/features/funds/sign";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";
import { PermissionsList, SafetyPanel } from "./parts";

/** What stays out of the file, in plain words (ADR-0103: the reviewers read `disc:` and `wakes:`). */
const KEPT: Record<string, string> = {
  memories: "Memories",
  keys: "Keys",
  disc: "Spending limit",
  wakes: "Receipts and history",
};

function Share({ id, owner }: { id: string; owner: string }) {
  const navigate = useNavigate();
  const run = useSignAndRun();
  const [review, setReview] = useState<ShareReview | null>(null);
  // D3 (ADR-0150): publish as a new version of one of your templates; its copies are offered it.
  const gallery = useLoad(() => api.hatchery(), []);
  const mine = (gallery.data?.templates ?? []).filter(
    (t) => t.author.toLowerCase() === owner.toLowerCase() && !t.deprecated,
  );
  const [parent, setParent] = useState("");
  const [error, setError] = useState("");
  const [step, setStep] = useState("");
  const [signed, setSigned] = useState<string | null>(null);

  useEffect(() => {
    void api.share(id).then((r) => (r.ok ? setReview(r.data.review) : setError(r.error)));
  }, [id]);

  const finish = async (digest: string) => {
    setStep("Confirming onchain…");
    const done = await api.publishConfirm(digest);
    if (!done.ok) throw new Error(done.error);
    setSigned(null);
    toast.success("Published as a template.");
    navigate(`/hatchery/${done.data.listing.templateId}?published=1`);
  };
  const publish = async () => {
    if (!review) return;
    setError("");
    try {
      setStep("Storing the file on Walrus…");
      const out = await api.publishTx(review.markdown, parent || null);
      if (!out.ok) throw new Error(out.error);
      setStep("Sign once in your wallet: it records you as the author…");
      const digest = await run(out.data.transaction);
      setSigned(digest);
      await finish(digest);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStep("");
    }
  };

  return (
    <Page title="Share as a template">
      <PageHeader
        title="Share as a template"
        description="Anyone can copy it into their own account."
        actions={
          review ? (
            <Button
              type="button"
              disabled={!!step || review.safety.verdict === "block"}
              onClick={() => void publish()}
            >
              Publish as a template (one signature)
            </Button>
          ) : null
        }
      />
      {step ? (
        <span className="flex items-center gap-2 text-md text-ob-muted">
          <Spinner /> {step}
        </span>
      ) : null}
      {error ? (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{error}</span>
            {!signed && !review ? (
              <Button asChild type="button" size="sm" variant="outline">
                <Link to={`/remoras/${id}`}>Back to the remora</Link>
              </Button>
            ) : null}
            {signed ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void finish(signed).catch((e) => setError((e as Error).message))}
              >
                Check again (already signed)
              </Button>
            ) : null}
          </AlertDescription>
        </Alert>
      ) : null}
      {!review && !error ? <Skeleton className="h-64 w-full max-w-3xl rounded-ob-card" /> : null}
      {review ? (
        <>
          {mine.length ? (
            <Section
              title="Publish as"
              description="A new version keeps its line: copies made from the older one are offered the update, and nothing changes for them until they accept."
            >
              <select
                className="h-9 w-full max-w-md rounded-md border border-ob-border bg-ob-raised px-2 text-md"
                aria-label="Publish as"
                value={parent}
                disabled={!!step}
                onChange={(e) => setParent(e.target.value)}
                data-testid="share-parent"
              >
                <option value="">A new template</option>
                {mine.map((t) => (
                  <option key={t.templateId} value={t.templateId}>
                    A new version of “{t.name}”
                  </option>
                ))}
              </select>
            </Section>
          ) : null}
          <Section title="What it can do" description="This is what people see before they use it.">
            <div className="max-w-3xl">
              <PermissionsList permissions={review.permissions} />
            </div>
          </Section>
          <Section title="What stays with you">
            <Checks
              className="max-w-3xl"
              label="Removed"
              items={review.removed.map((x) => ({
                label: KEPT[x.field] ?? x.field,
                state: "pass",
                detail: x.reason,
              }))}
            />
          </Section>
          {review.packCandidates?.length ? (
            <Section
              title="Starter memories (public)"
              description="Optional: lines from its memory that whoever copies it can start with. They're public plaintext on Walrus; anything about people is left out."
            >
              <ul className="flex max-w-3xl flex-col gap-1.5" data-testid="share-pack">
                {review.packCandidates.map((c) => (
                  <li key={c.text} className="flex items-start gap-2 text-sm">
                    <Checkbox
                      aria-label={`Add to the pack: ${c.text.slice(0, 60)}`}
                      disabled={!c.ok || !!step}
                      checked={(review.team.pack ?? []).includes(c.text)}
                      onCheckedChange={(on) => {
                        const now = review.team.pack ?? [];
                        const next = on ? [...now, c.text] : now.filter((t) => t !== c.text);
                        void api
                          .share(id, next)
                          .then((r) => (r.ok ? setReview(r.data.review) : setError(r.error)));
                      }}
                    />
                    <span className={c.ok ? "" : "text-ob-muted line-through"} data-ux-skip>
                      {c.text}
                      {c.why ? <span className="ml-1 text-xs no-underline">({c.why})</span> : null}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          ) : null}
          <Section title="Safety review">
            <div className="max-w-3xl">
              <SafetyPanel report={review.safety} />
            </div>
          </Section>
          <details className="group max-w-3xl">
            <summary className="cursor-pointer text-sm font-medium text-ob-secondary hover:text-ob-text">
              Show the file ({review.sizeBytes} bytes, public on Walrus)
            </summary>
            <pre
              className="mt-2 max-h-80 overflow-auto rounded-ob-lg border border-ob-border-grouped bg-ob-grouped p-4 font-mono text-xs leading-5 break-words whitespace-pre-wrap text-ob-secondary"
              data-testid="share-file"
            >
              {review.markdown}
            </pre>
          </details>
        </>
      ) : null}
    </Page>
  );
}

export function SharePage() {
  const { id = "" } = useParams();
  return (
    <RequireOwner what="sharing this remora" needsWallet>
      {(owner) => <Share id={id} owner={owner} />}
    </RequireOwner>
  );
}
