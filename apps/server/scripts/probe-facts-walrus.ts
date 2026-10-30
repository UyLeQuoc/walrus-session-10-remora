/**
 * F15 (ADR-0074) on the real relayer: Scout's track-record lines for one source go through the
 * remora's memory (redaction, the F4 index) into a throwaway namespace the way feedback.ts writes
 * them (no semantic dedupe), the ledger reads them, and admission on a real recall keeps only the
 * current one. A third line once the first two are searchable is the case dedupe used to swallow.
 * Then the namespace is forgotten and the throwaway rows are deleted.
 *
 *   bun run --filter @remora/server probe:facts:walrus
 *
 * Needs a local DATABASE_URL (it inserts a throwaway remora) and the MEMWAL_* operator settings.
 */
import { randomBytes } from "node:crypto";
import { createLogger } from "@remora/chain";
import { createDb, eq, memoryFacts, remoraMemories, remoras } from "@remora/db";
import { loadEnv, RelayerExtras } from "@remora/memory";
import { admitMemories, createFactLedger, withFacts } from "../src/runtime/facts.ts";
import { createRemoraMemory, namespaceFor } from "../src/runtime/memory.ts";
import { memoryIndexFor } from "../src/runtime/memory-controls.ts";

loadEnv();
const url = process.env.DATABASE_URL;
if (!url || !/localhost|127\.0\.0\.1/.test(url)) {
  console.error("needs a local DATABASE_URL: this inserts a throwaway remora");
  process.exit(2);
}
const operator = {
  key: process.env.MEMWAL_PRIVATE_KEY ?? "",
  accountId: process.env.MEMWAL_ACCOUNT_ID ?? "",
  serverUrl: process.env.MEMWAL_SERVER_URL ?? "",
};
if (!operator.key || !operator.accountId || !operator.serverUrl) {
  console.error("needs MEMWAL_PRIVATE_KEY, MEMWAL_ACCOUNT_ID and MEMWAL_SERVER_URL");
  process.exit(2);
}
const db = createDb(url);
const log = createLogger({}, () => {});
const ledger = createFactLedger(db, { log });
const memory = withFacts(createRemoraMemory(operator, log, memoryIndexFor(db)), ledger);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const t0 = Date.now();
const at = () => `${((Date.now() - t0) / 1000).toFixed(1)} s`;

const [row] = await db
  .insert(remoras)
  .values({
    ownerAddress: `0x${randomBytes(32).toString("hex")}`,
    network: "testnet",
    template: "scout",
    name: "probe-f15",
    config: { namespaces: ["me", "sources", "feedback", "receipts"] },
    status: "active",
    address: `0x${randomBytes(32).toString("hex")}`,
  })
  .returning();
if (!row) throw new Error("no remora");
const r = { id: row.id, name: row.name, ownerAddress: row.ownerAddress };
console.log(`throwaway remora ${r.id}, namespace ${namespaceFor(r, "sources")}`);

let failed = false;
try {
  const lines = [
    "SOURCE reef:brief · 3 calls · 3 useful · 0 noise · $0.003 per useful answer · as_of 2026-10-30",
    "SOURCE reef:brief · 9 calls · 2 useful · 7 noise · $0.045 per useful answer · as_of 2026-10-31",
  ];
  for (const line of lines) {
    const res = await memory.remember(r, "sources", "source", line, { dedupe: false });
    console.log(`[${at()}] remember → saved=${res.saved} ${res.note.slice(0, 80)}`);
    await ledger.idle();
  }

  // The blob ids land about 25 s after the accept.
  for (let i = 0; i < 40; i++) {
    const rows = await db.select().from(remoraMemories).where(eq(remoraMemories.remoraId, r.id));
    if (rows.length && rows.every((m) => m.status !== "pending")) {
      console.log(`[${at()}] settled: ${rows.map((m) => `${m.status} ${m.blobId}`).join(", ")}`);
      break;
    }
    await sleep(3_000);
  }
  const facts = await ledger.list(r, ["sources"]);
  for (const f of facts)
    console.log(
      `fact v${f.version} ${f.status.padEnd(10)} ${f.slot} = ${f.value} · blobs ${f.blobIds.join(",") || "-"}`,
    );

  // Recall until both lines are searchable, then admit.
  let recalled: Awaited<ReturnType<typeof memory.recall>> = [];
  for (let i = 0; i < 30; i++) {
    recalled = await memory.recall(r, "is the brief service worth paying for", ["sources"]);
    if (recalled.length >= facts.length) break;
    await sleep(4_000);
  }
  console.log(
    `[${at()}] recall: ${recalled.map((m) => `${m.blobId} @${m.distance.toFixed(3)}`).join(", ")}`,
  );
  const a = await admitMemories({ facts: ledger, log }, r, "is brief worth it?", recalled, [
    "sources",
  ]);
  console.log(
    "admitted:",
    a.memories.map((m) => m.text),
  );
  console.log("rejected:", a.report.rejected);

  // Phase 2: a third line once the first two are searchable, as feedback writes it days later.
  const third = await memory.remember(
    r,
    "sources",
    "source",
    "SOURCE reef:brief · 10 calls · 2 useful · 8 noise · $0.050 per useful answer · as_of 2026-11-01",
    { dedupe: false },
  );
  console.log(`[${at()}] third line → saved=${third.saved} ${third.note.slice(0, 80)}`);
  await ledger.idle();
  const latest = (await ledger.list(r, ["sources"])).find((f) => f.status === "active");
  console.log(`active now: ${latest?.value}`);

  const current = facts.find((f) => f.status === "active");
  const checks: [string, boolean][] = [
    [
      "a later line isn't swallowed by dedupe",
      third.saved && !!latest?.value.startsWith("10 calls"),
    ],
    ["both lines were written (not deduped)", facts.length === 2],
    ["the newer line is the active fact", !!current?.value.startsWith("9 calls")],
    [
      "admission keeps only the current line",
      a.memories.length === 1 && !!a.memories[0]?.text.includes("9 calls"),
    ],
  ];
  for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);
  failed = !checks.every(([, ok]) => ok);
} finally {
  await new RelayerExtras(operator).forget(namespaceFor(r, "sources")).catch((err) => {
    console.warn("forget failed", err);
  });
  await db.delete(memoryFacts).where(eq(memoryFacts.remoraId, r.id));
  await db.delete(remoras).where(eq(remoras.id, r.id));
}
process.exit(failed ? 1 : 0);
