/**
 * Who a wallet sign-in should become.
 *
 * Creating a fresh person and pointing the session at them dropped the guest
 * the browser was already talking as, which is what "I approved and got logged
 * out" was. Stay with the person who has the memories.
 */
export type SignInTarget =
  | { action: "use"; personId: string }
  | { action: "merge"; winnerId: string; loserId: string }
  | { action: "attach"; personId: string }
  | { action: "create" };

export function chooseSignInTarget(input: {
  walletPersonId: string | null;
  currentPersonId: string | null;
  walletHasMemories: boolean;
  currentHasMemories: boolean;
}): SignInTarget {
  const { walletPersonId, currentPersonId, walletHasMemories, currentHasMemories } = input;

  if (walletPersonId && currentPersonId && walletPersonId === currentPersonId) {
    return { action: "use", personId: walletPersonId };
  }

  if (walletPersonId && currentPersonId) {
    if (!currentHasMemories) {
      return { action: "merge", winnerId: walletPersonId, loserId: currentPersonId };
    }
    if (!walletHasMemories) {
      return { action: "merge", winnerId: currentPersonId, loserId: walletPersonId };
    }
    return { action: "use", personId: walletPersonId };
  }

  if (walletPersonId) return { action: "use", personId: walletPersonId };
  if (currentPersonId) return { action: "attach", personId: currentPersonId };
  return { action: "create" };
}
