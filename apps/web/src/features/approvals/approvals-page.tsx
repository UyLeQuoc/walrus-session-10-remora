/**
 * `/approvals` (N2 + E4): everything waiting on you. An over-limit payment is paid once from your own
 * address balance: your wallet signs it, the merchant settles it, and the remora answers with what
 * was bought (ADR-0031). A proposed schedule needs only a yes.
 */
import { useSignTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import type { ApprovalRequest } from "@remora/schema";
import { useState } from "react";
import { toast } from "sonner";
import { useShellTitle } from "@/app/shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
        <CardTitle className="flex items-center gap-2">
          {a.remora} <Badge variant="outline">{a.status}</Badge>
        </CardTitle>
        <CardDescription>
          {a.kind === "over_limit_payment" && p.amount && p.payee
            ? `Pay ${usdc(p.amount)} USDC to ${p.payee}, over its per-payment cap.`
            : a.summary}
          {p.question ? ` For: “${p.question}”` : ""}
        </CardDescription>
      </CardHeader>
      {answer ? (
        <CardContent>
          <p className="whitespace-pre-wrap text-sm">{answer}</p>
        </CardContent>
      ) : null}
      {a.status === "pending" ? (
        <CardFooter className="flex-wrap gap-2">
          {a.kind === "over_limit_payment" ? (
            <Button type="button" disabled={!!busy} onClick={() => void pay()}>
              Pay once{p.amount ? ` (${usdc(p.amount)} USDC)` : ""}
            </Button>
          ) : (
            <Button type="button" onClick={() => void decide(true)}>
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

function Inbox() {
  const [all, setAll] = useState(false);
  const [paid, setPaid] = useState<Paid[]>([]);
  const list = useLoad(() => api.approvals(all ? "all" : "pending"), [all], 20_000);
  const rows = list.data?.approvals ?? [];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 overflow-y-auto p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {list.loading && !list.data
            ? "Loading…"
            : rows.length
              ? `${rows.length} ${all ? "in total" : "waiting for you"}.`
              : "Nothing is waiting for you."}
        </p>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAll((x) => !x)}>
          {all ? "Only pending" : "Show decided"}
        </Button>
      </div>
      {list.error ? <p className="text-sm text-destructive">{list.error}</p> : null}
      {paid.map((p) => (
        <Card key={p.id}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {p.remora} <Badge variant="secondary">paid once</Badge>
            </CardTitle>
            <CardDescription>
              {p.digest ? `Settled in ${p.digest.slice(0, 10)}…` : "Settled."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm" data-testid="approval-answer">
              {p.answer}
            </p>
          </CardContent>
        </Card>
      ))}
      {rows.map((a) => (
        <ApprovalCard
          key={a.id}
          a={a}
          onDone={() => void list.refresh()}
          onPaid={(p) => setPaid((x) => [p, ...x])}
        />
      ))}
    </div>
  );
}

export function ApprovalsPage() {
  useShellTitle("Approvals");
  return <RequireOwner what="your approvals">{() => <Inbox />}</RequireOwner>;
}
