/**
 * `/remoras/:id/share` (M1 + M3 + M7, ADR-0046): share a remora in the Hatchery. The review shows the
 * exact file that would be stored on Walrus, what each remora may do, what was taken out, and the
 * safety report; Publish stores it and records it onchain with one signature.
 */

import type { ShareReview } from "@remora/schema";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { toast } from "sonner";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Checks } from "@/components/visual";
import { useSignAndRun } from "@/features/funds/sign";
import { api } from "@/features/remoras/api";
import { RequireOwner } from "@/features/remoras/hooks";
import { PermissionsList, SafetyPanel } from "./parts";

/** What stays out of the file, in plain words (ADR-0103: the reviewers read `disc:` and `wakes:`). */
const KEPT: Record<string, string> = {
  memories: "Memories",
  keys: "Keys",
  disc: "Spending limit",
  wakes: "Receipts and history",
};

function Share({ id }: { id: string }) {
  const navigate = useNavigate();
  const run = useSignAndRun();
  const [review, setReview] = useState<ShareReview | null>(null);
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
      const out = await api.publishTx(review.markdown);
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
      {() => <Share id={id} />}
    </RequireOwner>
  );
}
