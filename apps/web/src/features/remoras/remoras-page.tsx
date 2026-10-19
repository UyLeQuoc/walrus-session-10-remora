/**
 * `/remoras` (H4 dashboard): your remoras with status and budget, what is waiting for you (N2),
 * and one feed across all of them (N1). The empty state is one block with two templates.
 */
import { AlertTriangle, Fish, Plus } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/app/empty-state";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNetwork } from "@/lib/network";
import { api } from "./api";
import { FeedList } from "./feed-list";
import { RequireOwner, useLoad } from "./hooks";
import { RemoraCard } from "./remora-card";
import { TemplateCard } from "./template-card";

function Dashboard() {
  const network = useNetwork();
  const remoras = useLoad(() => api.remoras(), [], 30_000);
  const feed = useLoad(() => api.feed(), [], 15_000);
  const inbox = useLoad(() => api.approvals(), [], 30_000);
  const templates = useLoad(() => api.templates(), []);
  const live = (remoras.data?.remoras ?? []).filter((r) => r.status !== "retired");
  const pending = inbox.data?.approvals.length ?? 0;
  const list = Object.entries(templates.data?.templates ?? {});

  return (
    <Page title="Remoras" description="Your always-on agents and what they did lately.">
      <PageHeader
        title="Remoras"
        description={`${live.length} on ${network}`}
        actions={
          <Button asChild>
            <Link to="/remoras/new">
              <Plus /> New remora
            </Link>
          </Button>
        }
      />

      {pending > 0 ? (
        <Alert variant="warning">
          <AlertTitle>
            {pending} approval{pending === 1 ? "" : "s"} waiting
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            A payment went over its per-payment cap.
            <Button asChild variant="outline" size="sm">
              <Link to="/approvals">Review</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {remoras.error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Couldn't read your remoras</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            {remoras.error}
            <Button variant="outline" size="sm" onClick={() => void remoras.refresh()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      {remoras.loading && !remoras.data ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      ) : live.length ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {live.map((r) => (
            <RemoraCard key={r.id} remora={r} />
          ))}
        </div>
      ) : (
        <EmptyState
          icon={<Fish />}
          title="Your first remora"
          description="Scout buys answers with a budget Sui enforces. Sentinel watches wallets and learns what matters. Pick a template to start."
          action={
            <div className="grid w-full max-w-sm gap-3 sm:max-w-none sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {list.map(([slug, template]) => (
                <TemplateCard key={slug} slug={slug} template={template} />
              ))}
            </div>
          }
        />
      )}

      {live.length ? (
        <Section title="Activity">
          {feed.loading && !feed.data ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : (
            <FeedList items={feed.data?.events ?? []} showRemora />
          )}
        </Section>
      ) : null}
    </Page>
  );
}

export function RemorasPage() {
  return <RequireOwner what="your remoras">{() => <Dashboard />}</RequireOwner>;
}
