/**
 * The silent wallet resume decision (Phase 6 §5): the session cookie can know the owner after a
 * refresh while dapp-kit has no account, because `autoConnect` stays off. `resume` means the saved
 * wallet matches the owner and the reconnect is in flight (show nothing); `reconnect` means the
 * person has to pick their wallet again.
 */
export type ResumeDecision = "signed-out" | "connected" | "resume" | "reconnect";

export function resumeDecision(input: {
  owner: string | null;
  account: string | null;
  savedAddress: string | null;
  pending: boolean;
}): ResumeDecision {
  const { owner, account, savedAddress, pending } = input;
  if (!owner) return "signed-out";
  if (account?.toLowerCase() === owner.toLowerCase()) return "connected";
  if (!account && savedAddress?.toLowerCase() === owner.toLowerCase()) {
    return pending ? "resume" : "reconnect";
  }
  return "reconnect";
}
