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

/**
 * D2: the durable job queue. Claimed with `FOR UPDATE SKIP LOCKED`; a failure re-queues with
 * exponential backoff until `max_attempts`, then the row is dead (the dead-letter state).
 * `idempotency_key` dedupes enqueues.
 */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").notNull(),
    payload: jsonb("payload").$type<unknown>().notNull(),
    idempotencyKey: text("idempotency_key").notNull(),
    status: text("status", { enum: ["queued", "running", "done", "dead"] })
      .notNull()
      .default("queued"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(8),
    runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
    lockedAt: timestamp("locked_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("jobs_idempotency_key_idx").on(t.idempotencyKey),
    index("jobs_ready_idx").on(t.status, t.runAt),
  ],
);

/**
 * B4: remora signing keys, envelope-encrypted (`@remora/signer`). Only the signer decrypts `sealed`;
 * nothing else reads it. One key per remora, and a remora lives on one network (ADR-0026).
 */
export const remoraKeys = pgTable(
  "remora_keys",
  {
    remoraId: text("remora_id").primaryKey(),
    network: text("network", { enum: ["testnet", "mainnet"] }).notNull(),
    address: text("address").notNull(),
    sealed: jsonb("sealed").$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    rotatedAt: timestamp("rotated_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("remora_keys_address_idx").on(t.address)],
);
