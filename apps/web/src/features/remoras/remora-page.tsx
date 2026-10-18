import { useParams } from "react-router";
import { useShellTitle } from "@/app/shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdc } from "@/lib/usdc";
import { FIXTURE_EVENTS, FIXTURE_REMORAS, FIXTURE_WAKE } from "./fixtures";
import { WhyDrawer } from "./why-drawer";

function describe(e: (typeof FIXTURE_EVENTS)[number]): string {
  switch (e.type) {
    case "payment":
      return `Paid ${formatUsdc(e.amount)} USDC to ${e.payee}`;
    case "ping":
      return e.summary;
    case "rule_learned":
      return `Learned: ${e.rule}`;
    case "handoff":
      return `Handed off to ${e.to}: ${e.summary}`;
    case "approval_needed":
      return "Asked for your approval";
    default:
      return "summary" in e && typeof e.summary === "string" ? e.summary : e.type;
  }
}

/** `/remoras/:id` (W1 skeleton): the remora and its activity feed (N1), with "Why?" (N4). */
export function RemoraPage() {
  const { id } = useParams();
  const remora = FIXTURE_REMORAS.find((r) => r.template === id || r.id === id);
  useShellTitle(remora?.name ?? "Remora");
  if (!remora) return <p className="p-6 text-sm text-muted-foreground">No remora called {id}.</p>;
  const feed = FIXTURE_EVENTS.filter((e) => e.remora === remora.template);
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 overflow-y-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {remora.name} <Badge variant="secondary">{remora.status}</Badge>
          </CardTitle>
          <CardDescription>{remora.persona}</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {remora.identity.suinsName ?? remora.identity.address} · tools: {remora.tools.join(", ")}
        </CardContent>
      </Card>
      <h2 className="text-sm font-medium">Activity</h2>
      <ol className="flex flex-col gap-2" aria-label="Activity">
        {feed.map((e) => (
          <li
            key={e.id}
            className="flex items-center justify-between gap-2 rounded-md border p-3 text-sm"
          >
            <span className="min-w-0">
              <span className="text-muted-foreground">{new Date(e.ts).toLocaleString()} · </span>
              {describe(e)}
            </span>
            {"wakeId" in e && e.wakeId ? <WhyDrawer view={FIXTURE_WAKE} /> : null}
          </li>
        ))}
        {feed.length === 0 ? <li className="text-sm text-muted-foreground">Nothing yet.</li> : null}
      </ol>
    </div>
  );
}
