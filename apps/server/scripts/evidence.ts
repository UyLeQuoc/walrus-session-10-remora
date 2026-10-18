/**
 * `bun run evidence` — the numbers the submission form and the article need.
 * Everything here is read from Postgres plus the relayer, never invented.
 */
import { IMPORT_CHANNEL } from "@remora/core/import-facts";
import { desc, memoryIndex, people, sql, turnLog } from "@remora/db";
import { createClient, explorer, guestScope, RelayerExtras } from "@remora/memory";
import { isConversationTurn } from "../src/chat/turn-modes.ts";
import { db, operator } from "../src/context.ts";
import { env } from "../src/env/load.ts";
import { countPeople, qualifyingPeople } from "../src/ops/people-count.ts";

const rows = <T>(r: T[]): T[] => r;

/**
 * Facts pasted in from another assistant on /me are left out of the per-person
 * numbers: one paste can hold twenty, and the requirement is memory built by use.
 */
const ownMemory = sql`${memoryIndex.channel} <> ${IMPORT_CHANNEL}`;
const importedMemory = sql`${memoryIndex.channel} = ${IMPORT_CHANNEL}`;

const byPerson = rows(
  await db
    .select({
      personId: memoryIndex.personId,
      mode: people.mode,
      accountId: memoryIndex.accountId,
      channel: sql<string>`min(${memoryIndex.channel})`,
      // Only a `stored` row is a blob that exists on Walrus. A `pending` row is
      // a write still in flight and a `failed` one never landed, so counting
      // them would overstate the numbers the submission form asks for.
      stored: sql<number>`count(*) filter (where ${memoryIndex.status} = 'stored')::int`,
      pending: sql<number>`count(*) filter (where ${memoryIndex.status} = 'pending')::int`,
      failed: sql<number>`count(*) filter (where ${memoryIndex.status} = 'failed')::int`,
      first: sql<string>`min(${memoryIndex.createdAt})::text`,
      last: sql<string>`max(${memoryIndex.createdAt})::text`,
    })
    .from(memoryIndex)
    .innerJoin(people, sql`${people.id} = ${memoryIndex.personId}`)
    .where(ownMemory)
    .groupBy(memoryIndex.personId, people.mode, memoryIndex.accountId)
    .orderBy(desc(sql`count(*)`)),
);

const [turns] = await db
  .select({
    total: sql<number>`count(*) filter (where ${isConversationTurn})::int`,
    commands: sql<number>`count(*) filter (where not ${isConversationTurn})::int`,
    withMemory: sql<number>`count(*) filter (where ${isConversationTurn} and ${turnLog.memoryEnabled})::int`,
    withoutMemory: sql<number>`count(*) filter (where ${isConversationTurn} and not ${turnLog.memoryEnabled})::int`,
    recalls: sql<number>`coalesce(sum(jsonb_array_length(${turnLog.injected})) filter (where ${isConversationTurn}), 0)::int`,
    turnsWithRecall: sql<number>`count(*) filter (where ${isConversationTurn} and jsonb_array_length(${turnLog.injected}) > 0)::int`,
    writes: sql<number>`coalesce(sum(${turnLog.writes}) filter (where ${isConversationTurn}), 0)::int`,
  })
  .from(turnLog);

const byChannel = rows(
  await db
    .select({ channel: turnLog.channel, turns: sql<number>`count(*)::int` })
    .from(turnLog)
    .where(isConversationTurn)
    .groupBy(turnLog.channel)
    .orderBy(desc(sql`count(*)`)),
);

const [imported] = await db
  .select({
    stored: sql<number>`count(*) filter (where ${memoryIndex.status} = 'stored')::int`,
    people: sql<number>`count(distinct ${memoryIndex.personId})::int`,
  })
  .from(memoryIndex)
  .where(importedMemory);

const counted = countPeople(byPerson);
const qualifying = qualifyingPeople(counted);
const totalStored = counted.reduce((n, p) => n + p.stored, 0);
const totalFailed = counted.reduce((n, p) => n + p.failed, 0);
const totalPending = counted.reduce((n, p) => n + p.pending, 0);
const client = createClient(guestScope(operator, "evidence"));
const agentId = await client.getPublicKeyHex();

console.log(`# hippo evidence — ${new Date().toISOString()}`);
console.log(`\nRelayer: ${env.MEMWAL_SERVER_URL} (${env.SUI_NETWORK})`);
console.log(`Operator account: ${env.MEMWAL_ACCOUNT_ID}`);
console.log(`  ${explorer.object(env.MEMWAL_ACCOUNT_ID)}`);
console.log(`MEMWAL_AGENT_ID (delegate public key): ${agentId}`);

console.log(`\n## Requirement check`);
console.log(`People with memories:            ${counted.length}`);
console.log(`People with 10+ stored memories: ${qualifying.length}  (session rules ask for 3)`);
console.log(`Memories stored on Walrus:       ${totalStored}`);
console.log(`  still writing:                 ${totalPending}`);
console.log(`  failed to land:                ${totalFailed}`);
console.log(
  `Distinct accounts written to:    ${new Set(counted.flatMap((p) => p.accountIds)).size}`,
);
console.log(
  `Imported memories, not counted:  ${imported?.stored ?? 0} from ${imported?.people ?? 0} people`,
);
console.log(`Owned-mode people:               ${counted.filter((p) => p.mode === "owned").length}`);

const requirementsMet = qualifying.length >= 3 && totalStored >= 10;
console.log(
  `\nSession requirement (3 people x 10 memories on mainnet): ${requirementsMet ? "MET" : "NOT YET MET"}`,
);

console.log(`\n## Per person`);
for (const p of counted) {
  const trouble =
    p.failed > 0 || p.pending > 0 ? `  (${p.pending} writing, ${p.failed} failed)` : "";
  const extraAccounts = p.accountIds.length > 1 ? ` +${p.accountIds.length - 1}` : "";
  console.log(
    `  ${p.personId.slice(0, 8)}  ${p.mode.padEnd(5)}  ${String(p.stored).padStart(3)} stored  first ${p.first.slice(0, 16)}  last ${p.last.slice(0, 16)}  acct ${p.accountIds[0]?.slice(0, 10) ?? ""}…${extraAccounts}${trouble}`,
  );
}

console.log(`\n## Turns`);
console.log(
  `  conversation turns ${turns?.total ?? 0} (memory on ${turns?.withMemory ?? 0}, off ${turns?.withoutMemory ?? 0})`,
);
console.log(`  slash commands     ${turns?.commands ?? 0} (excluded from the counts above)`);
const recallRate = turns?.withMemory
  ? Math.round((100 * (turns.turnsWithRecall ?? 0)) / turns.withMemory)
  : 0;
console.log(
  `  turns that recalled something: ${turns?.turnsWithRecall ?? 0} (${recallRate}% of memory-on turns)`,
);
console.log(`  memories injected in total:    ${turns?.recalls ?? 0}`);
console.log(`  memories written by the model: ${turns?.writes ?? 0}`);
for (const c of byChannel) console.log(`  ${c.channel.padEnd(9)} ${c.turns}`);

console.log(`\n## Accounts on the relayer`);
for (const accountId of new Set(counted.flatMap((p) => p.accountIds))) {
  const extras = new RelayerExtras({ ...operator, accountId });
  try {
    const agents = await extras.agents();
    console.log(`  ${accountId}  ${agents.agents.length} delegate keys`);
    for (const a of agents.agents) console.log(`    - ${a.label}`);
  } catch (e) {
    console.log(
      `  ${accountId}  (agents unavailable: ${e instanceof Error ? e.message.slice(0, 60) : e})`,
    );
  }
}
process.exit(0);
