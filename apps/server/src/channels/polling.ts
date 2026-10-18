/**
 * Keep Telegram's long polling alive through the errors that end it.
 *
 * grammY's `bot.start()` rejects when `getUpdates` answers 409, which Telegram
 * does whenever a second process polls the same bot. Every Railway deploy runs
 * the old and the new container side by side for a moment, so every deploy
 * produced one, and with `void bot.start()` the rejection went unhandled and
 * took the whole server down with it, web API included: 22 crashes in the 24
 * hours to 2026-09-25, against a restart policy that gives up after five.
 * `start()` resets its own state when it rejects, so calling it again is safe.
 */

export interface PollingDeps {
  start: () => Promise<void>;
  /** True once the adapter was asked to stop; the loop then ends quietly. */
  stopped: () => boolean;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
  now?: () => number;
}

const BASE_MS = 5_000;
const MAX_MS = 60_000;
/** A run this long was healthy, so the next failure starts the backoff again. */
const HEALTHY_MS = 5 * 60_000;

export function describePollingError(err: unknown): string {
  const code = (err as { error_code?: unknown } | null)?.error_code;
  if (code === 409) return "another process is polling this bot (409)";
  if (code === 401) return "Telegram refused the token (401)";
  const message = err instanceof Error ? err.message : String(err);
  return (message.split("\n")[0] ?? "").slice(0, 120);
}

export async function keepPolling({
  start,
  stopped,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  log = console.warn,
  now = Date.now,
}: PollingDeps): Promise<void> {
  let failures = 0;
  while (!stopped()) {
    const began = now();
    try {
      await start();
      return;
    } catch (err) {
      if (stopped()) return;
      failures = now() - began > HEALTHY_MS ? 1 : failures + 1;
      const wait = Math.min(MAX_MS, BASE_MS * 2 ** (failures - 1));
      log(`[telegram] polling stopped: ${describePollingError(err)}; retrying in ${wait / 1000}s`);
      await sleep(wait);
    }
  }
}
