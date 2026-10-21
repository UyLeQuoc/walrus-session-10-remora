/**
 * Rooms (ADR-0042): several of an owner's remoras in one chat. An owner line goes to the remoras it
 * `@mentions`, then `@everyone`, then a deterministic signal (a rule phrase → Sentinel, an object id,
 * odds or a summary → Scout), then in `auto` the small decision model (used at p ≥ 0.6), then the lead.
 */
import { z } from "zod";
import { FEED_TYPES } from "./api.ts";
import { IsoDateTime } from "./common.ts";
import { Network } from "./network.ts";

export const RoomResponder = z.enum(["mentions", "lead", "auto"]);

/** How an owner line found who answers it. */
export const RoomRoute = z.enum(["mention", "everyone", "signal", "auto", "lead", "none"]);

export const Room = z.object({
  id: z.uuid(),
  ownerAddress: z.string().min(1),
  network: Network,
  name: z.string().min(1).max(40),
  responder: RoomResponder,
  /** Answers what nothing else routes; null means the first member. */
  leadId: z.uuid().nullable(),
  memberIds: z.array(z.uuid()),
  /** The Team room every owner gets; it always holds every live remora. */
  isDefault: z.boolean(),
  createdAt: IsoDateTime,
});

export const RoomMessage = z.object({
  id: z.uuid(),
  roomId: z.uuid(),
  author: z.enum(["owner", "remora", "system"]),
  /** For remora lines: who said it. */
  remoraId: z.uuid().nullable(),
  remora: z.string().nullable(),
  text: z.string(),
  /** For owner lines: who was asked to answer, and how they were found. */
  routedTo: z.array(z.uuid()),
  route: RoomRoute.nullable(),
  /** The remora event a remora line mirrors, for Why? and inline approval cards. */
  eventId: z.uuid().nullable(),
  eventType: z.enum(FEED_TYPES).nullable(),
  payload: z.record(z.string(), z.unknown()),
  /** The owner line a remora line answers. */
  replyTo: z.uuid().nullable(),
  createdAt: IsoDateTime,
});

export type RoomResponder = z.infer<typeof RoomResponder>;
export type RoomRoute = z.infer<typeof RoomRoute>;
export type Room = z.infer<typeof Room>;
export type RoomMessage = z.infer<typeof RoomMessage>;
