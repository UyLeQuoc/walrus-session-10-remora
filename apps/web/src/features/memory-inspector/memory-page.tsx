/**
 * `/memory` (F3·ui + F6): one place with two tabs. Remoras lists each remora's namespaces as the
 * relayer holds them (a Walrus blob per row, real recall search, an index-check warning) with the
 * owner's controls (F4 hide/correct/forget all, F5 expiry, F8 export, F9 Claude Code), and the
 * writes skipped as duplicates (ADR-0086); Chat is the memory Remora keeps from conversations (the
 * old `/me`).
 */
import type { InspectorResponse } from "@remora/schema";
import { Brain, Fish } from "lucide-react";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { EmptyState } from "@/components/app/empty-state";
import { Page, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Time } from "@/components/app/time";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toggle } from "@/components/ui/toggle";
import { ExpiryBar, Hint, Problem } from "@/components/visual";
import { ChatMemory } from "@/features/me/me-page";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import { DataTable, SettingsGroup, SettingsSection } from "@/openbot/pages";
import {
  ClaudeCodeCard,
  CorrectDialog,
  ExpiryAlert,
  ExportButtons,
  ForgetButton,
  HideButton,
} from "./memory-controls";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");
const shortDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
const daysLeft = (iso: string) =>
  Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000));
const size = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`);

function RemorasTab() {
  const [params, setParams] = useSearchParams();
  const remoras = useLoad(() => api.remoras(), []);
  const list = (remoras.data?.remoras ?? []).filter((r) => r.status !== "creating");
  const id = params.get("remora") ?? list[0]?.id ?? "";
  const [q, setQ] = useState("");
  const [namespace, setNamespace] = useState<string | null>(null);
  const query = useDebouncedValue(q, 400);
  const mem = useLoad(
    () =>
      id ? api.memory(id, query || undefined) : Promise.resolve({ ok: true as const, data: null }),
    [id, query],
  );
  const m = mem.data;
  const current = list.find((r) => r.id === id);
  const refresh = () => void mem.refresh();
  const active = namespace && m?.namespaces.includes(namespace) ? namespace : null;
  const rows = (m?.rows ?? []).filter((row) => !active || row.namespace === active);
  const results = (m?.results ?? []).filter((x) => !active || x.namespace === active);
  const duplicates = (m?.duplicates ?? []).filter((x) => !active || x.namespace === active);
  // ADR-0103: a write skipped as a duplicate isn't missing. The reviewers read "2 of 6" as lost data
  // when the other 4 were listed just below as skipped.
  const missing = (m?.mismatches ?? [])
    .map((x) => ({
      ...x,
      found: x.relayer + (m?.duplicates ?? []).filter((d) => d.namespace === x.namespace).length,
    }))
    .filter((x) => x.found < x.written);
  // A0 (ADR-0135): our stored writes against listMemories(), for the namespace shown (or all).
  const indexRows = (m?.index ?? []).filter((x) => !active || x.namespace === active);
  const indexTotals = indexRows.length
    ? {
        written: indexRows.reduce((n, x) => n + x.written, 0),
        listed: indexRows.reduce((n, x) => n + x.listed, 0),
        missing: indexRows.flatMap((x) => x.missing),
      }
    : null;

  if (remoras.error && !remoras.data) {
    return (
      <Problem
        title="Can't reach Remora right now."
        detail={remoras.error}
        onRetry={() => void remoras.refresh()}
      />
    );
  }
  if (remoras.loading && !remoras.data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full rounded-ob-card" />
      </div>
    );
  }
  if (remoras.data && !list.length) {
    return (
      <EmptyState
        icon={<Fish />}
        title="No remoras yet"
        description="A remora writes what it learns to Walrus Memory. Create one to start."
        action={
          <Link className="link text-sm" to="/remoras/new">
            Create a remora
          </Link>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={id}
          onValueChange={(value) => {
            const next = new URLSearchParams(params);
            next.set("remora", value);
            setParams(next);
          }}
        >
          <SelectTrigger aria-label="Remora" className="w-48">
            <SelectValue placeholder="Remora" />
          </SelectTrigger>
          <SelectContent>
            {list.map((r) => (
              <SelectItem key={r.id} value={r.id}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          className="max-w-xs"
          aria-label="Search memory"
          placeholder="Search what it remembers"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {m?.namespaces.length ? (
        <div className="flex flex-wrap gap-2">
          {(m?.namespaces ?? []).map((ns) => (
            <Toggle
              key={ns}
              variant="outline"
              size="sm"
              className="rounded-full"
              pressed={active === ns}
              aria-label={`Filter by ${ns}`}
              onPressedChange={(on) => setNamespace(on ? ns : null)}
            >
              {ns} · {m?.counts[ns] ?? 0}
            </Toggle>
          ))}
        </div>
      ) : null}

      <ExpiryAlert count={(m?.rows ?? []).filter((x) => x.expiresSoon && !x.hiddenAt).length} />
      {current ? (
        <div className="flex flex-wrap items-center gap-2">
          <ExportButtons remoraId={current.id} name={current.name} />
          {active && active !== "me" ? (
            <ForgetButton
              remoraId={current.id}
              namespace={active}
              onDone={() => void mem.refresh()}
            />
          ) : null}
        </div>
      ) : null}

      {indexTotals ? (
        <p
          className="flex flex-wrap items-center gap-1.5 text-sm text-ob-muted"
          data-testid="index-check"
        >
          <span>
            written {indexTotals.written} · on Walrus Memory {indexTotals.listed} · missing{" "}
            {indexTotals.missing.length}
          </span>
          <Hint label="About the index check">
            Each write we record as stored, checked against the list Walrus Memory gives back
            (listMemories). A missing one is shown with its blob id; nothing is re-written.
          </Hint>
          {indexTotals.missing.length ? (
            <span className="font-mono text-xs" data-ux-skip>
              {indexTotals.missing.slice(0, 5).join(" · ")}
            </span>
          ) : null}
        </p>
      ) : null}
      {missing.length ? (
        <p
          className="flex flex-wrap items-center gap-1.5 rounded-ob-lg border border-ob-warning-soft bg-ob-warning-soft px-4 py-2.5 text-md text-ob-warning-text"
          data-testid="index-warning"
        >
          {missing
            .map((x) => `${x.namespace}: ${x.found} of ${x.written} found on Walrus yet`)
            .join(" · ")}
          <Hint label="About the index check">
            Every write we send is counted, and so is every write skipped as already known. New
            writes take about 30 s to show up; if a gap stays, some writes didn't make it.
          </Hint>
        </p>
      ) : null}
      {mem.error ? (
        <Problem
          title="Couldn't read this memory from Walrus."
          detail={mem.error}
          onRetry={refresh}
        />
      ) : null}

      {results.length ? (
        <SettingsGroup as="ul" className="text-md" aria-label="Search results">
          {results.map((x) => (
            <li
              key={x.blobId}
              className="flex flex-wrap items-start justify-between gap-2 px-4 py-3"
              data-testid="memory-result"
            >
              <span className="min-w-0 flex-1">
                <Badge variant="outline">{x.namespace}</Badge>{" "}
                <span className="whitespace-pre-wrap" data-ux-skip>
                  {x.text}
                </span>
              </span>
              <span className="flex gap-1">
                <HideButton remoraId={id} m={x} hidden={false} onDone={refresh} />
                <CorrectDialog remoraId={id} m={x} current={x.text} onDone={refresh} />
              </span>
            </li>
          ))}
        </SettingsGroup>
      ) : null}

      {/* Desktop table. */}
      <DataTable frameClassName="hidden md:block">
        <thead>
          <tr>
            <th>Blob</th>
            <th>Namespace</th>
            <th>Status</th>
            <th>Stored</th>
            <th>Expires</th>
            <th data-align="right">Size</th>
            <th data-align="right">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.blobId} data-testid="memory-row">
              <td className="w-64 max-w-64">
                <Hash value={row.blobId} label="blob" />
                <RowFlags row={row} />
              </td>
              <td className="max-w-52 truncate" title={row.namespace}>
                {row.namespace}
              </td>
              <td>
                {row.status === "active" ? (
                  <StatusBadge status="active" />
                ) : (
                  <Badge variant="outline">expired</Badge>
                )}
              </td>
              <td data-tone="muted">
                <Time value={row.createdAt} />
              </td>
              <td
                data-tone="muted"
                className={cn(row.expiresSoon && "font-medium text-ob-warning-text")}
              >
                {row.expiresAt ? (
                  // ADR-0103: the real end date and the days to it; the term isn't counted from
                  // "Stored" (Walrus extends a blob by epochs), so no "of 210" claim.
                  <span className="inline-flex items-center gap-2 whitespace-nowrap">
                    <span>{shortDay(row.expiresAt)}</span>
                    <ExpiryBar days={daysLeft(row.expiresAt)} />
                  </span>
                ) : (
                  "pending"
                )}
              </td>
              <td data-align="right" data-numeric>
                {size(row.size)}
              </td>
              <td data-align="right" className="whitespace-nowrap">
                <HideButton remoraId={id} m={row} hidden={!!row.hiddenAt} onDone={refresh} />
                <CorrectDialog remoraId={id} m={row} onDone={refresh} />
              </td>
            </tr>
          ))}
          {m && !rows.length ? (
            <tr>
              <td colSpan={7} data-tone="muted" className="py-6 text-center">
                {active ? `Nothing in ${active} yet.` : "Nothing stored yet."}
              </td>
            </tr>
          ) : null}
        </tbody>
      </DataTable>

      {/* Phone: one card per blob. */}
      <SettingsGroup as="ul" className="md:hidden">
        {rows.map((row) => (
          <li key={row.blobId} className="flex min-w-0 flex-col gap-1 px-4 py-3 text-md">
            <Hash value={row.blobId} label="blob" />
            <RowFlags row={row} />
            <span className="truncate text-ob-muted" title={row.namespace}>
              {row.namespace}
            </span>
            <span className="flex items-center justify-between gap-2 text-ob-muted">
              {row.status === "active" ? (
                <StatusBadge status="active" />
              ) : (
                <Badge variant="outline">expired</Badge>
              )}
              <span>
                {row.expiresAt ? `expires ${day(row.expiresAt)}` : "expiry pending"} ·{" "}
                {size(row.size)}
              </span>
            </span>
            <span className="flex gap-1">
              <HideButton remoraId={id} m={row} hidden={!!row.hiddenAt} onDone={refresh} />
              <CorrectDialog remoraId={id} m={row} onDone={refresh} />
            </span>
          </li>
        ))}
        {m && !rows.length ? (
          <li className="p-4 text-center text-md text-ob-muted">
            {active ? `Nothing in ${active} yet.` : "Nothing stored yet."}
          </li>
        ) : null}
      </SettingsGroup>
      {duplicates.length ? <SkippedDuplicates items={duplicates} /> : null}
      {current && m ? <ClaudeCodeCard remoraId={current.id} namespaces={m.namespaces} /> : null}
    </div>
  );
}

const writes = (n: number) => `${n} later write${n === 1 ? "" : "s"}`;

/**
 * ADR-0086: writes the memory client skipped because a stored memory was close enough. Dewee flags
 * such pairs for review; showing them is our version, since a write that differs only in its numbers
 * (a newer score) looks like a repeat.
 */
function SkippedDuplicates({ items }: { items: InspectorResponse["duplicates"] }) {
  return (
    <SettingsSection
      title="Skipped as already known"
      description="These writes were close enough to a memory already stored that nothing new was written. If one was really new, correct the memory it matched."
    >
      <SettingsGroup as="ul" className="text-md" aria-label="Skipped as already known">
        {items.map((x) => (
          <li
            key={`${x.blobId}-${x.at}`}
            className="flex flex-wrap items-center justify-between gap-2 px-4 py-3"
            data-testid="memory-duplicate"
          >
            <span className="flex min-w-0 flex-wrap items-center gap-1">
              <Badge variant="outline">{x.namespace}</Badge>
              {x.type ? <Badge variant="outline">{x.type}</Badge> : null}
              <span className="text-ob-muted">matched</span>
              <Hash value={x.blobId} label="blob" />
            </span>
            <span className="text-ob-muted">
              <Time value={x.at} />
            </span>
          </li>
        ))}
      </SettingsGroup>
    </SettingsSection>
  );
}

/**
 * F4/F5: what the owner did to a memory, and whether it's about to expire; ADR-0086: how many later
 * writes were skipped because they matched it.
 */
function RowFlags({ row }: { row: InspectorResponse["rows"][number] }) {
  if (!row.hiddenAt && !row.supersededBy && !row.expiresSoon && !row.type && !row.duplicateWrites)
    return null;
  return (
    <span className="mt-1 flex flex-wrap gap-1">
      {row.type ? <Badge variant="outline">{row.type}</Badge> : null}
      {row.hiddenAt ? <Badge variant="secondary">hidden</Badge> : null}
      {row.supersededBy ? (
        <Badge variant="secondary" title={row.supersededBy}>
          corrected
        </Badge>
      ) : null}
      {row.expiresSoon ? <Badge variant="outline">expires soon</Badge> : null}
      {row.duplicateWrites ? (
        <Badge
          variant="outline"
          title="Later writes skipped because they matched this memory"
          data-testid="duplicate-writes"
        >
          {writes(row.duplicateWrites)} matched this
        </Badge>
      ) : null}
    </span>
  );
}

function Memory() {
  const [params, setParams] = useSearchParams();
  const tab = params.get("tab") === "chat" ? "chat" : "remoras";
  return (
    <Page title="Memory" description="What your remoras remember, and what the chat does.">
      <PageHeader
        title="Memory"
        description="What your remoras remember, stored on Walrus."
        hint="Two kinds: each remora's memories, one Walrus blob each, and the facts the chat keeps about you. You can search, hide, correct and export them."
      />
      <Tabs
        value={tab}
        onValueChange={(value) => {
          const next = new URLSearchParams(params);
          next.set("tab", value);
          setParams(next);
        }}
      >
        <TabsList>
          <TabsTrigger value="remoras">
            <Brain /> Remoras
          </TabsTrigger>
          <TabsTrigger value="chat">Chat</TabsTrigger>
        </TabsList>
        <TabsContent value="remoras" className="pt-3">
          <RemorasTab />
        </TabsContent>
        <TabsContent value="chat" className="pt-3">
          <ChatMemory />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

export function MemoryInspectorPage() {
  return <RequireOwner what="your remoras' memory">{() => <Memory />}</RequireOwner>;
}
