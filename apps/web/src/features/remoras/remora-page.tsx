/**
 * `/remoras/:id` (H4): one remora. Its status and controls (N3 shadow → live, B8 pause/retire, B9
 * rotate, B6 edit), its budget with a forecast (N5, B7), Ask (Scout, C1) or Teach (Sentinel, C2),
 * schedules (N12), sources (F2), and its activity (N1) with Why? (N4) and 👍/👎 (N19).
 */
import type { RemoraView } from "@remora/schema";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { useShellTitle } from "@/app/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useSignAndRun } from "@/features/funds/sign";
import { formatUsdc, parseUsdc } from "@/lib/usdc";
import { api } from "./api";
import { FeedList } from "./feed-list";
import { RequireOwner, useLoad } from "./hooks";
import { budgetLine } from "./remoras-page";

/** Runs an owner transaction from the server, then its confirm; toasts the human error (N6). */
function useOwnerTx() {
  const run = useSignAndRun();
  const [busy, setBusy] = useState("");
  const go = async (label: string, steps: () => Promise<string | undefined>) => {
    setBusy(label);
    try {
      const done = await steps();
      if (done) toast.success(done);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy("");
    }
  };
  return { run, busy, go };
}

const must = <T,>(r: { ok: true; data: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

function Controls({ r, reload }: { r: RemoraView; reload: () => void }) {
  const { run, busy, go } = useOwnerTx();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.name);
  const [persona, setPersona] = useState(r.config.persona);
  const live = r.status === "active" || r.status === "shadow";
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {r.name}{" "}
          <Badge variant={r.status === "paused" ? "destructive" : "secondary"}>{r.status}</Badge>
          <span className="text-xs font-normal text-muted-foreground">
            {r.template} · {r.network}
          </span>
        </CardTitle>
        <CardDescription>
          {r.status === "shadow"
            ? `Shadow mode: it says what it would pay but pays nothing${r.shadowUntil ? ` until ${new Date(r.shadowUntil).toLocaleString()}` : ""}.`
            : r.status === "creating"
              ? "Waiting for its budget transaction."
              : r.config.persona}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <p className="text-muted-foreground">
          Key {r.address ? `${r.address.slice(0, 10)}…` : "—"}
          {r.discId ? ` · Disc ${r.discId.slice(0, 10)}…` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          {r.status === "shadow" ? (
            <Button
              type="button"
              size="sm"
              disabled={!!busy}
              onClick={() =>
                void go("activate", async () => {
                  must(await api.activate(r.id));
                  reload();
                  return `${r.name} is live.`;
                })
              }
            >
              Go live
            </Button>
          ) : null}
          {live || r.status === "paused" ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                void go("pause", async () => {
                  const paused = r.status !== "paused";
                  const out = must(await api.pause(r.id, paused));
                  if (out.transaction) {
                    await run(out.transaction);
                    must(await api.pauseConfirm(r.id));
                  }
                  reload();
                  return paused ? `${r.name} is paused.` : `${r.name} is back on.`;
                })
              }
            >
              {r.status === "paused" ? "Resume" : "Pause"}
            </Button>
          ) : null}
          {r.discId ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                void go("rotate", async () => {
                  const out = must(await api.rotate(r.id));
                  const digest = await run(out.transaction);
                  must(await api.rotateConfirm(r.id, digest, out.keyId));
                  reload();
                  return "New key in place. The old one can't spend anymore.";
                })
              }
            >
              Rotate key
            </Button>
          ) : null}
          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing((e) => !e)}>
            Edit
          </Button>
          {r.status !== "retired" ? (
            <Button
              type="button"
              size="sm"
              variant="destructive"
              disabled={!!busy}
              onClick={() =>
                void go("retire", async () => {
                  const out = must(await api.retire(r.id));
                  const digest = out.transaction ? await run(out.transaction) : undefined;
                  must(await api.retireConfirm(r.id, digest));
                  reload();
                  return `${r.name} is retired. Its memory stays yours.`;
                })
              }
            >
              Retire
            </Button>
          ) : null}
          {busy ? (
            <span className="self-center text-muted-foreground">Working… check your wallet.</span>
          ) : null}
        </div>
        {editing ? (
          <div className="flex flex-col gap-2">
            <Input
              aria-label="Name"
              value={name}
              maxLength={40}
              onChange={(e) => setName(e.target.value)}
            />
            <Textarea
              aria-label="Persona"
              rows={3}
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              className="self-start"
              onClick={() =>
                void go("edit", async () => {
                  must(await api.edit(r.id, { name, persona }));
                  setEditing(false);
                  reload();
                  return "Saved. The previous version is in the feed.";
                })
              }
            >
              Save
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function BudgetCard({ r, reload }: { r: RemoraView; reload: () => void }) {
  const meter = useLoad(() => api.budget(r.id), [r.id, r.discId], 30_000);
  const { run, busy, go } = useOwnerTx();
  const b = r.config.budget;
  const [monthly, setMonthly] = useState(b ? formatUsdc(b.windowLimit) : "1");
  const [cap, setCap] = useState(b ? formatUsdc(b.perPaymentCap) : "0.05");
  const m = meter.data?.meter;
  if (!b) return null;
  const left = m?.window ? BigInt(m.window.limit) - BigInt(m.window.spent) : null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Budget</CardTitle>
        <CardDescription>{budgetLine(r)}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {m ? (
          <p data-testid="budget-meter">
            {left !== null ? `${formatUsdc(left)} USDC left this ${b.window}` : ""} · spent{" "}
            {formatUsdc(m.spent)} in total{m.paused ? " · paused" : ""}
            {m.forecast?.runsOutOn ? ` · at this pace it runs out on ${m.forecast.runsOutOn}` : ""}
          </p>
        ) : (
          <p className="text-muted-foreground">{meter.error || "Reading the Disc…"}</p>
        )}
        {r.discId ? (
          <div className="flex flex-wrap items-end gap-2">
            <Input
              className="w-28"
              aria-label="Monthly limit"
              value={monthly}
              onChange={(e) => setMonthly(e.target.value)}
            />
            <Input
              className="w-28"
              aria-label="Per payment"
              value={cap}
              onChange={(e) => setCap(e.target.value)}
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={!!busy}
              onClick={() =>
                void go("budget", async () => {
                  const limit = parseUsdc(monthly);
                  const per = parseUsdc(cap);
                  if (!limit || !per || per > limit)
                    throw new Error("Set a monthly limit and a smaller per-payment cap.");
                  const budget = {
                    ...b,
                    windowLimit: limit.toString(),
                    perPaymentCap: per.toString(),
                  };
                  const out = must(await api.budgetTx(r.id, budget));
                  if (!out.transaction) throw new Error("This remora has no Disc.");
                  const digest = await run(out.transaction);
                  must(await api.budgetConfirm(r.id, digest, budget));
                  reload();
                  void meter.refresh();
                  return "Budget changed: the old Disc is revoked and the new one is live.";
                })
              }
            >
              Change budget
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function AskCard({ r, onDone }: { r: RemoraView; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const ask = async () => {
    setBusy(true);
    const out = await api.ask(r.id, q);
    setBusy(false);
    if (!out.ok) return void toast.error(out.error);
    setAnswer(out.data.answer);
    onDone();
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Ask {r.name}</CardTitle>
        <CardDescription>
          It buys data when that helps, and tells you what each answer cost.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Textarea
          aria-label="Question"
          rows={2}
          placeholder="Is package 0x2 safe to depend on?"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button
          type="button"
          size="sm"
          className="self-start"
          disabled={busy || !q.trim()}
          onClick={() => void ask()}
        >
          {busy ? "Thinking (and maybe paying)…" : "Ask"}
        </Button>
        {answer ? (
          <p className="whitespace-pre-wrap text-sm" data-testid="answer">
            {answer}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

function TeachCard({ r, onDone }: { r: RemoraView; onDone: () => void }) {
  const rules = useLoad(() => api.rules(r.id), [r.id]);
  const [text, setText] = useState("");
  const teach = async () => {
    const out = await api.teach(r.id, text);
    if (!out.ok) return void toast.error(out.error);
    toast.success(`Learned: ${out.data.text}`);
    setText("");
    void rules.refresh();
    onDone();
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Teach {r.name}</CardTitle>
        <CardDescription>
          Plain words: “ignore incoming SUI under 0.01”, “always ping me for anything over 1 SUI”.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="flex gap-2">
          <Input aria-label="Rule" value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="button" size="sm" disabled={!text.trim()} onClick={() => void teach()}>
            Teach
          </Button>
        </div>
        <ul className="flex flex-col gap-1" aria-label="Rules">
          {(rules.data?.rules ?? []).map((x) => (
            <li key={x.id} className="flex items-center justify-between gap-2">
              <span>{x.text}</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void api.deleteRule(r.id, x.id).then(() => rules.refresh())}
              >
                Forget
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SchedulesCard({ r }: { r: RemoraView }) {
  const [when, setWhen] = useState("weekdays at 8am");
  const [question, setQuestion] = useState("");
  const preview = useLoad(() => api.schedulePreview(when), [when]);
  const list = useLoad(() => api.schedules(r.id), [r.id]);
  const schedules = list.data?.schedules ?? [];
  const add = async () => {
    const out = await api.addSchedule(r.id, when, question);
    if (!out.ok) return void toast.error(out.error);
    toast.success(`Next run ${new Date(out.data.next[0] ?? "").toLocaleString()}`);
    setQuestion("");
    void list.refresh();
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Schedules</CardTitle>
        <CardDescription>A question it asks on its own, and tells you the answer.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 text-sm">
        <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
          <Input aria-label="When" value={when} onChange={(e) => setWhen(e.target.value)} />
          <Input
            aria-label="Scheduled question"
            placeholder="What are the odds for this weekend?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
          <Button
            type="button"
            size="sm"
            disabled={!preview.data || !question.trim()}
            onClick={() => void add()}
          >
            Add
          </Button>
        </div>
        <p className="text-muted-foreground" data-testid="schedule-preview">
          {preview.data
            ? `${preview.data.human}: next ${preview.data.next.map((t) => new Date(t).toLocaleString()).join(", ")}`
            : preview.error || "…"}
        </p>
        <ul className="flex flex-col gap-1">
          {schedules.map((s) => (
            <li key={s.id} className="flex items-center justify-between gap-2">
              <span>
                {s.human}: {s.question}
              </span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => void api.removeSchedule(r.id, s.id).then(() => list.refresh())}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SourcesCard({ r }: { r: RemoraView }) {
  const s = useLoad(() => api.sources(r.id), [r.id], 30_000);
  const rows = s.data?.sources ?? [];
  if (!rows.length) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">What its sources are worth</CardTitle>
        <CardDescription>From your 👍/👎; written to its memory as it learns.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1 text-sm">
          {rows.map((x) => (
            <li key={x.payee}>
              {x.payee}: {x.calls} calls, {x.useful} useful, {x.noise} noise, {formatUsdc(x.spent)}{" "}
              USDC spent
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function Remora({ id }: { id: string }) {
  const [params] = useSearchParams();
  const remora = useLoad(() => api.remora(id), [id]);
  // N13: the first run lands within a minute; poll faster right after creation.
  const feed = useLoad(() => api.feed({ remora: id }), [id], params.get("new") ? 5_000 : 20_000);
  const r = remora.data?.remora;
  useShellTitle(r?.name ?? "Remora");
  if (remora.error) return <p className="p-6 text-sm text-destructive">{remora.error}</p>;
  if (!r) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  const reload = () => void remora.refresh();
  const refreshFeed = () => void feed.refresh();
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 overflow-y-auto p-4">
      <Controls r={r} reload={reload} />
      {params.get("new") &&
      !feed.data?.events.some((e) => e.type === "answer" || e.type === "action") ? (
        <p className="text-sm text-muted-foreground">Getting its first run ready…</p>
      ) : null}
      {r.template === "scout" ? <AskCard r={r} onDone={refreshFeed} /> : null}
      {r.template === "sentinel" ? <TeachCard r={r} onDone={refreshFeed} /> : null}
      <BudgetCard r={r} reload={reload} />
      {r.template === "scout" ? <SchedulesCard r={r} /> : null}
      <SourcesCard r={r} />
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium">Activity</h2>
        <Link className="text-sm underline" to={`/memory?remora=${r.id}`}>
          Its memory
        </Link>
      </div>
      <FeedList items={feed.data?.events ?? []} />
    </div>
  );
}

export function RemoraPage() {
  const { id = "" } = useParams();
  return <RequireOwner what="this remora">{() => <Remora id={id} />}</RequireOwner>;
}
