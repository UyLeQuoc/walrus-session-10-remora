/**
 * Phase 6 §6: the signed-in address's SUI and USDC on the network selected in the header, read
 * through the browser Sui client (gRPC-web, never JSON-RPC, ADR-0021) and refetched on a network
 * change and every 30 s.
 */
import { useSuiClient } from "@mysten/dapp-kit";
import { DEPLOYMENTS } from "@remora/schema";
import { useEffect, useRef, useState } from "react";
import { type BalanceReader, balanceMist, SUI_COIN_TYPE } from "@/lib/balance";
import { type Network, useNetwork } from "@/lib/network";

export type WalletBalance = {
  sui: bigint | null;
  usdc: bigint | null;
  loading: boolean;
  failed: boolean;
};

const EMPTY: WalletBalance = { sui: null, usdc: null, loading: false, failed: false };

export async function readBalances(
  client: BalanceReader,
  owner: string,
  network: Network,
): Promise<{ sui: bigint; usdc: bigint } | null> {
  if (typeof client.getBalance !== "function") return null;
  const usdcCoinType = DEPLOYMENTS[network].usdcCoinType;
  try {
    const [sui, usdc] = await Promise.all([
      client.getBalance({ owner, coinType: SUI_COIN_TYPE }),
      client.getBalance({ owner, coinType: usdcCoinType }),
    ]);
    const suiMist = balanceMist(sui);
    const usdcMist = balanceMist(usdc);
    if (suiMist === null || usdcMist === null) return null;
    return { sui: suiMist, usdc: usdcMist };
  } catch {
    return null;
  }
}

export function useWalletBalance(owner: string | null): WalletBalance {
  const network = useNetwork();
  const client = useSuiClient() as unknown as BalanceReader;
  const [state, setState] = useState<WalletBalance>(EMPTY);
  const ticket = useRef(0);

  useEffect(() => {
    if (!owner) {
      setState(EMPTY);
      return;
    }
    let active = true;
    const read = async () => {
      const mine = ++ticket.current;
      setState((s) => ({ ...s, loading: true }));
      const out = await readBalances(client, owner, network);
      if (!active || mine !== ticket.current) return;
      setState(
        out
          ? { sui: out.sui, usdc: out.usdc, loading: false, failed: false }
          : { sui: null, usdc: null, loading: false, failed: true },
      );
    };
    void read();
    const timer = setInterval(() => void read(), 30_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [client, network, owner]);

  return state;
}
