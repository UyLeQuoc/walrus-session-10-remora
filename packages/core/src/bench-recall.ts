/**
 * `bun run --filter @remora/core bench:recall <namespace-person-id>` — what a
 * session's first turn spends on recall, the old way against the new.
 *
 * Old: the message, then three natural-language pulls for profile, style and
 * commitments. New: the message, then one pull on the type tags. The corrections
 * pull is common to both and left out. Rounds alternate which goes first, so
 * the relayer's drift over a run lands on both equally. A single recall ranges
 * from about one second to over two, so few samples prove nothing; this takes
 * ten of each by default and reports the median and the slowest.
 */
import { createMemoryPort, guestScope, loadEnv, readOperatorEnv } from "@remora/memory";

loadEnv();
const person = process.argv[2];
if (!person) throw new Error("usage: bench-recall.ts <person-id>, e.g. demo-mufn9ra2");
const rounds = Number(process.env.ROUNDS ?? 10);
const env = readOperatorEnv();
const port = createMemoryPort({
  scope: guestScope(
    {
      key: env.MEMWAL_PRIVATE_KEY,
      accountId: env.MEMWAL_ACCOUNT_ID,
      serverUrl: env.MEMWAL_SERVER_URL,
    },
    person,
  ),
  by: "bench",
  channel: "bench",
});
const message = "Which package manager should I use here?";

const OLD = [
  { query: "who the user is, their stack, tools and preferences", limit: 5, maxDistance: 0.7 },
  { query: "how the user wants replies: language, length, tone", limit: 3, maxDistance: 0.6 },
  { query: "open commitments, deadlines, things promised", limit: 4, maxDistance: 0.65 },
];
const NEW = [{ query: "[profile] [style] [commitment]", limit: 8, maxDistance: 0.75 }];

/**
 * A recall that throws is counted and the round goes on, timed to the failure,
 * which is what a person waits for. Before this, one relayer timeout ended the
 * whole run, so a bench on a bad hour measured nothing at all.
 */
const failures = { old: 0, now: 0 };
const reasons = new Map<string, number>();

async function timed(pulls: typeof OLD, side: keyof typeof failures): Promise<number> {
  const began = Date.now();
  for (const p of [{ query: message, limit: 6 }, ...pulls]) {
    try {
      await port.recall(p);
    } catch (err) {
      failures[side]++;
      const e = err as { serverCode?: string; name?: string; status?: number };
      const reason = e.serverCode ?? e.name ?? String(e.status ?? "error");
      reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
    }
  }
  return Date.now() - began;
}

const old: number[] = [];
const now: number[] = [];
for (let i = 0; i < rounds; i++) {
  if (i % 2) {
    now.push(await timed(NEW, "now"));
    old.push(await timed(OLD, "old"));
  } else {
    old.push(await timed(OLD, "old"));
    now.push(await timed(NEW, "now"));
  }
}
const stat = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const median =
    s.length % 2
      ? s[(s.length - 1) / 2]
      : ((s[s.length / 2 - 1] ?? 0) + (s[s.length / 2] ?? 0)) / 2;
  return `median ${((median ?? 0) / 1000).toFixed(2)}s, slowest ${((s.at(-1) ?? 0) / 1000).toFixed(2)}s`;
};
console.log(`${rounds} rounds, alternating, namespace ${port.scope.namespace}`);
console.log(`  old, message + 3 pulls: ${stat(old)}, ${failures.old}/${rounds * 4} recalls failed`);
console.log(`  new, message + 1 pull:  ${stat(now)}, ${failures.now}/${rounds * 2} recalls failed`);
for (const [reason, n] of reasons) console.log(`  failed with ${reason}: ${n}`);
