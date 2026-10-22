/**
 * K1/K2 (ADR-0052): what the running server has observed about itself, for the health report:
 * errors per route (a small ring, no vendor), the last time the relayer said 429 to *our own*
 * calls (so health never spends budget to check it), and the chain watcher's progress.
 */
import type { RecentError } from "@remora/schema";

const MAX_ERRORS = 100;
const errors: { route: string; code: string; message: string; at: number }[] = [];

/** Errors an operator should see: server failures, and the codes that mean a dependency is struggling. */
export const isOpsError = (code: string, status: number) =>
  status >= 500 ||
  /^(relayer|sponsor|network|tx\.failed|hatchery\.walrus|playground\.(unavailable|failed)|x402\.gas)/.test(
    code,
  );

export function recordError(route: string, code: string, message: string, at = Date.now()) {
  errors.push({ route, code, message: message.slice(0, 200), at });
  if (errors.length > MAX_ERRORS) errors.splice(0, errors.length - MAX_ERRORS);
}

/** Grouped by route and code, newest first. */
export function recentErrors(): RecentError[] {
  const groups = new Map<string, RecentError>();
  for (const e of errors) {
    const key = `${e.route} ${e.code}`;
    const g = groups.get(key);
    groups.set(key, {
      route: e.route,
      code: e.code,
      message: e.message,
      count: (g?.count ?? 0) + 1,
      lastAt: new Date(Math.max(e.at, g ? Date.parse(g.lastAt) : 0)).toISOString(),
    });
  }
  return [...groups.values()].sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

let relayer429: { at: number; detail: string } | null = null;

/** Called wherever a relayer call fails; remembers a 429 (the account's budget). */
export function noteRelayerError(err: unknown, at = Date.now()) {
  const text = err instanceof Error ? err.message : String(err);
  if (/\b429\b|Rate limit exceeded|Too Many Requests/i.test(text))
    relayer429 = { at, detail: text.slice(0, 160) };
}

export const lastRelayer429 = () => relayer429;

const watchers = new Map<string, { checkpoint: number; at: number; subscriptions: number }>();

export function noteWatcher(
  network: string,
  update: { checkpoint?: number; subscriptions?: number },
) {
  const w = watchers.get(network) ?? { checkpoint: 0, at: 0, subscriptions: 0 };
  if (update.checkpoint !== undefined) {
    w.checkpoint = update.checkpoint;
    w.at = Date.now();
  }
  if (update.subscriptions !== undefined) w.subscriptions = update.subscriptions;
  watchers.set(network, w);
}

export const watcherState = (network: string) => watchers.get(network) ?? null;

/** Tests reset the module state between cases. */
export function resetSignals() {
  errors.length = 0;
  relayer429 = null;
  watchers.clear();
}
