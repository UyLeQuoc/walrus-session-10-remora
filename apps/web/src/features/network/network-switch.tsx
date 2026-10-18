/** A9·ui: the header switch, a loud TESTNET badge, and the wallet-network mismatch warning. */
import { useCurrentAccount, useSuiClientContext } from "@mysten/dapp-kit";
import { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { chainOf, type Network, setNetwork } from "@/lib/network";
import { useNetworks } from "./use-networks";

export function NetworkSwitch() {
  const { network, networks } = useNetworks();
  const list: { network: Network; available: boolean; reason?: string }[] = networks.length
    ? networks.map((n) => ({
        network: n.network as Network,
        available: n.available,
        reason: n.reason,
      }))
    : [
        { network: "testnet", available: true },
        { network: "mainnet", available: false, reason: "Loading…" },
      ];
  return (
    <TooltipProvider>
      <div className="flex items-center gap-2">
        {network === "testnet" ? (
          <Badge className="bg-amber-500 text-white hover:bg-amber-500" data-testid="testnet-badge">
            TESTNET
          </Badge>
        ) : null}
        <ToggleGroup
          type="single"
          size="sm"
          variant="outline"
          value={network}
          aria-label="Network"
          onValueChange={(v) => {
            if (v === "testnet" || v === "mainnet") setNetwork(v);
          }}
        >
          {list.map((n) =>
            n.available ? (
              <ToggleGroupItem key={n.network} value={n.network} aria-label={n.network}>
                {n.network}
              </ToggleGroupItem>
            ) : (
              <Tooltip key={n.network}>
                <TooltipTrigger asChild>
                  <span>
                    <ToggleGroupItem value={n.network} aria-label={n.network} disabled>
                      {n.network}
                    </ToggleGroupItem>
                  </span>
                </TooltipTrigger>
                <TooltipContent>{n.reason ?? "Not available yet"}</TooltipContent>
              </Tooltip>
            ),
          )}
        </ToggleGroup>
      </div>
    </TooltipProvider>
  );
}

/** Keeps dapp-kit's client on the session's network. */
export function NetworkSync() {
  const { network } = useNetworks();
  const ctx = useSuiClientContext();
  useEffect(() => {
    if (ctx.network !== network) ctx.selectNetwork(network);
  }, [ctx, network]);
  return null;
}

/** Shown when the connected wallet's account isn't on the session's network. */
export function WalletNetworkWarning() {
  const { network } = useNetworks();
  const account = useCurrentAccount();
  if (!account || account.chains.length === 0 || account.chains.includes(chainOf(network)))
    return null;
  return (
    <div
      role="alert"
      className="border-b bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-100"
    >
      Your wallet is on {account.chains.map((c) => c.replace("sui:", "")).join(", ")}. Switch it to{" "}
      <strong>{network}</strong> to sign here.
    </div>
  );
}
