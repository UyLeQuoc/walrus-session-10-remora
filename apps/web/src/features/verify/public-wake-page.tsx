/**
 * H5: the public proof page. Not routed yet (the route comes with the contract PR; proposed
 * `/p/:token`). Works signed out and has no owner controls. It renders only what `PublicWake`
 * allows (see `public-wake.ts`), through the same verdict and check list as `/verify/:ref`.
 * The page is `noindex` (`Page` default); the title and description feed the link preview.
 */
import { Link2Off } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { EmptyState } from "@/components/app/empty-state";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Time } from "@/components/app/time";
import { Hash } from "@/components/hash";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { NamedAddress } from "@/features/names/sui-name";
import { payeeName } from "@/lib/payee";
import { explorerTx, usdc } from "@/lib/usdc";
import type { PublicWake } from "./public-wake";
import { fetchPublicWake, type PublicWakeResult } from "./share-api";
import { allChecksOk, CheckList, ReceiptSummary, VerifyVerdict } from "./verify-result";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] items-start gap-2 px-4 py-3 text-md">
      <dt className="text-ob-muted">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

export function actionLine(a: PublicWake["action"]): string {
  return a.kind === "pay" ? `Pay ${usdc(a.amount)} USDC to ${payeeName(a.payee)}` : a.kind;
}

export function PublicWakeView({ wake }: { wake: PublicWake }) {
  return (
    <>
      <ReceiptSummary
        remora={wake.remora}
        agent={wake.agent}
        action={
          wake.action.kind === "pay"
            ? { kind: "pay", amount: wake.action.amount, payee: wake.action.payee }
            : { kind: wake.action.kind }
        }
        ts={wake.ts}
        verified={allChecksOk(wake.checks)}
        tx={wake.tx}
        network={wake.network}
      />
      <div className="flex flex-wrap items-center gap-3">
        {wake.tx ? (
          <Button asChild size="sm">
            <Link to={`/verify/${wake.tx}`}>Check it yourself</Link>
          </Button>
        ) : null}
        <Link className="link text-sm" to="/about">
          What's Remora?
        </Link>
      </div>
      <VerifyVerdict checks={wake.checks} anchored={wake.anchored} />
      <Section title="What happened">
        <dl className="ob-group" aria-label="Receipt">
          <Row label="Remora">{wake.remora}</Row>
          <Row label="Action">{actionLine(wake.action)}</Row>
          {wake.action.kind === "pay" ? (
            <Row label="Paid to">
              <NamedAddress value={wake.action.payTo} label="Payee address" />
            </Row>
          ) : null}
          <Row label="When">
            <Time value={wake.ts} />
          </Row>
          {wake.tx ? (
            <Row label="Transaction">
              <Hash
                value={wake.tx}
                href={explorerTx(wake.network, wake.tx)}
                label="Transaction digest"
              />
            </Row>
          ) : null}
          <Row label="Signed by">
            <Hash value={wake.agent} label="Remora address" />
          </Row>
          <Row label="Intent hash">
            <code className="break-all text-xs">{wake.intentHash}</code>
          </Row>
        </dl>
      </Section>
      <Section title="What we checked">
        <CheckList checks={wake.checks} />
      </Section>
    </>
  );
}

export function PublicWakePage() {
  const { token = "" } = useParams();
  const [state, setState] = useState<PublicWakeResult | null>(null);
  const load = useCallback(async () => {
    setState(null);
    setState(await fetchPublicWake(token));
  }, [token]);
  useEffect(() => {
    void load();
  }, [load]);

  const wake = state?.status === "ok" ? state.wake : null;
  const title = wake ? `${wake.remora}: ${actionLine(wake.action)}` : "A shared proof";
  const description = wake
    ? `A receipt for what ${wake.remora} did, checked against Sui. No sign-in needed.`
    : "A remora receipt, checked against Sui.";

  return (
    <Page title={title} description={description}>
      <PageHeader title="Shared proof" description={description} />
      {state === null ? (
        <div className="flex flex-col gap-2" data-testid="public-wake-loading">
          <Skeleton className="h-20 w-full rounded-ob-card" />
          <Skeleton className="h-32 w-full rounded-ob-card" />
        </div>
      ) : state.status === "gone" ? (
        <EmptyState
          icon={<Link2Off />}
          title="This proof was revoked or doesn't exist"
          description="The owner may have stopped sharing it, or the link is wrong."
        />
      ) : state.status === "error" ? (
        <Alert variant="destructive">
          <AlertTitle>Couldn't load this proof</AlertTitle>
          <AlertDescription className="flex items-center justify-between gap-2">
            {state.error}
            <Button variant="outline" size="sm" onClick={() => void load()}>
              Try again
            </Button>
          </AlertDescription>
        </Alert>
      ) : (
        <PublicWakeView wake={state.wake} />
      )}
    </Page>
  );
}
