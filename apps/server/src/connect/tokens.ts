/**
 * Connect-token plumbing. A person starts the owned-mode flow on any channel;
 * the token carries them to the web page where their wallet signs
 * add_delegate_key (or remove_delegate_key) against their own MemWalAccount.
 */
import { randomBytes } from "node:crypto";
import { and, connectTokens, delegateKeys, eq, gt, isNotNull, isNull } from "@remora/db";
import { encryptSecret, generateDelegate } from "@remora/memory";
import { db } from "../context.ts";
import { env } from "../env/load.ts";
import type { Person } from "../identity/persons.ts";

const TOKEN_TTL_MS = 10 * 60 * 1000;

export interface StartedConnect {
  token: string;
  url: string;
  publicKeyHex: string;
  label: string;
}

/**
 * Mint a delegate keypair for this person and a single-use token for the page.
 * The private key is encrypted at rest and never leaves the server; only the
 * public key travels to the browser, which registers it on-chain.
 */
export async function startConnect(
  person: Person,
  channel: string,
  handle: string,
): Promise<StartedConnect> {
  const delegate = await generateDelegate();
  const label = `hippo (${channel}:${handle})`.slice(0, 64);
  const token = randomBytes(32).toString("hex");

  await db.transaction(async (tx) => {
    const [key] = await tx
      .insert(delegateKeys)
      .values({
        personId: person.id,
        publicKeyHex: delegate.publicKeyHex,
        privateKeyEnc: encryptSecret(delegate.privateKeyHex, env.KEY_ENCRYPTION_KEY),
        label,
        status: "pending",
      })
      .returning();
    if (!key) throw new Error("failed to store the delegate key");
    await tx.insert(connectTokens).values({
      token,
      personId: person.id,
      kind: "connect",
      delegateKeyId: key.id,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    });
  });

  return {
    token,
    url: `${env.WEB_BASE_URL}/connect/${token}`,
    publicKeyHex: delegate.publicKeyHex,
    label,
  };
}

export async function startDisconnect(person: Person): Promise<StartedConnect> {
  const [key] = await db
    .select()
    .from(delegateKeys)
    .where(and(eq(delegateKeys.personId, person.id), eq(delegateKeys.status, "active")))
    .limit(1);
  if (!key) throw new Error("no active delegate key to revoke");
  const token = randomBytes(32).toString("hex");
  await db.insert(connectTokens).values({
    token,
    personId: person.id,
    kind: "disconnect",
    delegateKeyId: key.id,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return {
    token,
    url: `${env.WEB_BASE_URL}/disconnect/${token}`,
    publicKeyHex: key.publicKeyHex,
    label: key.label,
  };
}

/**
 * A connect or disconnect token, which always carries a person. Sign-in
 * challenges share the table but have no person, so they are filtered out here:
 * a challenge nonce must never be usable as a connect token.
 */
export async function loadToken(token: string) {
  const [row] = await db
    .select()
    .from(connectTokens)
    .where(
      and(
        eq(connectTokens.token, token),
        isNull(connectTokens.usedAt),
        gt(connectTokens.expiresAt, new Date()),
        isNotNull(connectTokens.personId),
      ),
    )
    .limit(1);
  if (!row?.personId) return null;
  return { ...row, personId: row.personId };
}
