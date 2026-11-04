/**
 * ADR-0106: a Briefer's page. Its list (what the brief follows), its schedule and the next run, Run
 * now, and the last brief with a receipt for every purchase. Every number here comes from the server:
 * the prices it paid, the digests, the next run.
 */
import type { RemoraView } from "@remora/schema";
import { CalendarClock, ListChecks, Play } from "lucide-react";
import { useState } from "react";
import { Section } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Empty, Problem, Receipt } from "@/components/visual";
import { Markdown } from "@/features/chat/markdown";
import { payeeName } from "@/lib/payee";
import { explorerTx, usdc } from "@/lib/usdc";
import { soon } from "@/lib/when";
import { api } from "./api";
import { useLoad } from "./hooks";

export function BriefCard({
  r,
  onDone,
  readOnly = false,
}: {
  r: RemoraView;
  onDone: () => void;
  readOnly?: boolean;
}) {
  const brief = useLoad(() => api.brief(r.id), [r.id]);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<"" | "save" | "run">("");
  const [error, setError] = useState("");
  const b = brief.data;

  const save = async () => {
    setBusy("save");
    setError("");
    const out = await api.setBriefItems(
      r.id,
      draft
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
    );
    setBusy("");
    if (!out.ok) return setError(out.error);
    setEditing(false);
    void brief.refresh();
  };
  const run = async () => {
    setBusy("run");
    setError("");
    const out = await api.runBrief(r.id);
    setBusy("");
    if (!out.ok) return setError(out.error);
    void brief.refresh();
    onDone();
  };

  if (brief.error) return <Problem title="Can't load its brief right now." detail={brief.error} />;
  if (!b) return null;
  const spent = b.last?.paid.reduce((n, p) => n + BigInt(p.amount || "0"), 0n) ?? 0n;
  return (
    <Section
      title="Its brief"
      hint="It buys each thing on its list, then sends one brief with a receipt for each purchase. Edit the list any time."
    >
      <div className="flex flex-col gap-4" data-testid="brief-card">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-md">
          <span className="flex items-center gap-1.5 text-ob-secondary">
            <ListChecks className="size-4" aria-hidden />
            {b.items.length} on its list
          </span>
          {b.schedule ? (
            <span
              className="flex items-center gap-1.5 text-ob-secondary"
              data-testid="brief-schedule"
            >
              <CalendarClock className="size-4" aria-hidden />
              {b.schedule.human}
              {b.schedule.paused
                ? " · paused"
                : b.schedule.next
                  ? ` · next ${soon(b.schedule.next)}`
                  : ""}
            </span>
          ) : null}
          {readOnly ? null : (
            <Button
              type="button"
              size="sm"
              className="ml-auto"
              disabled={!!busy || !b.items.length}
              onClick={() => void run()}
            >
              {busy === "run" ? <Spinner /> : <Play />} Run now
            </Button>
          )}
        </div>
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              aria-label="What it follows"
              rows={4}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={"SUI and WAL prices\nweather in Hanoi\ngithub.com/MystenLabs/walrus"}
            />
            <div className="flex gap-2">
              <Button type="button" size="sm" disabled={!!busy} onClick={() => void save()}>
                {busy === "save" ? <Spinner /> : null} Save list
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <ul className="flex flex-wrap gap-1.5" aria-label="What it follows">
            {b.items.map((item) => (
              <li
                key={item}
                className="rounded-full border border-ob-border px-2.5 py-1 text-xs text-ob-secondary [overflow-wrap:anywhere]"
              >
                {item}
              </li>
            ))}
            {readOnly ? null : (
              <li>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-auto px-2 py-1 text-xs"
                  onClick={() => {
                    setDraft(b.items.join("\n"));
                    setEditing(true);
                  }}
                >
                  Edit list
                </Button>
              </li>
            )}
          </ul>
        )}
        {busy === "run" ? (
          <p className="flex items-center gap-2 text-md text-ob-muted" role="status">
            <Spinner /> Buying what's on its list…
          </p>
        ) : null}
        {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
        {b.last ? (
          <div
            className="flex flex-col gap-3 rounded-ob-card border border-ob-border p-4"
            data-testid="brief-last"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs text-ob-muted">
              <span>Last brief · {soon(b.last.at)}</span>
              <span className="tabular-nums">
                {b.last.paid.length} paid · {usdc(spent.toString())} USDC
              </span>
            </div>
            <div className="text-md">
              <Markdown>{b.last.answer}</Markdown>
            </div>
            {b.last.paid.length ? (
              <ul className="grid gap-2 sm:grid-cols-2" aria-label="Receipts">
                {b.last.paid.map((p, i) => (
                  <li key={p.digest ?? i}>
                    <Receipt
                      compact
                      data-testid="brief-receipt"
                      amount={usdc(p.amount)}
                      payee={payeeName(p.payee)}
                      proof={
                        p.digest ? (
                          <Hash
                            value={p.digest}
                            href={explorerTx(r.network, p.digest)}
                            label="paid in"
                          />
                        ) : undefined
                      }
                    />
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : (
          <Empty title="No brief yet. Run now, or wait for its schedule." />
        )}
      </div>
    </Section>
  );
}
