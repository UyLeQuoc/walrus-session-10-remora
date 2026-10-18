import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { sharedCounts } from "@/hooks/team-counts";
import type { TeamMemory } from "@/hooks/use-team";
import { ago } from "@/lib/ago";

export function TeamShared({ memories, error }: { memories: TeamMemory[]; error: string }) {
  const counts = sharedCounts(memories);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Shared memory</CardTitle>
        <CardDescription>
          {counts.shared === 0
            ? "Nothing shared yet. What you add above shows up here."
            : `${counts.shared} shared, ${counts.mine} added by you.`}
        </CardDescription>
      </CardHeader>
      {memories.length > 0 || error ? (
        <CardContent className="flex flex-col gap-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {memories.length > 0 ? (
            <ul className="divide-y rounded-lg border text-sm">
              {memories.map((memory) => (
                <li
                  key={memory.id}
                  className="flex flex-col gap-1 px-3 py-2 sm:flex-row sm:items-center sm:gap-3"
                >
                  <div className="flex w-full min-w-0 items-center gap-2 sm:flex-1">
                    <Badge>{memory.type}</Badge>
                    {memory.blobId ? (
                      <Hash value={memory.blobId} href={memory.explorerUrl} label="blob id" />
                    ) : (
                      <span className="min-w-0 flex-1 text-muted-foreground">
                        {memory.status === "failed" ? "never reached Walrus" : "not written yet"}
                      </span>
                    )}
                  </div>
                  <span className="shrink-0 text-muted-foreground">
                    {ago(memory.createdAt)} · {memory.mine ? "you" : "a teammate"}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      ) : null}
    </Card>
  );
}
