/**
 * `/remoras/import` (ADR-0042): install a whole team from one Markdown file. Paste or open the file,
 * see exactly what it creates (remoras, budgets, models, rules, schedules, warnings), then create it
 * with one signature for every Disc. Imported remoras start in shadow mode and schedules arrive
 * paused; a team file never carries keys, memories or anyone's addresses.
 */
import type { TeamPreview } from "@remora/schema";
import { Check } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { modelById } from "@/features/chat/models";
import { useSignAndRun } from "@/features/funds/sign";
import { api } from "@/features/remoras/api";
import { RequireOwner } from "@/features/remoras/hooks";

const EXAMPLE = `---
schema: remora.team/v1
name: Onchain desk
remoras:
  - template: scout
    name: Scout
    budget: { monthlyUsd: 0.5, perPaymentUsd: 0.015 }
    schedules:
      - when: weekdays at 8am
        question: Is package 0x2 safe to depend on?
  - template: sentinel
    name: Sentinel
    rules:
      - Ignore incoming SUI under 0.01
room: { name: Team, responder: auto, lead: Scout }
---

# Onchain desk
Ask Scout anything onchain; tell Sentinel what matters.
`;

function Importer() {
  const navigate = useNavigate();
  const run = useSignAndRun();
  const [markdown, setMarkdown] = useState("");
  const [preview, setPreview] = useState<TeamPreview | null>(null);
  const [error, setError] = useState("");
  const [step, setStep] = useState("");
  // Signed but not confirmed yet (the server's node can lag the wallet's): confirm again, no new signature.
  const [signed, setSigned] = useState<{ digest: string; ids: string[]; roomId: string } | null>(
    null,
  );

  const check = async (md = markdown) => {
    setError("");
    setPreview(null);
    const out = await api.teamPreview(md);
    if (out.ok) setPreview(out.data);
    else setError(out.error);
  };
  const open = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setMarkdown(text);
    void check(text);
  };
  const create = async () => {
    try {
      setStep("Creating the remoras…");
      const out = await api.teamApply(markdown);
      if (!out.ok) throw new Error(out.error);
      if (out.data.transaction) {
        setStep("Sign once in your wallet: every Disc in one transaction…");
        const digest = await run(out.data.transaction);
        setSigned({ digest, ids: out.data.remoras, roomId: out.data.roomId });
        setStep("Confirming onchain…");
        const done = await api.teamConfirm(digest, out.data.remoras);
        if (!done.ok) throw new Error(done.error);
        setSigned(null);
      }
      if (out.data.skipped.length) toast(`Skipped: ${out.data.skipped.join("; ")}`);
      toast.success("Your team is in. Say hello in the room.");
      navigate(`/chat/room/${out.data.roomId}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setStep("");
    }
  };

  const confirmAgain = async () => {
    if (!signed) return;
    setError("");
    setStep("Confirming onchain…");
    const done = await api.teamConfirm(signed.digest, signed.ids);
    setStep("");
    if (!done.ok) return setError(done.error);
    setSigned(null);
    toast.success("Your team is in. Say hello in the room.");
    navigate(`/chat/room/${signed.roomId}`);
  };

  return (
    <Page title="Import a team">
      <PageHeader
        title="Import a team"
        description="One Markdown file sets up a whole team: remoras, budgets, models, rules, schedules and the room they share."
      />
      <Section
        title="The file"
        description="Paste it, or open a .md file. Nothing is created until you confirm below."
      >
        <div className="flex max-w-3xl flex-col gap-3">
          <Textarea
            aria-label="Team file"
            rows={14}
            className="rounded-ob-lg bg-ob-grouped font-mono text-xs leading-5"
            placeholder={EXAMPLE}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
          />
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!markdown.trim()}
              onClick={() => void check()}
            >
              Preview
            </Button>
            <Button asChild type="button" variant="ghost">
              <label>
                Open a .md file
                <input
                  type="file"
                  accept=".md,text/markdown,text/plain"
                  className="sr-only"
                  aria-label="Open a team file"
                  onChange={(e) => void open(e.target.files?.[0])}
                />
              </label>
            </Button>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setMarkdown(EXAMPLE);
                void check(EXAMPLE);
              }}
            >
              Use the example
            </Button>
          </div>
          {error ? (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>{error}</span>
                {signed ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => void confirmAgain()}
                  >
                    Check again (already signed)
                  </Button>
                ) : null}
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </Section>
      {preview ? (
        <Section title={preview.team.name} description={preview.team.description}>
          <ul className="ob-group max-w-3xl" aria-label="Team preview">
            {preview.remoras.map((r) => (
              <li
                key={r.name}
                className="flex min-w-0 flex-col gap-1 px-4 py-3 text-md text-ob-secondary"
                data-testid="team-remora"
              >
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-ob-text">
                  {r.name} <Badge variant="outline">{r.template}</Badge>
                  {r.model ? <Badge variant="secondary">{modelById(r.model).label}</Badge> : null}
                  <Badge variant="warning">starts in shadow mode</Badge>
                </p>
                <p className="text-ob-muted">{r.budget ?? "Read-only: no budget, never pays."}</p>
                {r.rules.map((rule) => (
                  <p key={rule.text}>
                    Rule: “{rule.text}”{" "}
                    {rule.understood ? (
                      <span className="inline-flex align-middle text-ob-success-text">
                        <Check aria-hidden className="size-3.5" />
                        <span className="sr-only">understood</span>
                      </span>
                    ) : (
                      "(read by its model at import)"
                    )}
                  </p>
                ))}
                {r.schedules.map((s) => (
                  <p key={s.when + s.question}>
                    {s.human ?? s.when}: {s.question}{" "}
                    <span className="text-ob-muted">(paused)</span>
                  </p>
                ))}
              </li>
            ))}
          </ul>
          {preview.warnings.length ? (
            <ul className="flex max-w-3xl flex-col gap-1 rounded-ob-lg bg-ob-warning-soft px-4 py-3 text-md text-ob-warning-text">
              {preview.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
          <div className="flex items-center gap-3">
            <Button type="button" disabled={!!step} onClick={() => void create()}>
              {step ? <Spinner /> : null}
              Create the team{preview.signatures ? " (one signature)" : ""}
            </Button>
            <span className="text-md text-ob-muted" aria-live="polite" data-testid="import-step">
              {step}
            </span>
          </div>
        </Section>
      ) : null}
    </Page>
  );
}

export function ImportTeamPage() {
  return (
    <RequireOwner what="team import" needsWallet>
      {() => <Importer />}
    </RequireOwner>
  );
}
