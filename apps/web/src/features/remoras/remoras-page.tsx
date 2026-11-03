/**
 * `/remoras` (H4 dashboard): your remoras with status and budget, what is waiting for you (N2),
 * and one feed across all of them (N1). The empty state is one block with two templates.
 */
import { AlertTriangle, Download, Fish, Plus, Upload } from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useNetwork } from "@/lib/network";
import { CardGrid } from "@/openbot/pages";
import { api, exportTeam } from "./api";
import { FeedList } from "./feed-list";
import { RequireOwner, useLoad } from "./hooks";
import { RemoraCard } from "./remora-card";
import { TemplateCard } from "./template-card";

/** ADR-0042: the team as one Markdown file, without keys, memories or watched addresses. */
async function downloadTeam() {
  const out = await exportTeam();
  if (!out.ok) return void toast.error(out.error);
  const url = URL.createObjectURL(new Blob([out.data], { type: "text/markdown" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = "remora-team.md";
  a.click();
  URL.revokeObjectURL(url);
}

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
          <>
            {live.length ? (
              <Button type="button" variant="ghost" onClick={() => void downloadTeam()}>
                <Download /> Export team
              </Button>
            ) : null}
            <Button asChild variant="outline">
              <Link to="/remoras/import">
                <Upload /> Import a team
              </Link>
            </Button>
            <Button asChild>
              <Link to="/remoras/new">
                <Plus /> New remora
              </Link>
            </Button>
          </>
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
        <CardGrid>
          <Skeleton className="h-36 w-full rounded-ob-card" />
          <Skeleton className="h-36 w-full rounded-ob-card" />
        </CardGrid>
      ) : live.length ? (
        <CardGrid>
          {live.map((r) => (
            <RemoraCard key={r.id} remora={r} />
          ))}
        </CardGrid>
      ) : (
        <EmptyState
          icon={<Fish />}
          title="Your first remora"
          description="A Researcher buys answers with a budget Sui enforces. A Wallet watcher watches wallets and learns what matters. Pick a template to start."
          action={
            <CardGrid className="w-full max-w-2xl">
              {list.map(([slug, template]) => (
                <TemplateCard key={slug} slug={slug} template={template} />
              ))}
            </CardGrid>
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
