/**
 * `bun run demo` — the memory eval. Two sessions against the real mainnet relayer:
 * teach hippo some facts, change one of them, throw the conversation away, then
 * ask questions that can only be answered from Walrus. This is the evidence for
 * "does it actually remember", and it doubles as an end-to-end smoke test for
 * reviewers.
 */
import { createMemoryPort, guestScope, loadEnv, readOperatorEnv } from "@remora/memory";
import type { ModelMessage } from "ai";
import { completeTurn, gatherContext } from "./agent.ts";
import { createModel } from "./model.ts";

loadEnv();

/** Yesterday, so the promise below is overdue whenever the eval runs. */
const YESTERDAY = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);

/**
 * A promise past its date, taught in session one and never asked about again.
 * Bringing it up unprompted at the start of a later session is memory doing
 * work nobody asked for, which is the difference from a lookup table. Linh is a
 * name, so it survives the answer being in Vietnamese.
 */
const PROMISE = /Linh/;

const TEACH = [
  "Hi, I'm Mai. I work on Sui and Next.js, always in TypeScript strict mode.",
  "For package managers I only use pnpm, never npm or yarn.",
  "We decided to use Drizzle instead of Prisma for this project's ORM.",
  "One thing to remember: our Postgres runs on port 5433 because 5432 is taken.",
  "Please keep your answers short, and always answer me in Vietnamese.",
  // Contradicts the pnpm line above. Both get stored — a correction is related
  // to what it corrects, not a duplicate of it — so session two recalls both,
  // and only ordering plus the conflict rule decide which one is believed.
  "Change of plan: we moved this project from pnpm to bun this week, so use bun now.",
  `I promised Linh I would send her the invoice by ${YESTERDAY}.`,
];

const ASK: Array<{ q: string; expect: RegExp; why: string }> = [
  {
    q: "Which package manager should I use here?",
    expect: /\bbun\b/i,
    why: "believes the correction over the fact it replaced",
  },
  { q: "Which ORM did we settle on?", expect: /drizzle/i, why: "recalls a decision" },
  { q: "What port is the database on?", expect: /5433/, why: "recalls a gotcha" },
  { q: "What do you know about me?", expect: /sui|next|typescript/i, why: "recalls a profile" },
];

/**
 * The style check is the sharpest evidence that memory changes behaviour rather
 * than just being quoted back. Nothing in session two asks for Vietnamese; a
 * `style` memory written in session one is the only reason it would appear.
 * Vietnamese-only diacritics, so an English answer cannot pass by accident.
 */
const VIETNAMESE = /[ăâđêôơưĂÂĐÊÔƠƯàáảãạằắẳẵặầấẩẫậèéẻẽẹềếểễệìíỉĩịòóỏõọồốổỗộờớởỡợùúủũụừứửữựỳýỷỹỵ]/;

const INDEX_WAIT_MS = Number(process.env.DEMO_INDEX_WAIT_MS ?? 90_000);

/**
 * The fact the correction replaced, and the one it replaced it with. An answer
 * that names pnpm without bun is presenting the superseded fact as current,
 * whichever question it was answering. Checking only the package-manager
 * question missed exactly that: on 2026-09-24 it passed with "use bun" while
 * "what do you know about me?" answered "you only use pnpm".
 */
const STALE = /pnpm/i;
const CURRENT = /\bbun\b/i;

/**
 * The control: the same questions, the same model, memory off. Only facts no
 * model could guess are asserted — a generic answer to "which package manager"
 * may well list pnpm and bun, and "which ORM" may list Drizzle, so those two
 * are shown side by side and not scored. Nobody guesses port 5433, that this
 * person works on Sui and Next.js, or that they want Vietnamese.
 */
const CANNOT_GUESS: Record<string, RegExp> = {
  "What port is the database on?": /5433/,
  "What do you know about me?": /\bsui\b|next\.?js/i,
};

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : ((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2;
}

/**
 * The same memory reached from a second "channel": a different MemoryPort, a
 * different handle, no shared conversation, pointed at the same namespace. That
 * is exactly what linking two channels does on the server, so this is the
 * automated version of the manual web-to-CLI check in
 * docs/evidence/cross-channel-2026-09-21.md.
 */
async function crossChannelCheck(
  model: ReturnType<typeof createModel>,
  namespace: string,
  operator: { key: string; accountId: string; serverUrl: string },
): Promise<{ ok: boolean; text: string; injected: string[] }> {
  const other = createMemoryPort({
    scope: { mode: "guest", ...operator, namespace },
    by: "mai",
    channel: "telegram",
  });
  const turn = await completeTurn({
    model,
    port: other,
    messages: [{ role: "user", content: "Which ORM did we pick for this project?" }],
    channel: "telegram",
    userHandle: "mai",
    memoryEnabled: true,
    sessionStart: true,
  });
  const ok = /drizzle/i.test(turn.text);
  console.log(`
CROSS-CHANNEL — a second channel, same memory`);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${turn.text.replace(/\n/g, " ").slice(0, 120)}`);
  console.log(`        recalled ${turn.ctx.injected.length} memories`);
  return { ok, text: turn.text, injected: turn.ctx.injected.map((m) => m.text) };
}

async function main() {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY missing");
  const env = readOperatorEnv();
  const model = createModel({
    apiKey,
    model: process.env.LLM_MODEL ?? "google/gemini-2.5-flash",
    fallbackModel: process.env.LLM_FALLBACK_MODEL,
  });

  const personId = `demo-${Date.now().toString(36)}`;
  const port = createMemoryPort({
    scope: guestScope(
      {
        key: env.MEMWAL_PRIVATE_KEY,
        accountId: env.MEMWAL_ACCOUNT_ID,
        serverUrl: env.MEMWAL_SERVER_URL,
      },
      personId,
    ),
    by: "mai",
    channel: "demo",
    onWrite: (e) => {
      if (e.outcome === "stored" && e.blobId)
        console.log(`    stored [${e.type}] blob ${e.blobId.slice(0, 12)}…`);
      if (e.outcome === "failed") console.log(`    FAILED [${e.type}] ${e.error ?? ""}`);
      return undefined;
    },
  });

  console.log(`hippo memory eval · model ${model.id} · namespace ${port.scope.namespace}\n`);
  console.log("SESSION 1 — teaching");
  const first: ModelMessage[] = [];
  let writes = 0;
  for (const [i, text] of TEACH.entries()) {
    first.push({ role: "user", content: text });
    const turn = await completeTurn({
      model,
      port,
      messages: first,
      channel: "demo",
      userHandle: "mai",
      memoryEnabled: true,
      sessionStart: i === 0,
    });
    first.push({ role: "assistant", content: turn.text });
    writes += turn.writes;
    console.log(`  › ${text}`);
    console.log(`  ‹ ${turn.text.replace(/\n/g, " ").slice(0, 100)}  (${turn.writes} writes)`);
  }
  console.log(`\n  ${writes} memories written. Waiting ${INDEX_WAIT_MS / 1000}s for indexing…`);
  await port.flush();
  await new Promise((r) => setTimeout(r, INDEX_WAIT_MS));

  console.log("\nSESSION 2 — fresh conversation, no history carried over");
  const results: Array<{
    ok: boolean;
    q: string;
    why: string;
    answer: string;
    full: string;
    injected: string[];
  }> = [];
  const onMs: number[] = [];
  for (const { q, expect, why } of ASK) {
    const began = Date.now();
    const turn = await completeTurn({
      model,
      port,
      messages: [{ role: "user", content: q }],
      channel: "demo",
      userHandle: "mai",
      memoryEnabled: true,
      sessionStart: true,
    });
    onMs.push(Date.now() - began);
    const ok = expect.test(turn.text);
    results.push({
      ok,
      q,
      why,
      answer: turn.text.replace(/\n/g, " ").slice(0, 120),
      full: turn.text,
      injected: turn.ctx.injected.map((m) => m.text),
    });
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${q}`);
    console.log(`        ${turn.text.replace(/\n/g, " ").slice(0, 140)}`);
    console.log(`        recalled ${turn.ctx.injected.length} memories`);
  }

  const nudged = results.filter((r) => PROMISE.test(r.full)).length;
  const nudgeOk = nudged > 0;
  console.log(`\nCOMMITMENT — did hippo bring up an overdue promise nobody asked about?`);
  console.log(
    `  ${nudgeOk ? "PASS" : "FAIL"}  ${nudged} of ${results.length} session-start answers mentioned the invoice for Linh`,
  );

  const styleAnswer = results.find((r) => r.q === "What do you know about me?")?.answer ?? "";
  const styleOk = VIETNAMESE.test(styleAnswer);
  console.log(`\nSTYLE — did a [style] memory change how it writes?`);
  console.log(
    `  ${styleOk ? "PASS" : "FAIL"}  the answer came back ${styleOk ? "in Vietnamese" : "in English"}, unprompted in this session`,
  );
  // Scored on one answer, reported on all: a change to what a session's first
  // turn recalls could lose the style memory for some questions and not others.
  const inVietnamese = results.filter((r) => VIETNAMESE.test(r.full)).length;
  console.log(
    `        ${inVietnamese} of ${results.length} answers in this session came back in Vietnamese`,
  );

  const cross = await crossChannelCheck(model, port.scope.namespace, {
    key: env.MEMWAL_PRIVATE_KEY,
    accountId: env.MEMWAL_ACCOUNT_ID,
    serverUrl: env.MEMWAL_SERVER_URL,
  });
  const crossOk = cross.ok;

  // Measured, not asserted: what was actually in context, and what came out.
  const direct = results.find((r) => r.q === "Which package manager should I use here?");
  const had = (texts: string[] = [], re: RegExp) => texts.some((t) => re.test(t));
  const answers = [
    ...results.map((r) => ({ q: r.q, text: r.full, injected: r.injected })),
    { q: "(cross-channel) Which ORM did we pick?", text: cross.text, injected: cross.injected },
  ];
  const stale = answers.filter((a) => STALE.test(a.text) && !CURRENT.test(a.text));
  const newestOk = Boolean(direct?.ok) && stale.length === 0;
  console.log(`\nCONFLICT — pnpm was taught, then corrected to bun. Did the correction win?`);
  console.log(
    `  ${direct?.ok ? "PASS" : "FAIL"}  asked directly: answered ${direct?.ok ? "bun" : "without bun"}; in context: pnpm memory ${had(direct?.injected, STALE) ? "yes" : "no"}, bun correction ${had(direct?.injected, CURRENT) ? "yes" : "no"}`,
  );
  console.log(
    `  ${stale.length ? "FAIL" : "PASS"}  ${stale.length} of ${answers.length} answers stated pnpm without bun`,
  );
  for (const a of stale) {
    console.log(
      `        "${a.q}" — the correction was ${had(a.injected, CURRENT) ? "in context and ignored" : "never recalled"}`,
    );
  }

  /**
   * Before and after, measured rather than claimed: the same four questions
   * with memory off. The eval fails if a memory-off answer knows something
   * nobody could guess, or comes back in Vietnamese unasked.
   */
  console.log(`\nBASELINE — the same questions, memory off`);
  const offMs: number[] = [];
  let baselineOk = true;
  for (const { q } of ASK) {
    const began = Date.now();
    const turn = await completeTurn({
      model,
      port,
      messages: [{ role: "user", content: q }],
      channel: "demo",
      userHandle: "mai",
      memoryEnabled: false,
    });
    offMs.push(Date.now() - began);
    const leak = CANNOT_GUESS[q]?.test(turn.text) || VIETNAMESE.test(turn.text);
    if (leak) baselineOk = false;
    const on = results.find((r) => r.q === q)?.answer ?? "";
    console.log(`  ${leak ? "FAIL" : CANNOT_GUESS[q] ? "PASS" : "    "}  ${q}`);
    console.log(`        off: ${turn.text.replace(/\n/g, " ").slice(0, 110)}`);
    console.log(`        on:  ${on.slice(0, 110)}`);
  }

  /**
   * What memory costs. Recall timed on its own, so the model's variance does
   * not hide it: a session's first turn runs the message recall, three
   * session-start pulls and the corrections pull, one after another; a turn
   * mid-session runs the message recall and the corrections pull.
   */
  const startMs: number[] = [];
  const midMs: number[] = [];
  const plainMs: number[] = [];
  for (const { q } of ASK) {
    // The third case is a later turn for someone who has never corrected
    // anything, where the server skips the corrections recall. Timing only:
    // this person does have a correction, so its answers are not scored.
    for (const [sessionStart, hasCorrections, into] of [
      [true, undefined, startMs],
      [false, undefined, midMs],
      [false, false, plainMs],
    ] as const) {
      const began = Date.now();
      await gatherContext({
        model,
        port,
        messages: [{ role: "user", content: q }],
        channel: "demo",
        userHandle: "mai",
        memoryEnabled: true,
        sessionStart,
        hasCorrections,
      });
      into.push(Date.now() - began);
    }
  }
  const s1 = (ms: number) => `${(ms / 1000).toFixed(1)}s`;
  console.log(`\nCOST — median over ${ASK.length} questions`);
  console.log(`  whole turn, memory on (first of a session):  ${s1(median(onMs))}`);
  console.log(`  whole turn, memory off:                      ${s1(median(offMs))}`);
  console.log(`  recall alone, first turn of a session:       ${s1(median(startMs))}`);
  console.log(`  recall alone, later turns:                   ${s1(median(midMs))}`);
  console.log(`  recall alone, later turns, no corrections:   ${s1(median(plainMs))}`);

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n${passed}/${results.length} recalled correctly across sessions.`);
  console.log(`newest fact wins:     ${newestOk ? "PASS" : "FAIL"}`);
  console.log(`style adaptation:     ${styleOk ? "PASS" : "FAIL"}`);
  console.log(`cross-channel recall: ${crossOk ? "PASS" : "FAIL"}`);
  console.log(`memory-off control:   ${baselineOk ? "PASS" : "FAIL"}`);
  console.log(`overdue commitment:   ${nudgeOk ? "PASS" : "FAIL"}`);
  console.log(`namespace: ${port.scope.namespace}`);
  if (passed < results.length || !crossOk || !styleOk || !newestOk || !baselineOk || !nudgeOk) {
    process.exitCode = 1;
  }
}

await main();
