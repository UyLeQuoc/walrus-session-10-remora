/**
 * F15 (ADR-0074): the fact extractor on the real small model, folded through `reconcile` in memory,
 * on the cases from the Dewee write-up (a preference change, a job change dated next month, an agent
 * contradicting the owner, a one-off event). No database, no Walrus: model calls only.
 *
 *   bun run --filter @remora/server probe:facts
 *
 * Needs OPENROUTER_API_KEY and LLM_MODEL (LLM_SMALL_MODEL if set). Exit code 1 if an expectation fails.
 */
import { createModel } from "@remora/core";
import {
  type Authority,
  currentAt,
  type Fact,
  type FactInput,
  loadEnv,
  reconcile,
  slotKey,
} from "@remora/memory";
import { createBrain } from "../src/runtime/brain.ts";

loadEnv();
const key = process.env.OPENROUTER_API_KEY;
const id = process.env.LLM_SMALL_MODEL || process.env.LLM_MODEL;
if (!key || !id) {
  console.error("needs OPENROUTER_API_KEY and LLM_MODEL");
  process.exit(2);
}
const small = createModel({ apiKey: key, model: id });
const brain = createBrain({
  answer: small.primary,
  answerId: id,
  check: small.primary,
  parse: small.primary,
  parseId: id,
});
const extract = brain.extractFacts;
if (!extract) throw new Error("no extractor");

const corpus: { by: Authority; day: string; text: string }[] = [
  { by: "owner", day: "2026-10-20", text: "Reply to me in Vietnamese, and keep it short." },
  { by: "owner", day: "2026-10-21", text: "I'm the CTO at Company A." },
  { by: "owner", day: "2026-10-22", text: "I drink tea every morning." },
  { by: "owner", day: "2026-10-28", text: "I switched from tea to coffee." },
  {
    by: "owner",
    day: "2026-10-30",
    text: "From next month, December 1st, I'm moving to Company B.",
  },
  { by: "agent", day: "2026-10-30", text: "The owner seems to prefer English replies lately." },
  { by: "runtime", day: "2026-10-31", text: "Asked about the odds for tonight's match." },
];

const facts: Fact[] = [];
let n = 0;
let tokens = 0;
for (const m of corpus) {
  const t0 = Date.now();
  const out = await extract({
    text: m.text,
    slots: [...new Set(facts.map((f) => slotKey(f)))],
    today: m.day,
  });
  tokens += out.tokens;
  const lines: string[] = [];
  for (const f of out.facts) {
    const c: FactInput = {
      ...f,
      observedAt: `${m.day}T09:00:00.000Z`,
      assertedBy: f.verification === "inferred" ? "extractor" : m.by,
    };
    const slot = facts.filter((x) => slotKey(x) === slotKey(c) && x.status !== "retracted");
    const d = reconcile(c, slot, Date.parse(`${m.day}T10:00:00Z`));
    const version = Math.max(0, ...slot.map((x) => x.version)) + 1;
    const fid = `f${++n}`;
    if (d.action === "create") facts.push({ ...c, id: fid, status: "active", version });
    if (d.action === "dispute") facts.push({ ...c, id: fid, status: "disputed", version });
    if (d.action === "history")
      facts.push({ ...c, id: fid, status: "superseded", validUntil: d.validUntil, version });
    if (d.action === "supersede") {
      const old = facts.find((x) => x.id === d.factId);
      if (old) Object.assign(old, { status: "superseded", validUntil: d.validUntil });
      facts.push({ ...c, id: fid, status: "active", version });
    }
    lines.push(`${slotKey(c)} = ${c.value} [${c.assertedBy}/${c.verification}] → ${d.action}`);
  }
  console.log(`\n${m.day} ${m.by}: “${m.text}” (${Date.now() - t0} ms)`);
  for (const l of lines.length ? lines : ["(no facts)"]) console.log(`  ${l}`);
}

const at = (iso: string) =>
  currentAt(facts, Date.parse(iso)).map((f) => `${slotKey(f)} = ${f.value}`);
const now = at("2026-10-31T12:00:00Z");
const december = at("2026-12-15T00:00:00Z");
console.log("\nHolds on Oct 31:", now);
console.log("Holds on Dec 15:", december);
console.log(
  "Disputed:",
  facts.filter((f) => f.status === "disputed").map((f) => `${slotKey(f)} = ${f.value}`),
);
console.log(`Model ${id}, ${tokens} tokens in ${corpus.length} extractions.`);

const has = (list: string[], re: RegExp) => list.some((l) => re.test(l));
const checks: [string, boolean][] = [
  ["reply language is still Vietnamese", has(now, /language.*= vietnamese/i)],
  ["the agent's English is not current", !has(now, /language.*= english/i)],
  [
    "tea was recorded, then coffee replaced it",
    facts.some((f) => /^tea$/i.test(f.value) && f.status === "superseded") &&
      has(now, /coffee/i) &&
      !has(now, /= tea/i),
  ],
  [
    "the owner's switch is the owner's, not the extractor's",
    facts.some((f) => /coffee/i.test(f.value) && f.assertedBy === "owner"),
  ],
  ["Company A holds in October", has(now, /company a/i) && !has(now, /company b/i)],
  ["Company B holds in December", has(december, /company b/i)],
  ["the match question asserted nothing", !facts.some((f) => /odds|match/i.test(f.value))],
];
for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);
process.exit(checks.every(([, ok]) => ok) ? 0 : 1);
