/** Disc, payments, Wakes, the sponsor ledger and the chain indexer (Uy). Every row carries its network (ADR-0026). */
import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const network = () => text("network", { enum: ["testnet", "mainnet"] }).notNull();

/**
 * D8: gas the sponsor committed per sender (remora key) per UTC day. A row is `reserved` when the gas
 * station hands out a sponsored transaction, `settled` with the real gas after execution, and
 * `released` if it never executed. The daily budget sums reserved + settled.
 */
export const sponsorLedger = pgTable(
  "sponsor_ledger",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    network: network(),
    sender: text("sender").notNull(),
    day: date("day").notNull(),
    /** Digest of the sponsored transaction (known from the bytes before execution). */
    digest: text("digest").notNull(),
    gasBudget: bigint("gas_budget", { mode: "bigint" }).notNull(),
    gasUsed: bigint("gas_used", { mode: "bigint" }),
    status: text("status", { enum: ["reserved", "settled", "released"] })
      .notNull()
      .default("reserved"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("sponsor_ledger_digest_idx").on(t.network, t.digest),
    index("sponsor_ledger_sender_day_idx").on(t.network, t.sender, t.day),
  ],
);

/** G1: Wakes, the receipt of every paid (or attempted) action. `intent_hash` goes onchain as `Paid.intent`. */
export const receipts = pgTable(
  "receipts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    network: network(),
    remoraId: text("remora_id").notNull(),
    /** The remora key that signed. */
    agent: text("agent").notNull(),
    wake: jsonb("wake").$type<Record<string, unknown>>().notNull(),
    intentHash: text("intent_hash").notNull(),
    txDigest: text("tx_digest"),
    /** True once the indexer saw `Paid.intent == intent_hash` (G2). */
    anchored: boolean("anchored").notNull().default(false),
    wakeBlobId: text("wake_blob_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("receipts_tx_digest_idx")
      .on(t.network, t.txDigest)
      .where(sql`${t.txDigest} is not null`),
    index("receipts_intent_hash_idx").on(t.intentHash),
    index("receipts_remora_idx").on(t.remoraId, t.createdAt),
  ],
);

/** D1: `remora::disc` events from the checkpoint stream; history reads come from here (ADR-0021). */
export const discEvents = pgTable(
  "disc_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    network: network(),
    checkpoint: bigint("checkpoint", { mode: "bigint" }).notNull(),
    txDigest: text("tx_digest").notNull(),
    eventSeq: integer("event_seq").notNull(),
    /** Paid | DiscIssued | DiscUpdated | SpenderRotated | DiscRevoked */
    type: text("type").notNull(),
    discId: text("disc_id").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown>>().notNull(),
    timestampMs: bigint("timestamp_ms", { mode: "bigint" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("disc_events_unique_idx").on(t.network, t.txDigest, t.eventSeq),
    index("disc_events_disc_idx").on(t.network, t.discId),
  ],
);

/** D1: the last checkpoint the indexer stored, per network; it resumes from here. */
export const indexerCursors = pgTable("indexer_cursors", {
  network: text("network").primaryKey(),
  checkpoint: bigint("checkpoint", { mode: "bigint" }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** C1/F2: Scout's counters per source (memory holds the conclusions, Postgres the counts; spec §8). */
export const sourceStats = pgTable(
  "source_stats",
  {
    remoraId: text("remora_id").notNull(),
    /** reef:<slug> */
    payee: text("payee").notNull(),
    calls: integer("calls").notNull().default(0),
    useful: integer("useful").notNull().default(0),
    noise: integer("noise").notNull().default(0),
    spent: bigint("spent", { mode: "bigint" }).notNull().default(sql`0`),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.remoraId, t.payee] })],
);
