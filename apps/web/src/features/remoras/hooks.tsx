/** Shared pieces of the W2 pages: the signed-in owner, a loader with refresh, and the wallet gate. */
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useCallback, useEffect, useRef, useState } from "react";
import { WalletPicker } from "@/components/wallet-picker";
import { useMe } from "@/features/me/use-me";
import { useNetwork } from "@/lib/network";
import type { Result } from "./api";

/** The wallet behind the server session, or null (A1: the session, not just a connected wallet). */
export function useOwner(): { owner: string | null; loading: boolean; reload: () => void } {
  const { me, load } = useMe();
  return {
    owner: me?.signedIn && me.walletAddress ? me.walletAddress : null,
    loading: me === null,
    reload: load,
  };
}

/**
 * Loads `fn` now, whenever the network or `key` changes, on `refresh()`, and every `pollMs` if set
 * (N6/N13: first-run answers and settling payments show up without a reload).
 */
export function useLoad<T>(fn: () => Promise<Result<T>>, key: unknown[], pollMs?: number) {
  const network = useNetwork();
  const [state, setState] = useState<{ data: T | null; error: string; loading: boolean }>({
    data: null,
    error: "",
    loading: true,
  });
  const latest = useRef(fn);
  latest.current = fn;
  const ticket = useRef(0);
  const refresh = useCallback(async () => {
    const mine = ++ticket.current;
    const r = await latest.current();
    if (mine !== ticket.current) return;
    setState(
      r.ok
        ? { data: r.data, error: "", loading: false }
        : (s) => ({ ...s, error: r.error, loading: false }),
    );
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` is the caller's dependency list.
  useEffect(() => {
    setState((s) => ({ ...s, loading: true }));
    void refresh();
    if (!pollMs) return;
    const t = setInterval(() => void refresh(), pollMs);
    return () => clearInterval(t);
  }, [network, refresh, pollMs, ...key]);
  return { ...state, refresh };
}

/** Shows a sign-in card until the session has a wallet; then renders the page for that owner. */
export function RequireOwner({
  children,
  what,
}: {
  children: (owner: string) => React.ReactNode;
  what: string;
}) {
  const { owner, loading, reload } = useOwner();
  const account = useCurrentAccount();
  if (owner) {
    // The session outlives the wallet connection (no auto-connect): signing needs it back.
    const connected = account?.address.toLowerCase() === owner.toLowerCase();
    return (
      <>
        {connected ? null : (
          <div className="mx-auto w-full max-w-3xl px-4 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
              <span className="text-muted-foreground">
                Signed in as {owner.slice(0, 8)}…; connect that wallet here to sign.
              </span>
              <WalletPicker label="Connect wallet to sign" />
            </div>
          </div>
        )}
        {children(owner)}
      </>
    );
  }
  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-3 p-6">
      <p className="text-sm text-muted-foreground">Sign in with your wallet to see {what}.</p>
      <WalletPicker label="Sign in with your wallet" signIn onSignedIn={reload} />
    </div>
  );
}
