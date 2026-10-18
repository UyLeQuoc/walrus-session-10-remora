import { MemWal } from "@mysten-incubation/memwal";

/**
 * The prefix of every team namespace. Team writes are indexed under the person
 * who made them, so anything that counts or lists a person's *own* memory —
 * `bun run evidence` above all, whose 3 × 10 check must not be inflated by shared
 * facts — filters on this.
 */
export const TEAM_PREFIX = "hippo-team:";

export const NAMESPACE = {
  owned: "hippo",
  guest: (personId: string) => `hippo-guest:${personId}`,
  team: (id: string) => `${TEAM_PREFIX}${id}`,
  isTeam: (namespace: string) => namespace.startsWith(TEAM_PREFIX),
} as const;

/** Everything needed to talk to one (account, namespace) through the relayer. */
export interface MemoryScope {
  mode: "guest" | "owned";
  key: string;
  accountId: string;
  namespace: string;
  serverUrl: string;
}

export function guestScope(
  operator: { key: string; accountId: string; serverUrl: string },
  personId: string,
): MemoryScope {
  return { mode: "guest", ...operator, namespace: NAMESPACE.guest(personId) };
}

/**
 * A team's shared namespace, inside hippo's own account.
 *
 * The team does not own this, exactly as a guest does not own theirs. Shared
 * memory that the members owned would need an account somebody holds the keys
 * to, and choosing who that is between colleagues is a question this does not
 * answer yet. `/team` says so rather than letting the name imply otherwise.
 */
export function teamScope(
  operator: { key: string; accountId: string; serverUrl: string },
  teamId: string,
): MemoryScope {
  return { mode: "guest", ...operator, namespace: NAMESPACE.team(teamId) };
}

export function ownedScope(user: {
  key: string;
  accountId: string;
  serverUrl: string;
}): MemoryScope {
  return { mode: "owned", ...user, namespace: NAMESPACE.owned };
}

export function createClient(scope: MemoryScope): MemWal {
  return MemWal.create({
    key: scope.key,
    accountId: scope.accountId,
    serverUrl: scope.serverUrl,
    namespace: scope.namespace,
  });
}
