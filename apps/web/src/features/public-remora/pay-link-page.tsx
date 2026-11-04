/**
 * B3 (ADR-0132): a pay link from a split. Whoever owes opens it, connects a testnet wallet and pays
 * the owner from it: a USDC transfer with gas sponsored by our facilitator, settled by it, then the
 * link is marked paid. No account needed.
 */
import { useCurrentAccount, useSignTransaction, useSuiClient } from "@mysten/dapp-kit";
import { coinWithBalance, Transaction } from "@mysten/sui/transactions";
import { toBase64 } from "@mysten/sui/utils";
import { X402_VERSION } from "@remora/disc-sdk";
import { HandCoins } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { z } from "zod";
import { Page, PageHeader, Section } from "@/components/app/page";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Problem } from "@/components/visual";
import { WalletPicker } from "@/components/wallet-picker";
import { apiFetch, errorMessage } from "@/lib/api";
import { usdc } from "@/lib/usdc";

const PayLink = z.object({
  name: z.string(),
  amount: z.string(),
  memo: z.string(),
  to: z.string(),
  from: z.string(),
  network: z.string(),
  asset: z.string(),
  paidDigest: z.string().nullable(),
});

const post = (path: string, body: unknown) =>
  apiFetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

export function PayLinkPage() {
  const { token = "" } = useParams();
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: sign } = useSignTransaction();
  const [link, setLink] = useState<z.infer<typeof PayLink> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [payError, setPayError] = useState("");

  useEffect(() => {
    void apiFetch(`/api/public/pay/${encodeURIComponent(token)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(await errorMessage(res, "Not found."));
        setLink(PayLink.parse(await res.json()));
      })
      .catch((e: Error) => setError(e.message));
  }, [token]);

  const pay = async () => {
    if (!account || !link) return;
    setPayError("");
    try {
      setBusy("Building the payment…");
      const tx = new Transaction();
      tx.setSender(account.address);
      tx.moveCall({
        target: "0x2::coin::send_funds",
        typeArguments: [link.asset],
        arguments: [
          coinWithBalance({ type: link.asset, balance: BigInt(link.amount) }),
          tx.pure.address(link.to),
        ],
      });
      const kind = await tx.build({ client: client as never, onlyTransactionKind: true });
      const network = `sui:${link.network}`;
      setBusy("Getting gas sponsored…");
      const gas = await post("/api/facilitator/gas", {
        network,
        sender: account.address,
        transactionKind: toBase64(kind),
      });
      const sponsored = (await gas.json()) as {
        transaction?: string;
        error?: { message?: string };
      };
      if (!gas.ok || !sponsored.transaction)
        throw new Error(sponsored.error?.message ?? "No sponsored gas right now.");
      setBusy("Sign in your wallet…");
      const signed = await sign({ transaction: Transaction.from(sponsored.transaction) as never });
      setBusy("Paying…");
      const settle = await post("/api/facilitator/settle", {
        paymentPayload: {
          x402Version: X402_VERSION,
          scheme: "exact",
          network,
          payload: { signature: signed.signature, transaction: signed.bytes },
        },
        paymentRequirements: {
          scheme: "exact",
          network,
          amount: link.amount,
          asset: link.asset,
          payTo: link.to,
          maxTimeoutSeconds: 60,
        },
      });
      const settled = (await settle.json()) as {
        success?: boolean;
        transaction?: string;
        errorReason?: string;
      };
      if (!settled.success || !settled.transaction)
        throw new Error(settled.errorReason ?? "The payment didn't settle.");
      const done = await post(`/api/public/pay/${encodeURIComponent(token)}/paid`, {
        digest: settled.transaction,
      });
      if (!done.ok) throw new Error(await errorMessage(done, "Paid, but the link wasn't updated."));
      setLink({ ...link, paidDigest: settled.transaction });
    } catch (e) {
      setPayError((e as Error).message);
    } finally {
      setBusy("");
    }
  };

  if (error) return <Problem title="This pay link doesn't exist." detail={error} />;
  if (!link)
    return (
      <Page title="Pay link">
        <Skeleton className="h-40 w-full" />
      </Page>
    );
  return (
    <Page title={`Pay ${usdc(link.amount)} USDC`} description={link.memo}>
      <PageHeader
        title={`${link.name}, you owe ${usdc(link.amount)} USDC`}
        description={link.memo}
      />
      <Section
        title="Pay it from your wallet"
        hint="Testnet USDC, to the address below. Gas is on us."
      >
        <div className="flex flex-col gap-3" data-testid="pay-link">
          <p className="flex flex-wrap items-center gap-2 text-md">
            <Badge>{usdc(link.amount)} USDC</Badge> to{" "}
            <Hash value={link.to} label="their address" />
            <span className="text-ob-muted">from {link.from}'s split</span>
          </p>
          {link.paidDigest ? (
            <p className="flex flex-wrap items-center gap-2 text-md" data-testid="pay-link-paid">
              Paid. <Hash value={link.paidDigest} label="transaction" />
              <Link
                to={`/verify/${link.paidDigest}`}
                className="text-ob-accent-text hover:underline"
              >
                Verify
              </Link>
            </p>
          ) : account ? (
            <Button
              type="button"
              className="self-start"
              disabled={busy !== ""}
              data-testid="pay-link-pay"
              onClick={() => void pay()}
            >
              {busy ? <Spinner /> : <HandCoins className="size-4" aria-hidden />}{" "}
              {busy || `Pay ${usdc(link.amount)} USDC`}
            </Button>
          ) : (
            <WalletPicker label="Connect a testnet wallet" className="self-start" />
          )}
          {payError ? <p className="text-md text-ob-danger-text">{payError}</p> : null}
        </div>
      </Section>
    </Page>
  );
}
