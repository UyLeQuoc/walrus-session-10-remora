/**
 * Did anyone hit a failure yesterday? The morning check for the real-use week.
 *
 * Two sources that already exist are enough: `memory_index`, where every write
 * carries its status and error, and the server's own log lines, where every
 * failure a person can feel starts with a fixed prefix. Recall drops and
 * command errors never reach Postgres, and adding a table for them would be a
 * production schema change, so they are counted from the logs.
 *
 * Log lines are classified by prefix and counted, and their bodies are never
 * printed: an error or a stack trace can quote what somebody said, and this
 * report is written into a committed file. Pure, so it is tested in CI.
 */

export interface LogLine {
  timestamp: string;
  message: string;
  level?: string;
}

export type Kind =
  | "recall-dropped"
  | "recall-gave-up"
  | "recall-failed"
  | "write-failed"
  | "dedupe-failed"
  | "model-fallback"
  | "turn-failed"
  | "command-failed"
  | "stream-failed"
  | "adapter-failed"
  | "bookkeeping-failed"
  | "export-degraded"
  | "startup-failed"
  | "process-crashed"
  | "unhandled";

/** What each kind means for the person on the other end, in report order. */
export const KINDS: Record<Kind, string> = {
  "process-crashed": "server crashes: Node exited on an uncaught error, every channel down",
  "recall-gave-up": "recalls given up: every attempt dropped, so that turn had no memory",
  "recall-dropped": "recall attempts dropped by the relayer and retried",
  "recall-failed": "recalls that threw; the turn went on without that context",
  "write-failed": "memory writes that never landed, after retries",
  "dedupe-failed": "dedupe checks that failed, so the write went ahead unchecked",
  "turn-failed": "turns that failed and got an apology instead of an answer",
  "command-failed": "slash commands that failed",
  "stream-failed": "web replies whose stream broke",
  "model-fallback": "turns where the primary model failed and the fallback answered",
  "adapter-failed": "chat adapter errors (Telegram, Discord, Slack)",
  "bookkeeping-failed": "turn or command logs not written (evidence undercounts)",
  "export-degraded": "exports that could not read something and said so",
  "startup-failed": "server starts refused for invalid environment",
  unhandled: "rejections nothing handled; logged, and the server stayed up",
};

const CHANNEL = /^\[(web|cli|telegram|discord|slack)\] (turn failed|command failed|logTurn)\b/;

const PREFIXES: Array<[RegExp, Kind]> = [
  [/^\[memory\] recall in \S+ dropped all \d+ candidates/, "recall-dropped"],
  [/^\[memory\] recall in \S+ gave up after/, "recall-gave-up"],
  [/^\[memory\] (recall|corrections recall|secondary recall) failed/, "recall-failed"],
  [/^\[memory\] write failed in /, "write-failed"],
  [/^\[memory\] dedupe check failed in /, "dedupe-failed"],
  [/^\[model\] primary failed/, "model-fallback"],
  [/^\[web\] stream failed/, "stream-failed"],
  [/^\[(telegram|discord|slack)\] (failed to start|polling stopped)/, "adapter-failed"],
  [/^\[ratelimit\] noteCommand/, "bookkeeping-failed"],
  [/^\[export\] /, "export-degraded"],
  [/^Invalid environment:/, "startup-failed"],
  // Node prints its version as the last line of an uncaught exception's exit.
  [/^Node\.js v\d+\.\d+\.\d+$/, "process-crashed"],
  [/^\[process\] unhandled rejection/, "unhandled"],
];

export interface Classified {
  kind: Kind;
  channel?: string;
}

export function classify(line: LogLine): Classified | null {
  const message = line.message.trimStart();
  const ch = CHANNEL.exec(message);
  if (ch) {
    const what = ch[2];
    const kind: Kind =
      what === "turn failed"
        ? "turn-failed"
        : what === "command failed"
          ? "command-failed"
          : "bookkeeping-failed";
    return { kind, channel: ch[1] };
  }
  for (const [re, kind] of PREFIXES) if (re.test(message)) return { kind };
  // grammY's bot.catch logs "[telegram]" and then the error, at error level.
  if (/^\[telegram\] /.test(message) && line.level === "error") {
    return { kind: "adapter-failed", channel: "telegram" };
  }
  return null;
}

export interface LogSummary {
  lines: number;
  counts: Partial<Record<Kind, number>>;
  byChannel: Partial<Record<Kind, Record<string, number>>>;
  /** Error-level lines no prefix matched, stack frames included. */
  unclassifiedErrors: number;
}

export function summarizeLogs(lines: LogLine[]): LogSummary {
  const out: LogSummary = { lines: lines.length, counts: {}, byChannel: {}, unclassifiedErrors: 0 };
  for (const line of lines) {
    const c = classify(line);
    if (!c) {
      if (line.level === "error") out.unclassifiedErrors++;
      continue;
    }
    out.counts[c.kind] = (out.counts[c.kind] ?? 0) + 1;
    if (c.channel) {
      const per = out.byChannel[c.kind] ?? {};
      per[c.channel] = (per[c.channel] ?? 0) + 1;
      out.byChannel[c.kind] = per;
    }
  }
  return out;
}

/**
 * A write's error with ids, hashes and numbers masked, so identical failures
 * group together. Write errors come from the SDK and the relayer, not from the
 * memory, and are already stored in `memory_index.error`.
 */
export function errorKind(error: string | null): string {
  if (!error) return "(no error recorded)";
  return (
    error
      .split("\n")[0]
      ?.replace(/0x[0-9a-fA-F]+/g, "0x…")
      .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "<id>")
      .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "<id>")
      .replace(/\d+/g, "N")
      .slice(0, 100) ?? "(no error recorded)"
  );
}

export interface WriteTrouble {
  failed: Array<{ error: string | null; channel: string }>;
  /** Pending past the point a write can still land. */
  stuck: number;
  /** Pending and still young enough to be in flight. */
  inFlight: number;
  stored: number;
}

export interface Deployment {
  id: string;
  status: string;
  createdAt: string;
}

/** Statuses of a deployment that never ran, so it has no runtime logs. */
const NEVER_RAN = new Set(["FAILED", "SKIPPED", "QUEUED", "INITIALIZING", "BUILDING"]);

/**
 * The deployments whose logs cover a window: every one created inside it, and
 * the last few created before it, one of which was running when it opened.
 * Railway's `logs` reads one deployment at a time, so a redeploy mid-window
 * would otherwise hide everything before it. Replaced deployments show as
 * REMOVED, including some superseded while still building, which is why more
 * than one from before the window is read; a deployment with no lines in the
 * window costs one empty call.
 */
export function deploymentsCovering(all: Deployment[], since: Date, before = 3): Deployment[] {
  const ran = all
    .filter((d) => !NEVER_RAN.has(d.status))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const inside = ran.filter((d) => new Date(d.createdAt) >= since);
  const earlier = ran.filter((d) => new Date(d.createdAt) < since).slice(-before);
  return [...earlier, ...inside];
}

export interface OpsInput {
  since: Date;
  until: Date;
  turns: number;
  commands: number;
  writes: WriteTrouble;
  /** null when the logs could not be read; the report says so rather than looking clean. */
  logs: LogSummary | null;
  logsError?: string;
  deployments: number;
}

export function formatOps(input: OpsInput): string[] {
  const { writes, logs } = input;
  const out: string[] = [];
  out.push(`## What went wrong, ${input.since.toISOString()} to ${input.until.toISOString()}`);
  out.push("");
  out.push(`Conversation turns in the window: ${input.turns}, slash commands: ${input.commands}.`);
  out.push("");
  out.push("### Writes (from memory_index)");
  out.push(`  stored:            ${writes.stored}`);
  out.push(`  failed:            ${writes.failed.length}`);
  out.push(`  stuck in pending:  ${writes.stuck}  (older than 10 minutes; a write lands in ~25 s)`);
  out.push(`  still in flight:   ${writes.inFlight}`);
  const groups = new Map<string, number>();
  for (const f of writes.failed) {
    const k = `${f.channel}: ${errorKind(f.error)}`;
    groups.set(k, (groups.get(k) ?? 0) + 1);
  }
  for (const [k, n] of [...groups].sort((a, b) => b[1] - a[1])) out.push(`    ${n} × ${k}`);
  out.push("");
  out.push("### From the server logs");
  if (!logs) {
    out.push(`  LOGS NOT READ: ${input.logsError ?? "unknown reason"}`);
    out.push("  Everything below the writes is unknown for this window, not zero.");
  } else {
    out.push(`  ${logs.lines} lines from ${input.deployments} deployment(s)`);
    for (const kind of Object.keys(KINDS) as Kind[]) {
      const n = logs.counts[kind] ?? 0;
      const per = logs.byChannel[kind];
      const split = per
        ? `  (${Object.entries(per)
            .map(([c, v]) => `${c} ${v}`)
            .join(", ")})`
        : "";
      out.push(`  ${String(n).padStart(4)}  ${KINDS[kind]}${split}`);
    }
    out.push(
      `  ${String(logs.unclassifiedErrors).padStart(4)}  other error-level lines, stack frames included`,
    );
  }
  out.push("");
  out.push(`Verdict: ${verdict(input)}`);
  return out;
}

export function verdict(input: OpsInput): string {
  const felt =
    input.writes.failed.length +
    input.writes.stuck +
    (input.logs
      ? (input.logs.counts["recall-gave-up"] ?? 0) +
        (input.logs.counts["turn-failed"] ?? 0) +
        (input.logs.counts["command-failed"] ?? 0) +
        (input.logs.counts["stream-failed"] ?? 0) +
        (input.logs.counts["startup-failed"] ?? 0) +
        (input.logs.counts["process-crashed"] ?? 0)
      : 0);
  if (!input.logs) return `logs unread; ${felt} write problem(s) seen. Read the logs by hand.`;
  if (felt === 0) return "nobody hit a failure they could feel.";
  return `${felt} failure(s) a person could feel. \`railway logs --service hippo-server --since 1d\` has the details.`;
}
