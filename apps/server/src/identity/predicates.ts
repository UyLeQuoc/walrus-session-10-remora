/**
 * Two identity decisions that were wrong, kept apart from the database so they
 * are tested in CI. Found in the review of 2026-09-25
 * (docs/evidence/review-2026-09-25.md).
 */

/**
 * Who an `/api/me` request is about.
 *
 * The routes used to let a request through when it carried either a guest id or
 * a session header, then resolve it. A session header that did not resolve —
 * expired, signed out, or invented — therefore counted as identified, and with
 * no guest id to reuse the route minted a brand-new person for every such
 * request. Only a session that resolves, or a guest id, identifies anyone.
 */
export function meIdentity(
  sessionPersonFound: boolean,
  guestId: string | undefined,
): "session" | "guest" | "none" {
  if (sessionPersonFound) return "session";
  return guestId ? "guest" : "none";
}

const GUEST_PREFIX = "hippo-guest:";

/**
 * Guest namespaces a person's own memory sits in besides their own.
 *
 * When `/connect` finds the wallet already belongs to someone from another
 * channel, it merges the two people and moves the loser's index rows across.
 * Their memories stay in `hippo-guest:<loser id>`, because nothing on Walrus can
 * move, and recall only read the survivor's own guest namespace — so everything
 * the loser had said became unrecallable at the moment they took ownership.
 * Reading every guest namespace that appears in the person's own rows keeps it.
 */
export function inheritedGuestIds(personId: string, namespaces: readonly string[]): string[] {
  const ids = namespaces
    .filter((n) => n.startsWith(GUEST_PREFIX))
    .map((n) => n.slice(GUEST_PREFIX.length))
    .filter((id) => id && id !== personId);
  return [...new Set(ids)];
}
