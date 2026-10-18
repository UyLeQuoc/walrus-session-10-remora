import type { FormEvent } from "react";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useTeamSearch } from "@/features/team/use-team-search";

export function TeamSearch() {
  const search = useTeamSearch();
  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    void search.search();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Search the team's memory</CardTitle>
        <CardDescription>
          The words come back from Walrus, so a search runs when you ask, not as you type.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form className="flex flex-wrap gap-2" onSubmit={onSubmit}>
          <Input
            value={search.query}
            aria-label="Search the team's memory"
            placeholder="How do we deploy?"
            className="min-w-0 flex-1"
            onChange={(event) => search.setQuery(event.target.value)}
          />
          <Button type="submit" variant="outline" disabled={search.busy}>
            {search.busy ? "Reading…" : "Search"}
          </Button>
        </form>

        {search.error ? <p className="text-sm text-destructive">{search.error}</p> : null}

        {search.busy ? <Skeleton className="h-16 w-full" /> : null}

        {search.results !== null && !search.busy ? (
          search.results.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing in the team's memory is close.</p>
          ) : (
            <ul className="divide-y rounded-lg border text-sm">
              {search.results.map((hit) => (
                <li key={hit.blobId} className="flex flex-col gap-2 px-3 py-2">
                  <p className="break-words">{hit.text}</p>
                  <div className="flex flex-col gap-1 text-muted-foreground sm:flex-row sm:items-center sm:gap-3">
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      {hit.type ? <Badge>{hit.type}</Badge> : null}
                      {hit.mine ? <Badge variant="outline">added by you</Badge> : null}
                      <span>relevance {hit.relevance.toFixed(2)}</span>
                    </div>
                    <div className="flex w-full min-w-0 items-center sm:flex-1">
                      <Hash value={hit.blobId} href={hit.explorerUrl} label="blob id" />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
        ) : null}
      </CardContent>
    </Card>
  );
}
