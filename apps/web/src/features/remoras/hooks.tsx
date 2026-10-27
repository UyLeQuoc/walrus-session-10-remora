/** Shared pieces of the W2 pages: the signed-in owner, a loader with refresh, and the wallet gate. */
import { useCurrentAccount } from "@mysten/dapp-kit";
import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { PageColumn } from "@/components/app/page";
import { Logo } from "@/components/logo";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { WalletPicker } from "@/components/wallet-picker";
import { useWalletResume } from "@/features/connect/wallet-resume";
import { useMe } from "@/features/me/use-me";
import { WalletNetworkWarning } from "@/features/network/network-switch";
import { useNetwork } from "@/lib/network";
import { AuthCard } from "@/openbot/pages";
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

/**
 * Shows a sign-in card until the session has a wallet; then renders the page for that owner.
 * `needsWallet` turns on the quiet reconnect banner, and only pages that sign should set it (B6).
 * The banners sit in the same full-width `PageColumn` as the page body, so their left edge matches;
 * the silent resume hides them while it is in flight, so a refresh never flashes a warning (§5).
 */
export function RequireOwner({
  children,
  what,
  needsWallet = false,
}: {
  children: (owner: string) => React.ReactNode;
  what: string;
  needsWallet?: boolean;
}) {
  const { owner, loading, reload } = useOwner();
  const account = useCurrentAccount();
  const resume = useWalletResume();
  if (owner) {
    const connected = account?.address.toLowerCase() === owner.toLowerCase();
    return (
      <>
        <PageColumn className="gap-3 pt-4 [&:has(>div:empty)]:hidden">
          <WalletNetworkWarning />
          {connected || !needsWallet || resume.pending ? null : (
            <Alert variant="warning">
              <AlertTriangle />
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  Reconnect your wallet to sign. Signed in as {owner.slice(0, 6)}…{owner.slice(-4)}.
                </span>
                <WalletPicker label="Reconnect" variant="outline" size="sm" onSignedIn={reload} />
              </AlertDescription>
            </Alert>
          )}
        </PageColumn>
        {children(owner)}
      </>
    );
  }
  if (loading) {
    return (
      <PageColumn className="py-6 md:py-8">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-24 w-full rounded-ob-card" />
      </PageColumn>
    );
  }
  // The h1 stays on the page's left edge like every other page's title (the layout invariant);
  // the sign-in itself is a centred card in openbot's AccountLogin shape, with Remora's mark.
  return (
    <PageColumn className="py-6 md:py-8 [[data-slot=page-column]_&]:p-0!">
      {/* Inside a page that already has its own h1 (Connections), the page's title stands. */}
      <div className="ob-page-header [[data-slot=page-column]_[data-slot=page-column]_&]:hidden">
        <h1 className="ob-page-title">Sign in</h1>
      </div>
      <AuthCard
        className="[[data-slot=page-column]_[data-slot=page-column]_&]:min-h-0 [[data-slot=page-column]_[data-slot=page-column]_&]:place-items-start [[data-slot=page-column]_[data-slot=page-column]_&]:py-0"
        mark={<Logo size={44} background decorative />}
        description={<>Sign in with your wallet to see {what}.</>}
      >
        <WalletPicker label="Sign in with your wallet" signIn onSignedIn={reload} />
      </AuthCard>
    </PageColumn>
  );
}
