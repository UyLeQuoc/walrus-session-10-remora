/** `/connect/:token` and `/disconnect/:token`: one signature moves or revokes Remora's key. */
import { useParams } from "react-router";
import { Page, PageHeader } from "@/components/app/page";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletPicker } from "@/components/wallet-picker";
import { Web3Address } from "@/components/web3-address";
import { useConnectFlow } from "@/features/connect/use-connect-flow";
import { useResumeWallet } from "@/features/connect/use-resume-wallet";

export function ConnectPage({ kind }: { kind: "connect" | "disconnect" }) {
  const { token } = useParams();
  const { account, info, step, status, error, selfPaid, linkDead, run } = useConnectFlow(
    kind,
    token,
  );
  const resume = useResumeWallet(step === "ready" && !account && !linkDead);

  if (step === "loading") {
    return (
      <Page title={kind === "connect" ? "Connect" : "Revoke"}>
        <div className="flex w-full flex-col gap-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </Page>
    );
  }

  if (step === "done") {
    return (
      <Page
        title={kind === "connect" ? "Your memory is yours" : "Access revoked"}
        description="The on-chain change is confirmed."
      >
        <PageHeader
          title={kind === "connect" ? "Your memory is yours" : "Access revoked"}
          description={
            kind === "connect"
              ? "Remora now writes into your own Walrus Memory account."
              : "Remora can no longer read or write anything in your account."
          }
        />
        <div className="flex w-full flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {kind === "connect"
              ? "The same memory is readable from Claude Code or any other Walrus Memory client you sign in. Anything you told it before this stays in Remora's own account, where it cannot be moved from, so Remora reads both. You can revoke its access to yours at any time with /disconnect."
              : "What you told it before you connected lives in Remora's account rather than yours, so that part it can still read; /memory forget all makes it unrecallable. Nothing was deleted, and /connect grants access again."}
          </p>
          {selfPaid ? (
            <p className="text-sm text-muted-foreground">
              Gas sponsorship was unavailable, so your wallet paid for this transaction.
            </p>
          ) : null}
          <p className="text-sm">You can close this tab and go back to the chat.</p>
        </div>
      </Page>
    );
  }

  return (
    <Page
      title={kind === "connect" ? "Connect your wallet" : "Revoke Remora's access"}
      description="One signature moves or revokes Remora's key."
    >
      <PageHeader
        title={kind === "connect" ? "Own your memory" : "Revoke Remora"}
        description={
          kind === "connect"
            ? "Sign one transaction and your memory moves to a Walrus Memory account you own on Sui."
            : "This removes Remora's key from your account on chain."
        }
      />
      <div className="flex w-full flex-col gap-6">
        <p className="text-sm text-muted-foreground">
          {kind === "connect" ? (
            <>
              Right now Remora keeps your memory under its own account. Walrus Memory normally
              sponsors the gas, so it costs you nothing. If sponsorship is unavailable your wallet
              pays instead, which needs a small amount of SUI, and you will be told before you sign.
              You can take the access away again whenever you want.
            </>
          ) : (
            <>
              After it lands, Remora cannot read or write your memories at all. Gas is normally
              sponsored; if it is not, your wallet pays and you will be told before you sign.
            </>
          )}
        </p>

        {info ? (
          <dl className="flex flex-col gap-2 rounded-lg border p-3 text-sm text-muted-foreground">
            <div className="flex justify-between gap-4">
              <dt>Key label</dt>
              <dd className="font-mono">{info.label}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="shrink-0">Delegate key</dt>
              <dd className="min-w-0 flex-1">
                <Web3Address value={info.publicKey} />
              </dd>
            </div>
          </dl>
        ) : null}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {step === "working" ? <p className="text-sm">{status}</p> : null}

        {linkDead ? null : account ? (
          <Button onClick={() => void run()} disabled={step === "working"}>
            {step === "working"
              ? "Working…"
              : kind === "connect"
                ? "Grant access"
                : "Revoke access"}
          </Button>
        ) : resume.pending ? (
          <p
            className="text-sm text-muted-foreground"
            role="status"
            aria-label="Connecting your wallet"
          >
            Connecting your wallet…
          </p>
        ) : (
          <WalletPicker label="Connect your Sui wallet" />
        )}
      </div>
    </Page>
  );
}
