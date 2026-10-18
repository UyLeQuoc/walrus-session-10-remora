import type { TurnContext } from "@remora/core";
import {
  and,
  channelIdentities,
  conversations,
  delegateKeys,
  eq,
  isNotNull,
  isNull,
  memoryIndex,
  people,
  sql,
  turnLog,
} from "@remora/db";
import {
  createMemoryPort,
  decryptSecret,
  guestScope,
  type MemoryPort,
  ownedScope,
  type WriteEvent,
} from "@remora/memory";
import { isConversationTurn } from "../chat/turn-modes.ts";
import { db, operator } from "../context.ts";
import { env } from "../env/load.ts";
import { isUniqueViolation } from "../unique-violation.ts";
import { inheritedGuestIds } from "./predicates.ts";

export type Person = typeof people.$inferSelect;

/** Find or create the person behind a channel identity. */
export async function resolvePerson(
  channel: string,
  externalId: string,
  displayName?: string,
): Promise<Person> {
  const existing = await personByChannel(channel, externalId);
  if (existing) return existing;
  try {
    return await db.transaction(async (tx) => {
      const [person] = await tx.insert(people).values({ displayName }).returning();
      if (!person) throw new Error("failed to create person");
      await tx
        .insert(channelIdentities)
        .values({ personId: person.id, channel, externalId, displayName });
      return person;
    });
  } catch (err) {
    // Two first requests for one new identity (the web page loads several
    // /api/me routes at once) both miss the select above, and the loser's insert
    // hits channel_identity_unique. Its transaction rolled back, so no orphan
    // person is left; answer with the winner's.
    if (!isUniqueViolation(err)) throw err;
    const winner = await personByChannel(channel, externalId);
    if (!winner) throw err;
    return winner;
  }
}

/** A person's own rows in `memory_index`. */
export function ownMemoryOf(personId: string) {
  return eq(memoryIndex.personId, personId);
}

/**
 * Record every write in `memory_index` as it moves from accepted to stored or
 * failed, so a write that fails on Walrus is noticed after the person was told
 * "Added".
 */
function indexWrites(person: Person) {
  return async (e: WriteEvent) => {
    if (e.outcome === "duplicate") return;
    if (e.outcome === "accepted") {
      const [row] = await db
        .insert(memoryIndex)
        .values({
          personId: person.id,
          accountId: e.scope.accountId,
          namespace: e.scope.namespace,
          jobId: e.jobId,
          blobId: e.blobId,
          status: "pending",
          type: e.type,
          textSha256: e.textSha256,
          channel: e.channel,
        })
        .returning({ id: memoryIndex.id });
      return row?.id;
    }
    if (!e.jobId) return;
    await db
      .update(memoryIndex)
      .set({
        blobId: e.blobId,
        status: e.outcome,
        error: e.error ?? null,
        settledAt: new Date(),
      })
      .where(eq(memoryIndex.jobId, e.jobId));
  };
}

/** Guest or owned MemoryPort for a person, recording every write in memory_index. */
export async function portFor(
  person: Person,
  channel: string,
  opts: { includeHidden?: boolean } = {},
): Promise<MemoryPort> {
  const by = person.displayName ?? person.id.slice(0, 8);
  const onWrite = indexWrites(person);
  // The export reads hidden memories too: hiding stops hippo using a memory,
  // it does not make it stop being the person's.
  const hidden = opts.includeHidden ? new Set<string>() : await hiddenBlobs(person.id);
  if (person.mode === "owned" && person.accountId) {
    const [key] = await db
      .select()
      .from(delegateKeys)
      .where(and(eq(delegateKeys.personId, person.id), eq(delegateKeys.status, "active")))
      .limit(1);
    if (key?.privateKeyEnc) {
      const scope = ownedScope({
        key: decryptSecret(key.privateKeyEnc, env.KEY_ENCRYPTION_KEY),
        accountId: person.accountId,
        serverUrl: env.MEMWAL_SERVER_URL,
      });
      /**
       * Keep reading what this person told hippo before they owned anything.
       *
       * Those memories are in hippo's account under `hippo-guest:<id>` and
       * cannot be moved: a write is append-only, costs ~25 s each, and the
       * originals could never be deleted afterwards (docs/issues/09). So they
       * stay where they are and are read alongside the owned account. New
       * writes only ever go to the account the user owns.
       */
      return createMemoryPort({
        scope,
        by,
        channel,
        onWrite,
        alsoRead: [guestScope(operator, person.id), ...(await inheritedGuestScopes(person))],
        hidden,
      });
    }
  }
  return createMemoryPort({
    scope: guestScope(operator, person.id),
    by,
    channel,
    onWrite,
    alsoRead: await inheritedGuestScopes(person),
    hidden,
  });
}

/**
 * Whether this person has ever stored a correction. When they have not, the
 * corrections recall is skipped, which saves about a second on every turn for
 * most people (docs/evidence/latency-2026-09-24.md).
 */
export async function hasCorrections(personId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: memoryIndex.id })
    .from(memoryIndex)
    .where(and(ownMemoryOf(personId), eq(memoryIndex.type, "correction")))
    .limit(1);
  return Boolean(row);
}

export async function knownSoFar(personId: string): Promise<{ facts: number; turns: number }> {
  const [facts] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(memoryIndex)
    .where(and(ownMemoryOf(personId), sql`${memoryIndex.status} <> 'failed'`));
  const [turns] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(turnLog)
    .where(and(eq(turnLog.personId, personId), isConversationTurn));
  return { facts: facts?.n ?? 0, turns: turns?.n ?? 0 };
}

/** Blob ids this person asked hippo to stop using. */
export async function hiddenBlobs(personId: string): Promise<Set<string>> {
  const rows = await db
    .select({ blobId: memoryIndex.blobId })
    .from(memoryIndex)
    .where(and(ownMemoryOf(personId), isNotNull(memoryIndex.hiddenAt)));
  return new Set(rows.flatMap((r) => (r.blobId ? [r.blobId] : [])));
}

export type HideOutcome =
  | { kind: "done"; blobId: string; type: string }
  | { kind: "too-short" }
  | { kind: "none" }
  | { kind: "ambiguous"; count: number };

/**
 * Hide or unhide one of the person's own memories, named by the start of its
 * blob id, which is what `/memory` and `/memory search` show.
 *
 * Six characters at least: a blob id is 43, and a prefix short enough to match
 * several memories must never silently pick one.
 */
export async function setHidden(
  personId: string,
  blobPrefix: string,
  hide: boolean,
): Promise<HideOutcome> {
  // What /memory prints ends in "…"; accept it pasted as shown.
  const prefix = blobPrefix.trim().replace(/…$/, "");
  if (prefix.length < 6 || !/^[A-Za-z0-9_-]+$/.test(prefix)) return { kind: "too-short" };
  // An exact prefix, not LIKE: blob ids contain "_", which LIKE reads as "any
  // character", so a LIKE match could hide a memory the person did not name.
  const rows = await db
    .select({ id: memoryIndex.id, blobId: memoryIndex.blobId, type: memoryIndex.type })
    .from(memoryIndex)
    .where(
      and(ownMemoryOf(personId), sql`left(${memoryIndex.blobId}, ${prefix.length}) = ${prefix}`),
    );
  const [row] = rows;
  if (!row?.blobId) return { kind: "none" };
  if (rows.length > 1) return { kind: "ambiguous", count: rows.length };
  await db
    .update(memoryIndex)
    .set({ hiddenAt: hide ? new Date() : null })
    .where(eq(memoryIndex.id, row.id));
  return { kind: "done", blobId: row.blobId, type: row.type };
}

/**
 * Guest namespaces a merge left in this person's own rows. Read alongside, so a
 * `/connect` that folds one person into another does not orphan what the folded
 * one said; `forget all` forgets them too. See `inheritedGuestIds`.
 */
export async function inheritedGuestScopes(person: Person) {
  const rows = await db
    .selectDistinct({ namespace: memoryIndex.namespace })
    .from(memoryIndex)
    .where(ownMemoryOf(person.id));
  return inheritedGuestIds(
    person.id,
    rows.map((r) => r.namespace),
  ).map((id) => guestScope(operator, id));
}

export async function logTurn(
  person: Person,
  channel: string,
  ctx: TurnContext,
  writes: number,
  modelId: string,
) {
  await db.insert(turnLog).values({
    personId: person.id,
    channel,
    memoryEnabled: person.memoryEnabled,
    mode: person.mode,
    model: modelId,
    injected: ctx.injected.map((m) => ({
      blobId: m.blob_id,
      distance: m.distance,
      type: m.parsed?.type ?? null,
    })),
    writes,
  });
}

/**
 * Fold `loser` into `winner`: identities, delegate keys, memory index rows and
 * turn history all move across, then the empty person is deleted.
 *
 * This is what makes one human on Telegram, the web and the CLI a single memory
 * rather than three. It is deliberately additive: nothing on Walrus is touched,
 * only the mapping from channel identities to a person.
 */
export async function mergePersons(winnerId: string, loserId: string): Promise<void> {
  if (winnerId === loserId) return;
  await db.transaction(async (tx) => {
    await tx
      .update(channelIdentities)
      .set({ personId: winnerId })
      .where(eq(channelIdentities.personId, loserId));
    await tx
      .update(delegateKeys)
      .set({ personId: winnerId })
      .where(eq(delegateKeys.personId, loserId));
    await tx
      .update(memoryIndex)
      .set({ personId: winnerId })
      .where(eq(memoryIndex.personId, loserId));
    await tx.update(turnLog).set({ personId: winnerId }).where(eq(turnLog.personId, loserId));
    // An open thread is unique per person, channel and key. Close only the
    // loser's open threads that would collide, then move the rest across.
    const winnerOpen = await tx
      .select({ channel: conversations.channel, threadKey: conversations.threadKey })
      .from(conversations)
      .where(and(eq(conversations.personId, winnerId), isNull(conversations.closedAt)));
    for (const row of winnerOpen) {
      await tx
        .update(conversations)
        .set({ closedAt: new Date() })
        .where(
          and(
            eq(conversations.personId, loserId),
            eq(conversations.channel, row.channel),
            eq(conversations.threadKey, row.threadKey),
            isNull(conversations.closedAt),
          ),
        );
    }
    await tx
      .update(conversations)
      .set({ personId: winnerId })
      .where(eq(conversations.personId, loserId));
    await tx.delete(people).where(eq(people.id, loserId));
  });
}

/** The person behind a channel identity, if one exists. Does not create one. */
export async function personByChannel(channel: string, externalId: string): Promise<Person | null> {
  const [row] = await db
    .select({ person: people })
    .from(channelIdentities)
    .innerJoin(people, eq(people.id, channelIdentities.personId))
    .where(
      and(eq(channelIdentities.channel, channel), eq(channelIdentities.externalId, externalId)),
    )
    .limit(1);
  return row?.person ?? null;
}

/** The person that owns a wallet, if any. */
export async function personByWallet(walletAddress: string): Promise<Person | null> {
  return personByChannel("wallet", walletAddress.toLowerCase());
}

/** Record that this person controls `address`, without minting a second person. */
export async function attachWallet(personId: string, address: string): Promise<void> {
  const externalId = address.toLowerCase();
  await db
    .insert(channelIdentities)
    .values({ personId, channel: "wallet", externalId, displayName: externalId.slice(0, 10) })
    .onConflictDoNothing();
  await db.update(people).set({ walletAddress: externalId }).where(eq(people.id, personId));
}

export async function reloadPerson(personId: string): Promise<Person | null> {
  const [row] = await db.select().from(people).where(eq(people.id, personId)).limit(1);
  return row ?? null;
}
