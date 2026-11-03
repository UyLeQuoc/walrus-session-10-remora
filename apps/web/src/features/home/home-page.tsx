/**
 * `/` is Home (Q1, ADR-0038): what a remora is and the setup checklist until there is one (ADR-0095),
 * then the dashboard — remoras, what needs you, and one activity feed. Chat lives at `/chat`.
 */
import { BellRing, Bot, Fish, Plus, ShieldCheck, Wallet } from "lucide-react";
import { Link } from "react-router";
import { Page, PageHeader, Section } from "@/components/app/page";
import { SetupChecklist } from "@/components/app/setup-checklist";
import { WhatIsRemora } from "@/components/app/what-is-remora";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty, Problem, Stat, StatPending, StatRow } from "@/components/visual";
import { useFunds } from "@/features/funds/use-funds";
import { api } from "@/features/remoras/api";
import { FeedList } from "@/features/remoras/feed-list";
import { useLoad, useOwner } from "@/features/remoras/hooks";
import { RemoraCard } from "@/features/remoras/remora-card";
import { TemplateCard } from "@/features/remoras/template-card";
import { useNetwork } from "@/lib/network";
import { formatUsdc } from "@/lib/usdc";

/** Home shows a handful; the rest are one click away on Remoras. */
const SHOWN = 6;

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
  const ready = funds.data?.splits.find((s) => s.role === "owner")?.addressBalance;

  return (
    <Page title="Home" description="Your remoras, what needs you, and what they did lately.">
      <PageHeader
        title="Home"
        description="Your remoras at a glance."
        actions={
          <Button asChild>
            <Link to="/remoras/new">
              <Plus /> New remora
            </Link>
          </Button>
        }
      />

      {remoras.error ? (
        <Problem
          title="Can't reach Remora right now. Your limits still hold."
          detail={remoras.error}
          onRetry={() => void remoras.refresh()}
        />
      ) : null}

      <StatRow className="md:grid-cols-3">
        <Stat
          label="Remoras"
          icon={<Bot />}
          value={remoras.data ? live.length : <StatPending />}
          of={remoras.data ? `on ${network}` : undefined}
        />
        <Link to="/approvals" className="block transition-colors hover:border-ob-border-strong">
          <Stat
            label="Waiting for you"
            icon={<BellRing />}
            value={inbox.data ? pending : <StatPending />}
            tone={pending ? "warning" : "default"}
            of={inbox.data ? (pending ? "Review →" : "all clear") : undefined}
          />
        </Link>
        <Link to="/funds" className="block transition-colors hover:border-ob-border-strong">
          <Stat
            label="Ready to spend"
            icon={<Wallet />}
            value={
              ready !== undefined ? formatUsdc(ready) : funds.error ? "—" : <StatPending wide />
            }
            unit={ready === undefined ? undefined : "USDC"}
          />
        </Link>
      </StatRow>

      <Section
        title="Your remoras"
        actions={
          <Button asChild variant="ghost" size="sm" className="-mr-3">
            <Link to="/remoras">See all{live.length > SHOWN ? ` ${live.length}` : ""}</Link>
          </Button>
        }
      >
        {remoras.loading && !remoras.data ? (
          <CardGrid>
            <Skeleton className="h-32 w-full rounded-ob-card" />
            <Skeleton className="h-32 w-full rounded-ob-card" />
          </CardGrid>
        ) : remoras.error && !live.length ? (
          <p className="text-md text-ob-muted">Your remoras show once Remora is back.</p>
        ) : live.length ? (
          <CardGrid>
            {live.slice(0, SHOWN).map((r) => (
              <RemoraCard key={r.id} remora={r} />
            ))}
          </CardGrid>
        ) : (
          <Empty
            title="No remoras yet."
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
        ) : feed.error && !feed.data ? (
          <p className="text-md text-ob-muted">The activity shows once Remora is back.</p>
        ) : (
          <FeedList items={(feed.data?.events ?? []).slice(0, 8)} showRemora />
        )}
      </Section>
    </Page>
  );
}

function EmptyHome({ signedIn }: { signedIn: boolean }) {
  const templates = useLoad(() => api.templates(), []);
  const list = Object.entries(templates.data?.templates ?? {});

  return (
    <Page title="Home" description="Always-on agents you own.">
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
                <Fish /> Try a Researcher, no wallet
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
      {/* ADR-0103: signed in, the next step comes first; signed out, what a remora is. */}
      {signedIn ? <SetupChecklist variant="full" /> : null}
      <WhatIsRemora />
      {signedIn ? null : <SetupChecklist variant="full" />}
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
      <Page title="Home">
        <Skeleton className="h-10 w-2/3" />
        <Skeleton className="h-24 w-full rounded-ob-card" />
      </Page>
    );
  }
  if (owner && (remoras.loading || remoras.error || (remoras.data?.remoras.length ?? 0) > 0)) {
    // Loading still shows the dashboard shell, so the page does not jump from Home to Home; a
    // failing server shows it too, with the error, never the new-account page (ADR-0103).
    return <Dashboard owner={owner} />;
  }
  return <EmptyHome signedIn={!!owner} />;
}
