/**
 * A2 (ADR-0137): rules from outcomes. The open proposal shows the rule, its one-line reason and the
 * memories it cites; Accept is a tap, because a rule can only narrow spending. Accepted rules are
 * listed with Remove.
 */
import type { RemoraView } from "@remora/schema";
import { Brain, Check, ListChecks, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Section } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Problem } from "@/components/visual";
import { useLoad } from "@/features/remoras/hooks";
import { replayApi } from "./api";

const day = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

export function RuleCard({ r, onChanged }: { r: RemoraView; onChanged?: () => void }) {
  const view = useLoad(() => replayApi.rules(r.id), [r.id]);
  const [busy, setBusy] = useState<"" | "accept" | "decline" | "check" | string>("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  if (view.error) return <Problem title="Can't load its rules." detail={view.error} />;
  const v = view.data;
  if (!v) return null;
  const p = v.proposal;
  const readOnly = r.status === "retired";

  const act = async (what: "accept" | "decline" | "check", fn: () => Promise<unknown>) => {
    setBusy(what);
    setError("");
    const out = (await fn()) as { ok: boolean; error?: string; data?: { skipped?: string } };
    setBusy("");
    if (!out.ok) return setError(out.error ?? "Something went wrong.");
    if (what === "check")
      setNote(out.data?.skipped ? `Nothing to propose: ${out.data.skipped}.` : "");
    void view.refresh();
    if (what === "accept") onChanged?.();
  };

  return (
    <Section
      title="Its rules"
      hint="It proposes rules from what you rated. A rule can only make it spend less or ask more, so a tap accepts it."
      actions={
        p || readOnly ? null : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-mr-3"
            disabled={busy !== ""}
            onClick={() => void act("check", () => replayApi.checkRules(r.id))}
            data-testid="rule-check"
          >
            {busy === "check" ? <Spinner /> : <ListChecks className="size-4" aria-hidden />} Check
            now
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-4" data-testid="rule-card">
        {p ? (
          <div className="flex flex-col gap-3 rounded-lg border border-ob-accent/40 bg-ob-accent/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>rule proposal</Badge>
              <b className="text-lg" data-testid="rule-text">
                {p.rule.text}
              </b>
            </div>
            <p className="text-md text-ob-secondary" data-testid="rule-reason">
              {p.reason}
            </p>
            <ul className="flex flex-col gap-1" aria-label="Memories it cites">
              {p.cites.map((c) => (
                <li key={c.blobId} className="flex items-center gap-2 text-sm">
                  <Brain className="size-3.5 shrink-0 text-ob-accent" aria-hidden />
                  <Link
                    to={`/memory?remora=${r.id}&blob=${encodeURIComponent(c.blobId)}`}
                    className="truncate hover:underline"
                    data-testid="rule-cite"
                  >
                    <span className="text-ob-muted">{c.at}</span> · {c.label}
                  </Link>
                </li>
              ))}
            </ul>
            {readOnly ? null : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy !== ""}
                  onClick={() => void act("accept", () => replayApi.accept(p.id))}
                  data-testid="rule-accept"
                >
                  {busy === "accept" ? <Spinner /> : <Check className="size-4" aria-hidden />}{" "}
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== ""}
                  onClick={() => void act("decline", () => replayApi.decline(p.id))}
                  data-testid="rule-decline"
                >
                  <X className="size-4" aria-hidden /> Decline
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-md text-ob-secondary">
            {note || "No rule proposal open. It checks once a day."}
          </p>
        )}
        {v.rules.length ? (
          <ul className="flex flex-col gap-2 text-md" aria-label="Rules you accepted">
            {v.rules.map((x) => (
              <li key={x.id} className="flex flex-wrap items-center gap-2" data-testid="rule-row">
                <Badge variant="secondary">✓ you said yes · {day(x.acceptedAt)}</Badge>
                <span className="min-w-0 flex-1">{x.text}</span>
                {readOnly ? null : (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={busy !== ""}
                    onClick={async () => {
                      setBusy(x.id);
                      const out = await replayApi.removeRule(r.id, x.id);
                      setBusy("");
                      if (!out.ok) setError(out.error);
                      void view.refresh();
                      onChanged?.();
                    }}
                  >
                    Remove
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
      </div>
    </Section>
  );
}
