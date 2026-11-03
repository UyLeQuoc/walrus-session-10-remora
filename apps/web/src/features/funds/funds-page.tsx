/**
 * `/funds` (A4·ui): Detect funds. Allowances can only spend what is in your address balance, so the
 * page shows the split, moves coins in with one signature, and keeps Withdraw under Advanced
 * (ADR-0004). A zero coin balance shows a tick, never a disabled primary button. ADR-0103: the two
 * balances as big numbers, each spending limit as a meter, and the money path as a picture.
 */
import { toDiscError } from "@remora/disc-sdk";
import { ArrowDownToLine, Check, ChevronDown, Coins, Plus, RefreshCw, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Term } from "@/components/app/glossary";
import { Page, PageHeader, Section } from "@/components/app/page";
import { MoneyFlow } from "@/components/app/what-is-remora";
import { Hash } from "@/components/hash";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Address, Problem, Stat, StatRow } from "@/components/visual";
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
  const number = (v: string | undefined) =>
    v === undefined ? <Skeleton className="h-7 w-20" /> : formatUsdc(v);

  return (
    <Page title="Funds" description="What your remoras can spend, and what is still in coins.">
      <PageHeader
        title="Funds"
        description="What your remoras can spend."
        hint={
          <>
            Remoras spend USDC from your <Term name="address balance">address balance</Term>, only
            within their spending limits. USDC in coins has to move there first.
          </>
        }
        actions={
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Detect funds"
              title="Detect funds: read your balances again"
              disabled={loading || busy}
              onClick={() => void detect()}
            >
              {loading ? <Spinner /> : <RefreshCw />}
            </Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button type="button">
                  <Plus /> Add USDC
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="flex w-80 flex-col gap-3 text-sm">
                <p className="font-medium text-ob-text">Send USDC to your address</p>
                <Address value={owner} />
                {network === "testnet" ? (
                  <a
                    className="link text-xs"
                    href="https://faucet.circle.com/"
                    target="_blank"
                    rel="noreferrer"
                  >
                    Get test USDC (Circle faucet, Sui testnet) ↗
                  </a>
                ) : null}
              </PopoverContent>
            </Popover>
          </>
        }
      />

      {error ? (
        <Problem
          title="Couldn't read your balance from Sui."
          detail={error}
          onRetry={() => void detect()}
        />
      ) : null}

      <StatRow className="md:grid-cols-2">
        <Stat
          label="Ready to spend"
          icon={<Wallet />}
          value={number(mine?.addressBalance)}
          unit={mine ? "USDC" : undefined}
          size="lg"
          data-testid="ready"
        />
        <Stat
          label="In coins"
          icon={<Coins />}
          value={number(mine?.coins.total)}
          unit={mine ? "USDC" : undefined}
          size="lg"
          tone={coins > 0n ? "warning" : "default"}
          data-testid="coins"
        >
          {!mine ? null : coins > 0n ? (
            <Button
              type="button"
              size="sm"
              className="w-fit"
              disabled={busy}
              onClick={() => void sign("/api/funds/move", { owner })}
            >
              {busy ? <Spinner /> : <ArrowDownToLine />}
              Move ${formatUsdc(mine.coins.total)} to address balance
            </Button>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-ob-success-text">
              <Check aria-hidden className="size-3.5" /> Nothing to move
            </span>
          )}
        </Stat>
      </StatRow>

      {settling || lastTx ? (
        <div className="flex min-h-6 flex-wrap items-center gap-2 text-md">
          {settling ? (
            <Badge variant="warning">
              <Spinner /> Settling…
            </Badge>
          ) : null}
          {lastTx ? (
            <span className="flex min-w-0 items-center gap-2 text-ob-muted">
              Last transaction
              <Hash value={lastTx} href={explorerTx(network, lastTx)} label="transaction" />
            </span>
          ) : null}
        </div>
      ) : null}

      <DiscPanel owner={owner} network={network} />

      <Section title="Where it goes">
        <MoneyFlow />
      </Section>

      <Collapsible>
        <CollapsibleTrigger asChild>
          <Button type="button" variant="ghost" size="sm" className="group -ml-3">
            <ChevronDown className="transition-transform group-data-[state=open]:rotate-180" />
            Advanced: withdraw to a coin
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="ob-card mt-2">
          <p className="text-md text-ob-muted">For apps that need a Coin object.</p>
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
