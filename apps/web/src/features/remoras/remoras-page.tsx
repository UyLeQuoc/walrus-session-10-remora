/**
 * `/remoras` (H4 dashboard): your remoras on this network with status and budget, what's waiting for
 * you (N2), and one feed across all of them (N1).
 */
import type { RemoraView } from "@remora/schema";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { useShellTitle } from "@/app/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { formatUsdc } from "@/lib/usdc";
import { api } from "./api";
import { FeedList } from "./feed-list";
import { RequireOwner, useLoad } from "./hooks";

const STATUS: Record<RemoraView["status"], "default" | "secondary" | "outline" | "destructive"> = {
  creating: "outline",
  shadow: "secondary",
  active: "default",
  paused: "destructive",
  retired: "outline",
};

export function budgetLine(r: RemoraView): string {
  const b = r.config.budget;
  if (!b) return "Read-only: no budget";
  return `Up to ${formatUsdc(b.windowLimit)} USDC a ${b.window}, at most ${formatUsdc(b.perPaymentCap)} a payment`;
}

function Dashboard() {
  const remoras = useLoad(() => api.remoras(), []);
  const feed = useLoad(() => api.feed(), [], 15_000);
  const inbox = useLoad(() => api.approvals(), [], 30_000);
  const live = (remoras.data?.remoras ?? []).filter((r) => r.status !== "retired");
  const pending = inbox.data?.approvals.length ?? 0;
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 overflow-y-auto p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {remoras.loading && !remoras.data
            ? "Loading…"
            : `${live.length} remora${live.length === 1 ? "" : "s"} on this network.`}
          {pending ? (
            <>
              {" "}
              <Link className="underline" to="/approvals">
                {pending} waiting for you
              </Link>
            </>
          ) : null}
        </p>
        <Button asChild size="sm">
          <Link to="/remoras/new">
            <Plus /> New remora
          </Link>
        </Button>
      </div>
      {remoras.error ? <p className="text-sm text-destructive">{remoras.error}</p> : null}
      {live.map((r) => (
        <Link key={r.id} to={`/remoras/${r.id}`} className="block" data-testid="remora-card">
          <Card className="transition-colors hover:bg-muted/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {r.name}
                <Badge variant={STATUS[r.status]}>{r.status}</Badge>
                <span className="text-xs font-normal text-muted-foreground">{r.template}</span>
              </CardTitle>
              <CardDescription>{budgetLine(r)}</CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
      {remoras.data && !live.length ? (
        <Card>
          <CardHeader>
            <CardTitle>Your first remora</CardTitle>
            <CardDescription>
              Scout buys answers with a budget Sui enforces; Sentinel watches wallets and learns
              what matters.{" "}
              <Link className="underline" to="/remoras/new">
                Start from a template
              </Link>
            </CardDescription>
          </CardHeader>
        </Card>
      ) : null}
      <h2 className="text-sm font-medium">Everything, newest first</h2>
      <FeedList items={feed.data?.events ?? []} showRemora />
    </div>
  );
}

export function RemorasPage() {
  useShellTitle("Remoras");
  return <RequireOwner what="your remoras">{() => <Dashboard />}</RequireOwner>;
}
