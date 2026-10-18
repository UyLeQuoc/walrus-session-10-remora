/**
 * Wallet sign-in for the web.
 *
 * A person who ran `/connect` on Telegram should be able to open `/me` and see
 * their own memory without linking a second identity. Proving that means one
 * thing only: a signature over a nonce this server issued, verified against the
 * address it claims to come from.
 *
 * Deliberate rules, after a review found the connect callback trusting a
 * request body:
 *   - the address is derived from the signature, never read from the request
 *   - the nonce is single-use, short-lived and bound to nothing else
 *   - a session is a random opaque id in an httpOnly cookie, not a claim
 */
import { randomBytes } from "node:crypto";
import { and, connectTokens, eq, gt, isNull, webSessions } from "@remora/db";
import { addressFromSignature, type createSuiClient, signInMessage } from "@remora/memory";
import { db } from "../context.ts";
import {
  attachWallet,
  mergePersons,
  type Person,
  personByWallet,
  reloadPerson,
  resolvePerson,
} from "./persons.ts";
import { chooseSignInTarget } from "./sign-in-target.ts";

const NONCE_TTL_MS = 5 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Issue a nonce. Stored in `connect_tokens`, which already has single-use and
 * expiry semantics, rather than inventing a second table for the same shape.
 */
export async function createChallenge(): Promise<{ nonce: string; message: string }> {
  const nonce = randomBytes(32).toString("hex");
  await db.insert(connectTokens).values({
    token: `challenge:${nonce}`,
    // A challenge belongs to nobody until it is signed.
    personId: null,
    kind: "connect",
    expiresAt: new Date(Date.now() + NONCE_TTL_MS),
  });
  return { nonce, message: signInMessage(nonce) };
}

export type SignInResult =
  | { ok: true; person: Person; sessionId: string; address: string }
  | { ok: false; reason: "nonce" | "signature" | "no-account" };

/**
 * Verify a signature over a challenge and open a session for the person
 * `chooseSignInTarget` names. `currentPersonId` is whoever this browser
 * already is (the session, or else the guest cookie).
 */
export async function signInWithWallet(
  nonce: string,
  signature: string,
  currentPersonId: string | undefined,
  client: ReturnType<typeof createSuiClient>,
): Promise<SignInResult> {
  const token = `challenge:${nonce}`;
  const [row] = await db
    .select()
    .from(connectTokens)
    .where(
      and(
        eq(connectTokens.token, token),
        isNull(connectTokens.usedAt),
        gt(connectTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row) return { ok: false, reason: "nonce" };

  // The address comes out of the signature. Nothing the caller sent names it.
  const address = await addressFromSignature(signInMessage(nonce), signature, client);
  if (!address) return { ok: false, reason: "signature" };

  // Burn the nonce before anything else, so a replay loses the race.
  const burned = await db
    .update(connectTokens)
    .set({ usedAt: new Date() })
    .where(and(eq(connectTokens.token, token), isNull(connectTokens.usedAt)))
    .returning({ token: connectTokens.token });
  if (burned.length === 0) return { ok: false, reason: "nonce" };

  const walletPerson = await personByWallet(address);
  const current = currentPersonId ? await reloadPerson(currentPersonId) : null;
  const both = Boolean(walletPerson && current && walletPerson.id !== current.id);
  const walletHasMemories =
    both && walletPerson ? (await personHasMemories(walletPerson.id)).hasMemories : false;
  const currentHasMemories =
    both && current ? (await personHasMemories(current.id)).hasMemories : false;
  const target = chooseSignInTarget({
    walletPersonId: walletPerson?.id ?? null,
    currentPersonId: current?.id ?? null,
    walletHasMemories,
    currentHasMemories,
  });

  const personId = await personIdFor(target, address);
  await attachWallet(personId, address);
  const person = await reloadPerson(personId);
  if (!person) return { ok: false, reason: "no-account" };

  const sessionId = randomBytes(32).toString("hex");
  await db.insert(webSessions).values({
    id: sessionId,
    personId: person.id,
    expiresAt: new Date(Date.now() + SESSION_TTL_MS),
  });
  return { ok: true, person, sessionId, address };
}

async function personIdFor(
  target: ReturnType<typeof chooseSignInTarget>,
  address: string,
): Promise<string> {
  switch (target.action) {
    case "use":
      return target.personId;
    case "merge":
      await mergePersons(target.winnerId, target.loserId);
      return target.winnerId;
    case "attach":
      return target.personId;
    case "create":
      return (await resolvePerson("wallet", address, address.slice(0, 10))).id;
    default: {
      const unexpected: never = target;
      throw new Error(`unexpected sign-in target ${JSON.stringify(unexpected)}`);
    }
  }
}

export async function personFromSession(sessionId: string): Promise<Person | null> {
  const [row] = await db
    .select()
    .from(webSessions)
    .where(and(eq(webSessions.id, sessionId), gt(webSessions.expiresAt, new Date())))
    .limit(1);
  if (!row) return null;
  return reloadPerson(row.personId);
}

export async function signOut(sessionId: string): Promise<void> {
  await db.delete(webSessions).where(eq(webSessions.id, sessionId));
}

async function personHasMemories(personId: string): Promise<{ hasMemories: boolean }> {
  const { memoryIndex } = await import("@remora/db");
  const [row] = await db
    .select({ id: memoryIndex.id })
    .from(memoryIndex)
    .where(eq(memoryIndex.personId, personId))
    .limit(1);
  return { hasMemories: Boolean(row) };
}

export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;
