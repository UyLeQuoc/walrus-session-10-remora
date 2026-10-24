/**
 * Picks (RC2, ADR-0061): refused at or after lock, hashed into a leaf, written to memory, and anchored
 * on Sui in the next batch, or straight away when the event is about to lock.
 */
import { randomUUID } from "node:crypto";
import { and, asc, eq, isNull } from "drizzle-orm";
import type { Anchorer } from "./chain.ts";
import { anchors, type Db, events, members, picks } from "./db/index.ts";
import { type Chip, nudgeFor } from "./learn.ts";
import { parseConfidence, pct, type Side } from "./markets.ts";
import { ns, type ReceiptsMemory } from "./memory.ts";
import { buildTree, leafHash, type PickLeaf, type ProofStep } from "./merkle.ts";

export class PickError extends Error {
  constructor(
    readonly code: "locked" | "not_found" | "bad_confidence" | "duplicate" | "not_member",
    message: string,
  ) {
    super(message);
  }
}

/** A pick on an event that locks this soon is anchored at once, so its receipt predates the lock. */
export const ANCHOR_BEFORE_LOCK_MS = 3 * 60_000;

export interface PickDeps {
  db: Db;
  memory: ReceiptsMemory | null;
  anchorer: Anchorer | null;
  log?: (msg: string, data?: Record<string, unknown>) => void;
}

export interface PickInput {
  groupId: string;
  memberId: string;
  eventId: string;
  side: Side;
  confidence: number | string;
  note?: string;
  now?: Date;
}

export async function logPick(deps: PickDeps, input: PickInput) {
  const { db } = deps;
  const now = input.now ?? new Date();
  const [event] = await db.select().from(events).where(eq(events.id, input.eventId));
  if (!event) throw new PickError("not_found", "No such event.");
  if (now.getTime() >= event.startsAt.getTime() || event.status !== "scheduled") {
    const ago = Math.max(0, Math.round((now.getTime() - event.startsAt.getTime()) / 60_000));
    throw new PickError(
      "locked",
      `Locked at ${event.startsAt.toISOString().slice(11, 16)} UTC${ago ? `, ${ago} min ago` : ""}. Picks close when the event starts.`,
    );
  }
  const [member] = await db
    .select()
    .from(members)
    .where(and(eq(members.id, input.memberId), eq(members.groupId, input.groupId)));
  if (!member) throw new PickError("not_member", "That member isn't in this group.");
  const confidence = parseConfidence(input.confidence);
  if (confidence === null) throw new PickError("bad_confidence", "Confidence is 50–99%.");

  const id = randomUUID();
  const leaf: PickLeaf = {
    id,
    groupId: input.groupId,
    memberId: input.memberId,
    eventId: event.id,
    side: input.side,
    confidence,
    createdAt: now.toISOString(),
  };
  const row = {
    ...leaf,
    createdAt: now,
    leaf: leafHash(leaf),
    note: input.note?.slice(0, 200) ?? null,
  };
  try {
    await db.insert(picks).values(row);
  } catch (err) {
    if (String((err as { cause?: unknown }).cause ?? err).includes("picks_one_per_member")) {
      throw new PickError("duplicate", "You already picked this one.");
    }
    throw err;
  }

  const sideLabel = input.side === "yes" ? event.yesLabel : event.noLabel;
  if (deps.memory) {
    const text = `PICK member=${member.id}${member.test ? " (test)" : ""} event=${event.id} "${event.title}" side=${input.side} (${sideLabel}) confidence=${confidence.toFixed(2)} at=${now.toISOString()} leaf=${row.leaf}`;
    deps.memory
      .remember(ns.picks(input.groupId), "episode", text)
      .catch((err) => deps.log?.("pick.memory_failed", { id, error: String(err) }));
  }
  if (deps.anchorer && event.startsAt.getTime() - now.getTime() <= ANCHOR_BEFORE_LOCK_MS) {
    anchorPending(deps).catch((err) => deps.log?.("anchor.failed", { error: String(err) }));
  }
  let nudge: Chip | null = null;
  if (deps.memory) {
    nudge = await nudgeFor(deps.memory, member.id, event.league, confidence).catch(() => null);
  }
  return {
    pick: { ...row, sideLabel, confidenceLabel: pct(confidence) },
    event,
    member,
    nudge,
  };
}

let anchoring: Promise<unknown> | null = null;

/**
 * One batch at a time: every unanchored pick, oldest first, in one root. `onlyGroup` exists for
 * tests that share the dev database with a running server.
 */
export async function anchorPending(
  deps: Pick<PickDeps, "db" | "anchorer" | "log">,
  onlyGroup?: string,
) {
  if (!deps.anchorer) return null;
  if (anchoring) await anchoring.catch(() => {});
  const run = (async () => {
    const pending = await deps.db
      .select()
      .from(picks)
      .where(
        onlyGroup
          ? and(isNull(picks.anchorId), eq(picks.groupId, onlyGroup))
          : isNull(picks.anchorId),
      )
      .orderBy(asc(picks.createdAt), asc(picks.id))
      .limit(512);
    if (!pending.length) return null;
    const { root } = buildTree(pending.map((p) => p.leaf));
    const id = randomUUID();
    try {
      const { digest, tsMs } = await (deps.anchorer as Anchorer).anchor(root, pending.length);
      await deps.db.transaction(async (tx) => {
        await tx
          .insert(anchors)
          .values({ id, root, count: pending.length, digest, tsMs: String(tsMs) });
        for (const [i, p] of pending.entries()) {
          await tx.update(picks).set({ anchorId: id, leafIndex: i }).where(eq(picks.id, p.id));
        }
      });
      deps.log?.("anchor.sent", { digest, count: pending.length, root });
      return { id, root, digest, tsMs, count: pending.length };
    } catch (err) {
      await deps.db.insert(anchors).values({ id, root, count: pending.length, error: String(err) });
      throw err;
    }
  })();
  anchoring = run;
  try {
    return await run;
  } finally {
    if (anchoring === run) anchoring = null;
  }
}

export interface Receipt {
  pick: PickLeaf;
  leaf: string;
  proof: ProofStep[];
  anchor: { digest: string; root: string; network: string } | null;
  event: { id: string; title: string; locksAt: string };
}

/** The portable receipt: everything a stranger needs to check the pick against the chain. */
export async function receiptFor(db: Db, pickId: string): Promise<Receipt | null> {
  const [p] = await db.select().from(picks).where(eq(picks.id, pickId));
  if (!p) return null;
  const [event] = await db.select().from(events).where(eq(events.id, p.eventId));
  if (!event) return null;
  const pick: PickLeaf = {
    id: p.id,
    groupId: p.groupId,
    memberId: p.memberId,
    eventId: p.eventId,
    side: p.side,
    confidence: p.confidence,
    createdAt: p.createdAt.toISOString(),
  };
  const base = {
    pick,
    leaf: p.leaf,
    event: { id: event.id, title: event.title, locksAt: event.startsAt.toISOString() },
  };
  if (!p.anchorId) return { ...base, proof: [], anchor: null };
  const [a] = await db.select().from(anchors).where(eq(anchors.id, p.anchorId));
  const batch = await db
    .select({ leaf: picks.leaf, leafIndex: picks.leafIndex })
    .from(picks)
    .where(eq(picks.anchorId, p.anchorId))
    .orderBy(asc(picks.leafIndex));
  const { proofs } = buildTree(batch.map((b) => b.leaf));
  return {
    ...base,
    proof: proofs[p.leafIndex ?? 0] ?? [],
    anchor: a?.digest ? { digest: a.digest, root: a.root, network: a.network } : null,
  };
}
