/**
 * `bun run restore` — rebuild the relayer's search index from Walrus.
 *
 * The memories themselves live on Walrus, but recall runs against a vector
 * index in the relayer's database. If that index is lost or reset, every memory
 * still exists and none of them can be found. This walks the namespaces hippo
 * has written to and asks the relayer to re-index each one.
 *
 *   bun run restore                 # dry run: what would be restored, per namespace
 *   bun run restore --run           # actually restore
 *   bun run restore --run --limit 50
 *
 * `restore` has no pagination cursor: it tops up the N newest blobs per call, so
 * a large namespace needs repeated calls with a rising limit. The loop below
 * raises the limit until `restored` stops increasing.
 *
 * Do not trust a clean-looking result. On our mainnet account, which owns 197
 * Walrus Blob objects, restore reports `total: 0` and `truncated: false` for a
 * namespace whose memories recall returns right now: the relayer's owner-wide
 * candidate fetch appears to be capped below the account's blob count, and the
 * response has no field that admits it. This script therefore prints what we
 * wrote next to what the relayer says, so a zero is visible as a discrepancy
 * rather than read as "nothing to do". See docs/issues/10.
 */
import { delegateKeys, desc, eq, memoryIndex, people, sql } from "@remora/db";
import { createClient, decryptSecret, guestScope, ownedScope, RelayerExtras } from "@remora/memory";
import { db, operator } from "../src/context.ts";
import { env } from "../src/env/load.ts";

const run = process.argv.includes("--run");
const limitArg = process.argv.indexOf("--limit");
const startLimit = limitArg > -1 ? Number(process.argv[limitArg + 1] ?? 10) : 10;

/** Namespaces hippo has written to, with the credential that can reach each one. */
const rows = await db
  .select({
    namespace: memoryIndex.namespace,
    accountId: memoryIndex.accountId,
    personId: memoryIndex.personId,
    mode: people.mode,
    stored: sql<number>`count(*) filter (where ${memoryIndex.status} = 'stored')::int`,
  })
  .from(memoryIndex)
  .innerJoin(people, eq(people.id, memoryIndex.personId))
  .groupBy(memoryIndex.namespace, memoryIndex.accountId, memoryIndex.personId, people.mode)
  .orderBy(desc(sql`count(*)`));

if (rows.length === 0) {
  console.log("No namespaces to restore: hippo has not written anything yet.");
  process.exit(0);
}

console.log(`${rows.length} namespace(s) to check${run ? "" : "  (dry run, pass --run to act)"}\n`);

for (const row of rows) {
  let scope = guestScope(operator, row.personId);
  if (row.mode === "owned") {
    const [key] = await db
      .select()
      .from(delegateKeys)
      .where(eq(delegateKeys.personId, row.personId))
      .limit(1);
    if (!key?.privateKeyEnc) {
      console.log(`${row.namespace}: skipped, no usable delegate key (revoked?)`);
      continue;
    }
    scope = ownedScope({
      key: decryptSecret(key.privateKeyEnc, env.KEY_ENCRYPTION_KEY),
      accountId: row.accountId,
      serverUrl: env.MEMWAL_SERVER_URL,
    });
  }

  const extras = new RelayerExtras(scope);
  let indexed = "?";
  try {
    indexed = String((await extras.stats(row.namespace)).memory_count);
  } catch (e) {
    indexed = `unknown (${e instanceof Error ? e.message.slice(0, 40) : e})`;
  }
  console.log(`${row.namespace}`);
  console.log(`  we wrote ${row.stored}, relayer index holds ${indexed}`);

  if (!run) continue;

  const client = createClient({ ...scope, namespace: row.namespace });
  let limit = startLimit;
  let total = 0;
  for (let round = 1; round <= 4; round++) {
    try {
      const res = await client.restore(row.namespace, limit);
      total += res.restored;
      console.log(
        `  round ${round} limit ${limit}: restored ${res.restored}, skipped ${res.skipped}, failed ${res.failed}, truncated ${res.truncated}`,
      );
      if (res.restored === 0 && !res.truncated) break;
      limit = Math.min(100, limit * 2);
    } catch (e) {
      console.log(`  round ${round} failed: ${e instanceof Error ? e.message.slice(0, 80) : e}`);
      break;
    }
  }
  console.log(`  restored ${total} in total`);
  if (total === 0 && row.stored > 0) {
    console.log(
      `  WARNING: we wrote ${row.stored} memories here and restore found nothing. See docs/issues/10.`,
    );
  }
}

process.exit(0);
