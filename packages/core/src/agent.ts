import {
  formatUntrustedMemories,
  isoDate,
  type MemoryPort,
  orderNewestFirst,
  type RecalledMemory,
} from "@remora/memory";
import { type ModelMessage, stepCountIs, streamText } from "ai";
import type { HippoModel } from "./model.ts";
import { buildSystemPrompt } from "./prompt.ts";
import { createTools } from "./tools.ts";

export interface TurnInput {
  model: HippoModel;
  port: MemoryPort;
  messages: ModelMessage[];
  channel: string;
  userHandle: string;
  memoryEnabled: boolean;
  /** First turn of a session: also pull profile/style/commitments with fixed queries. */
  sessionStart?: boolean;
  /**
   * False when the caller knows this person has never stored a correction, so
   * the corrections recall can be skipped. Undefined means unknown, and the
   * recall runs. Measured 2026-09-24, each recall costs about a second.
   */
  hasCorrections?: boolean;
  abortSignal?: AbortSignal;
  knownHashes?: ReadonlySet<string>;
  gettingToKnow?: boolean;
}

export interface TurnContext {
  injected: RecalledMemory[];
  styleHints: string[];
}

function lastUserText(messages: ModelMessage[]): string | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    const m = messages[i];
    if (m?.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    const text = m.content
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join(" ");
    return text || null;
  }
  return null;
}

/** Recall policy from docs/ARCHITECTURE.md §5: per-turn recall on the user message, plus session-start profile pulls. */
export async function gatherContext(input: TurnInput): Promise<TurnContext> {
  if (!input.memoryEnabled) return { injected: [], styleHints: [] };
  /**
   * The search string, not the message. A long paste is a legitimate thing to
   * send a bot, but sending all of it to the relayer as an embedding query is
   * slow, spends shared budget, and searches worse than the first couple of
   * sentences would. The model still sees the whole message.
   *
   * 300 characters is the same ceiling the `recall` tool's own schema enforces,
   * so the two paths cannot disagree.
   */
  const query = lastUserText(input.messages)?.slice(0, 300) ?? null;
  const seen = new Map<string, RecalledMemory>();
  const add = (list: RecalledMemory[]) => {
    for (const m of list) if (!seen.has(m.blob_id)) seen.set(m.blob_id, m);
  };
  // One at a time. Issuing them together did not help: measured 2026-09-24,
  // the relayer answers a key's recalls roughly one after another, so four in
  // parallel took about as long as four in a row, and only added load on a key
  // every guest shares. What cut the time was asking fewer questions
  // (docs/evidence/latency-2026-09-24.md).
  const jobs: Array<() => Promise<RecalledMemory[]>> = [];
  if (query) jobs.push(() => input.port.recall({ query, limit: 6 }));
  if (input.sessionStart) {
    /**
     * Who the person is, how they want replies, and what they promised, in one
     * recall. This was three natural-language queries, a second each. Every
     * memory's text begins with its type tag, so the tags themselves are the
     * query: measured on two namespaces, this one recall returned every
     * profile, style and commitment memory the three used to, between them.
     */
    jobs.push(() =>
      input.port.recall({ query: "[profile] [style] [commitment]", limit: 8, maxDistance: 0.75 }),
    );
  }
  for (const job of jobs) {
    if (input.abortSignal?.aborted) return { injected: [], styleHints: [] };
    try {
      add(await job());
    } catch (err) {
      console.warn("[memory] recall failed", err);
    }
  }
  if (input.abortSignal?.aborted) return { injected: [], styleHints: [] };
  const relevant = [...seen.values()].sort((a, b) => a.distance - b.distance).slice(0, 10);
  const corrections =
    input.hasCorrections === false ? [] : await recallCorrections(input.port, relevant);
  // Pick by relevance, then read newest first. Both steps matter: distance
  // decides which memories are worth injecting at all, and write time decides
  // which of two disagreeing ones the model meets first. Sorting by time alone
  // would let a recent irrelevant line crowd out an old exact match.
  const injected = orderNewestFirst([
    ...relevant,
    ...corrections.filter((c) => !relevant.some((m) => m.blob_id === c.blob_id)),
  ]);
  const styleHints = injected
    .filter((m) => m.parsed?.type === "style")
    .map((m) => m.parsed?.text ?? m.text);
  return { injected, styleHints };
}

/**
 * The person's corrections, whenever a fact they might correct was recalled.
 *
 * A correction only helps if the model sees it beside the fact it replaces,
 * and a topical recall does not put it there. Measured on 2026-09-24: asked
 * "what do you know about me?", the profile pull returned "I only use pnpm"
 * and never "we moved to bun", so the model stated pnpm as current. The two
 * are about the same thing; they are not close to the same *question*.
 *
 * Every correction's stored text starts with the tag `[correction]`, so the tag
 * is the query, and the parsed type — not the distance — decides membership.
 * The distance gap alone is too thin to cut on: the farthest correction sat at
 * 0.638 and a profile line that merely said "corrected" at 0.677
 * (packages/memory/scripts/spike-corrections.ts).
 *
 * One extra recall, run only when something correctable came back and the
 * caller has not said the person has none. It needs the first recalls' results,
 * so it cannot run alongside them.
 */
async function recallCorrections(
  port: MemoryPort,
  recalled: RecalledMemory[],
): Promise<RecalledMemory[]> {
  if (!recalled.some((m) => m.parsed?.type !== "correction")) return [];
  try {
    const found = await port.recall({ query: "[correction]", limit: 6 });
    return found.filter((m) => m.parsed?.type === "correction");
  } catch (err) {
    console.warn("[memory] corrections recall failed", err);
    return [];
  }
}

export function runTurn(input: TurnInput, ctx: TurnContext, useFallback = false) {
  const system = buildSystemPrompt({
    channel: input.channel,
    mode: input.port.scope.mode,
    memoryEnabled: input.memoryEnabled,
    userHandle: input.userHandle,
    today: isoDate(),
    styleHints: ctx.styleHints,
    sessionStart: input.sessionStart,
    gettingToKnow: input.gettingToKnow,
  });
  const messages: ModelMessage[] = [...input.messages];
  if (ctx.injected.length) {
    const block = formatUntrustedMemories(ctx.injected);
    const idx = messages.map((m) => m.role).lastIndexOf("user");
    messages.splice(Math.max(idx, 0), 0, { role: "user", content: block });
  }
  const model = useFallback ? input.model.fallback : input.model.primary;
  if (!model) throw new Error("No fallback model configured.");
  return streamText({
    model,
    system,
    messages,
    tools: input.memoryEnabled
      ? createTools(input.port, input.channel, input.knownHashes)
      : undefined,
    stopWhen: stepCountIs(4),
    abortSignal: input.abortSignal,
  });
}

/**
 * Convenience for non-streaming channels: gather, run, collect text.
 *
 * Falls back to the second model once if the first fails outright. A
 * `fallbackModel` had been constructed and wired to nothing since the beginning,
 * so the submission's claim that one was configured was true of the config and
 * false of the behaviour.
 *
 * Only this path falls back, which covers Telegram, Discord, Slack and the CLI.
 * The web chat streams, and by the time a stream fails its first bytes may
 * already be on the page, so it reports the failure instead. That asymmetry is
 * deliberate and is the reason this lives here rather than in `runTurn`.
 */
export async function completeTurn(
  input: TurnInput,
): Promise<{ text: string; ctx: TurnContext; writes: number }> {
  const ctx = await gatherContext(input);
  const collect = async (useFallback: boolean) => {
    const result = runTurn(input, ctx, useFallback);
    const text = await result.text;
    const steps = await result.steps;
    const writes = steps
      .flatMap((s) => s.toolCalls)
      .filter((c) => c.toolName === "remember").length;
    return { text, ctx, writes };
  };
  try {
    return await collect(false);
  } catch (err) {
    if (!input.model.fallback) throw err;
    console.warn("[model] primary failed, trying the fallback", err);
    return await collect(true);
  }
}
