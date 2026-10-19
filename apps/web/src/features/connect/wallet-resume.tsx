/**
 * One silent resume for the whole app (Phase 6 §5). A signed-in session with no current account
 * reconnects the wallet this browser already approved, so pages keep working after a refresh
 * without flipping `autoConnect` on. While it is pending pages show nothing extra; a failed or
 * mismatched resume is what turns on the quiet "Reconnect" banner.
 */
import { useCurrentAccount } from "@mysten/dapp-kit";
import { createContext, type ReactNode, useContext, useMemo } from "react";
import { useMe } from "@/features/me/use-me";
import { useResumeWallet } from "./use-resume-wallet";
import { resumeDecision } from "./wallet-resume-state";

export type WalletResumeState = { pending: boolean; needsReconnect: boolean };

const WalletResumeContext = createContext<WalletResumeState>({
  pending: false,
  needsReconnect: false,
});

export function WalletResumeProvider({ children }: { children: ReactNode }) {
  const { me } = useMe();
  const account = useCurrentAccount();
  const owner = me?.signedIn && me.walletAddress ? me.walletAddress : null;
  const resume = useResumeWallet(Boolean(owner) && !account);
  const decision = resumeDecision({
    owner,
    account: account?.address ?? null,
    savedAddress: resume.saved?.address ?? null,
    pending: resume.pending,
  });
  const value = useMemo<WalletResumeState>(
    () => ({ pending: decision === "resume", needsReconnect: decision === "reconnect" }),
    [decision],
  );
  return <WalletResumeContext.Provider value={value}>{children}</WalletResumeContext.Provider>;
}

export function useWalletResume(): WalletResumeState {
  return useContext(WalletResumeContext);
}
