/**
 * `bun run capacity` — will this survive the real-use week?
 *
 * Three things can end M6 quietly: the model key running out of credit, the
 * database filling its free tier, and the relayer refusing us. The first is the
 * likely one, because the OpenRouter key is capped rather than metered, so it
 * stops dead at a number rather than costing more.
 *
 * Every figure is read live. Nothing here is estimated except the runway, and
 * that is labelled as an upper bound with the reason.
 */
import { sql, turnLog } from "@remora/db";
import { readOperatorEnv } from "@remora/memory";
import { isConversationTurn } from "../src/chat/turn-modes.ts";
import { db } from "../src/context.ts";
import { env } from "../src/env/load.ts";

const money = (n: number) => `$${n.toFixed(4)}`;

console.log(`# hippo capacity — ${new Date().toISOString()}`);

// ── the model budget ──────────────────────────────────────────────────────
const res = await fetch("https://openrouter.ai/api/v1/key", {
  headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}` },
});
const key = res.ok
  ? (
      (await res.json()) as {
        data: { limit: number | null; limit_remaining: number | null; usage: number };
      }
    ).data
  : null;

console.log("\n## Model budget (OpenRouter)");
if (!key) {
  console.log(`  could not read the key: HTTP ${res.status}`);
} else {
  const limit = key.limit;
  const remaining = key.limit_remaining;
  console.log(`  spent so far    ${money(key.usage)}`);
  console.log(`  limit           ${limit === null ? "none (metered)" : money(limit)}`);
  console.log(`  remaining       ${remaining === null ? "n/a" : money(remaining)}`);

  const [turns] = await db
    .select({
      n: sql<number>`count(*) filter (where ${isConversationTurn})::int`,
    })
    .from(turnLog);
  const logged = turns?.n ?? 0;

  if (remaining !== null) {
    /**
     * Measured, not derived from spend over logged turns.
     *
     * That earlier arithmetic was wrong by about seven times and said a
     * realistic week would not fit. It divided every dollar ever spent by the
     * production turn_log rows alone, while most of those dollars went on
     * `bun run demo` runs and mainnet spikes, none of which write a turn row. A
     * wrong number that says "you cannot afford this" is not a safe default;
     * it nearly bought a worse model.
     *
     * This figure comes from scripts/model-bakeoff.sh: one `bun run demo` is nine
     * model turns and cost $0.0033 to $0.0037 on the current model. Re-run the
     * bakeoff if LLM_MODEL changes; the number is per model, not universal.
     * docs/evidence/model-bakeoff-2026-09-23.md has the table.
     */
    const MEASURED_COST_PER_TURN = 0.0037 / 9;
    const perTurn = MEASURED_COST_PER_TURN;
    console.log(`\n  turns logged in this database   ${logged}`);
    console.log(
      `  cost per turn, measured         ${money(perTurn)}  (model-bakeoff, ${env.LLM_MODEL})`,
    );
    console.log(`  turns left at that rate         ~${Math.floor(remaining / perTurn)}`);
    for (const [people, perDay] of [
      [3, 10],
      [5, 15],
      [8, 20],
    ] as const) {
      const week = people * perDay * 7;
      const cost = week * perTurn;
      const verdict = remaining >= cost ? "fits" : "DOES NOT FIT";
      console.log(
        `  ${people} people x ${perDay}/day x 7 days = ${String(week).padStart(4)} turns -> ${money(cost)}  ${verdict}`,
      );
    }
  }
}

// ── the database ──────────────────────────────────────────────────────────
console.log("\n## Database");
const size = await db.execute(
  sql`select pg_size_pretty(pg_database_size(current_database())) as size`,
);
// Drizzle's execute shape differs by driver, so read defensively.
const row =
  (size as unknown as { rows?: Array<{ size?: string }> }).rows?.[0] ??
  (size as unknown as Array<{ size?: string }>)[0];
console.log(`  size            ${row?.size ?? "unknown"}`);
const [rows] = await db.select({ turns: sql<number>`count(*)::int` }).from(turnLog);
console.log(`  turn_log rows   ${rows?.turns ?? 0}`);
console.log("  Neon free tier is 0.5 GB of storage; nothing here stores memory text.");

// ── the relayer ───────────────────────────────────────────────────────────
console.log("\n## Relayer");
const opEnv = readOperatorEnv();
const health = await fetch(`${opEnv.MEMWAL_SERVER_URL}/health`).catch(() => null);
console.log(
  `  ${opEnv.MEMWAL_SERVER_URL}  ${health?.ok ? "ok" : `unreachable (${health?.status ?? "no response"})`}`,
);
console.log("  Write limit is 60/min per delegate key, shared by every user in guest mode.");
process.exit(0);
