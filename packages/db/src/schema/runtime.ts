/** Turns, conversations and messages: what the agent runtime and channels record. */
import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { people } from "./identity.ts";

/** Evidence: one row per turn, including which memories were injected. */
export const turnLog = pgTable(
  "turn_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    memoryEnabled: boolean("memory_enabled").notNull(),
    mode: text("mode").notNull(),
    model: text("model").notNull(),
    /** [{ blobId, distance, type }] */
    injected:
      jsonb("injected").$type<Array<{ blobId: string; distance: number; type: string | null }>>(),
    writes: integer("writes").notNull().default(0),
    promptTokens: integer("prompt_tokens"),
    completionTokens: integer("completion_tokens"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("turn_log_person_idx").on(t.personId, t.createdAt)],
);

/**
 * One thread of chat. Text is not stored here.
 *
 * A channel thread (Telegram, Discord, Slack, CLI) has one open row per
 * thread key. A gap closes it and the next message opens another, so a restart
 * does not look like a new session and a six-hour silence still does. Web
 * threads are explicit: the page picks the id, and reopening one does not
 * close it.
 */
export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    channel: text("channel").notNull(),
    threadKey: text("thread_key").notNull(),
    /** AES-256-GCM of the first user line, capped. Null until that line exists. */
    titleEnc: text("title_enc"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp("closed_at", { withTimezone: true }),
  },
  (t) => [
    index("conversations_person_updated_idx").on(t.personId, t.updatedAt),
    uniqueIndex("conversations_open_thread_idx")
      .on(t.personId, t.channel, t.threadKey)
      .where(sql`${t.closedAt} is null`),
  ],
);

/**
 * One line of a conversation. The body is encrypted. Memory text is not a
 * column here either: a recalled fact stays on Walrus, and this row is only
 * what the person and hippo actually said.
 */
export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    role: text("role", { enum: ["user", "assistant"] }).notNull(),
    /** turn goes to the model; command is shown and then left out of the prompt. */
    kind: text("kind", { enum: ["turn", "command"] }).notNull(),
    bodyEnc: text("body_enc").notNull(),
    /** Idempotency key from the web client. Absent on channel adapters. */
    clientId: text("client_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("messages_conversation_seq_idx").on(t.conversationId, t.seq),
    uniqueIndex("messages_client_id_idx")
      .on(t.conversationId, t.clientId)
      .where(sql`${t.clientId} is not null`),
    index("messages_conversation_seq_desc_idx").on(t.conversationId, t.seq),
  ],
);
