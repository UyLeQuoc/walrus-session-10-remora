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

/** The unit of memory. One person can have many channel identities. */
export const people = pgTable("people", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** guest = memory under the operator account; owned = the person's own MemWalAccount */
  mode: text("mode", { enum: ["guest", "owned"] })
    .notNull()
    .default("guest"),
  accountId: text("account_id"),
  walletAddress: text("wallet_address"),
  memoryEnabled: boolean("memory_enabled").notNull().default(true),
  displayName: text("display_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const channelIdentities = pgTable(
  "channel_identities",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    /** telegram | discord | slack | web | cli | wallet */
    channel: text("channel").notNull(),
    externalId: text("external_id").notNull(),
    displayName: text("display_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("channel_identity_unique").on(t.channel, t.externalId)],
);

/** Per-person delegate keys registered on the person's own MemWalAccount. */
export const delegateKeys = pgTable(
  "delegate_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    publicKeyHex: text("public_key_hex").notNull(),
    /** AES-256-GCM under KEY_ENCRYPTION_KEY. Never the raw key. */
    privateKeyEnc: text("private_key_enc").notNull(),
    label: text("label").notNull(),
    status: text("status", { enum: ["pending", "active", "revoked"] })
      .notNull()
      .default("pending"),
    addTxDigest: text("add_tx_digest"),
    removeTxDigest: text("remove_tx_digest"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("delegate_keys_person_idx").on(t.personId)],
);

/**
 * Single-use, short-lived tokens. Three shapes share this table because they
 * share the same semantics: `connect` and `disconnect` carry a person from a
 * chat channel to the web wallet page, and a wallet sign-in challenge is a
 * nonce that belongs to nobody until somebody signs it, which is why
 * `personId` is nullable.
 */
export const connectTokens = pgTable("connect_tokens", {
  token: text("token").primaryKey(),
  personId: uuid("person_id").references(() => people.id, { onDelete: "cascade" }),
  kind: text("kind", { enum: ["connect", "disconnect"] }).notNull(),
  delegateKeyId: uuid("delegate_key_id").references(() => delegateKeys.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webSessions = pgTable("web_sessions", {
  id: text("id").primaryKey(),
  personId: uuid("person_id")
    .notNull()
    .references(() => people.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

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
 * Local index of memories hippo wrote. Metadata only; the text lives on Walrus.
 *
 * A row is inserted the moment the relayer accepts the job, not when the blob
 * lands ~25 s later, so a deploy or crash in that window cannot lose the record
 * of a memory the user was already told about.
 */
export const memoryIndex = pgTable(
  "memory_index",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    namespace: text("namespace").notNull(),
    /** Null until the relayer finishes writing to Walrus. */
    blobId: text("blob_id"),
    jobId: text("job_id"),
    status: text("status", { enum: ["pending", "stored", "failed"] })
      .notNull()
      .default("pending"),
    error: text("error"),
    type: text("type").notNull(),
    textSha256: text("text_sha256").notNull(),
    channel: text("channel").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    settledAt: timestamp("settled_at", { withTimezone: true }),
    /**
     * Set when the person asked hippo to stop using this memory. The blob stays
     * on Walrus and cannot be deleted (docs/issues/09); hiding is hippo's own
     * filter on recall and dedupe, and it can be undone.
     */
    hiddenAt: timestamp("hidden_at", { withTimezone: true }),
  },
  (t) => [index("memory_index_person_idx").on(t.personId, t.createdAt)],
);

/**
 * Shared memory for a handful of people.
 *
 * A team's memory lives in hippo's own account under `hippo-team:<id>`, exactly
 * as a guest's does. The team does not own it, and that is said out loud in
 * `/team` and `/privacy` rather than implied otherwise: owning shared memory
 * needs an account somebody holds the keys to, and deciding who that is between
 * colleagues is a product question this does not answer yet.
 */
export const teams = pgTable("teams", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  createdBy: uuid("created_by").references(() => people.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const teamMembers = pgTable(
  "team_members",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    teamId: uuid("team_id")
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
    /**
     * Leaving stops reads and writes; it does not remove what the person
     * contributed, because a memory on Walrus cannot be deleted (docs/issues/09).
     * Kept as a row rather than a delete so `/team` can say that truthfully.
     */
    leftAt: timestamp("left_at", { withTimezone: true }),
  },
  (t) => [
    index("team_members_person_idx").on(t.personId, t.leftAt),
    uniqueIndex("team_members_unique").on(t.teamId, t.personId),
  ],
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

/** Six characters, ten minutes, single use. Same shape as a channel link code. */
export const teamInvites = pgTable("team_invites", {
  code: text("code").primaryKey(),
  teamId: uuid("team_id")
    .notNull()
    .references(() => teams.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").references(() => people.id, { onDelete: "set null" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * A private file the person stored on Walrus from their own wallet. Only the
 * ciphertext is on Walrus; this row holds where it is and how to unseal it.
 * The file's text and its name are never columns: the name is AES-256-GCM
 * under `KEY_ENCRYPTION_KEY`, like a conversation title.
 */
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    personId: uuid("person_id")
      .notNull()
      .references(() => people.id, { onDelete: "cascade" }),
    walletAddress: text("wallet_address").notNull(),
    accountId: text("account_id").notNull(),
    blobId: text("blob_id").notNull(),
    blobObjectId: text("blob_object_id"),
    sealId: text("seal_id").notNull(),
    ciphertextSha256: text("ciphertext_sha256").notNull(),
    nameEnc: text("name_enc").notNull(),
    mediaType: text("media_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    endEpoch: integer("end_epoch"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [
    index("documents_person_created_idx").on(t.personId, t.createdAt),
    uniqueIndex("documents_person_blob_idx").on(t.personId, t.blobId),
  ],
);

/** Which file a user message asked about. The excerpt itself is never stored. */
export const messageAttachments = pgTable(
  "message_attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("message_attachments_message_document_idx").on(t.messageId, t.documentId)],
);
