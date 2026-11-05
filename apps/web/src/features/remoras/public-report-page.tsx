/**
 * `/t/:token` (C3, ADR-0148): a Treasurer's report, shared as a public, redacted link the way G6
 * shares a Wake. Works signed out. It shows only what the server's allow-list sends: the team's
 * totals and runway, each address by its label and a shortened address, counterparties shortened.
 */
import { Link2Off } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router";
import { EmptyState } from "@/components/app/empty-state";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Result } from "./api";
import { fetchPublicReport, type PublicReport, units } from "./treasury-api";

export function PublicReportView({ rep }: { rep: PublicReport }) {
  return (
    <>
      <Section title={`${rep.from} to ${rep.to}`}>
        <div className="grid gap-3 sm:grid-cols-2" data-testid="public-report">
          {rep.coins.map((c) => (
            <div key={c.symbol} className="rounded-lg bg-ob-surface-2 p-4 text-md">
              <p className="font-medium">{c.symbol}</p>
              <p className="tabular-nums">
                {units(c.in, c.decimals)} in · {units(c.out, c.decimals)} out
                {BigInt(c.internal) > 0n
                  ? ` · ${units(c.internal, c.decimals)} moved inside the team`
                  : ""}
              </p>
              <p className="text-sm text-ob-secondary">
                {c.balance === null
                  ? "Balance unavailable"
                  : c.runwayDays === null
                    ? `Holds ${units(c.balance, c.decimals)}, no burn this week`
                    : `Holds ${units(c.balance, c.decimals)}: runway ${c.runwayDays} days at ${units(c.burnPerDay, c.decimals)} a day`}
              </p>
            </div>
          ))}
        </div>
      </Section>
      <Section title="Per address">
        <ul className="flex flex-col gap-1 text-md">
          {rep.addresses.map((a) => (
            <li key={`${a.label}-${a.address}`} className="flex flex-wrap gap-2">
              <b>{a.label}</b>
              <code className="text-xs">{a.address}</code>
              <span className="tabular-nums text-ob-secondary">
                {a.flows.length
                  ? a.flows
                      .map(
                        (f) =>
                          `${units(f.in, f.decimals)} ${f.symbol} in, ${units(f.out, f.decimals)} out`,
                      )
                      .join("; ")
                  : "no transfers"}
              </span>
            </li>
          ))}
        </ul>
      </Section>
      {rep.counterparties.length ? (
        <Section title="Top counterparties">
          <ul className="flex flex-col gap-1 text-md">
            {rep.counterparties.map((p) => (
              <li key={`${p.who}-${p.symbol}`} className="tabular-nums">
                <code className="text-xs">{p.who}</code> · {p.transfers}× ·{" "}
                {units(p.in, p.decimals)} in, {units(p.out, p.decimals)} out {p.symbol}
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
      <p className="text-sm text-ob-muted">
        Read from Sui's checkpoints on {rep.network}. Full addresses, names and requests stay
        private.
      </p>
    </>
  );
}

export function PublicReportPage() {
  const { token = "" } = useParams();
  const [state, setState] = useState<Result<PublicReport | null> | null>(null);
  const load = useCallback(async () => {
    setState(null);
    setState(await fetchPublicReport(token));
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);
  const rep = state?.ok ? state.data : null;
  const title = rep ? `${rep.remora}: treasury report` : "A shared treasury report";
  const description = rep
    ? `What came in and went out of a team's wallets, ${rep.from} to ${rep.to}, and the runway.`
    : "A team's treasury report, read from Sui.";
  return (
    <Page title={title} description={description}>
      <PageHeader
        title={rep ? `${rep.remora}'s treasury report` : "Treasury report"}
        description={description}
      />
      {state === null ? (
        <div className="flex flex-col gap-2">
          <Skeleton className="h-20 w-full rounded-ob-card" />
          <Skeleton className="h-32 w-full rounded-ob-card" />
        </div>
      ) : !state.ok ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load this report</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            {state.error}
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : !rep ? (
        <EmptyState
          icon={<Link2Off />}
          title="This report was revoked or doesn't exist"
          description="The owner may have stopped sharing it, or the link is wrong."
        />
      ) : (
        <PublicReportView rep={rep} />
      )}
    </Page>
  );
}
