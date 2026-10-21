/** The signed-in wallet behind a web request (cookie, or the header cross-origin pages use). */
import type { Context } from "hono";
import { personFromSession } from "./auth.ts";
import { sessionCookie, sessionHeader } from "./names.ts";
import type { Person } from "./persons.ts";

export function readSessionId(c: Context): string | undefined {
  const cookie = sessionCookie(c);
  if (cookie && /^[0-9a-f]{64}$/i.test(cookie)) return cookie;
  const header = sessionHeader(c);
  return header && /^[0-9a-f]{64}$/i.test(header) ? header : undefined;
}

/** The person and wallet, or null when not signed in with a wallet. */
export async function signedInOwner(c: Context): Promise<{ person: Person; owner: string } | null> {
  const id = readSessionId(c);
  if (!id) return null;
  const person = await personFromSession(id);
  if (!person?.walletAddress) return null;
  return { person, owner: person.walletAddress };
}
