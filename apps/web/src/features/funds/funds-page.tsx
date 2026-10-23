/**
 * `/funds` (A4·ui): Detect funds. Allowances can only spend what is in your address balance, so the
 * page shows the split, moves coins in with one signature, and keeps Withdraw under Advanced
 * (ADR-0004). A zero coin balance shows a tick, never a disabled primary button.
 */
import { toDiscError } from "@remora/disc-sdk";
import { ChevronDown, Coins } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Term } from "@/components/app/glossary";
import { Page, PageHeader, Section } from "@/components/app/page";
import { StatTile } from "@/components/app/stat-tile";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { RequireOwner } from "@/features/remoras/hooks";
import { apiPost } from "@/lib/api-request";
import { FundsTxResponse } from "@/lib/contracts";
import { useNetwork } from "@/lib/network";
import { explorerTx, formatUsdc, parseUsdc } from "@/lib/usdc";
import { DiscPanel } from "./disc-panel";
import { useSignAndRun } from "./sign";
import { useFunds } from "./use-funds";

function Funds({ owner }: { owner: string }) {
  const network = useNetwork();
  const { data, error, loading, detect } = useFunds(owner, network);
  const run = useSignAndRun();
  const [busy, setBusy] = useState(false);
  const [settling, setSettling] = useState(false);
  const [lastTx, setLastTx] = useState<string | null>(null);
  const [amount, setAmount] = useState("");

  const mine = data?.splits.find((s) => s.role === "owner");
  const ready = mine ? BigInt(mine.addressBalance) : 0n;
  const coins = mine ? BigInt(mine.coins.total) : 0n;

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
      await settle(ready);
    } catch (err) {
      toast.error(err instanceof Error ? toDiscError(err).message : "Couldn't sign.");
    } finally {
      setBusy(false);
    }
  };

  const withdrawAmount = parseUsdc(amount);

  return (
    <Page title="Funds" description="What your remoras can spend, and what is still in coins.">
      <PageHeader
        title="Funds"
        description="Remoras spend USDC from your address balance, only through their Disc."
        actions={
          <Button
            type="button"
            variant="outline"
            disabled={loading || busy}
            onClick={() => void detect()}
          >
            {loading ? <Spinner /> : null}
            Detect funds
          </Button>
        }
      />

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile
          label="Ready to spend"
          value={`$${mine ? formatUsdc(mine.addressBalance) : "—"}`}
          hint="Remoras spend this through their Disc."
          data-testid="ready"
        />
        <StatTile
          label="In coins"
          value={`$${mine ? formatUsdc(mine.coins.total) : "—"}`}
          tone={coins > 0n ? "warning" : "default"}
          hint={
            coins > 0n ? (
              "Needs moving to your address balance."
            ) : (
              <span className="text-success">✓ Nothing to move</span>
            )
          }
          data-testid="coins"
          action={
            coins > 0n ? (
              <Button
                type="button"
                disabled={busy}
                onClick={() => void sign("/api/funds/move", { owner })}
              >
                {busy ? <Spinner /> : null}
                Move ${mine ? formatUsdc(mine.coins.total) : "0"} to address balance
              </Button>
            ) : null
          }
        />
      </div>

      {settling || lastTx ? (
        <div className="flex min-h-6 flex-wrap items-center gap-2 text-sm">
          {settling ? (
            <Badge variant="warning">
              <Spinner /> Settling…
            </Badge>
          ) : null}
          {lastTx ? (
            <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
              Last transaction
              <Hash value={lastTx} href={explorerTx(network, lastTx)} label="transaction" />
            </span>
          ) : null}
        </div>
      ) : null}

      <DiscPanel owner={owner} network={network} />

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm">
            <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
            Advanced: withdraw to a coin
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-2 pt-2">
          <p className="text-sm text-muted-foreground">
            For apps that need a Coin object. Remoras can only spend your{" "}
            <Term name="address balance">address balance</Term>.
          </p>
          <div className="flex flex-wrap gap-2">
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

      <Section title="Where it goes" description="A short version of the money path.">
        <div className="flex items-start gap-3 rounded-xl border bg-card p-4 text-sm">
          <Coins className="mt-0.5 size-4 shrink-0 text-primary" />
          <p className="text-muted-foreground">
            USDC in coins → your address balance → each remora's Disc → a merchant. A Disc can only
            spend what is already in your address balance, and only up to its cap.
          </p>
        </div>
      </Section>
    </Page>
  );
}

export function FundsPage() {
  return (
    <RequireOwner what="your funds" needsWallet>
      {(owner) => <Funds owner={owner} />}
    </RequireOwner>
  );
}
