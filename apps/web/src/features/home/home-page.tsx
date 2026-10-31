/**
 * `/` is Home (Q1, ADR-0038): the setup checklist until there is a remora, then the dashboard —
 * remoras, what needs you, and one activity feed. Chat lives at `/chat`.
 */
import { AlertTriangle, Fish, Plus, ShieldCheck } from "lucide-react";
import { Link } from "react-router";
import { EmptyState } from "@/components/app/empty-state";
import { Page, PageHeader, Section } from "@/components/app/page";
import { SetupChecklist } from "@/components/app/setup-checklist";
import { StatTile } from "@/components/app/stat-tile";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useFunds } from "@/features/funds/use-funds";
import { api } from "@/features/remoras/api";
import { FeedList } from "@/features/remoras/feed-list";
import { useLoad, useOwner } from "@/features/remoras/hooks";
import { RemoraCard } from "@/features/remoras/remora-card";
import { TemplateCard } from "@/features/remoras/template-card";
import { useNetwork } from "@/lib/network";
import { formatUsdc } from "@/lib/usdc";
import { CardGrid } from "@/openbot/pages";

const HERO = "Always-on agents you own.";
const SUB = "Memory you can read · a budget Sui enforces · a receipt for every action.";

function Dashboard({ owner }: { owner: string }) {
  const network = useNetwork();
  const remoras = useLoad(() => api.remoras(), [], 30_000);
  const feed = useLoad(() => api.feed(), [], 15_000);
  const inbox = useLoad(() => api.approvals(), [], 30_000);
  const funds = useFunds(owner, network);
  const live = (remoras.data?.remoras ?? []).filter((r) => r.status !== "retired");
  const pending = inbox.data?.approvals.length ?? 0;
  const ready = funds.data?.splits.find((s) => s.role === "owner")?.addressBalance ?? "0";

  return (
    <Page title="Home" description="Your remoras, what needs you, and what they did lately.">
      <PageHeader
        title="Home"
        description={`${live.length} remora${live.length === 1 ? "" : "s"} on ${network}.`}
        actions={
          <Button asChild>
            <Link to="/remoras/new">
              <Plus /> New remora
            </Link>
          </Button>
        }
      />

      {remoras.error ? (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Couldn't read your remoras</AlertTitle>
          <AlertDescription>{remoras.error}</AlertDescription>
        </Alert>
      ) : null}

      {pending > 0 ? (
        <Alert variant="warning">
          <AlertTitle>
            {pending} approval{pending === 1 ? "" : "s"} waiting
          </AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            A payment is over its per-payment cap.
            <Button asChild variant="outline" size="sm">
              <Link to="/approvals">Review</Link>
            </Button>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Remoras" value={live.length} hint="on this network" />
        <StatTile
          label="Waiting for you"
          value={pending}
          tone={pending ? "warning" : "default"}
          hint={pending ? "approvals need a yes" : "nothing needs you"}
        />
        <StatTile
          label="Ready to spend"
          value={`$${formatUsdc(ready)}`}
          hint="in your address balance"
        />
      </div>

      <Section
        title="Your remoras"
        actions={
          <Button asChild variant="ghost" size="sm" className="-mr-3">
            <Link to="/remoras">See all</Link>
          </Button>
        }
      >
        {remoras.loading && !remoras.data ? (
          <CardGrid>
            <Skeleton className="h-32 w-full rounded-ob-card" />
            <Skeleton className="h-32 w-full rounded-ob-card" />
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
            title="No remoras yet"
            description="Start from a template. Scout buys answers; Sentinel watches wallets and learns what matters."
            action={
              <Button asChild>
                <Link to="/remoras/new">
                  <Plus /> Create a remora
                </Link>
              </Button>
            }
          />
        )}
      </Section>

      <Section title="Activity">
        {feed.loading && !feed.data ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-16 w-full rounded-ob-card" />
            <Skeleton className="h-16 w-full rounded-ob-card" />
          </div>
        ) : (
          <FeedList items={feed.data?.events ?? []} showRemora />
        )}
      </Section>
    </Page>
  );
}

function EmptyHome({ signedIn }: { signedIn: boolean }) {
  const templates = useLoad(() => api.templates(), []);
  const list = Object.entries(templates.data?.templates ?? {});

  return (
    <Page title="Remora" description="Always-on agents you own.">
      <header className="ob-page-header-copy gap-2 pt-2">
        <h1 className="ob-page-title text-balance md:text-[32px] md:leading-[38px] md:tracking-[-0.03em]">
          {HERO}
        </h1>
        <p className="ob-page-description md:text-base">{SUB}</p>
        {signedIn ? null : (
          // ADR-0088: a first visit can see a remora pay and prove it before connecting anything.
          <div className="flex flex-wrap gap-2 pt-2">
            <Button asChild>
              <Link to="/playground" data-testid="home-try-scout">
                <Fish /> Try Scout, no wallet
              </Link>
            </Button>
            <Button asChild variant="outline">
              <Link to="/verify">
                <ShieldCheck /> Check a receipt
              </Link>
            </Button>
          </div>
        )}
      </header>
      <SetupChecklist variant="full" />
      {list.length ? (
        <Section title="Start from a template">
          <CardGrid>
            {list.map(([slug, template]) => (
              <TemplateCard key={slug} slug={slug} template={template} />
            ))}
          </CardGrid>
        </Section>
      ) : null}
      <p className="text-md text-ob-muted">
        Already at home here?{" "}
        <Link className="link" to="/chat">
          Open the chat
        </Link>
        .
      </p>
    </Page>
  );
}

export function HomePage() {
  const { owner, loading } = useOwner();
  const remoras = useLoad(
    () =>
      owner
        ? api.remoras()
        : Promise.resolve({ ok: true as const, data: { remoras: [] as never[] } }),
    [owner],
  );

  if (loading) {
    return (
      <Page title="Remora">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 w-full rounded-ob-card" />
      </Page>
    );
  }
  if (owner && (remoras.loading || (remoras.data?.remoras.length ?? 0) > 0)) {
    // Loading still shows the dashboard shell, so the page does not jump from Home to Home.
    return <Dashboard owner={owner} />;
  }
  return <EmptyHome signedIn={!!owner} />;
}
