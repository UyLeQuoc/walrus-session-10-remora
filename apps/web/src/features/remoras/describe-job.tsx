/** C1 (ADR-0123): one box, "What should it do?", that drafts the create form below it. */
import type { RemoraDraft } from "@remora/schema";
import { AlertTriangle, Ban, Check, Sparkles } from "lucide-react";
import { useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { useDraft } from "./use-draft";

const EXAMPLE = "Every weekday at 8, tell me if any of my wallets moved more than 50 USDC";

export function DescribeJob({ onDraft }: { onDraft: (draft: RemoraDraft) => void }) {
  const [text, setText] = useState("");
  const { state, describe } = useDraft(onDraft);
  const busy = state.kind === "drafting";
  return (
    <section
      aria-label="Describe the job"
      className="flex flex-col gap-3 rounded-ob-card border border-ob-border-grouped p-4"
    >
      <Field>
        <FieldLabel htmlFor="describe-job">
          <Sparkles aria-hidden className="size-4 text-ob-accent-text" />
          What should it do?
        </FieldLabel>
        <Textarea
          id="describe-job"
          rows={2}
          maxLength={1_000}
          placeholder={EXAMPLE}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void describe(text);
          }}
        />
      </Field>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          disabled={busy || !text.trim()}
          onClick={() => void describe(text)}
          data-testid="draft-job"
        >
          {busy ? <Spinner /> : <Sparkles aria-hidden />}
          {busy ? "Drafting…" : "Draft it"}
        </Button>
        {state.kind === "drafted" && !state.issues.length ? (
          <span className="flex items-center gap-1.5 text-md text-ob-success-text">
            <Check aria-hidden className="size-4" /> Drafted below. Check it, then create.
          </span>
        ) : null}
      </div>
      {state.kind === "drafted" && state.draft.why ? (
        <p className="text-md text-ob-secondary" data-testid="draft-why">
          {state.draft.why}
        </p>
      ) : null}
      {state.kind === "drafted" && state.issues.length ? (
        <Alert variant="warning" data-testid="draft-issues">
          <AlertTriangle />
          <AlertTitle>Still to fill</AlertTitle>
          <AlertDescription>
            <ul className="list-disc pl-4">
              {state.issues.map((i) => (
                <li key={`${i.field}:${i.message}`}>{i.message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
      {state.kind === "refused" ? (
        <Alert variant="destructive" data-testid="draft-refused">
          <Ban />
          <AlertTitle>Not a job for a remora</AlertTitle>
          <AlertDescription>{state.reason}</AlertDescription>
        </Alert>
      ) : null}
      {state.kind === "failed" ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
    </section>
  );
}
