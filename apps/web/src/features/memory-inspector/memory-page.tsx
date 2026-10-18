/**
 * `/memory` (F3·ui + F6): a remora's namespaces as the relayer holds them. Each row is a Walrus blob
 * with its expiry; search runs a real recall; and if we wrote more than the relayer reports, it says
 * so (an index-check warning, never a `restore()`).
 */
import { useState } from "react";
import { useSearchParams } from "react-router";
import { useShellTitle } from "@/app/shell";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";
import { useDebouncedValue } from "@/hooks/use-debounced-value";

const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString() : "—");

function Inspector() {
  const [params, setParams] = useSearchParams();
  const remoras = useLoad(() => api.remoras(), []);
  const list = (remoras.data?.remoras ?? []).filter((r) => r.status !== "creating");
  const id = params.get("remora") ?? list[0]?.id ?? "";
  const [q, setQ] = useState("");
  const query = useDebouncedValue(q, 400);
  const mem = useLoad(
    () =>
      id ? api.memory(id, query || undefined) : Promise.resolve({ ok: true as const, data: null }),
    [id, query],
  );
  const m = mem.data;
  if (remoras.data && !list.length)
    return (
      <p className="p-6 text-sm text-muted-foreground">No remoras yet, so no memory to show.</p>
    );
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 overflow-auto p-4">
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Remora"
          value={id}
          onChange={(e) => setParams({ remora: e.target.value })}
        >
          {list.map((r) => (
            <NativeSelectOption key={r.id} value={r.id}>
              {r.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Input
          className="max-w-xs"
          aria-label="Search memory"
          placeholder="Search (recall)…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Each memory is a Walrus blob in Walrus Memory, under this remora's namespaces:{" "}
        {m ? m.namespaces.map((ns) => `${ns} (${m.counts[ns] ?? 0})`).join(", ") : "…"}
      </p>
      {m?.mismatches.length ? (
        <p
          className="rounded-md border border-amber-500/50 p-2 text-sm"
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
      {m?.results.length ? (
        <ul className="flex flex-col gap-1 text-sm" aria-label="Search results">
          {m.results.map((x) => (
            <li key={x.blobId} className="rounded-md border p-2">
              <Badge variant="outline">{x.namespace}</Badge> {x.text}
            </li>
          ))}
        </ul>
      ) : null}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Blob</TableHead>
            <TableHead>Namespace</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Stored</TableHead>
            <TableHead>Expires</TableHead>
            <TableHead className="text-right">Size</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(m?.rows ?? []).map((row) => (
            <TableRow key={row.blobId}>
              <TableCell className="font-mono text-xs">{row.blobId.slice(0, 16)}…</TableCell>
              <TableCell>{row.namespace}</TableCell>
              <TableCell>
                <Badge variant={row.status === "active" ? "secondary" : "outline"}>
                  {row.status}
                </Badge>
              </TableCell>
              <TableCell>{day(row.createdAt)}</TableCell>
              <TableCell>{day(row.expiresAt)}</TableCell>
              <TableCell className="text-right">{row.size} B</TableCell>
            </TableRow>
          ))}
          {m && !m.rows.length ? (
            <TableRow>
              <TableCell colSpan={6} className="text-muted-foreground">
                Nothing stored yet.
              </TableCell>
            </TableRow>
          ) : null}
        </TableBody>
      </Table>
    </div>
  );
}

export function MemoryInspectorPage() {
  useShellTitle("Memory");
  return <RequireOwner what="your remoras' memory">{() => <Inspector />}</RequireOwner>;
}
