/**
 * `/memory` (F3·ui + F6): one place with two tabs. Remoras lists each remora's namespaces as the
 * relayer holds them (a Walrus blob per row, real recall search, an index-check warning) with the
 * owner's controls (F4 hide/correct/forget all, F5 expiry, F8 export, F9 Claude Code); Chat is the
 * memory Remora keeps from conversations (the old `/me`).
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
import { ChatMemory } from "@/features/me/me-page";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/utils";
import {
  ClaudeCodeCard,
  CorrectDialog,
  ExpiryAlert,
  ExportButtons,
  ForgetButton,
  HideButton,
} from "./memory-controls";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");
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

  if (remoras.loading && !remoras.data) {
    return (
      <div className="flex flex-col gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-40 w-full" />
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

      {m?.mismatches.length ? (
        <p
          className="rounded-lg border border-warning/50 bg-warning/10 p-3 text-sm text-warning-foreground"
          data-testid="index-warning"
        >
          Index check:{" "}
          {m.mismatches
            .map((x) => `${x.namespace} has ${x.relayer} of the ${x.written} we wrote`)
            .join("; ")}
          . New writes take about 30 s to land; if this stays, some writes didn't make it.
        </p>
      ) : null}
      {mem.error ? <p className="text-sm text-destructive">{mem.error}</p> : null}

      {results.length ? (
        <ul className="flex flex-col gap-2 text-sm" aria-label="Search results">
          {results.map((x) => (
            <li
              key={x.blobId}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3"
              data-testid="memory-result"
            >
              <span className="min-w-0 flex-1">
                <Badge variant="outline">{x.namespace}</Badge>{" "}
                <span className="whitespace-pre-wrap">{x.text}</span>
              </span>
              <span className="flex gap-1">
                <HideButton remoraId={id} m={x} hidden={false} onDone={refresh} />
                <CorrectDialog remoraId={id} m={x} current={x.text} onDone={refresh} />
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Desktop table. */}
      <div className="hidden overflow-x-auto rounded-xl border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Blob</th>
              <th className="px-3 py-2 font-medium">Namespace</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Stored</th>
              <th className="px-3 py-2 font-medium">Expires</th>
              <th className="px-3 py-2 text-right font-medium">Size</th>
              <th className="px-3 py-2 text-right font-medium">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.blobId} className="border-t" data-testid="memory-row">
                <td className="w-64 max-w-64 px-3 py-2">
                  <Hash value={row.blobId} label="blob" />
                  <RowFlags row={row} />
                </td>
                <td className="max-w-52 truncate px-3 py-2" title={row.namespace}>
                  {row.namespace}
                </td>
                <td className="px-3 py-2">
                  {row.status === "active" ? (
                    <StatusBadge status="active" />
                  ) : (
                    <Badge variant="outline">expired</Badge>
                  )}
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  <Time value={row.createdAt} />
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-muted-foreground",
                    row.expiresSoon && "font-medium text-warning-foreground",
                  )}
                >
                  {row.expiresAt ? day(row.expiresAt) : "pending"}
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{size(row.size)}</td>
                <td className="px-3 py-2 text-right whitespace-nowrap">
                  <HideButton remoraId={id} m={row} hidden={!!row.hiddenAt} onDone={refresh} />
                  <CorrectDialog remoraId={id} m={row} onDone={refresh} />
                </td>
              </tr>
            ))}
            {m && !rows.length ? (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
                  {active ? `Nothing in ${active} yet.` : "Nothing stored yet."}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Phone: one card per blob. */}
      <ul className="flex flex-col gap-2 md:hidden">
        {rows.map((row) => (
          <li key={row.blobId} className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
            <Hash value={row.blobId} label="blob" />
            <RowFlags row={row} />
            <span className="truncate text-muted-foreground" title={row.namespace}>
              {row.namespace}
            </span>
            <span className="flex items-center justify-between gap-2 text-muted-foreground">
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
          <li className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
            {active ? `Nothing in ${active} yet.` : "Nothing stored yet."}
          </li>
        ) : null}
      </ul>
      {current && m ? <ClaudeCodeCard remoraId={current.id} namespaces={m.namespaces} /> : null}
    </div>
  );
}

/** F4/F5: what the owner did to a memory, and whether it's about to expire. */
function RowFlags({ row }: { row: InspectorResponse["rows"][number] }) {
  if (!row.hiddenAt && !row.supersededBy && !row.expiresSoon && !row.type) return null;
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
        description="Two kinds of memory, side by side: each remora's Walrus blobs and the chat's own facts."
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
        <TabsContent value="remoras" className="pt-4">
          <RemorasTab />
        </TabsContent>
        <TabsContent value="chat" className="pt-4">
          <ChatMemory />
        </TabsContent>
      </Tabs>
    </Page>
  );
}

export function MemoryInspectorPage() {
  return <RequireOwner what="your remoras' memory">{() => <Memory />}</RequireOwner>;
}
