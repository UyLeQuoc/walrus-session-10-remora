import { useConnectWallet, useCurrentAccount, useWallets } from "@mysten/dapp-kit";
import { useEffect, useState } from "react";
import { lastWalletConnection, WALLET_CONNECTION_KEY } from "@/features/connect/last-wallet";

/**
 * One silent reconnect shared across Strict Mode's extra mount.
 * A second `connect` opens the wallet again.
 */
let resumeFlight: { key: string; done: Promise<boolean> } | null = null;

function startResume(key: string, run: () => Promise<unknown>): Promise<boolean> {
  if (resumeFlight?.key === key) return resumeFlight.done;
  const done = run().then(
    () => true,
    () => false,
  );
  const flight = { key, done };
  resumeFlight = flight;
  void done.finally(() => {
    if (resumeFlight === flight) resumeFlight = null;
  });
  return done;
}

/** Reconnect the wallet this browser already approved, instead of opening the chooser again. */
export function useResumeWallet(enabled: boolean): { pending: boolean } {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const { mutateAsync: connectWallet } = useConnectWallet();
  const [failed, setFailed] = useState(false);
  const saved = lastWalletConnection(storedWalletRecord());
  const savedName = saved?.name;
  const savedAddress = saved?.address;
  const match =
    savedName == null
      ? undefined
      : wallets.find((wallet) => (wallet.id ?? wallet.name) === savedName);
  const pending = enabled && !account && !failed && match != null;

  useEffect(() => {
    if (!pending || !match || !savedAddress || !savedName) return;
    let active = true;
    void startResume(`${savedName}\n${savedAddress}`, () =>
      connectWallet({ wallet: match, accountAddress: savedAddress, silent: true }),
    ).then((ok) => {
      if (active && !ok) setFailed(true);
    });
    return () => {
      active = false;
    };
  }, [connectWallet, match, pending, savedAddress, savedName]);

  return { pending };
}

function storedWalletRecord(): string | null {
  try {
    return window.localStorage?.getItem(WALLET_CONNECTION_KEY) ?? null;
  } catch {
    return null;
  }
}
