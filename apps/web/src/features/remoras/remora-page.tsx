/**
 * `/remoras/:id` (H4): one remora. Its status and controls (N3 shadow → live, B8 pause/retire, B9
 * rotate, B6 edit), its budget (N5, B7), Ask (Scout, C1) or Teach (Sentinel, C2), schedules (N12),
 * sources (F2), and its activity (N1) with Why? (N4) and 👍/👎 (N19). Three tabs keep Overview to
 * about one screen; destructive actions live in Settings → Danger zone behind ConfirmAction.
 */
import type { FeedItem, RemoraView } from "@remora/schema";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Ellipsis,
  Eye,
  EyeOff,
  KeyRound,
  MessageCircle,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { BudgetMeter } from "@/components/app/budget-meter";
import { ConfirmAction } from "@/components/app/confirm-action";
import { Term } from "@/components/app/glossary";
import { Page, PageHeader, Section } from "@/components/app/page";
import { RemoraAvatar, remoraMood } from "@/components/app/remora-avatar";
import { SpendBadge } from "@/components/app/spend-badge";
import { Hash } from "@/components/hash";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Address, Problem, Stat, StatRow } from "@/components/visual";
import { ModelPicker } from "@/features/chat/model-picker";
import { DEFAULT_MODEL_ID, modelById, priceLabel } from "@/features/chat/models";
import { useSignAndRun } from "@/features/funds/sign";
import { LearningSection } from "@/features/learning/learning";
import { payeeName } from "@/lib/payee";
import { parseUsdc, usdc } from "@/lib/usdc";
import { cn } from "@/lib/utils";
import { day, soon } from "@/lib/when";
import { Property, PropertyList, SettingsGroup, SettingsRow, SurfaceCard } from "@/openbot/pages";
import { api } from "./api";
import { BriefCard } from "./brief-card";
import { budgetLine } from "./budget";
import { CostCard } from "./cost-card";
import { CrewCard } from "./crew-card";
import { describeRemora, useTemplateCatalog } from "./describe";
import { ErrandCard } from "./errand-card";
import { FeedList } from "./feed-list";
import { RequireOwner, useLoad } from "./hooks";
import { ProposalCard } from "./proposal-card";
import { ReviewCard } from "./review-card";
import { BuyFromCard, SellCard } from "./sell-card";
import { useBudget } from "./use-budget";

const must = <T,>(r: { ok: true; data: T } | { ok: false; error: string }): T => {
  if (!r.ok) throw new Error(r.error);
  return r.data;
};

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

type Tab = "overview" | "activity" | "learning" | "settings";

/** Pause/resume needs the shared signer; kept separate from the menu so the JSX stays flat. */
function PauseButton({ r, reload }: { r: RemoraView; reload: () => void }) {
  const { run, busy, go } = useOwnerTx();
  const live = r.status === "active" || r.status === "shadow";
  if (!live && r.status !== "paused") return null;
  return (
    <Button
      type="button"
      variant={r.status === "paused" ? "default" : "outline"}
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
      {busy === "pause" ? <Spinner /> : null}
      {r.status === "paused" ? "Resume" : "Pause"}
    </Button>
  );
}

function headerActions(r: RemoraView, reload: () => void, setTab: (t: Tab) => void) {
  return (
    <>
      {r.status === "shadow" || r.status === "active" ? (
        <Button asChild type="button" variant="outline" size="sm">
          <Link to={`/chat/r/${r.id}`}>
            <MessageCircle /> Chat
          </Link>
        </Button>
      ) : null}
      {r.status === "shadow" ? (
        <GoLive r={r} reload={reload} />
      ) : (
        <PauseButton r={r} reload={reload} />
      )}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="ghost" size="icon-sm" aria-label="More actions">
            <Ellipsis />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onSelect={() => setTab("settings")}>Edit</DropdownMenuItem>
          {r.status === "shadow" || r.status === "active" || r.status === "paused" ? (
            <DropdownMenuItem asChild>
              <Link to={`/remoras/${r.id}/share`}>Share as a template</Link>
            </DropdownMenuItem>
          ) : null}
          {r.discId ? (
            <DropdownMenuItem onSelect={() => setTab("settings")}>Rotate key</DropdownMenuItem>
          ) : null}
          {r.status !== "retired" ? (
            <DropdownMenuItem variant="destructive" onSelect={() => setTab("settings")}>
              Retire
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function GoLive({ r, reload }: { r: RemoraView; reload: () => void }) {
  const { busy, go } = useOwnerTx();
  return (
    <Button
      type="button"
      disabled={!!busy}
      onClick={() =>
        void go("activate", async () => {
          must(await api.activate(r.id));
          reload();
          return `${r.name} is live.`;
        })
      }
    >
      {busy === "activate" ? <Spinner /> : null}
      Go live
    </Button>
  );
}

function AskCard({ r, onDone }: { r: RemoraView; onDone: () => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [answer, setAnswer] = useState("");
  const queries = useQueryClient();
  const ask = async () => {
    setBusy(true);
    const out = await api.ask(r.id, q);
    setBusy(false);
    if (!out.ok) return void toast.error(out.error);
    setAnswer(out.data.answer);
    // ADR-0092: an answer can pay, so the budget meter and the cost card read it now, not later.
    void queries.invalidateQueries({ queryKey: ["remora-budget"] });
    void queries.invalidateQueries({ queryKey: ["remora-cost"] });
    onDone();
  };
  return (
    <Section
      title={`Ask ${r.name}`}
      description="It buys data when that helps, and tells you what each answer cost."
    >
      <SurfaceCard className="gap-2 p-2">
        <Textarea
          aria-label="Question"
          rows={2}
          placeholder="Is package 0x2 safe to depend on?"
          className="min-h-16 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={busy || !q.trim()} onClick={() => void ask()}>
            {busy ? <Spinner /> : null}
            {busy ? "Thinking…" : "Ask"}
          </Button>
        </div>
      </SurfaceCard>
      {answer ? (
        <SurfaceCard tone="muted">
          <p className="text-md whitespace-pre-wrap text-ob-text" data-testid="answer">
            {answer}
          </p>
        </SurfaceCard>
      ) : null}
    </Section>
  );
}

/** A Wallet watcher's overview leads with what it watches (ADR-0103: the reviewers couldn't see it). */
const count = (events: FeedItem[], type: FeedItem["type"]) =>
  events.filter((e) => e.type === type).length;

function WatchingCard({ r }: { r: RemoraView }) {
  const addresses = r.config.triggers.flatMap((t) => (t.kind === "chain" ? t.addresses : []));
  return (
    <Section title="Watching" badge={<Badge variant="secondary">never pays</Badge>}>
      {addresses.length ? (
        <ul className="flex flex-wrap gap-2" aria-label="Watched wallets">
          {addresses.map((a) => (
            <li
              key={a}
              className="flex max-w-72 min-w-0 items-center gap-2 rounded-lg border border-ob-border bg-ob-raised px-3 py-1.5"
            >
              <Eye className="size-3.5 shrink-0 text-ob-muted" aria-hidden />
              <Address value={a} href={`https://suiscan.xyz/${r.network}/account/${a}`} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-md text-ob-muted">No wallets yet. Add one in Settings.</p>
      )}
    </Section>
  );
}

function TeachCard({
  r,
  onDone,
  readOnly = false,
}: {
  r: RemoraView;
  onDone: () => void;
  /** Retired: the rules it learned, nothing to teach or forget. */
  readOnly?: boolean;
}) {
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
    <Section
      title={readOnly ? "Rules it learned" : `Teach ${r.name}`}
      hint={
        readOnly
          ? undefined
          : "Plain words: “ignore incoming SUI under 0.01”, “always ping me for anything over 1 SUI”."
      }
    >
      {readOnly ? (
        (rules.data?.rules ?? []).length ? null : (
          <p className="text-md text-ob-muted">It learned no rules.</p>
        )
      ) : (
        <div className="flex gap-2">
          <Input aria-label="Rule" value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="button" disabled={!text.trim()} onClick={() => void teach()}>
            Teach
          </Button>
        </div>
      )}
      <SettingsGroup
        as="ul"
        aria-label="Rules"
        className={cn(!(rules.data?.rules ?? []).length && "hidden")}
      >
        {(rules.data?.rules ?? []).map((x) => (
          <SettingsRow
            as="li"
            key={x.id}
            size="compact"
            title={<span className="font-normal">{x.text}</span>}
            actions={
              readOnly ? null : (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void api.deleteRule(r.id, x.id).then(() => rules.refresh())}
                >
                  Forget
                </Button>
              )
            }
          />
        ))}
      </SettingsGroup>
    </Section>
  );
}

function BudgetSection({
  r,
  reload,
  layout = "stack",
}: {
  r: RemoraView;
  reload: () => void;
  layout?: "stack" | "split";
}) {
  const retired = r.status === "retired";
  const meter = useBudget(r.id, Boolean(r.config.budget) && !retired);
  const { run } = useOwnerTx();
  const b = r.config.budget;
  const [monthly, setMonthly] = useState(b ? usdc(b.windowLimit) : "1");
  const [cap, setCap] = useState(b ? usdc(b.perPaymentCap) : "0.05");
  if (!b || retired)
    return (
      <Section
        layout={layout}
        title="Budget"
        description={
          retired
            ? "Retired: its spending limit was revoked, so it never pays again."
            : "Read-only: this remora has no spending limit and never pays."
        }
      >
        <p className="text-md text-ob-muted">No budget to change.</p>
      </Section>
    );

  const change = async () => {
    const limit = parseUsdc(monthly);
    const per = parseUsdc(cap);
    if (!limit || !per || per > limit)
      throw new Error("Set a monthly limit and a smaller per-payment cap.");
    const budget = { ...b, windowLimit: limit.toString(), perPaymentCap: per.toString() };
    const out = must(await api.budgetTx(r.id, budget));
    if (!out.transaction) throw new Error("This remora has no spending limit.");
    const digest = await run(out.transaction);
    must(await api.budgetConfirm(r.id, digest, budget));
    reload();
    void meter.refresh();
    toast.success("Budget changed: the old spending limit is revoked and the new one is live.");
  };

  return (
    <Section
      layout={layout}
      title="Budget"
      description={
        !meter.loading && !meter.error && !meter.meter ? `Was: ${budgetLine(r)}` : budgetLine(r)
      }
    >
      <SurfaceCard>
        <BudgetMeter
          meter={meter.meter}
          window={b.window}
          loading={meter.loading}
          error={meter.error}
        />
        {meter.error ? <p className="text-md text-ob-danger-text">{meter.error}</p> : null}
        {/* A limit gone onchain can't be changed: the change revokes the old Disc and reissues. */}
        {r.discId && (meter.loading || meter.error || meter.meter) ? (
          <div className="flex flex-wrap items-end gap-2 border-t border-ob-border-grouped pt-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="budget-monthly">Monthly limit</Label>
              <Input
                id="budget-monthly"
                className="w-28"
                aria-label="Monthly limit"
                value={monthly}
                onChange={(e) => setMonthly(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="budget-cap">Per payment</Label>
              <Input
                id="budget-cap"
                className="w-28"
                aria-label="Per payment"
                value={cap}
                onChange={(e) => setCap(e.target.value)}
              />
            </div>
            <ConfirmAction
              trigger={
                <Button type="button" variant="outline">
                  Change budget
                </Button>
              }
              title={`Change ${r.name}'s budget?`}
              description="This revokes the old spending limit and sets a new one. You'll sign one transaction."
              confirmLabel="Change budget"
              tone="default"
              onConfirm={change}
            />
          </div>
        ) : null}
      </SurfaceCard>
    </Section>
  );
}

function IdentitySection({ r, reload }: { r: RemoraView; reload: () => void }) {
  const [name, setName] = useState(r.name);
  const [persona, setPersona] = useState(r.config.persona);
  const [busy, setBusy] = useState(false);
  const changed = name !== r.name || persona !== r.config.persona;
  const save = async () => {
    setBusy(true);
    try {
      must(await api.edit(r.id, { name, persona }));
      reload();
      toast.success("Saved. The previous version is in the feed.");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section
      layout="split"
      title="Identity"
      description="The name and the one-sentence persona it answers as."
    >
      <SurfaceCard className="gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="remora-name">Name</Label>
          <Input
            id="remora-name"
            aria-label="Name"
            value={name}
            maxLength={40}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="remora-persona">Persona</Label>
          <Textarea
            id="remora-persona"
            aria-label="Persona"
            rows={3}
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button type="button" size="sm" disabled={busy || !changed} onClick={() => void save()}>
            {busy ? <Spinner /> : null}
            Save
          </Button>
        </div>
      </SurfaceCard>
    </Section>
  );
}

/** D9 (ADR-0042): the model this remora thinks with, from the shared catalog. */
function BrainSection({ r, reload }: { r: RemoraView; reload: () => void }) {
  const [busy, setBusy] = useState(false);
  const model = modelById(r.config.model ?? DEFAULT_MODEL_ID);
  const choose = async (id: string) => {
    setBusy(true);
    const out = await api.edit(r.id, { model: id || null });
    setBusy(false);
    if (!out.ok) return void toast.error(out.error);
    toast.success(
      id
        ? `${r.name} now thinks with ${modelById(id).label}.`
        : `${r.name} uses the default model.`,
    );
    reload();
  };
  return (
    <Section
      layout="split"
      title="Brain"
      description="The model it answers with."
      hint="Every choice can call tools and costs at most $1 per 1M tokens."
    >
      <SettingsGroup>
        <SettingsRow
          stack
          title={model.label}
          description={
            priceLabel(model) === "—" ? undefined : `${model.vendor} · ${priceLabel(model)}`
          }
          actions={
            <div className="flex items-center gap-2" data-testid="remora-model">
              <ModelPicker
                labelled
                value={r.config.model ?? DEFAULT_MODEL_ID}
                onChange={(id) => void choose(id)}
              />
              {busy ? <Spinner /> : null}
            </div>
          }
        />
      </SettingsGroup>
    </Section>
  );
}

function SchedulesSection({ r }: { r: RemoraView }) {
  const [when, setWhen] = useState("weekdays at 8am");
  const [question, setQuestion] = useState("");
  const preview = useLoad(() => api.schedulePreview(when), [when]);
  const list = useLoad(() => api.schedules(r.id), [r.id]);
  const schedules = list.data?.schedules ?? [];
  const add = async () => {
    const out = await api.addSchedule(r.id, when, question);
    if (!out.ok) return void toast.error(out.error);
    toast.success(`Next run ${soon(out.data.next[0] ?? "")}`);
    setQuestion("");
    void list.refresh();
  };
  return (
    <Section
      layout="split"
      title="Schedules"
      description="A question it asks on its own, and tells you the answer."
    >
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
          disabled={!preview.data || !question.trim()}
          onClick={() => void add()}
        >
          Add
        </Button>
      </div>
      <p className="text-md text-ob-muted" data-testid="schedule-preview">
        {preview.data
          ? `${preview.data.human}: next ${preview.data.next
              .slice(0, 3)
              .map((t) => soon(t))
              .join(" · ")}`
          : preview.error || "…"}
      </p>
      <SettingsGroup as="ul" className={cn(!schedules.length && "hidden")}>
        {schedules.map((s) => (
          <SettingsRow
            as="li"
            key={s.id}
            size="compact"
            title={
              <span className="font-normal">
                {s.human}: {s.question}
                {s.paused ? <span className="ml-2 text-ob-muted">(paused)</span> : null}
              </span>
            }
            actions={
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    void api.pauseSchedule(r.id, s.id, !s.paused).then((out) => {
                      if (!out.ok) toast.error(out.error);
                      void list.refresh();
                    })
                  }
                >
                  {s.paused ? "Resume" : "Pause"}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => void api.removeSchedule(r.id, s.id).then(() => list.refresh())}
                >
                  Remove
                </Button>
              </>
            }
          />
        ))}
      </SettingsGroup>
    </Section>
  );
}

function SourcesSection({ r }: { r: RemoraView }) {
  const s = useLoad(() => api.sources(r.id), [r.id], 30_000);
  const rows = s.data?.sources ?? [];
  if (!rows.length) return null;
  return (
    <Section
      layout="split"
      title="Sources"
      description="From your thumbs up and down; written to its memory as it learns."
    >
      <SettingsGroup as="ul">
        {rows.map((x) => (
          <SettingsRow
            as="li"
            key={x.payee}
            size="compact"
            title={payeeName(x.payee)}
            description={`${x.calls} calls · ${x.useful} useful · ${x.noise} noise · ${usdc(x.spent)} USDC spent`}
          />
        ))}
      </SettingsGroup>
    </Section>
  );
}

/** ADR-0127: whether its counts feed the Reef's reputation. Counts only, never content. */
function ShareSection({ r, reload }: { r: RemoraView; reload: () => void }) {
  const on = Boolean((r.config as { share?: { stats?: boolean } }).share?.stats);
  const [busy, setBusy] = useState(false);
  const flip = async (next: boolean) => {
    setBusy(true);
    const out = await api.setShare(r.id, next);
    setBusy(false);
    if (!out.ok) return void toast.error(out.error);
    reload();
  };
  return (
    <Section
      layout="split"
      title="Share with the Reef"
      description="Its paid calls, refusals, your ratings and timings feed each service's 7-day score. Never a question, an answer or an amount."
    >
      <SettingsGroup>
        <SettingsRow
          title="Share its counts"
          description={on ? "On: the Reef counts its calls." : "Off: nothing leaves this remora."}
          actions={
            <Switch
              id="share-stats"
              aria-label="Share its counts with the Reef"
              checked={on}
              disabled={busy || r.status === "retired"}
              onCheckedChange={(next) => void flip(next)}
            />
          }
        />
      </SettingsGroup>
    </Section>
  );
}

function KeysSection({ r }: { r: RemoraView }) {
  const limit = useBudget(r.id, Boolean(r.discId) && r.status !== "retired");
  const limitGone =
    r.status === "retired" || (!limit.loading && !limit.error && !limit.meter && Boolean(r.discId));
  return (
    <Section
      layout="split"
      title="Keys"
      description="The key that acts, and the spending limit that caps it."
    >
      <PropertyList>
        <Property term="Spending key">{r.address ? <Hash value={r.address} /> : "—"}</Property>
        <Property term={<Term name="spending limit">Spending limit</Term>}>
          {r.discId ? (
            <span className="flex min-w-0 items-center gap-2">
              <Hash value={r.discId} />
              {limitGone ? <Badge variant="outline">revoked</Badge> : null}
            </span>
          ) : (
            "—"
          )}
        </Property>
      </PropertyList>
    </Section>
  );
}

function DangerSection({ r, reload }: { r: RemoraView; reload: () => void }) {
  const { run } = useOwnerTx();
  return (
    <Section
      layout="split"
      title="Danger zone"
      tone="danger"
      description="Both actions need a signature and take effect immediately."
    >
      <div className="flex flex-wrap gap-2">
        {r.discId ? (
          <ConfirmAction
            trigger={
              <Button type="button" variant="destructive">
                <KeyRound /> Rotate key
              </Button>
            }
            title={`Rotate ${r.name}'s key?`}
            description="The old key cannot spend after this. The new key is written to its memory."
            confirmLabel="Rotate key"
            onConfirm={async () => {
              const out = must(await api.rotate(r.id));
              const digest = await run(out.transaction);
              must(await api.rotateConfirm(r.id, digest, out.keyId));
              reload();
              toast.success("New key in place. The old one can't spend anymore.");
            }}
          />
        ) : null}
        {r.status !== "retired" ? (
          <ConfirmAction
            trigger={
              <Button type="button" variant="destructive">
                <Trash2 /> Retire
              </Button>
            }
            title={`Retire ${r.name}?`}
            description="Its spending limit is revoked and it stops for good. Its memory stays yours."
            confirmLabel="Retire"
            onConfirm={async () => {
              const out = must(await api.retire(r.id));
              const digest = out.transaction ? await run(out.transaction) : undefined;
              must(await api.retireConfirm(r.id, digest));
              reload();
              toast.success(`${r.name} is retired. Its memory stays yours.`);
            }}
          />
        ) : null}
      </div>
    </Section>
  );
}

function SettingsTab({ r, reload }: { r: RemoraView; reload: () => void }) {
  // ADR-0103: a retired remora can't act, so its settings are read-only: no name or brain to edit,
  // no empty danger zone.
  if (r.status === "retired")
    return (
      <div className="flex flex-col gap-8 lg:gap-10">
        <p className="text-md text-ob-muted">
          Retired: it can't act or pay. Its memory and receipts stay yours.
        </p>
        {r.template !== "sentinel" ? <SourcesSection r={r} /> : null}
        <KeysSection r={r} />
      </div>
    );
  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <IdentitySection r={r} reload={reload} />
      <BrainSection r={r} reload={reload} />
      <BudgetSection r={r} reload={reload} layout="split" />
      {r.template === "scout" ? <SchedulesSection r={r} /> : null}
      {/* ADR-0106: a Briefer's schedule is its brief's; its page shows it with Run now. */}
      {r.template === "scout" ? <SourcesSection r={r} /> : null}
      {r.template === "scout" || r.template === "briefer" ? (
        <ShareSection r={r} reload={reload} />
      ) : null}
      <KeysSection r={r} />
      <DangerSection r={r} reload={reload} />
    </div>
  );
}

function Remora({ id }: { id: string }) {
  const [params, setParams] = useSearchParams();
  const remora = useLoad(() => api.remora(id), [id]);
  const tab = (params.get("tab") as Tab | null) ?? "overview";
  // N13: the first run lands within a minute; poll faster right after creation.
  const feed = useLoad(() => api.feed({ remora: id }), [id], params.get("new") ? 5_000 : 20_000);
  const catalog = useTemplateCatalog();
  const r = remora.data?.remora;
  const headerLimit = useBudget(
    id,
    Boolean(r?.discId && r.config.budget && r.status !== "retired"),
  );
  const headerState: "checking" | "gone" | "row" =
    !r?.discId || !r.config.budget || r.status === "retired"
      ? "row"
      : headerLimit.loading
        ? "checking"
        : !headerLimit.error && !headerLimit.meter
          ? "gone"
          : "row";

  if (remora.error) {
    return (
      <Page title="Remora">
        <Problem
          title="Can't reach Remora right now. Your remora is safe onchain."
          detail={remora.error}
          onRetry={() => void remora.refresh()}
        />
      </Page>
    );
  }
  if (!r) {
    // The shape of the page it becomes: face and name, tabs, the Ask box, two cards (ADR-0103).
    return (
      <Page title="Remora">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <Skeleton className="h-7 w-48" />
        </div>
        <Skeleton className="h-8 w-80 rounded-lg" />
        <Skeleton className="h-24 w-full rounded-ob-card" />
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="h-40 w-full rounded-ob-card" />
          <Skeleton className="h-40 w-full rounded-ob-card" />
        </div>
      </Page>
    );
  }

  const reload = () => void remora.refresh();
  const refreshFeed = () => void feed.refresh();
  const setTab = (next: Tab) => {
    const params = new URLSearchParams(window.location.search);
    params.set("tab", next);
    setParams(params);
  };
  const events = feed.data?.events ?? [];
  // The server read its Disc and it's gone onchain: the header says so instead of "active".

  return (
    <Page title={r.name} description={describeRemora(r, catalog)}>
      <PageHeader
        title={
          <span className="inline-flex min-w-0 items-center gap-3">
            <RemoraAvatar id={r.id} mood={remoraMood(r)} size={40} />
            {r.name}
          </span>
        }
        badge={<SpendBadge status={r.status} state={headerState} />}
        description={describeRemora(r, catalog)}
        actions={headerActions(r, reload, setTab)}
      />

      {r.status === "shadow" ? (
        <Alert variant="warning">
          <AlertTitle>Practice mode</AlertTitle>
          <AlertDescription>
            It shows what it would pay, but pays nothing
            {r.shadowUntil ? ` until ${day(r.shadowUntil)}` : ""}.
          </AlertDescription>
        </Alert>
      ) : null}
      {r.status === "retired" ? (
        // ADR-0088: a retired remora's page said "Reading the Disc…" forever and still offered Ask.
        <Alert data-testid="retired-alert">
          <AlertTitle>Retired</AlertTitle>
          <AlertDescription>
            Its spending limit is revoked, so it can't act or pay. Its memory and receipts stay
            yours.
          </AlertDescription>
        </Alert>
      ) : null}
      {r.status === "creating" ? (
        <Alert>
          <AlertTitle>Waiting for its budget transaction</AlertTitle>
          <AlertDescription>
            This page updates itself when the spending limit lands onchain.
          </AlertDescription>
        </Alert>
      ) : null}
      {params.get("new") && !events.some((e) => e.type === "answer" || e.type === "action") ? (
        <Alert>
          <AlertTitle>Getting its first run ready…</AlertTitle>
          <AlertDescription>Nothing else to do; it will show up here.</AlertDescription>
        </Alert>
      ) : null}

      <Tabs value={tab} onValueChange={(value) => setTab(value as Tab)}>
        <TabsList className="max-w-full overflow-x-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="learning">Learning</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-8 pt-5">
          {r.template === "sentinel" ? <WatchingCard r={r} /> : null}
          {r.template === "sentinel" && events.length ? (
            <StatRow className="md:grid-cols-3">
              <Stat label="Pings" icon={<Bell />} value={count(events, "ping")} of="recently" />
              <Stat
                label="Ignored"
                icon={<EyeOff />}
                value={count(events, "episode")}
                of="recently"
              />
              <Stat
                label="Rules learned"
                icon={<Sparkles />}
                value={count(events, "rule_learned")}
                of="recently"
              />
            </StatRow>
          ) : null}
          {r.template === "briefer" ? (
            <BriefCard r={r} onDone={refreshFeed} readOnly={r.status === "retired"} />
          ) : r.status === "retired" ? (
            r.template === "sentinel" ? (
              <TeachCard r={r} onDone={refreshFeed} readOnly />
            ) : null
          ) : r.template === "scout" ? (
            <AskCard r={r} onDone={refreshFeed} />
          ) : r.template === "errand" ? (
            <ErrandCard r={r} onDone={refreshFeed} />
          ) : (
            <TeachCard r={r} onDone={refreshFeed} />
          )}
          {r.config.crew ? <CrewCard r={r} onChanged={reload} /> : null}
          {r.template === "scout" || r.template === "briefer" ? (
            <div className="grid items-start gap-8 lg:grid-cols-2">
              <SellCard r={r} readOnly={r.status === "retired"} />
              <BuyFromCard r={r} onChanged={reload} />
            </div>
          ) : null}
          {r.config.budget && r.discId ? (
            <ProposalCard r={r} onChanged={reload} open={Boolean(params.get("proposal"))} />
          ) : null}
          <div className="grid items-start gap-8 lg:grid-cols-2">
            {r.config.budget ? <BudgetSection r={r} reload={reload} /> : null}
            <CostCard remoraId={r.id} />
          </div>
          <Section
            title="Recent activity"
            actions={
              <Button asChild variant="ghost" size="sm" className="-mr-3">
                <Link to={`?tab=activity`}>See all</Link>
              </Button>
            }
          >
            <FeedList items={events.slice(0, 5)} />
          </Section>
        </TabsContent>

        <TabsContent value="activity" className="flex flex-col gap-4 pt-5">
          <div className="flex justify-end">
            <Button asChild variant="outline" size="sm">
              <Link to={`/memory?remora=${r.id}`}>Its memory</Link>
            </Button>
          </div>
          <FeedList items={events} />
        </TabsContent>

        <TabsContent value="learning" className="flex flex-col gap-8 pt-5">
          {r.template === "sentinel" ? null : <ReviewCard r={r} />}
          <LearningSection remoraId={r.id} />
        </TabsContent>

        <TabsContent value="settings" className="pt-5">
          <SettingsTab r={r} reload={reload} />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

export function RemoraPage() {
  const { id = "" } = useParams();
  return (
    <RequireOwner what="this remora" needsWallet>
      {() => <Remora id={id} />}
    </RequireOwner>
  );
}
