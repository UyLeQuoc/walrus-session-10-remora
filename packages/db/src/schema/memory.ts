/** The local index of Walrus Memory writes. Memory text itself is never a column. */
import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { people } from "./identity.ts";

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
