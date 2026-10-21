/**
 * The Hatchery (M3–M6, ADR-0046, ADR-0047): templates published through `remora_hatchery` and the
 * hatches recorded against them. Rows come from our own publish/hatch confirmations and from the
 * checkpoint indexer, so templates published elsewhere show up too. The Markdown is the public blob's
 * content (never private data); the safety report is recomputed on every hatch.
 */
import {
  bigint,
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const hatcheryTemplates = pgTable(
  "hatchery_templates",
  {
    /** The frozen `Template` object. */
    templateId: text("template_id").primaryKey(),
    network: text("network").notNull(),
    blobId: text("blob_id").notNull(),
    author: text("author").notNull(),
    parent: text("parent"),
    /** From the blob; null until it has been fetched and parsed. */
    name: text("name"),
    description: text("description"),
    markdown: text("markdown"),
    team: jsonb("team").$type<Record<string, unknown>>(),
    safety: jsonb("safety").$type<Record<string, unknown>>(),
    verdict: text("verdict", { enum: ["pass", "warn", "block", "unknown"] })
      .notNull()
      .default("unknown"),
    deprecated: boolean("deprecated").notNull().default(false),
    publishDigest: text("publish_digest").notNull(),
    checkpoint: bigint("checkpoint", { mode: "bigint" }),
    publishedAt: timestamp("published_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("hatchery_templates_network_idx").on(t.network, t.publishedAt)],
);

export const hatcheryForks = pgTable(
  "hatchery_forks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    network: text("network").notNull(),
    templateId: text("template_id").notNull(),
    /** The hatcher's address. */
    by: text("by").notNull(),
    txDigest: text("tx_digest").notNull(),
    eventSeq: bigint("event_seq", { mode: "number" }).notNull().default(0),
    /** Remoras this server created for the hatch (empty when it was hatched elsewhere). */
    remoraIds: jsonb("remora_ids").$type<string[]>().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("hatchery_forks_tx_idx").on(t.txDigest, t.eventSeq),
    index("hatchery_forks_template_idx").on(t.templateId),
  ],
);
