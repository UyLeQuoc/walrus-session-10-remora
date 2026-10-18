/**
 * What hippo wrote, with a way to narrow it down.
 *
 * Two different operations that look like one. Filtering by type is local: the
 * page already has every row. Searching is not, because memory text is never
 * stored in Postgres, only blob ids and dates, so the words have to come back
 * from Walrus through a recall. That is the same call `/memory search` makes,
 * and it costs relayer budget, so it happens on submit rather than on keystroke.
 */

import { EyeOff } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Web3Address } from "@/components/web3-address";
import { MemoriesTable } from "@/features/me/memories-table";
import type { Memory } from "@/features/me/memory";
import { useMemoryActions } from "@/features/me/use-memory-actions";

export type { Memory };

function daysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

export function MemoryList({
  memories,
  uses,
  onError,
  onChange,
}: {
  memories: Memory[];
  uses?: Record<string, number>;
  onError: (m: string) => void;
  /** Called after a memory is hidden or unhidden, so the page can reload. */
  onChange?: () => void;
}) {
  const [query, setQuery] = useState("");
  const { hits, searching, toggling, search, toggle, clear } = useMemoryActions(onError, onChange);
  const soonest = soonestExpiry(memories);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    void search(query);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Memories</CardTitle>
        {soonest !== null ? (
          <p className="text-sm text-muted-foreground">Storage runs out in about {soonest} days.</p>
        ) : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex flex-wrap gap-2" onSubmit={onSearch}>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Read them back: what do you know about me?"
            aria-label="Search your memory"
            className="min-w-0 flex-1"
          />
          <Button type="submit" variant="outline" disabled={searching}>
            {searching ? "Reading…" : "Search"}
          </Button>
          {hits !== null && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                clear();
                setQuery("");
              }}
            >
              Clear
            </Button>
          )}
        </form>

        {searching && <Skeleton className="h-16 w-full" />}

        {hits !== null && !searching && (
          <div className="flex flex-col gap-2">
            {hits.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing close to that.</p>
            ) : (
              <ul className="divide-y rounded-lg border text-sm">
                {hits.map((hit) => (
                  <li key={hit.blobId} className="flex flex-col gap-2 px-3 py-2">
                    <p>{hit.text}</p>
                    <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
                      {hit.type && <Badge>{hit.type}</Badge>}
                      {hit.mine === false && <Badge variant="outline">team</Badge>}
                      <span>relevance {hit.relevance.toFixed(2)}</span>
                      <a
                        className="block min-w-0 max-w-48 underline"
                        href={hit.explorerUrl}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <Web3Address value={hit.blobId} className="text-xs" />
                      </a>
                      {hit.mine !== false && (
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          disabled={toggling === hit.blobId}
                          aria-label="stop using this"
                          onClick={() => void toggle(hit.blobId, true)}
                        >
                          <EyeOff />
                        </Button>
                      )}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {hits === null && (
          <MemoriesTable
            memories={memories}
            uses={uses}
            toggling={toggling}
            onToggle={(id, hidden) => void toggle(id, hidden)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function soonestExpiry(memories: Memory[]): number | null {
  const days = memories
    .filter((memory) => memory.expiresAt)
    .map((memory) => daysUntil(memory.expiresAt as string));
  return days.length ? Math.min(...days) : null;
}
