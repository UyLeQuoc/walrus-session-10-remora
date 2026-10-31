/**
 * K2 (ADR-0052): one health report. Every probe has a timeout and turns into an item with a status,
 * the value it measured, the threshold, and a fix when it isn't ok. Nothing here spends the relayer
 * budget: the budget and memory items read the 429s and failures our own calls saw.
 */
import type { HealthItem, HealthReport, HealthStatus } from "@remora/schema";
import { tatumTrouble } from "./diagnose.ts";
import { lastRelayer429, recentErrors, relayerFailuresSince, watcherState } from "./signals.ts";

export interface HealthDeps {
  networks: string[];
  db: () => Promise<unknown>;
  /** The chain's latest checkpoint through Tatum. */
  tip: (network: string) => Promise<number>;
  relayerHealth: () => Promise<void>;
  /** The facilitator's `/supported`, reduced to its sponsor address (null: no facilitator here). */
  facilitator: (network: string) => Promise<{ sponsor: string | null } | null>;
  suiBalance: (network: string, address: string) => Promise<bigint>;
  queue: () => Promise<{ due: number; oldestDueMs: number | null }>;
  watcherOn: boolean;
  /** Tatum requests and stream frames in the last hour (ADR-0080). */
  tatumLastHour?: () => number;
  /** The playground funder's balances; null when the playground is off. */
  playground?: () => Promise<{ usdc: bigint; sui: bigint } | null>;
  now?: () => number;
  timeoutMs?: number;
}

const RANK: Record<HealthStatus, number> = { ok: 0, degraded: 1, down: 2 };
/** 1M credits a month on the free plan, spread over the hours of a month. */
const TATUM_HOURLY = 1_400;
const SUI = 1_000_000_000n;
const sui = (mist: bigint) => Number(mist) / Number(SUI);

const item = (
  name: string,
  status: HealthStatus,
  detail: string,
  extra: Partial<Pick<HealthItem, "value" | "threshold" | "fix">> = {},
): HealthItem => ({
  name,
  status,
  detail,
  value: extra.value ?? null,
  threshold: extra.threshold ?? null,
  fix: status === "ok" ? null : (extra.fix ?? null),
});

function within<T>(ms: number, p: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`no answer in ${ms} ms`)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function timed<T>(ms: number, fn: () => Promise<T>) {
  const started = Date.now();
  try {
    const value = await within(ms, fn());
    return { ok: true as const, value, ms: Date.now() - started };
  } catch (err) {
    return {
      ok: false as const,
      error: (err as Error).message.slice(0, 160),
      ms: Date.now() - started,
    };
  }
}

export async function healthReport(d: HealthDeps): Promise<HealthReport> {
  const now = d.now ?? Date.now;
  const t = d.timeoutMs ?? 5_000;
  const items: HealthItem[] = [];

  const db = await timed(t, d.db);
  items.push(
    db.ok
      ? item("database", db.ms > 500 ? "degraded" : "ok", `select 1 in ${db.ms} ms`, {
          value: db.ms,
          threshold: 500,
          fix: "Check the database's load and connection pool.",
        })
      : item("database", "down", db.error, { fix: "Check DATABASE_URL and that Postgres is up." }),
  );

  for (const network of d.networks) {
    const tip = await timed(t, () => d.tip(network));
    items.push(
      tip.ok
        ? item(
            `tatum (${network})`,
            tip.ms > 2_000 ? "degraded" : "ok",
            `latest checkpoint in ${tip.ms} ms`,
            {
              value: tip.ms,
              threshold: 2_000,
              fix: "Tatum is slow; check its status page and the key's rate limit.",
            },
          )
        : item(`tatum (${network})`, "down", tip.error, {
            fix:
              tatumTrouble(tip.error, network) ??
              `Check TATUM_API_KEY for ${network} and the gRPC URL.`,
          }),
    );
    if (d.watcherOn) {
      const w = watcherState(network);
      if (w && w.subscriptions === 0 && !w.at) {
        items.push(item(`checkpoint lag (${network})`, "ok", "no addresses to watch yet"));
      } else if (!w?.at || !tip.ok) {
        items.push(
          item(
            `checkpoint lag (${network})`,
            "degraded",
            "the watcher hasn't processed a checkpoint yet",
            {
              fix: "Wait a minute after boot; if it stays, check the watcher's reconnect logs.",
            },
          ),
        );
      } else {
        const lag = Math.max(0, Number(tip.value) - w.checkpoint);
        items.push(
          item(
            `checkpoint lag (${network})`,
            lag > 1_200 ? "down" : lag > 120 ? "degraded" : "ok",
            `the watcher is ${lag} checkpoints behind the tip, ${w.subscriptions} address(es) watched`,
            {
              value: lag,
              threshold: 120,
              fix: "The watcher is behind: check its stream and Tatum's limits.",
            },
          ),
        );
      }
    }

    const fac = await timed(t, () => d.facilitator(network));
    if (fac.ok && fac.value === null) {
      items.push(item(`facilitator (${network})`, "ok", "not configured on this server"));
    } else if (!fac.ok) {
      items.push(
        item(`facilitator (${network})`, "down", fac.error, {
          fix: `Check FACILITATOR_URL for ${network} and that the facilitator is up.`,
        }),
      );
    } else if (fac.value?.sponsor) {
      items.push(item(`facilitator (${network})`, "ok", "answers /supported"));
      const bal = await timed(t, () => d.suiBalance(network, fac.value?.sponsor ?? ""));
      const value = bal.ok ? sui(bal.value) : null;
      items.push(
        !bal.ok
          ? item(`sponsor gas (${network})`, "degraded", bal.error)
          : item(
              `sponsor gas (${network})`,
              bal.value < 50_000_000n ? "down" : bal.value < 200_000_000n ? "degraded" : "ok",
              `${value?.toFixed(3)} SUI`,
              { value, threshold: 0.2, fix: "Top up the gas station's sponsor address with SUI." },
            ),
      );
    } else {
      items.push(
        item(`facilitator (${network})`, "degraded", "answers, but sponsors no gas", {
          fix: `Set SPONSOR_PRIVATE_KEY for ${network} on the facilitator.`,
        }),
      );
    }
  }

  if (d.tatumLastHour) {
    // The free plan is 1M credits a month, about 1,400 an hour (ADR-0058).
    const n = d.tatumLastHour();
    items.push(
      n > TATUM_HOURLY
        ? item("tatum usage", "degraded", `${n} Tatum requests in the last hour`, {
            value: n,
            threshold: TATUM_HOURLY,
            fix: "On pace to spend the month's credits: look for an unfiltered stream or a loop of calls (ADR-0058).",
          })
        : item("tatum usage", "ok", `${n} Tatum requests in the last hour`, {
            value: n,
            threshold: TATUM_HOURLY,
          }),
    );
  }

  const relayer = await timed(t, d.relayerHealth);
  items.push(
    relayer.ok
      ? item("relayer", "ok", `/health in ${relayer.ms} ms`, { value: relayer.ms })
      : item("relayer", "down", relayer.error, {
          fix: "Check MEMWAL_SERVER_URL and the relayer's status.",
        }),
  );
  const last429 = lastRelayer429();
  const recent = last429 && now() - last429.at < 10 * 60_000;
  items.push(
    recent && last429
      ? item(
          "relayer budget",
          "degraded",
          `our calls got 429 ${Math.round((now() - last429.at) / 1000)} s ago: ${last429.detail}`,
          {
            value: "429",
            fix: "The account's hourly budget is spent: slow the pollers and wait for it to refill.",
          },
        )
      : item("relayer budget", "ok", "no 429 in the last 10 minutes"),
  );
  // `/health` can answer while every write fails behind it (the relayer's embedding was down on
  // Oct 22, ADR-0055), so this reads what our own recalls and writes saw.
  const failures = relayerFailuresSince(now() - 10 * 60_000);
  items.push(
    failures.count && failures.last
      ? item(
          "memory writes",
          "degraded",
          `${failures.count} recall or write failure(s) in the last 10 minutes, the last: ${failures.last.detail}`,
          {
            value: failures.count,
            threshold: 0,
            fix: "Memory is failing on the relayer's side; replies go on without it. Run bun run diagnose:memory, and send the relayer's traceId to the MemWal team.",
          },
        )
      : item("memory writes", "ok", "no recall or write failure in the last 10 minutes", {
          value: 0,
          threshold: 0,
        }),
  );

  const q = await timed(t, d.queue);
  if (!q.ok) items.push(item("job queue", "down", q.error, { fix: "Check the database." }));
  else {
    const age = q.value.oldestDueMs ?? 0;
    items.push(
      item(
        "job queue",
        age > 900_000 ? "down" : age > 120_000 ? "degraded" : "ok",
        `${q.value.due} due, the oldest waiting ${Math.round(age / 1000)} s`,
        {
          value: q.value.due,
          threshold: "oldest ≤ 120 s",
          fix: "Check that WORKER=on and the worker's logs.",
        },
      ),
    );
  }

  if (d.playground) {
    const pg = await timed(t, d.playground);
    if (pg.ok && pg.value) {
      const low = pg.value.usdc < 100_000n || pg.value.sui < 20_000_000n;
      items.push(
        item(
          "playground funder",
          low ? "degraded" : "ok",
          `${(Number(pg.value.usdc) / 1e6).toFixed(2)} USDC, ${sui(pg.value.sui).toFixed(3)} SUI`,
          {
            value: Number(pg.value.usdc) / 1e6,
            threshold: 0.1,
            fix: "Top up the playground wallet; the playground rests until then.",
          },
        ),
      );
    } else if (!pg.ok) {
      items.push(item("playground funder", "degraded", pg.error));
    }
  }

  const status = items.reduce<HealthStatus>(
    (w, i) => (RANK[i.status] > RANK[w] ? i.status : w),
    "ok",
  );
  return { status, items, errors: recentErrors(), checkedAt: new Date(now()).toISOString() };
}

/**
 * N20 (H2, ADR-0076): the public `/api/status`. Names and statuses only: the deep report's details,
 * values, thresholds, fixes and errors name balances and trace ids, which a public page has no use for.
 */
export function publicStatus(r: Pick<HealthReport, "status" | "items">) {
  return { status: r.status, items: r.items.map((i) => ({ name: i.name, status: i.status })) };
}
