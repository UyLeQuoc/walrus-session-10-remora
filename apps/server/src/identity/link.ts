/**
 * Channel linking without a wallet.
 *
 * "One memory across every channel" is the promise, and requiring a Sui wallet
 * to prove two chat accounts are the same person would put a wallet in front of
 * the feature for everyone. Instead a person asks for a short code on one
 * channel and types it on another, within ten minutes. The code is single use
 * and proves possession of both conversations, which is exactly the claim.
 *
 * Wallet sign-in does the same merge through a stronger proof; see
 * routes/connect.ts.
 */
import { randomInt } from "node:crypto";
import { and, connectTokens, eq, gt, isNull, memoryIndex } from "@remora/db";
import { db } from "../context.ts";
import { mergePersons, type Person } from "./persons.ts";

const TTL_MS = 10 * 60 * 1000;
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no I, L, O, 0, 1

function makeCode(): string {
  let out = "";
  for (let i = 0; i < 6; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

export async function createLinkCode(
  person: Person,
): Promise<{ code: string; expiresInMinutes: number }> {
  const code = makeCode();
  await db.insert(connectTokens).values({
    token: `link:${code}`,
    personId: person.id,
    kind: "connect",
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  return { code, expiresInMinutes: Math.round(TTL_MS / 60_000) };
}

export type LinkOutcome =
  | { ok: true; alreadyLinked: boolean }
  | { ok: false; reason: "unknown" | "expired" | "self" | "redeemer-has-memories" };

/**
 * Redeem a code issued on another channel. The person who asked for the code
 * wins the merge, so memories already attached to that identity keep their
 * person id and nothing has to move on Walrus.
 */
export async function redeemLinkCode(current: Person, rawCode: string): Promise<LinkOutcome> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z2-9]{6}$/.test(code)) return { ok: false, reason: "unknown" };

  const [row] = await db
    .select()
    .from(connectTokens)
    .where(
      and(
        eq(connectTokens.token, `link:${code}`),
        isNull(connectTokens.usedAt),
        gt(connectTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  if (!row?.personId) return { ok: false, reason: "expired" };
  if (row.personId === current.id) return { ok: false, reason: "self" };

  /**
   * Redeeming folds this identity into the one that issued the code, so the
   * redeemer gives up their person. That is exactly right when a new channel
   * joins an existing memory, and exactly wrong if someone is talked into
   * redeeming a stranger's code: they would hand over everything.
   *
   * Requiring the redeeming side to be empty removes the damage. The real use
   * case is always a fresh channel, and anyone with memories on both sides can
   * run /link from the other direction.
   */
  const [existing] = await db
    .select({ id: memoryIndex.id })
    .from(memoryIndex)
    .where(eq(memoryIndex.personId, current.id))
    .limit(1);
  if (existing) return { ok: false, reason: "redeemer-has-memories" };

  await mergePersons(row.personId, current.id);
  await db
    .update(connectTokens)
    .set({ usedAt: new Date() })
    .where(eq(connectTokens.token, row.token));
  return { ok: true, alreadyLinked: false };
}
