/**
 * ADR-0124 (E5): the remora proposes its own budget. The card shows the change, its one-line reason,
 * the numbers and the memories it cites (each opens in the Memory Inspector). Accept is one
 * signature (the limit is revoked and reissued); Decline takes an optional reason, which the remora
 * remembers and reads before it proposes again.
 */
import type { RemoraView } from "@remora/schema";
import { Brain, Check, Scale, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { Section } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Problem } from "@/components/visual";
import { useSignAndRun } from "@/features/funds/sign";
import { api, type Proposal } from "./api";
import { useLoad } from "./hooks";

const NUMBER_LABELS: Record<string, string> = {
  spent: "spent",
  limit: "limit",
  used: "used",
  left: "window left",
  days: "days",
  asked: "approvals asked",
  biggest: "biggest ask",
  cap: "cap",
  payments: "payments at the cap",
};

const unit = (k: string, v: string) =>
  ["spent", "limit", "biggest", "cap"].includes(k) ? `${v} USDC` : v;

export function ProposalCard({
  r,
  onChanged,
  open: focus = false,
}: {
  r: RemoraView;
  onChanged?: () => void;
  /** From a notification's link (`?proposal=…`): scroll it into view. */
  open?: boolean;
}) {
  const view = useLoad(() => api.proposals(r.id), [r.id]);
  const run = useSignAndRun();
  const [busy, setBusy] = useState<"" | "accept" | "decline" | "check">("");
  const [declining, setDeclining] = useState(false);
  const [why, setWhy] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  if (view.error) return <Problem title="Can't load its proposals." detail={view.error} />;
  const v = view.data;
  if (!v) return null;
  const p = v.open;
  const readOnly = r.status === "retired";

  const check = async () => {
    setBusy("check");
    setError("");
    const out = await api.checkProposals(r.id);
    setBusy("");
    if (!out.ok) return setError(out.error);
    setNote(out.data.skipped ? `Nothing to propose: ${out.data.skipped}.` : "");
    void view.refresh();
  };

  const accept = async (x: Proposal) => {
    setBusy("accept");
    setError("");
    try {
      const tx = await api.proposalTx(x.id);
      if (!tx.ok || !tx.data.transaction) throw new Error(tx.ok ? "Nothing to sign." : tx.error);
      const digest = await run(tx.data.transaction);
      const done = await api.proposalConfirm(x.id, digest);
      if (!done.ok) throw new Error(done.error);
      void view.refresh();
      onChanged?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  const decline = async (x: Proposal) => {
    setBusy("decline");
    setError("");
    const out = await api.declineProposal(x.id, why);
    setBusy("");
    if (!out.ok) return setError(out.error);
    setDeclining(false);
    setWhy("");
    void view.refresh();
  };

  return (
    <Section
      title="Its budget"
      hint="It proposes changes from what it spent and what it remembers. Nothing changes until you sign."
      actions={
        p || readOnly ? null : (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-mr-3"
            disabled={busy !== ""}
            onClick={() => void check()}
            data-testid="proposal-check"
          >
            {busy === "check" ? <Spinner /> : <Scale className="size-4" aria-hidden />} Check now
          </Button>
        )
      }
    >
      <div
        className="flex flex-col gap-4"
        data-testid="proposal-card"
        ref={(el) => {
          if (el && focus && p) el.scrollIntoView({ block: "center" });
        }}
      >
        {p ? (
          <div className="flex flex-col gap-3 rounded-lg border border-ob-accent/40 bg-ob-accent/5 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge>proposal</Badge>
              <b className="text-lg" data-testid="proposal-summary">
                {p.summary}
              </b>
            </div>
            <p className="text-md text-ob-secondary" data-testid="proposal-reason">
              {p.reason}
            </p>
            <div className="flex flex-wrap gap-2">
              {Object.entries(p.numbers).map(([k, val]) => (
                <span
                  key={k}
                  className="rounded-md bg-ob-surface-2 px-2 py-1 text-xs tabular-nums text-ob-secondary"
                >
                  {NUMBER_LABELS[k] ?? k} <b className="text-ob-primary">{unit(k, val)}</b>
                </span>
              ))}
            </div>
            <ul className="flex flex-col gap-1" aria-label="Memories it cites">
              {p.cites.map((c) => (
                <li key={c.memoryId} className="flex items-center gap-2 text-sm">
                  <Brain className="size-3.5 shrink-0 text-ob-accent" aria-hidden />
                  <Link
                    to={`/memory?remora=${r.id}&blob=${encodeURIComponent(c.blobId)}`}
                    className="truncate hover:underline"
                    data-testid="proposal-cite"
                  >
                    <span className="text-ob-muted">{c.at}</span> · {c.label}
                  </Link>
                </li>
              ))}
            </ul>
            {p.previous ? (
              <p className="text-xs text-ob-muted">
                Last time ({p.previous.at}) you {p.previous.outcome} it
                {p.previous.reason ? `: "${p.previous.reason}"` : "."}
              </p>
            ) : null}
            {readOnly ? null : declining ? (
              <div className="flex flex-wrap gap-2">
                <Input
                  aria-label="Why not? (optional)"
                  placeholder="Why not? It remembers."
                  value={why}
                  maxLength={200}
                  className="min-w-0 flex-1"
                  onChange={(e) => setWhy(e.target.value)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== ""}
                  onClick={() => void decline(p)}
                  data-testid="proposal-decline-send"
                >
                  {busy === "decline" ? <Spinner /> : null} Decline
                </Button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  disabled={busy !== ""}
                  onClick={() => void accept(p)}
                  data-testid="proposal-accept"
                >
                  {busy === "accept" ? <Spinner /> : <Check className="size-4" aria-hidden />}{" "}
                  Accept · one signature
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy !== ""}
                  onClick={() => setDeclining(true)}
                  data-testid="proposal-decline"
                >
                  <X className="size-4" aria-hidden /> Decline
                </Button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-md text-ob-secondary">
            {note || "No proposal open. It checks after each payment and once a day."}
          </p>
        )}
        {v.recent.length ? (
          <ul className="flex flex-col gap-1 text-sm" aria-label="Past proposals">
            {v.recent.slice(0, 3).map((x) => (
              <li
                key={x.id}
                className="flex flex-wrap items-center gap-2"
                data-testid="proposal-past"
              >
                <Badge variant={x.status === "approved" ? "secondary" : "outline"}>
                  {x.status === "approved" ? "accepted" : "declined"}
                </Badge>
                <span className="text-ob-secondary">{x.summary}</span>
                {x.declineReason ? (
                  <span className="text-ob-muted">"{x.declineReason}"</span>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
      </div>
    </Section>
  );
}
