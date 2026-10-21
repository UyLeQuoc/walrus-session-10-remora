/**
 * One shape for a chat line (ADR-0042), whether it comes from a remora's feed (1-1 thread) or a
 * room. The owner's words, a remora's answer, and the events around it (payments, blocks, pings,
 * learned rules, approval cards) all render from this.
 */
import type { FeedItem, FeedType, RoomMessage } from "@remora/schema";
import { describeItem } from "@/features/remoras/feed-list";

export interface Line {
  id: string;
  author: "owner" | "remora" | "system";
  remora: string | null;
  type: FeedType | null;
  text: string;
  payload: Record<string, unknown>;
  /** The remora event behind it, for Why? and feedback. */
  eventId: string | null;
  feedback: "useful" | "noise" | null;
  createdAt: string;
  /** Rooms: who an owner line was routed to, and how. */
  routedTo?: string[];
  route?: string | null;
}

/** Event types shown as a chip under the conversation rather than a bubble. */
export const CHIP_TYPES: FeedType[] = [
  "payment",
  "blocked",
  "shadow",
  "rule_learned",
  "episode",
  "action",
  "handoff",
  "config_changed",
];

/** Events that have a Wake to open from Why?. */
export const WHY_TYPES: FeedType[] = [
  "answer",
  "payment",
  "blocked",
  "shadow",
  "ping",
  "episode",
  "approval_needed",
];

export function lineFromFeed(e: FeedItem): Line {
  const p = e.payload as { text?: string; answer?: string };
  return {
    id: e.id,
    author: e.type === "message" ? "owner" : "remora",
    remora: e.remora,
    type: e.type,
    text:
      e.type === "message"
        ? String(p.text ?? e.summary)
        : e.type === "answer"
          ? String(p.answer ?? e.summary)
          : describeItem(e),
    payload: e.payload,
    eventId: e.type === "message" ? null : e.id,
    feedback: e.feedback,
    createdAt: e.createdAt,
  };
}

export function lineFromRoom(m: RoomMessage): Line {
  const fake = {
    id: m.eventId ?? m.id,
    remoraId: m.remoraId ?? "",
    remora: m.remora ?? "",
    network: "testnet" as const,
    type: m.eventType ?? "action",
    summary: m.text,
    payload: m.payload,
    receiptId: null,
    feedback: null,
    createdAt: m.createdAt,
  } satisfies FeedItem;
  return {
    id: m.id,
    author: m.author,
    remora: m.remora,
    type: m.eventType,
    text:
      m.author === "remora" && m.eventType && m.eventType !== "answer"
        ? describeItem(fake)
        : m.text,
    payload: m.payload,
    eventId: m.eventId,
    feedback: null,
    createdAt: m.createdAt,
    routedTo: m.routedTo,
    route: m.route,
  };
}
