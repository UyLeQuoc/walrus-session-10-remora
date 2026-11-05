/**
 * `/approvals` (N2 + E4): everything waiting on you. An over-limit payment is paid once from your own
 * address balance: your wallet signs it, the merchant settles it, and the remora answers with what
 * was bought (ADR-0031). A proposed schedule needs only a yes.
 */
import { useSignTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import type { ApprovalRequest, RemoraView } from "@remora/schema";
import { Wallet } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { toast } from "sonner";
import { Page, PageHeader } from "@/components/app/page";
import { RemoraAvatar, remoraMood } from "@/components/app/remora-avatar";
import { StatusBadge } from "@/components/app/status-badge";
import { Time } from "@/components/app/time";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Empty, Meter, Problem, Receipt } from "@/components/visual";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";
import { payeeName } from "@/lib/payee";
import { formatUsdc, usdc } from "@/lib/usdc";
import { InteractionCard } from "@/openbot";

interface Paid {
  id: string;
  remora: string;
  answer: string;
  digest: string | null;
  amount?: string;
  payee?: string;
}

function ApprovalCard({
  a,
  who,
  onDone,
  onPaid,
}: {
  a: ApprovalRequest;
  /** The remora asking, matched by name; its face and its per-payment cap. */
  who?: RemoraView;
  onDone: () => void;
  onPaid: (p: Paid) => void;
}) {
  const { mutateAsync: sign } = useSignTransaction();
  const [busy, setBusy] = useState("");
  const p = a.payload as {
    amount?: string;
    payee?: string;
    question?: string;
    human?: string;
    reason?: string;
    viaDisc?: boolean;
    usual?: string;
  };
  const cap = who?.config.budget?.perPaymentCap;
  const pay = async () => {
    try {
      setBusy("Building the payment…");
      const tx = await api.approvalPayTx(a.id);
      if (!tx.ok) throw new Error(tx.error);
      setBusy("Sign it in your wallet…");
      const signed = await sign({ transaction: Transaction.from(tx.data.transaction) as never });
      setBusy("Settling with the service…");
      const out = await api.approvalPay(a.id, {
        transaction: signed.bytes,
        signature: signed.signature,
      });
      if (!out.ok) throw new Error(out.error);
      // Shown once, above the inbox: this card leaves the pending list on the refresh below.
      onPaid({
        id: a.id,
        remora: a.remora,
        answer: out.data.answer,
        digest: out.data.digest,
        amount: p.amount,
        payee: p.payee,
      });
      toast.success("Paid once, from your balance.");
      onDone();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy("");
    }
  };
  const decide = async (yes: boolean) => {
    const out = yes ? await api.approve(a.id) : await api.reject(a.id);
    if (!out.ok) return void toast.error(out.error);
    toast.success(yes ? "Approved." : "Declined.");
    onDone();
  };
  // openbot's approval card (ADR-0069): who asks and its state, what it wants, then the actions.
  return (
    <InteractionCard
      data-testid="approval"
      className="w-full"
      tone={a.status === "pending" ? "warning" : undefined}
      title={
        <span className="flex flex-wrap items-center gap-2">
          {who ? <RemoraAvatar id={who.id} mood={remoraMood(who, 1)} size={24} still /> : null}
          {a.remora}
          {a.status === "pending" ? null : <Badge variant="outline">{a.status}</Badge>}
        </span>
      }
      status={<Time value={a.createdAt} className="shrink-0 text-xs text-ob-muted" />}
      actions={
        a.status === "pending" ? (
          <>
            {a.kind === "over_limit_payment" && p.viaDisc ? (
              // ADR-0125: an unusual amount within an Errand's limits: a yes lets it pay.
              <Button type="button" disabled={!!busy} onClick={() => void decide(true)}>
                Let it pay{p.amount ? ` (${usdc(p.amount)} USDC)` : ""}
              </Button>
            ) : a.kind === "over_limit_payment" ? (
              <Button type="button" disabled={!!busy} onClick={() => void pay()}>
                Pay once{p.amount ? ` (${usdc(p.amount)} USDC)` : ""}
              </Button>
            ) : a.kind === "budget_change" && who ? (
              // ADR-0124: a budget proposal is signed where its cited memories are shown.
              <Button asChild>
                <Link to={`/remoras/${who.id}?proposal=${a.id}`}>Review</Link>
              </Button>
            ) : a.kind === "template_update" && who ? (
              // ADR-0150: a template update is accepted where its diff is shown.
              <Button asChild>
                <Link to={`/remoras/${who.id}?update=${a.id}`}>Review</Link>
              </Button>
            ) : a.kind === "rule_conflict" && who ? (
              // ADR-0147: two notes or rules disagree; the owner picks in the Tidied tab.
              <Button asChild>
                <Link to={`/memory?tab=tidied&remora=${who.id}`}>Choose</Link>
              </Button>
            ) : (
              <Button type="button" disabled={!!busy} onClick={() => void decide(true)}>
                Approve
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              disabled={!!busy}
              onClick={() => void decide(false)}
            >
              Decline
            </Button>
            {busy ? <span className="text-sm text-muted-foreground">{busy}</span> : null}
          </>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-2">
        {a.kind === "over_limit_payment" && p.amount && p.payee ? (
          <>
            <p className="text-2xl font-semibold text-ob-text tabular-nums">
              {usdc(p.amount)} USDC{" "}
              <span className="text-base font-normal text-muted-foreground">
                to {payeeName(p.payee)}
              </span>
            </p>
            {cap ? (
              <Meter
                className="max-w-sm"
                size="sm"
                value={Number(formatUsdc(p.amount, 6))}
                max={Number(formatUsdc(cap, 6))}
                label="This payment against its per-payment cap"
                left={`its cap: ${usdc(cap)} a payment`}
                right="over the cap"
              />
            ) : null}
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Wallet className="size-3.5" aria-hidden />{" "}
              {p.viaDisc
                ? `Within its limit, but usually ${usdc(p.usual ?? "0")} USDC: it pays once you say yes`
                : "You pay it once, from your wallet"}
            </p>
          </>
        ) : a.kind === "budget_change" ? (
          <>
            <p className="text-lg font-semibold text-ob-text">{a.summary}</p>
            {typeof p.reason === "string" ? (
              <p className="text-sm text-ob-secondary">{p.reason}</p>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-ob-secondary">{a.summary}</p>
        )}
        {p.question ? <p className="text-sm text-muted-foreground">For: “{p.question}”</p> : null}
      </div>
    </InteractionCard>
  );
}

function PaidCard({ p }: { p: Paid }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {p.remora} <StatusBadge status="paid" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {p.amount ? (
          <Receipt
            compact
            amount={usdc(p.amount)}
            payee={p.payee ? payeeName(p.payee) : "the service"}
            verified={p.digest ? true : null}
            proof={p.digest ? <Hash value={p.digest} label="transaction" /> : undefined}
          />
        ) : p.digest ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            Settled <Hash value={p.digest} label="transaction" />
          </p>
        ) : (
          <p className="text-muted-foreground">Settled.</p>
        )}
        <p className="whitespace-pre-wrap" data-testid="approval-answer" data-ux-skip>
          {p.answer}
        </p>
      </CardContent>
    </Card>
  );
}

function InboxPage() {
  const [tab, setTab] = useState<"waiting" | "decided">("waiting");
  const [paid, setPaid] = useState<Paid[]>([]);
  const waiting = useLoad(() => api.approvals("pending"), [], 20_000);
  const remoras = useLoad(() => api.remoras(), []);
  const byName = (name: string) => {
    const hits = (remoras.data?.remoras ?? []).filter((r) => r.name === name);
    return hits.length === 1 ? hits[0] : undefined;
  };
  const decided = useLoad(
    () =>
      tab === "decided"
        ? api.approvals("all")
        : Promise.resolve({ ok: true as const, data: { approvals: [] as never[] } }),
    [tab],
  );
  const rows =
    tab === "waiting" ? (waiting.data?.approvals ?? []) : (decided.data?.approvals ?? []);
  const pending = waiting.data?.approvals.length ?? 0;
  const loading = tab === "waiting" ? waiting.loading : decided.loading;
  const error = tab === "waiting" ? waiting.error : decided.error;
  const refresh = () => {
    void waiting.refresh();
    if (tab === "decided") void decided.refresh();
  };

  return (
    <Page title="Approvals" description="Payments and changes that need your yes.">
      <PageHeader
        title="Approvals"
        description="Payments that wait for your yes."
        hint="A remora asks when a payment goes over its per-payment cap. Nothing is paid without you: you pay it once, from your own wallet, or decline."
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as "waiting" | "decided")}>
        <TabsList>
          <TabsTrigger value="waiting">Waiting ({waiting.data ? pending : "…"})</TabsTrigger>
          <TabsTrigger value="decided">Decided</TabsTrigger>
        </TabsList>
        <TabsContent value="waiting" className="flex flex-col gap-3 pt-4">
          {paid.map((p) => (
            <PaidCard key={p.id} p={p} />
          ))}
          {error ? (
            <Problem
              title="Couldn't load approvals. Nothing pays without you."
              detail={error}
              onRetry={refresh}
            />
          ) : loading && !rows.length ? (
            <>
              <Skeleton className="h-36 w-full rounded-ob-card" />
              <Skeleton className="h-36 w-full rounded-ob-card" />
            </>
          ) : !rows.length ? (
            <Empty
              title="You're all caught up."
              mood="success"
              action={
                <Button variant="outline" size="sm" onClick={() => setTab("decided")}>
                  See decided
                </Button>
              }
            />
          ) : (
            rows.map((a) => (
              <ApprovalCard
                key={a.id}
                a={a}
                who={byName(a.remora)}
                onDone={refresh}
                onPaid={(p) => setPaid((x) => [p, ...x])}
              />
            ))
          )}
        </TabsContent>
        <TabsContent value="decided" className="flex flex-col gap-3 pt-4">
          {error ? (
            <Problem title="Couldn't load approvals." detail={error} onRetry={refresh} />
          ) : loading && !rows.length ? (
            <Skeleton className="h-24 w-full rounded-ob-card" />
          ) : !rows.length ? (
            <Empty title="Nothing decided yet." mood="asleep" />
          ) : (
            rows.map((a) => (
              <Card key={a.id} data-testid="approval">
                <CardHeader>
                  <CardTitle className="flex flex-wrap items-center gap-2">
                    {a.remora}
                    <Badge variant={a.status === "approved" ? "success" : "outline"}>
                      {a.status}
                    </Badge>
                    <Time value={a.createdAt} className="ml-auto" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm">{a.summary}</p>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>
    </Page>
  );
}

export function ApprovalsPage() {
  return (
    <RequireOwner what="your approvals" needsWallet>
      {() => <InboxPage />}
    </RequireOwner>
  );
}
