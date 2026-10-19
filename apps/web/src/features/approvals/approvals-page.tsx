/**
 * `/approvals` (N2 + E4): everything waiting on you. An over-limit payment is paid once from your own
 * address balance: your wallet signs it, the merchant settles it, and the remora answers with what
 * was bought (ADR-0031). A proposed schedule needs only a yes.
 */
import { useSignTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import type { ApprovalRequest } from "@remora/schema";
import { Inbox } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/app/empty-state";
import { Page, PageHeader } from "@/components/app/page";
import { StatusBadge } from "@/components/app/status-badge";
import { Time } from "@/components/app/time";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/features/remoras/api";
import { RequireOwner, useLoad } from "@/features/remoras/hooks";
import { usdc } from "@/lib/usdc";

interface Paid {
  id: string;
  remora: string;
  answer: string;
  digest: string | null;
}

function ApprovalCard({
  a,
  onDone,
  onPaid,
}: {
  a: ApprovalRequest;
  onDone: () => void;
  onPaid: (p: Paid) => void;
}) {
  const { mutateAsync: sign } = useSignTransaction();
  const [busy, setBusy] = useState("");
  const [answer, setAnswer] = useState("");
  const p = a.payload as { amount?: string; payee?: string; question?: string; human?: string };
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
      setAnswer(out.data.answer);
      // Shown above the inbox, since this card leaves the pending list.
      onPaid({ id: a.id, remora: a.remora, answer: out.data.answer, digest: out.data.digest });
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
  return (
    <Card data-testid="approval">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          {a.remora}
          {a.status === "pending" ? (
            <StatusBadge status="pending" />
          ) : (
            <Badge variant="outline">{a.status}</Badge>
          )}
          <Time value={a.createdAt} className="ml-auto" />
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {a.kind === "over_limit_payment" && p.amount && p.payee ? (
          <>
            <p className="text-2xl font-semibold tabular-nums">
              {usdc(p.amount)} USDC{" "}
              <span className="text-base font-normal text-muted-foreground">to {p.payee}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Over its per-payment cap. You pay this once from your own balance.
            </p>
          </>
        ) : (
          <p className="text-sm">{a.summary}</p>
        )}
        {p.question ? <p className="text-sm text-muted-foreground">For: “{p.question}”</p> : null}
        {answer ? (
          <p className="whitespace-pre-wrap text-sm" data-testid="approval-answer">
            {answer}
          </p>
        ) : null}
      </CardContent>
      {a.status === "pending" ? (
        <CardFooter className="flex-wrap gap-2">
          {a.kind === "over_limit_payment" ? (
            <Button type="button" disabled={!!busy} onClick={() => void pay()}>
              Pay once{p.amount ? ` (${usdc(p.amount)} USDC)` : ""}
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
        </CardFooter>
      ) : null}
    </Card>
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
      <CardContent className="flex flex-col gap-2 text-sm">
        {p.digest ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            Settled <Hash value={p.digest} label="transaction" />
          </p>
        ) : (
          <p className="text-muted-foreground">Settled.</p>
        )}
        <p className="whitespace-pre-wrap" data-testid="approval-answer">
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
        description="A remora asks when a payment goes over its cap. Nothing is paid without you."
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as "waiting" | "decided")}>
        <TabsList>
          <TabsTrigger value="waiting">Waiting{pending ? ` (${pending})` : ""}</TabsTrigger>
          <TabsTrigger value="decided">Decided</TabsTrigger>
        </TabsList>
        <TabsContent value="waiting" className="flex flex-col gap-3 pt-4">
          {paid.map((p) => (
            <PaidCard key={p.id} p={p} />
          ))}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!loading && !rows.length ? (
            <EmptyState
              icon={<Inbox />}
              title="You're all caught up"
              description="When a remora needs a payment over its cap, it lands here first."
            />
          ) : (
            rows.map((a) => (
              <ApprovalCard
                key={a.id}
                a={a}
                onDone={refresh}
                onPaid={(p) => setPaid((x) => [p, ...x])}
              />
            ))
          )}
        </TabsContent>
        <TabsContent value="decided" className="flex flex-col gap-3 pt-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {!loading && !rows.length ? (
            <EmptyState
              icon={<Inbox />}
              title="Nothing decided yet"
              description="Approved, declined and expired requests show up here."
            />
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
