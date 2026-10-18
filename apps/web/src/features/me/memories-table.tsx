import { flexRender } from "@tanstack/react-table";
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type LegacyColumnDef,
  useLegacyTable,
} from "@tanstack/react-table/legacy";
import { Eye, EyeOff, Lock } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Web3Address } from "@/components/web3-address";
import type { Memory } from "@/features/me/memory";
import { useMemoriesTable } from "@/features/me/use-memories-table";
import { usedInLabel } from "@/features/me/use-usage";
import { ago } from "@/lib/ago";

function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function MemoriesTable({
  memories,
  uses,
  toggling,
  onToggle,
}: {
  memories: Memory[];
  uses?: Record<string, number>;
  toggling: string | null;
  onToggle: (blobId: string, hidden: boolean) => void;
}) {
  const tableState = useMemoriesTable(memories);
  const columns = useMemo<LegacyColumnDef<Memory>[]>(
    () => [
      {
        accessorKey: "type",
        header: "Type",
        enableSorting: false,
        cell: ({ row }) => <Badge>{row.original.type}</Badge>,
      },
      {
        accessorKey: "createdAt",
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting()}>
            When
          </Button>
        ),
        cell: ({ row }) => {
          const memory = row.original;
          const soon =
            memory.expiresAt !== null && daysUntil(memory.expiresAt) <= 30
              ? daysUntil(memory.expiresAt)
              : null;
          return (
            <span>
              {ago(memory.createdAt)}
              {soon !== null ? <span className="text-destructive"> expires in {soon}d</span> : null}
            </span>
          );
        },
      },
      {
        accessorKey: "channel",
        header: "Channel",
        enableSorting: false,
      },
      {
        id: "blob",
        header: "Blob",
        enableSorting: false,
        cell: ({ row }) => {
          const blobId = row.original.blobId;
          if (!blobId) return <span className="text-muted-foreground">not written yet</span>;
          const address = <Web3Address value={blobId} className="text-xs" />;
          if (!row.original.explorerUrl) return address;
          return (
            <a
              className="block min-w-0 underline"
              href={row.original.explorerUrl}
              target="_blank"
              rel="noreferrer"
            >
              {address}
            </a>
          );
        },
      },
      ...(uses
        ? [
            {
              id: "used",
              header: "Used in",
              enableSorting: false,
              cell: ({ row }: { row: { original: Memory } }) => (
                <span className="text-muted-foreground">
                  {usedInLabel(row.original.blobId ? (uses[row.original.blobId] ?? 0) : 0)}
                </span>
              ),
            },
          ]
        : []),
      {
        id: "status",
        header: "Status",
        enableSorting: false,
        cell: ({ row }) => <Status memory={row.original} />,
      },
      {
        id: "actions",
        header: () => <span className="sr-only">Actions</span>,
        enableSorting: false,
        cell: ({ row }) => (
          <RowActions memory={row.original} toggling={toggling} onToggle={onToggle} />
        ),
      },
    ],
    [onToggle, toggling, uses],
  );

  const table = useLegacyTable({
    data: tableState.data,
    columns,
    state: { sorting: tableState.sorting, pagination: tableState.pagination },
    onSortingChange: (updater) => {
      tableState.setSorting((current) =>
        typeof updater === "function" ? updater(current) : updater,
      );
    },
    onPaginationChange: (updater) => {
      tableState.setPagination((current) =>
        typeof updater === "function" ? updater(current) : updater,
      );
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
  });

  if (memories.length === 0) {
    return (
      <Empty>
        <EmptyHeader>
          <EmptyTitle>Nothing yet</EmptyTitle>
          <EmptyDescription>
            Say something in the <Link to="/">chat</Link> and hippo will start remembering you.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {tableState.types.length > 1 ? (
        <Select value={tableState.type} onValueChange={tableState.setType}>
          <SelectTrigger aria-label="Type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {tableState.types.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}
      {tableState.data.length === 0 ? (
        <p className="text-sm text-muted-foreground">No {tableState.type} memories.</p>
      ) : (
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((group) => (
              <TableRow key={group.id}>
                {group.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.map((row) => (
              <TableRow key={row.id} className={row.original.hidden ? "opacity-60" : undefined}>
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id} className="overflow-hidden">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
      {tableState.paginated && tableState.data.length > 0 ? (
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <Button
                variant="outline"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                Previous
              </Button>
            </PaginationItem>
            <PaginationItem>
              <Button
                variant="outline"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                Next
              </Button>
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      ) : null}
    </div>
  );
}

function Status({ memory }: { memory: Memory }) {
  if (memory.hidden) return <Badge variant="outline">hidden</Badge>;
  if (memory.status === "pending") {
    return <span className="text-muted-foreground">writing to Walrus…</span>;
  }
  if (memory.status === "failed") {
    return <span className="text-muted-foreground">write failed</span>;
  }
  return (
    <Badge variant="outline" className="border-brand/40 text-brand">
      stored
    </Badge>
  );
}

function RowActions({
  memory,
  toggling,
  onToggle,
}: {
  memory: Memory;
  toggling: string | null;
  onToggle: (blobId: string, hidden: boolean) => void;
}) {
  if (!memory.blobId || memory.status !== "stored") return null;
  const blobId = memory.blobId;
  return (
    <div className="flex items-center justify-end gap-1">
      {memory.ciphertextUrl ? (
        <Button size="icon" variant="ghost" asChild>
          <a
            href={memory.ciphertextUrl}
            target="_blank"
            rel="noreferrer"
            aria-label="Open ciphertext"
          >
            <Lock />
          </a>
        </Button>
      ) : null}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        disabled={toggling === blobId}
        aria-label={memory.hidden ? "Use again" : "Hide"}
        onClick={() => onToggle(blobId, !memory.hidden)}
      >
        {memory.hidden ? <Eye /> : <EyeOff />}
      </Button>
    </div>
  );
}
