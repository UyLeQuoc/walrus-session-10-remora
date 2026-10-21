/**
 * Rooms (ADR-0042): several of an owner's remoras in one chat, the Grok-bots shape. An owner line
 * goes, in order, to:
 * 1. the remoras it `@mentions` (or `@everyone`);
 * 2. a deterministic signal: a rule phrase → Sentinel; an object id, odds or a summary → Scout;
 * 3. in `auto`, the small decision model, used only at p ≥ 0.6;
 * 4. the lead.
 * Each routed remora runs its own path (Disc, Sonar, Wakes untouched), and its events come back into
 * the room as lines linked to them. Sentinel pings land in the owner's default Team room too.
 */
import type { SuiNetwork } from "@remora/chain";
import {
  and,
  asc,
  eq,
  gt,
  inArray,
  remoraEvents,
  remoras,
  roomMessages,
  rooms,
  sql,
} from "@remora/db";
import type { RoomResponder, RoomRoute } from "@remora/schema";
import type { RuntimeDeps } from "./deps.ts";
import { type Remora, RemoraError } from "./remoras.ts";
import { parseRule } from "./rules.ts";
import { planBuys } from "./scout.ts";
import { runRemora, withApprovalState } from "./threads.ts";

export type Room = typeof rooms.$inferSelect;
const LIVE = ["shadow", "active", "paused"] as const;
/** Below this the decision model's pick is ignored and the lead answers. */
export const AUTO_THRESHOLD = 0.6;

const liveRemoras = (db: RuntimeDeps["db"], owner: string, network: SuiNetwork) =>
  db
    .select()
    .from(remoras)
    .where(
      and(
        eq(remoras.ownerAddress, owner),
        eq(remoras.network, network),
        inArray(remoras.status, [...LIVE]),
      ),
    );

/** The owner's Team room on this network, created on first use. */
export async function defaultRoom(db: RuntimeDeps["db"], owner: string, network: SuiNetwork) {
  const [existing] = await db
    .select()
    .from(rooms)
    .where(
      and(eq(rooms.ownerAddress, owner), eq(rooms.network, network), eq(rooms.isDefault, true)),
    );
  if (existing) return existing;
  const [made] = await db
    .insert(rooms)
    .values({ ownerAddress: owner, network, name: "Team", responder: "auto", isDefault: true })
    .onConflictDoNothing()
    .returning();
  if (made) return made;
  const [raced] = await db
    .select()
    .from(rooms)
    .where(
      and(eq(rooms.ownerAddress, owner), eq(rooms.network, network), eq(rooms.isDefault, true)),
    );
  if (!raced) throw new RemoraError("room.create_failed", "Couldn't open the Team room.");
  return raced;
}

/** A room's members right now: every live remora for the Team room, else its list, still live. */
export async function membersOf(db: RuntimeDeps["db"], room: Room): Promise<Remora[]> {
  const live = await liveRemoras(db, room.ownerAddress, room.network);
  return room.isDefault ? live : live.filter((r) => room.memberIds.includes(r.id));
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Who an owner line goes to, and how they were found (deterministic steps only). */
export function routeByText(
  text: string,
  members: Remora[],
  reef: Parameters<typeof planBuys>[1],
  leadId?: string | null,
): { ids: string[]; route: RoomRoute } | null {
  if (/(^|\s)@everyone\b/i.test(text)) return { ids: members.map((m) => m.id), route: "everyone" };
  // Longest names first, so "@Scout two" isn't read as "@Scout".
  const byName = [...members].sort((a, b) => b.name.length - a.name.length);
  const mentioned: string[] = [];
  let rest = text;
  for (const m of byName) {
    const re = new RegExp(`(^|\\s)@${escapeRe(m.name)}(?=$|[\\s,.:;!?])`, "i");
    if (re.test(rest)) {
      mentioned.push(m.id);
      rest = rest.replace(re, " ");
    }
  }
  if (mentioned.length) return { ids: mentioned, route: "mention" };
  const sentinel = pick(members, "sentinel", leadId);
  if (sentinel && parseRule(text)) return { ids: [sentinel.id], route: "signal" };
  const scout = pick(members, "scout", leadId);
  if (scout && planBuys(text, reef).length) return { ids: [scout.id], route: "signal" };
  return null;
}

/** Of several remoras of one template, the room's lead, else the newest. */
function pick(members: Remora[], template: string, leadId?: string | null) {
  const of = members.filter((m) => m.template === template);
  return (
    of.find((m) => m.id === leadId) ??
    [...of].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]
  );
}

/** The line without its @mentions, which is what a remora is asked. */
export const withoutMentions = (text: string, members: Remora[]) =>
  members
    .reduce(
      (t, m) => t.replace(new RegExp(`(^|\\s)@${escapeRe(m.name)}(?=$|[\\s,.:;!?])`, "gi"), " "),
      text.replace(/(^|\s)@everyone\b/gi, " "),
    )
    .replace(/\s+/g, " ")
    .trim();

/** Routes a line through every step, the decision model included. */
export async function route(
  deps: Pick<RuntimeDeps, "brain" | "reef" | "log">,
  room: Room,
  members: Remora[],
  text: string,
): Promise<{ ids: string[]; route: RoomRoute }> {
  if (!members.length) return { ids: [], route: "none" };
  const found = routeByText(text, members, deps.reef(room.network), room.leadId);
  if (found) return found;
  if (room.responder === "mentions") return { ids: [], route: "none" };
  if (room.responder === "auto" && deps.brain.route) {
    const pick = await deps.brain
      .route({
        text,
        candidates: members.map((m) => ({
          id: m.id,
          name: m.name,
          summary: `${m.template}: ${String((m.config as { persona?: string }).persona ?? "").slice(0, 200)}`,
        })),
      })
      .catch((err) => {
        deps.log.warn("room.route_failed", { room: room.id, error: err });
        return { id: null, p: 0 };
      });
    if (pick.id && pick.p >= AUTO_THRESHOLD) return { ids: [pick.id], route: "auto" };
  }
  const lead = members.find((m) => m.id === room.leadId) ?? members[0];
  return { ids: lead ? [lead.id] : [], route: "lead" };
}

/** Puts one remora event into a room as that remora's line. */
async function mirror(
  db: RuntimeDeps["db"],
  roomId: string,
  r: Pick<Remora, "id">,
  eventId: string,
  replyTo: string | null,
) {
  const [e] = await db.select().from(remoraEvents).where(eq(remoraEvents.id, eventId));
  if (!e) return null;
  const text =
    e.type === "answer"
      ? String((e.payload as { answer?: string }).answer ?? e.summary)
      : e.summary;
  const [line] = await db
    .insert(roomMessages)
    .values({ roomId, author: "remora", remoraId: r.id, text, eventId, replyTo })
    .returning();
  return line ?? null;
}

/** The owner's line in a room: routed, answered by each remora in turn, mirrored back. */
export async function postToRoom(deps: RuntimeDeps, room: Room, text: string) {
  const members = await membersOf(deps.db, room);
  const routed = await route(deps, room, members, text);
  const [line] = await deps.db
    .insert(roomMessages)
    .values({ roomId: room.id, author: "owner", text, routedTo: routed.ids, route: routed.route })
    .returning();
  if (!line) throw new RemoraError("room.post_failed", "Couldn't post that.");
  const question = withoutMentions(text, members) || text;
  const replies: string[] = [];
  for (const id of routed.ids) {
    const r = members.find((m) => m.id === id);
    if (!r) continue;
    try {
      const out = await runRemora(deps, r, question, { kind: "message", ref: `room:${room.id}` });
      for (const eventId of out.eventIds) {
        const m = await mirror(deps.db, room.id, r, eventId, line.id);
        if (m) replies.push(m.id);
      }
    } catch (err) {
      deps.log.warn("room.remora_failed", { room: room.id, remora: r.id, error: err });
      const message = err instanceof RemoraError ? err.message : "Something went wrong.";
      const [sys] = await deps.db
        .insert(roomMessages)
        .values({
          roomId: room.id,
          author: "system",
          remoraId: r.id,
          text: `${r.name}: ${message}`,
          replyTo: line.id,
        })
        .returning();
      if (sys) replies.push(sys.id);
    }
  }
  return { messageId: line.id, routedTo: routed.ids, route: routed.route, replies };
}

/** A remora's own event (a Sentinel ping) posted to the owner's Team room. */
export async function postToTeam(deps: Pick<RuntimeDeps, "db">, r: Remora, eventId: string) {
  const room = await defaultRoom(deps.db, r.ownerAddress, r.network);
  return mirror(deps.db, room.id, r, eventId, null);
}

/** A room's lines, oldest first, with the event type and payload (approval state included). */
export async function roomLines(db: RuntimeDeps["db"], room: Room, after?: Date) {
  const rows = await db
    .select({ m: roomMessages, e: remoraEvents, name: remoras.name })
    .from(roomMessages)
    .leftJoin(remoraEvents, eq(remoraEvents.id, roomMessages.eventId))
    .leftJoin(remoras, eq(remoras.id, roomMessages.remoraId))
    .where(
      and(eq(roomMessages.roomId, room.id), ...(after ? [gt(roomMessages.createdAt, after)] : [])),
    )
    .orderBy(asc(roomMessages.createdAt))
    .limit(300);
  const withState = await withApprovalState(
    db,
    rows.map((x) => ({
      ...x,
      type: x.e?.type ?? "",
      payload: (x.e?.payload ?? {}) as Record<string, unknown>,
    })),
  );
  return withState.map((x) => ({
    id: x.m.id,
    roomId: x.m.roomId,
    author: x.m.author,
    remoraId: x.m.remoraId,
    remora: x.name ?? null,
    text: x.m.text,
    routedTo: x.m.routedTo,
    route: x.m.route,
    eventId: x.m.eventId,
    eventType: x.e?.type ?? null,
    payload: x.payload,
    replyTo: x.m.replyTo,
    createdAt: x.m.createdAt,
  }));
}

/** The API shape of a room (`Room` in packages/schema): members are computed for the Team room. */
export async function roomView(db: RuntimeDeps["db"], room: Room) {
  const members = await membersOf(db, room);
  return { ...room, memberIds: members.map((m) => m.id) };
}

export const RESPONDERS: RoomResponder[] = ["mentions", "lead", "auto"];

/**
 * After the owner decides an approval from a room's card, the payment and the answer appear in that
 * room under the card (ADR-0042). Rooms without the card are left alone.
 */
export async function followUpInRooms(
  db: RuntimeDeps["db"],
  approvalId: string,
  eventIds: string[],
) {
  if (!eventIds.length) return [];
  const cards = await db
    .select({ id: remoraEvents.id, remoraId: remoraEvents.remoraId })
    .from(remoraEvents)
    .where(
      and(
        eq(remoraEvents.type, "approval_needed"),
        sql`${remoraEvents.payload}->>'approvalId' = ${approvalId}`,
      ),
    );
  const out: string[] = [];
  for (const card of cards) {
    const lines = await db.select().from(roomMessages).where(eq(roomMessages.eventId, card.id));
    for (const line of lines) {
      for (const eventId of eventIds) {
        const m = await mirror(db, line.roomId, { id: card.remoraId }, eventId, line.replyTo);
        if (m) out.push(m.id);
      }
    }
  }
  return out;
}
