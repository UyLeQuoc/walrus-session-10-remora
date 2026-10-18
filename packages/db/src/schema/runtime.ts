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

const net = () => text("network", { enum: ["testnet", "mainnet"] }).notNull();

/**
 * B1/B3: a remora. Its key lives in `remora_keys` (B4), its money in its Disc (ADR-0025), its memory in
 * namespaces of the operator's Walrus Memory account until the mainnet pass (ADR-0030).
 */
export const remoras = pgTable(
  "remoras",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    ownerAddress: text("owner_address").notNull(),
    network: net(),
    template: text("template").notNull(),
    name: text("name").notNull(),
    /** `RemoraConfig` (packages/schema), minus status, which is its own column. */
    config: jsonb("config").$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: ["creating", "shadow", "active", "paused", "retired"] })
      .notNull()
      .default("creating"),
    /** The remora key's address (spender of its Disc). */
    address: text("address").notNull(),
    discName: text("disc_name"),
    discId: text("disc_id"),
    allowanceId: text("allowance_id"),
    capId: text("cap_id"),
    shadowUntil: timestamp("shadow_until", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("remoras_owner_idx").on(t.ownerAddress, t.network)],
);

/** N1: the activity feed, one row per thing a remora did or noticed; N19 feedback lands here. */
export const remoraEvents = pgTable(
  "remora_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    remoraId: uuid("remora_id")
      .notNull()
      .references(() => remoras.id, { onDelete: "cascade" }),
    network: net(),
    /** action | payment | ping | rule_learned | handoff | approval_needed | shadow | blocked | answer */
    type: text("type").notNull(),
    summary: text("summary").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
    /** The Wake (G1) behind it, if any. */
    receiptId: uuid("receipt_id"),
    feedback: text("feedback", { enum: ["useful", "noise"] }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("remora_events_remora_idx").on(t.remoraId, t.createdAt)],
);

/** N2/E4: what a remora asked its owner to decide. */
export const approvals = pgTable(
  "approvals",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    remoraId: uuid("remora_id")
      .notNull()
      .references(() => remoras.id, { onDelete: "cascade" }),
    network: net(),
    kind: text("kind", {
      enum: ["over_limit_payment", "budget_change", "rule_conflict", "template_update"],
    }).notNull(),
    summary: text("summary").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    status: text("status", { enum: ["pending", "approved", "rejected", "expired"] })
      .notNull()
      .default("pending"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
  },
  (t) => [index("approvals_remora_idx").on(t.remoraId, t.status)],
);

/** A7/H5: per-owner settings and notification policy. */
export const ownerSettings = pgTable("owner_settings", {
  ownerAddress: text("owner_address").primaryKey(),
  timezone: text("timezone").notNull().default("UTC"),
  /** "23:00"–"07:00": only urgent pings in between. */
  quietStart: text("quiet_start"),
  quietEnd: text("quiet_end"),
  language: text("language", { enum: ["en", "vi"] }).notNull().default("en"),
  /** all = every ping; important = urgent only, the rest in the digest; digest = digest only. */
  notify: text("notify", { enum: ["all", "important", "digest"] }).notNull().default("important"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * C2/F2: Sentinel's learned rules. Walrus Memory (`remora:…:rules`) is the durable, owned record; this
 * row is the fast copy triage reads on every event (spec §8: memory holds conclusions).
 */
export const sentinelRules = pgTable(
  "sentinel_rules",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    remoraId: uuid("remora_id")
      .notNull()
      .references(() => remoras.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    rule: jsonb("rule").$type<Record<string, unknown>>().notNull(),
    blobId: text("blob_id"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sentinel_rules_remora_idx").on(t.remoraId)],
);
