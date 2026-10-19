/** Keeps dapp-kit on the session network, and says so when the wallet is on another one (B9). */
import { useCurrentAccount, useSuiClientContext } from "@mysten/dapp-kit";
import { useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { chainOf } from "@/lib/network";
import { useNetworks } from "./use-networks";

/** Keeps dapp-kit's client on the session's network. */
export function NetworkSync() {
  const { network } = useNetworks();
  const ctx = useSuiClientContext();
  useEffect(() => {
    if (ctx.network !== network) ctx.selectNetwork(network);
  }, [ctx, network]);
  return null;
}

/** Shown inside a page (not as a full-width strip) when the wallet is on another network. */
export function WalletNetworkWarning() {
  const { network } = useNetworks();
  const account = useCurrentAccount();
  if (!account || account.chains.length === 0 || account.chains.includes(chainOf(network)))
    return null;
  return (
    <Alert variant="warning">
      <AlertTitle>Your wallet is on another network</AlertTitle>
      <AlertDescription>
        It is on {account.chains.map((c) => c.replace("sui:", "")).join(", ")}. Switch it to{" "}
        <strong>{network}</strong> to sign here.
      </AlertDescription>
    </Alert>
  );
}
