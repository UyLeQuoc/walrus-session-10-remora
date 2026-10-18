import { describe, expect, it } from "vitest";
import { isAdditive } from "./additive.ts";

const conversationsPlan = [
  'CREATE TABLE "conversations" (\n\t"id" uuid PRIMARY KEY NOT NULL,\n\t"person_id" uuid NOT NULL\n);\n',
  'CREATE TABLE "messages" (\n\t"id" uuid PRIMARY KEY NOT NULL,\n\t"conversation_id" uuid NOT NULL\n);\n',
  'ALTER TABLE "conversations" ADD CONSTRAINT "conversations_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE cascade ON UPDATE no action;',
  'ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;',
  'CREATE INDEX "conversations_person_updated_idx" ON "conversations" USING btree ("person_id","updated_at");',
  'CREATE UNIQUE INDEX "conversations_open_thread_idx" ON "conversations" USING btree ("person_id","channel","thread_key") WHERE "conversations"."closed_at" is null;',
  'CREATE UNIQUE INDEX "messages_conversation_seq_idx" ON "messages" USING btree ("conversation_id","seq");',
];

describe("isAdditive", () => {
  it("accepts new tables with their own foreign keys and unique indexes", () => {
    expect(isAdditive(conversationsPlan)).toBe(true);
  });

  it("accepts a new column and a plain index on an existing table", () => {
    expect(
      isAdditive([
        'ALTER TABLE "memory_index" ADD COLUMN "hidden_at" timestamp with time zone;',
        'CREATE INDEX "memory_index_hidden_idx" ON "memory_index" USING btree ("hidden_at");',
      ]),
    ).toBe(true);
  });

  it("refuses a foreign key or a unique index on a table the plan does not create", () => {
    expect(
      isAdditive([
        'ALTER TABLE "people" ADD CONSTRAINT "people_team_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id");',
      ]),
    ).toBe(false);
    expect(
      isAdditive(['CREATE UNIQUE INDEX "people_wallet_idx" ON "people" USING btree ("wallet");']),
    ).toBe(false);
  });

  it("refuses anything that drops, renames or rewrites", () => {
    for (const st of [
      'ALTER TABLE "people" DROP COLUMN "wallet";',
      'DROP TABLE "teams" CASCADE;',
      'ALTER TABLE "people" RENAME COLUMN "wallet" TO "address";',
      'ALTER TABLE "people" ALTER COLUMN "mode" SET DATA TYPE integer;',
    ]) {
      expect(isAdditive([...conversationsPlan, st])).toBe(false);
    }
  });
});
