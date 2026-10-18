/**
 * `bun run ops` — did anybody hit a failure in production over the last day?
 *
 * Run every morning of the real-use week by `bun run evidence:daily`, against the
 * production database. Writes come from `memory_index`; recall drops, give-ups
 * and command errors are only ever logged, so they are counted from Railway's
 * logs for every deployment that ran in the window. No memory text is read or
 * printed: log lines are counted by prefix, write errors are SDK and relayer
 * messages already stored in Postgres, masked before printing.
 *
 *   bun run ops                 the last 24 hours
 *   bun run ops --hours 72      a longer window, e.g. after a weekend
 *
 * If the logs cannot be read (no Railway CLI, not logged in, not linked), the
 * report says so and exits 1 rather than printing zeros that look like a clean
 * day.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { memoryIndex, sql, turnLog } from "@remora/db";
import { isConversationTurn } from "../src/chat/turn-modes.ts";
import { db } from "../src/context.ts";
import {
  type Deployment,
  deploymentsCovering,
  formatOps,
  type LogLine,
  summarizeLogs,
} from "../src/ops/report.ts";

const run = promisify(execFile);
const SERVICE = process.env.RAILWAY_SERVICE ?? "hippo-server";
const STUCK_AFTER_MIN = 10;

const hoursArg = process.argv.indexOf("--hours");
const hours = hoursArg > 0 ? Number(process.argv[hoursArg + 1]) : 24;
if (!Number.isFinite(hours) || hours <= 0) {
  console.error("--hours takes a positive number");
  process.exit(2);
}
const until = new Date();
const since = new Date(until.getTime() - hours * 3_600_000);

async function railway(args: string[]): Promise<string> {
  const { stdout } = await run("railway", args, { maxBuffer: 256 * 1024 * 1024 });
  return stdout;
}

async function readLogs(): Promise<{ lines: LogLine[]; deployments: number }> {
  const all = JSON.parse(
    await railway(["deployment", "list", "--service", SERVICE, "--json"]),
  ) as Deployment[];
  const covering = deploymentsCovering(all, since);
  const lines: LogLine[] = [];
  for (const d of covering) {
    const out = await railway([
      "logs",
      d.id,
      "--service",
      SERVICE,
      "--since",
      since.toISOString(),
      "--until",
      until.toISOString(),
      "--json",
    ]);
    for (const raw of out.split("\n")) {
      if (!raw.trim()) continue;
      try {
        const l = JSON.parse(raw) as { message?: string; timestamp?: string; level?: string };
        lines.push({ message: l.message ?? "", timestamp: l.timestamp ?? "", level: l.level });
      } catch {
        // A line the CLI did not emit as JSON is not ours to interpret.
      }
    }
  }
  return { lines, deployments: covering.length };
}

const inWindow = sql`${memoryIndex.createdAt} >= ${since.toISOString()} and ${memoryIndex.createdAt} <= ${until.toISOString()}`;

const failed = await db
  .select({ error: memoryIndex.error, channel: memoryIndex.channel })
  .from(memoryIndex)
  .where(sql`${inWindow} and ${memoryIndex.status} = 'failed'`);

const [counts] = await db
  .select({
    stored: sql<number>`count(*) filter (where ${memoryIndex.status} = 'stored')::int`,
    stuck: sql<number>`count(*) filter (where ${memoryIndex.status} = 'pending' and ${memoryIndex.createdAt} < now() - make_interval(mins => ${STUCK_AFTER_MIN}))::int`,
    inFlight: sql<number>`count(*) filter (where ${memoryIndex.status} = 'pending' and ${memoryIndex.createdAt} >= now() - make_interval(mins => ${STUCK_AFTER_MIN}))::int`,
  })
  .from(memoryIndex)
  .where(inWindow);

const [turns] = await db
  .select({
    turns: sql<number>`count(*) filter (where ${isConversationTurn})::int`,
    commands: sql<number>`count(*) filter (where ${turnLog.mode} = 'command')::int`,
  })
  .from(turnLog)
  .where(
    sql`${turnLog.createdAt} >= ${since.toISOString()} and ${turnLog.createdAt} <= ${until.toISOString()}`,
  );

let logs: Awaited<ReturnType<typeof readLogs>> | null = null;
let logsError: string | undefined;
try {
  logs = await readLogs();
} catch (e) {
  // The CLI's own message, which names what is missing: login, link or binary.
  logsError = (e instanceof Error ? e.message : String(e)).split("\n")[0]?.slice(0, 160);
}

const report = formatOps({
  since,
  until,
  turns: turns?.turns ?? 0,
  commands: turns?.commands ?? 0,
  writes: {
    failed,
    stuck: counts?.stuck ?? 0,
    inFlight: counts?.inFlight ?? 0,
    stored: counts?.stored ?? 0,
  },
  logs: logs ? summarizeLogs(logs.lines) : null,
  logsError,
  deployments: logs?.deployments ?? 0,
});
console.log(report.join("\n"));
process.exit(logs ? 0 : 1);
