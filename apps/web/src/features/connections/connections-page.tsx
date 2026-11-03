/**
 * `/connections` (F14·ui, ADR-0066; claimed for U12 under ADR-0027): let an agent (Claude Code,
 * Cursor, any MCP client) use one of your remoras. A token is scoped, expires and can be revoked; its
 * secret shows once. Money still moves only through the remora's Disc, and over it the agent has to
 * ask you.
 */
import type { McpCall, McpScope, McpToken, McpTokenCreated } from "@remora/schema";
import { Cable, ChevronDown, CircleCheck, CircleX, KeyRound } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { ConfirmAction } from "@/components/app/confirm-action";
import { EmptyState } from "@/components/app/empty-state";
import { Page, PageHeader } from "@/components/app/page";
import { Section } from "@/components/app/section";
import { StatusBadge } from "@/components/app/status-badge";
import { Time } from "@/components/app/time";
import { CopyButton } from "@/components/copy-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Empty, Problem } from "@/components/visual";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";
import { kindName } from "@/lib/kind";
import { usdc } from "@/lib/usdc";
import { connections, httpLine } from "./api";

const SCOPES: { scope: McpScope; label: string; hint: string }[] = [
  { scope: "memory:read", label: "Read its memory", hint: "Search what the remora remembers." },
  {
    scope: "memory:write",
    label: "Write to its memory",
    hint: "Episodes and sources, tagged as the agent's. A rule waits for your yes.",
  },
  {
    scope: "pay",
    label: "Pay within its spending limit",
    hint: "Buy paid services within its spending limit, and ask the remora questions.",
  },
  {
    scope: "approve:request",
    label: "Ask you to approve",
    hint: "For what its spending limit won't cover. You pay it once, or decline.",
  },
];

/** A future date ("Nov 24"): `Time` reads only the past ("2h ago"). */
function OnDate({ value }: { value: string }) {
  const date = new Date(value);
  return (
    <time dateTime={date.toISOString()} title={date.toLocaleString()}>
      {date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
    </time>
  );
}

const statusOf = (t: McpToken): "active" | "retired" | "failed" =>
  t.revokedAt ? "retired" : Date.parse(t.expiresAt) <= Date.now() ? "failed" : "active";
const statusLabel = (t: McpToken) =>
  t.revokedAt ? "revoked" : Date.parse(t.expiresAt) <= Date.now() ? "expired" : "active";

function CopyRow({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-md text-ob-muted">{label}</span>
      <div className="flex items-start gap-2">
        <code
          data-testid={testId}
          className="min-w-0 flex-1 break-all rounded-ob-md bg-ob-control-hover px-3 py-2 font-mono text-xs text-ob-secondary"
        >
          {value}
        </code>
        <CopyButton value={value} label={`Copy ${label.toLowerCase()}`} />
      </div>
    </div>
  );
}

function Created({ c, onDone }: { c: McpTokenCreated; onDone: () => void }) {
  return (
    <Card data-testid="token-created" className="border-ob-accent-strong">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyRound className="size-4 text-ob-accent-text" aria-hidden /> Copy it now: it's shown
          once
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-md text-ob-muted">
          {c.token.name} can act for {c.token.remoraName} as <code>mcp:{c.token.client}</code> until{" "}
          <OnDate value={c.token.expiresAt} />. Remora keeps only a hash, so it can't show this
          again.
        </p>
        <CopyRow label="Token" value={c.secret} testId="token-secret" />
        <CopyRow
          label="Claude Code over HTTP"
          value={httpLine(c.httpUrl, c.secret)}
          testId="token-http"
        />
        <CopyRow
          label="Claude Code over stdio (from a clone of the repo)"
          value={c.stdio}
          testId="token-stdio"
        />
      </CardContent>
      <CardFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          I've copied it
        </Button>
      </CardFooter>
    </Card>
  );
}

function NewConnection({ onCreated }: { onCreated: (c: McpTokenCreated) => void }) {
  const remoras = useLoad(() => api.remoras(), []);
  const usable = (remoras.data?.remoras ?? []).filter(
    (r) => r.status !== "retired" && r.status !== "creating",
  );
  const [name, setName] = useState("Claude Code");
  const [remora, setRemora] = useState("");
  const [scopes, setScopes] = useState<McpScope[]>(["memory:read"]);
  const [days, setDays] = useState(30);
  const [busy, setBusy] = useState(false);
  const chosen = remora || usable[0]?.id || "";
  const toggle = (s: McpScope, on: boolean) =>
    setScopes((cur) => (on ? [...new Set([...cur, s])] : cur.filter((x) => x !== s)));
  const create = async () => {
    setBusy(true);
    const out = await connections.create({ remora: chosen, name: name.trim(), scopes, days });
    setBusy(false);
    if (!out.ok) return void toast.error(out.error);
    onCreated(out.data);
  };
  if (!remoras.loading && !usable.length)
    return (
      <EmptyState
        icon={<Cable />}
        title="No remora to connect yet"
        description="An agent acts for one of your remoras, within its spending limit."
        action={
          <Button asChild>
            <Link to="/remoras/new">Create a remora</Link>
          </Button>
        }
      />
    );
  return (
    <form
      className="ob-card max-w-2xl gap-5 p-5"
      onSubmit={(e) => {
        e.preventDefault();
        void create();
      }}
    >
      <Field>
        <FieldLabel htmlFor="mcp-name">Name</FieldLabel>
        <Input
          id="mcp-name"
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
        />
        <FieldDescription>
          Its receipts say{" "}
          <code>
            via mcp:{(name.toLowerCase().match(/[a-z0-9]+/g) ?? ["agent"]).join("-").slice(0, 40)}
          </code>
          .
        </FieldDescription>
      </Field>
      <Field>
        <FieldLabel htmlFor="mcp-remora">Remora</FieldLabel>
        <NativeSelect id="mcp-remora" value={chosen} onChange={(e) => setRemora(e.target.value)}>
          {usable.map((r) => (
            <NativeSelectOption key={r.id} value={r.id}>
              {r.name} ({kindName(r.template)}, {r.status === "shadow" ? "practice" : r.status})
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">What it may do</legend>
        <div className="ob-group" data-surface="subtle">
          {SCOPES.map(({ scope, label, hint }) => (
            <div key={scope} className="ob-row items-start" data-size="compact">
              <Checkbox
                id={`scope-${scope}`}
                checked={scopes.includes(scope)}
                onCheckedChange={(v) => toggle(scope, v === true)}
                aria-label={label}
                className="mt-0.5"
              />
              <label htmlFor={`scope-${scope}`} className="ob-row-content cursor-pointer">
                <span className="ob-row-title text-md">{label}</span>
                <span className="ob-row-description">{hint}</span>
              </label>
            </div>
          ))}
        </div>
      </fieldset>
      <Field>
        <FieldLabel htmlFor="mcp-days">Expires after</FieldLabel>
        <NativeSelect
          id="mcp-days"
          value={String(days)}
          onChange={(e) => setDays(Number(e.target.value))}
        >
          <NativeSelectOption value="7">7 days</NativeSelectOption>
          <NativeSelectOption value="30">30 days</NativeSelectOption>
          <NativeSelectOption value="90">90 days</NativeSelectOption>
        </NativeSelect>
      </Field>
      <div>
        <Button type="submit" disabled={busy || !chosen || !scopes.length || !name.trim()}>
          {busy ? "Creating…" : "Create token"}
        </Button>
      </div>
    </form>
  );
}

function Calls({ id }: { id: string }) {
  const calls = useLoad(() => connections.calls(id), [id]);
  if (calls.loading) return <p className="text-md text-ob-muted">Loading calls…</p>;
  if (calls.error) return <p className="text-md text-ob-danger-text">{calls.error}</p>;
  const rows: McpCall[] = calls.data?.calls ?? [];
  if (!rows.length) return <p className="text-md text-ob-muted">No calls yet.</p>;
  return (
    <ul className="ob-group" data-surface="subtle" data-testid="token-calls">
      {rows.map((c) => (
        <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 text-md">
          <span className={c.ok ? "text-ob-success-text" : "text-ob-danger-text"}>
            {c.ok ? (
              <CircleCheck aria-hidden className="size-4" />
            ) : (
              <CircleX aria-hidden className="size-4" />
            )}
            <span className="sr-only">{c.ok ? "OK" : "Failed"}</span>
          </span>
          <code className="font-mono text-xs">{c.tool}</code>
          {c.spend ? <span className="tabular-nums">{usdc(c.spend)} USDC</span> : null}
          {c.error ? <span className="text-ob-muted">{c.error}</span> : null}
          {c.wakeId ? (
            <Link className="link" to={`/verify/${c.wakeId}`}>
              Receipt
            </Link>
          ) : null}
          <Time value={c.at} className="ml-auto text-ob-muted" />
        </li>
      ))}
    </ul>
  );
}

function TokenCard({ t, onChange }: { t: McpToken; onChange: () => void }) {
  const [open, setOpen] = useState(false);
  const live = statusLabel(t) === "active";
  return (
    <Card data-testid="token">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {t.name}
          <span className="text-md font-normal text-ob-muted">
            for {t.remoraName} · <code>mcp:{t.client}</code> · {t.prefix}…
          </span>
          <span className="ml-auto">
            {live ? (
              <StatusBadge status={statusOf(t)} />
            ) : (
              <Badge variant="outline">{statusLabel(t)}</Badge>
            )}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-1.5">
          {t.scopes.map((s) => (
            <Badge key={s} variant="secondary">
              {s}
            </Badge>
          ))}
        </div>
        <dl className="grid grid-cols-3 gap-3 text-md sm:max-w-md">
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-ob-muted">Calls</dt>
            <dd className="text-base font-semibold tabular-nums" data-testid="token-call-count">
              {t.calls}
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-ob-muted">Spent</dt>
            <dd
              className="whitespace-nowrap text-base font-semibold tabular-nums"
              data-testid="token-spend"
            >
              {usdc(t.spend)} USDC
            </dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt className="text-xs text-ob-muted">Memories</dt>
            <dd className="text-base font-semibold tabular-nums">{t.memories}</dd>
          </div>
        </dl>
        <p className="text-md text-ob-muted">
          Made <Time value={t.createdAt} />
          {t.lastUsedAt ? (
            <>
              , last used <Time value={t.lastUsedAt} />
            </>
          ) : null}
          {t.revokedAt ? (
            <>
              , revoked <Time value={t.revokedAt} />
            </>
          ) : (
            <>
              , expires <OnDate value={t.expiresAt} />
            </>
          )}
          .
        </p>
        <button
          type="button"
          className="-ml-1 flex w-fit items-center gap-1 rounded-ob-sm px-1 text-md text-ob-secondary hover:bg-ob-hover hover:text-ob-text"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
        >
          <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
          Recent calls
        </button>
        {open ? <Calls id={t.id} /> : null}
      </CardContent>
      {live ? (
        <CardFooter>
          <ConfirmAction
            trigger={
              <Button type="button" variant="outline" size="sm">
                Revoke
              </Button>
            }
            title={`Revoke ${t.name}?`}
            description="Its next call is refused (401). The receipts and memories it made stay."
            confirmLabel="Revoke"
            tone="danger"
            onConfirm={async () => {
              const out = await connections.revoke(t.id);
              if (!out.ok) throw new Error(out.error);
              toast.success(`${t.name} can't act any more.`);
              onChange();
            }}
          />
        </CardFooter>
      ) : null}
    </Card>
  );
}

export function ConnectionsPage() {
  const [created, setCreated] = useState<McpTokenCreated | null>(null);
  const list = useLoad(() => connections.list(), [created?.token.id]);
  return (
    <Page
      title="Connections"
      description="Let an agent use one of your remoras through MCP, within its spending limit."
    >
      <PageHeader
        title="Connections"
        description="Let an agent like Claude Code use one of your remoras."
        hint="Any MCP client (Claude Code, Cursor) can use a remora through a token. It acts within the remora's spending limit; anything over it comes back to you. One token per agent, for one remora, and you can revoke it any time."
      />
      <RequireOwner what="connect an agent">
        {() => {
          const tokens = list.data?.tokens ?? [];
          // ADR-0103: the live ones first; revoked and expired fold away (they were a third of a
          // 6,000 px page on a phone).
          const live = tokens.filter((t) => statusOf(t) === "active");
          const done = tokens.filter((t) => statusOf(t) !== "active");
          const form = created ? (
            <Created c={created} onDone={() => setCreated(null)} />
          ) : (
            <Section title="New connection">
              <NewConnection onCreated={setCreated} />
            </Section>
          );
          return (
            <>
              {tokens.length ? null : form}
              <Section title="Your connections">
                {list.error ? (
                  <Problem
                    title="Can't load your connections."
                    detail={list.error}
                    onRetry={() => void list.refresh()}
                  />
                ) : list.data && !tokens.length ? (
                  <Empty title="No agent is connected yet." mood="asleep" />
                ) : (
                  <div className="flex flex-col gap-3">
                    {live.map((t) => (
                      <TokenCard key={t.id} t={t} onChange={() => void list.refresh()} />
                    ))}
                    {done.length ? (
                      <details className="group">
                        <summary className="cursor-pointer text-sm text-ob-muted hover:text-ob-text">
                          Revoked or expired ({done.length})
                        </summary>
                        <div className="mt-3 flex flex-col gap-3">
                          {done.map((t) => (
                            <TokenCard key={t.id} t={t} onChange={() => void list.refresh()} />
                          ))}
                        </div>
                      </details>
                    ) : null}
                  </div>
                )}
              </Section>
              {tokens.length ? form : null}
            </>
          );
        }}
      </RequireOwner>
    </Page>
  );
}
