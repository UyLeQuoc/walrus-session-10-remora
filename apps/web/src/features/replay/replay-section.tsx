/**
 * A1 (ADR-0136): the replay bench. The same questions planned three ways: with no memory, with the
 * memory it had at T₀, and with today's. Every number is a plan from a replay, never a purchase, and
 * each difference names the memory or rule that caused it (each opens in the Memory Inspector).
 */
import type { RemoraView, ReplayColumn, ReplayRun } from "@remora/schema";
import { Brain, History, Play } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router";
import { Section } from "@/components/app/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { Problem } from "@/components/visual";
import { useLoad } from "@/features/remoras/hooks";
import { payeeName } from "@/lib/payee";
import { usdc } from "@/lib/usdc";
import { replayApi } from "./api";

const COLUMNS: { key: ReplayColumn; label: string }[] = [
  { key: "none", label: "No memory" },
  { key: "t0", label: "Memory at T₀" },
  { key: "today", label: "Today's memory" },
];

const when = (iso: string) =>
  new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

/** `datetime-local` wants local time without a zone. */
const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export function ReplaySection({ r }: { r: RemoraView }) {
  const home = useLoad(() => replayApi.home(r.id), [r.id]);
  const [picked, setPicked] = useState<string[] | null>(null);
  const [extra, setExtra] = useState("");
  const [t0, setT0] = useState("");
  const [runId, setRunId] = useState("");
  const [run, setRun] = useState<ReplayRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const h = home.data;
  const chosen = picked ?? (h?.questions ?? []).slice(0, 10).map((q) => q.question);

  useEffect(() => {
    if (!runId) return;
    let stop = false;
    const tick = async () => {
      const out = await replayApi.run(r.id, runId);
      if (stop) return;
      if (out.ok) {
        setRun(out.data);
        if (out.data.status === "running") setTimeout(() => void tick(), 2_000);
        else void home.refresh();
      } else setError(out.error);
    };
    void tick();
    return () => {
      stop = true;
    };
  }, [runId, r.id, home.refresh]);

  if (home.error) return <Problem title="Can't load the replay bench." detail={home.error} />;
  if (!h) return null;

  const start = async () => {
    setBusy(true);
    setError("");
    const questions = [
      ...chosen,
      ...extra
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
    ].slice(0, 12);
    const out = await replayApi.start(r.id, questions, t0 ? new Date(t0).toISOString() : undefined);
    setBusy(false);
    if (!out.ok) return setError(out.error);
    setRun(null);
    setRunId(out.data.runId);
  };

  return (
    <Section
      title="Replay: the same questions, three memories"
      hint="It plans each question with no memory, with what it remembered at T₀, and with today's memory. A replay never pays, never writes memory and never messages you: its numbers are plans."
    >
      <div className="flex flex-col gap-5" data-testid="replay-bench">
        <div className="flex flex-col gap-3">
          {h.questions.length ? (
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-sm text-ob-muted">
                Questions it was asked ({chosen.length} of up to 12 picked)
              </legend>
              {h.questions.slice(0, 20).map((q) => (
                <Label
                  key={q.question}
                  className="flex items-start gap-2 text-md font-normal"
                  data-ux-skip
                >
                  <Checkbox
                    checked={chosen.includes(q.question)}
                    onCheckedChange={(on) =>
                      setPicked(
                        on
                          ? [...chosen, q.question].slice(0, 12)
                          : chosen.filter((x) => x !== q.question),
                      )
                    }
                  />
                  <span className="min-w-0 flex-1 break-words">{q.question}</span>
                </Label>
              ))}
            </fieldset>
          ) : (
            <p className="text-md text-ob-secondary">
              It hasn't been asked anything yet: type questions below.
            </p>
          )}
          <Textarea
            aria-label="More questions, one per line"
            placeholder="More questions, one per line"
            value={extra}
            onChange={(e) => setExtra(e.target.value)}
            rows={2}
          />
          <div className="flex flex-wrap items-end gap-3">
            <Label className="flex flex-col gap-1 text-sm">
              T₀ (the earlier memory)
              <Input
                type="datetime-local"
                value={t0 || toLocalInput(h.defaultT0)}
                onChange={(e) => setT0(e.target.value)}
                data-testid="replay-t0"
              />
            </Label>
            <Button
              type="button"
              disabled={
                busy || run?.status === "running" || chosen.length + extra.trim().length === 0
              }
              onClick={() => void start()}
              data-testid="replay-run"
            >
              {busy || run?.status === "running" ? (
                <Spinner />
              ) : (
                <Play className="size-4" aria-hidden />
              )}{" "}
              Replay
            </Button>
          </div>
          {error ? <p className="text-md text-ob-danger-text">{error}</p> : null}
        </div>

        {run ? <ReplayResult r={r} run={run} /> : null}

        {h.runs.length ? (
          <ul className="flex flex-col gap-1 text-sm" aria-label="Past replays">
            {h.runs.map((x) => (
              <li key={x.runId} className="flex flex-wrap items-center gap-2">
                <History className="size-3.5 text-ob-muted" aria-hidden />
                <button
                  type="button"
                  className="link"
                  onClick={() => setRunId(x.runId)}
                  data-testid="replay-past"
                >
                  {when(x.startedAt)}
                </button>
                <span className="text-ob-muted">
                  {x.questions} questions
                  {x.totals
                    ? ` · planned ${x.totals.none.services} → ${x.totals.t0.services} → ${x.totals.today.services} services`
                    : ""}
                </span>
                {x.status !== "done" ? <Badge variant="outline">{x.status}</Badge> : null}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Section>
  );
}

function ReplayResult({ r, run }: { r: RemoraView; run: ReplayRun }) {
  const max = Math.max(1, ...COLUMNS.map((c) => run.totals[c.key].services));
  const doneQs = run.questions.filter((q) => q.plans.today).length;
  const anyDiff = run.questions.some((q) => q.differences.length);
  return (
    <div className="flex flex-col gap-4" data-testid="replay-result">
      <p className="text-sm text-ob-muted" data-testid="replay-label">
        Planned in a replay on {when(run.startedAt)} · T₀ {when(run.t0)} · {doneQs} of{" "}
        {run.questions.length} questions{run.status === "running" ? " so far" : ""} · nothing was
        bought
      </p>
      <div className="grid gap-2 sm:grid-cols-3" data-testid="replay-totals">
        {COLUMNS.map((c) => {
          const t = run.totals[c.key];
          return (
            <div key={c.key} className="flex flex-col gap-1.5 rounded-lg border p-3">
              <span className="text-sm text-ob-muted">{c.label}</span>
              <b className="text-xl tabular-nums" data-testid={`replay-services-${c.key}`}>
                {t.services} service{t.services === 1 ? "" : "s"}
              </b>
              <div className="h-2 rounded-full bg-ob-surface-2" aria-hidden>
                <div
                  className="h-2 rounded-full bg-ob-accent"
                  style={{ width: `${(t.services / max) * 100}%` }}
                />
              </div>
              <span className="text-sm tabular-nums text-ob-secondary">
                {usdc(t.spend)} USDC planned · {t.fromMemory} answered from memory
              </span>
            </div>
          );
        })}
      </div>
      {run.status === "done" && !anyDiff ? (
        <p className="text-md text-ob-secondary" data-testid="replay-no-difference">
          No difference: its memory didn't change what it would buy for these questions.
        </p>
      ) : null}
      {run.error ? <p className="text-md text-ob-danger-text">{run.error}</p> : null}
      <ol className="flex flex-col gap-3" aria-label="Each question">
        {run.questions.map((q) => (
          <li
            key={q.question}
            className="flex flex-col gap-2 rounded-lg border p-3"
            data-testid="replay-question"
          >
            <span className="text-md font-medium break-words" data-ux-skip>
              {q.question}
            </span>
            <div className="grid gap-2 text-sm sm:grid-cols-3">
              {COLUMNS.map((c) => {
                const p = q.plans[c.key];
                return (
                  <div key={c.key} className="flex flex-col gap-0.5">
                    <span className="text-xs text-ob-muted">{c.label}</span>
                    {!p ? (
                      <span className="text-ob-muted">…</span>
                    ) : p.buys.length ? (
                      <span>
                        {p.buys.map((b) => payeeName(b.payee)).join(", ")}{" "}
                        <span className="tabular-nums text-ob-muted">({usdc(p.total)})</span>
                      </span>
                    ) : (
                      <span className="text-ob-secondary">
                        {p.fromMemory ? "nothing: from memory" : "nothing to buy"}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {q.differences.length ? (
              <ul className="flex flex-col gap-1 text-sm" aria-label="What changed and why">
                {q.differences.map((d) => (
                  <li
                    key={`${d.payee}-${d.from}-${d.to}`}
                    className="flex flex-col gap-0.5"
                    data-testid="replay-diff"
                  >
                    <span className="text-ob-secondary">{d.reason}</span>
                    {d.cites.length ? (
                      <span className="flex flex-wrap gap-2">
                        {d.cites.map((b) => (
                          <Link
                            key={b}
                            to={`/memory?remora=${r.id}&blob=${encodeURIComponent(b)}`}
                            className="inline-flex items-center gap-1 font-mono text-xs hover:underline"
                            data-testid="replay-cite"
                          >
                            <Brain className="size-3 text-ob-accent" aria-hidden />
                            {b.slice(0, 10)}…
                          </Link>
                        ))}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
