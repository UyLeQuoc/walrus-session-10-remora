/**
 * N2/E4 inside a chat (ADR-0042): an approval card where the remora asked. An over-limit payment is
 * paid once from the owner's own balance (the wallet signs, the merchant settles, ADR-0031); a
 * proposed schedule takes a plain yes. Decided cards say what happened.
 */
import { useSignTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/features/remoras/api";
import { usdc } from "@/lib/usdc";

export function InlineApproval({
  payload,
  onDone,
}: {
  payload: Record<string, unknown>;
  onDone: (answer?: string) => void;
}) {
  const { mutateAsync: sign } = useSignTransaction();
  const [busy, setBusy] = useState("");
  const id = typeof payload.approvalId === "string" ? payload.approvalId : null;
  const status = String(payload.status ?? "pending");
  const kind = String(payload.kind ?? "over_limit_payment");
  const amount = typeof payload.amount === "string" ? payload.amount : null;
  const payee = typeof payload.payee === "string" ? payload.payee : null;
  if (!id) return null;

  const pay = async () => {
    try {
      setBusy("Building the payment…");
      const tx = await api.approvalPayTx(id);
      if (!tx.ok) throw new Error(tx.error);
      setBusy("Sign it in your wallet…");
      const signed = await sign({ transaction: Transaction.from(tx.data.transaction) as never });
      setBusy("Settling with the service…");
      const out = await api.approvalPay(id, {
        transaction: signed.bytes,
        signature: signed.signature,
      });
      if (!out.ok) throw new Error(out.error);
      toast.success("Paid once, from your balance.");
      onDone(out.data.answer);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy("");
    }
  };
  const decide = async (yes: boolean) => {
    setBusy(yes ? "Approving…" : "Declining…");
    const out = yes ? await api.approve(id) : await api.reject(id);
    setBusy("");
    if (!out.ok) return void toast.error(out.error);
    onDone();
  };

  return (
    <div
      className="flex w-fit max-w-full flex-col gap-2 rounded-xl border bg-card p-3 text-sm"
      data-testid="inline-approval"
    >
      <p>
        {kind === "over_limit_payment" && amount && payee
          ? `Pay ${usdc(amount)} USDC to ${payee}? It's over this remora's per-payment cap, so you pay it once, from your balance.`
          : kind === "schedule"
            ? `Ask “${String(payload.question ?? "")}” ${String(payload.human ?? "on a schedule")}?`
            : "This needs your decision."}
      </p>
      {status === "pending" ? (
        <div className="flex flex-wrap items-center gap-2">
          {kind === "over_limit_payment" ? (
            <Button type="button" size="sm" disabled={!!busy} onClick={() => void pay()}>
              Pay once{amount ? ` (${usdc(amount)} USDC)` : ""}
            </Button>
          ) : (
            <Button type="button" size="sm" disabled={!!busy} onClick={() => void decide(true)}>
              Approve
            </Button>
          )}
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!!busy}
            onClick={() => void decide(false)}
          >
            Decline
          </Button>
          {busy ? (
            <span className="flex items-center gap-1 text-muted-foreground">
              <Spinner /> {busy}
            </span>
          ) : null}
        </div>
      ) : (
        <Badge variant={status === "approved" ? "secondary" : "outline"} className="self-start">
          {status === "approved" ? "Approved" : status === "rejected" ? "Declined" : status}
        </Badge>
      )}
    </div>
  );
}
