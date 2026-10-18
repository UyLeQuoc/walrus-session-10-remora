/**
 * `/funds` (A4·ui): Detect funds. Allowances can only spend what's in your address balance, so the page
 * shows the split, moves coins in with one signature, and keeps Withdraw under Advanced (ADR-0004).
 */
import { useCurrentAccount } from "@mysten/dapp-kit";
import { toDiscError } from "@remora/disc-sdk";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useShellTitle } from "@/app/shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { WalletPicker } from "@/components/wallet-picker";
import { useMe } from "@/features/me/use-me";
import { apiPost } from "@/lib/api-request";
import { FundsTxResponse } from "@/lib/contracts";
import { useNetwork } from "@/lib/network";
import { explorerTx, formatUsdc, parseUsdc } from "@/lib/usdc";
import { DiscPanel } from "./disc-panel";
import { useSignAndRun } from "./sign";
import { useFunds } from "./use-funds";

export function FundsPage() {
  useShellTitle("Funds");
  const network = useNetwork();
  const account = useCurrentAccount();
  const { me, load } = useMe();
  const owner = account?.address ?? me?.walletAddress ?? null;
  const { data, error, loading, detect } = useFunds(owner, network);
  const run = useSignAndRun();
  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  if (!owner) {
    return (
      <div className="mx-auto flex w-full max-w-md flex-col items-center gap-3 p-8 text-center">
        <p className="text-sm text-muted-foreground">Connect your wallet to see your funds.</p>
        <WalletPicker label="Connect wallet" signIn onSignedIn={load} />
      </div>
    );
  }

  const mine = data?.splits.find((s) => s.role === "owner");

  /** After a move, the address balance shows up at finality; poll a few times while "settling". */
  const settle = async (before: bigint) => {
    setSettling(true);
    for (let i = 0; i < 10; i++) {
      const next = await detect();
      const ab = BigInt(next?.splits.find((s) => s.role === "owner")?.addressBalance ?? "0");
      if (ab !== before) break;
      await new Promise((r) => setTimeout(r, 1500));
    }
    setSettling(false);
  };

  const sign = async (
    path: "/api/funds/move" | "/api/funds/withdraw",
    body: Record<string, string>,
  ) => {
    setBusy(true);
    try {
      const r = await apiPost(path, FundsTxResponse, "Couldn't build the transaction.", body);
      if (!r.ok) throw new Error(r.error);
      const digest = await run(r.data.transaction);
      setLastTx(digest);
      toast.success(
        path.endsWith("move") ? "Moved to your address balance." : "Withdrawn to a coin.",
      );
      await settle(BigInt(mine?.addressBalance ?? "0"));
    } catch (err) {
      toast.error(err instanceof Error ? toDiscError(err).message : "Couldn't sign.");
    } finally {
      setBusy(false);
    }
  };

  const withdrawAmount = parseUsdc(amount);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 overflow-y-auto p-4">
      <Card>
        <CardHeader>
          <CardTitle>Your USDC on {network}</CardTitle>
          <CardDescription>
            Remoras spend from your address balance, only through their Disc.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border p-3" data-testid="ready">
              <p className="text-xs text-muted-foreground">Ready (address balance)</p>
              <p className="text-2xl font-semibold tabular-nums">
                ${mine ? formatUsdc(mine.addressBalance) : "—"}
              </p>
              {settling ? <p className="text-xs text-amber-600">Settling…</p> : null}
            </div>
            <div className="rounded-md border p-3" data-testid="coins">
              <p className="text-xs text-muted-foreground">
                In coins{mine ? ` (${mine.coins.count})` : ""} → needs moving
              </p>
              <p className="text-2xl font-semibold tabular-nums">
                ${mine ? formatUsdc(mine.coins.total) : "—"}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading || busy}
              onClick={() => void detect()}
            >
              {loading ? "Detecting…" : "Detect funds"}
            </Button>
            <Button
              type="button"
              disabled={busy || !mine || BigInt(mine.coins.total) === 0n}
              onClick={() => void sign("/api/funds/move", { owner })}
            >
              Move ${mine ? formatUsdc(mine.coins.total) : "0"} to address balance
            </Button>
          </div>
          {lastTx ? (
            <a
              className="text-xs underline"
              href={explorerTx(network, lastTx)}
              target="_blank"
              rel="noreferrer"
            >
              Last transaction {lastTx.slice(0, 10)}…
            </a>
          ) : null}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button type="button" variant="ghost" size="sm" className="px-0">
                Advanced <ChevronDown />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="flex flex-col gap-2 pt-2">
              <p className="text-xs text-muted-foreground">
                Withdraw to a coin, for apps that need a Coin object. Remoras can't spend coins.
              </p>
              <div className="flex gap-2">
                <Input
                  aria-label="Withdraw amount (USDC)"
                  placeholder="0.10"
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="max-w-40"
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy || withdrawAmount === null}
                  onClick={() =>
                    withdrawAmount &&
                    void sign("/api/funds/withdraw", { owner, amount: withdrawAmount.toString() })
                  }
                >
                  Withdraw to coin
                </Button>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </CardContent>
      </Card>
      <DiscPanel owner={owner} network={network} />
    </div>
  );
}
