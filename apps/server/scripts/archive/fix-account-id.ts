/**
 * One-off: repair `memory_index.account_id` rows that recorded the account we
 * thought we were writing to rather than the one the relayer actually used.
 *
 * Guest-mode writes are authenticated by the operator's delegate key, and the
 * relayer resolves the account from that key alone — it never reads the id we
 * send. So every guest memory went to the operator's account in the deployment
 * `GET /config` reports, while our env named the superseded deployment's
 * account for a week (docs/issues/11). The blobs are fine; only this column is
 * wrong, and leaving it wrong would make `bun run evidence` report two accounts.
 *
 *   tsx scripts/archive/fix-account-id.ts            # report only
 *   tsx scripts/archive/fix-account-id.ts --apply    # write
 */
import { and, eq, memoryIndex, people, sql } from "@remora/db";
import { db } from "../../src/context.ts";
import { env } from "../../src/env/load.ts";

const WRONG = "0x4926f26b7a166e146161c517723c50762988f2772024cc5de7504f7350d9b7a5";
const right = env.MEMWAL_ACCOUNT_ID;
const apply = process.argv.includes("--apply");

if (right === WRONG) throw new Error("MEMWAL_ACCOUNT_ID is still the superseded account");

// Only guest rows. An owned-mode row names the user's own account and is correct.
const affected = await db
  .select({ n: sql<number>`count(*)::int` })
  .from(memoryIndex)
  .innerJoin(people, eq(people.id, memoryIndex.personId))
  .where(and(eq(memoryIndex.accountId, WRONG), eq(people.mode, "guest")));

console.log(`guest rows naming the superseded account: ${affected[0]?.n ?? 0}`);
console.log(`would become: ${right}`);

if (!apply) {
  console.log("\ndry run. pass --apply to write.");
  process.exit(0);
}

const ids = await db
  .select({ id: memoryIndex.id })
  .from(memoryIndex)
  .innerJoin(people, eq(people.id, memoryIndex.personId))
  .where(and(eq(memoryIndex.accountId, WRONG), eq(people.mode, "guest")));

for (const { id } of ids) {
  await db.update(memoryIndex).set({ accountId: right }).where(eq(memoryIndex.id, id));
}
console.log(`updated ${ids.length} row(s)`);
process.exit(0);
