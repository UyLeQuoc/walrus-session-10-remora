/** Wires the money domain (A9·be, A4·be, E2, G1/G2, D1, D2) to the real env; tests use the factories directly. */
import { createLogger, type SuiNetwork } from "@remora/chain";
import { db } from "../context.ts";
import { env } from "../env/load.ts";
import { type JobHandler, startWorker } from "../runtime/jobs.ts";
import { type IndexerOptions, startIndexer } from "../triggers/indexer.ts";
import { createNetworks } from "./networks.ts";
import { WAKE_ANCHOR, wakeAnchorHandler } from "./pay.ts";
import { createMoneyRoutes } from "./routes.ts";

export const log = createLogger({ service: "server" });
export const networks = createNetworks(env);
export const moneyRoutes = createMoneyRoutes({ networks, log });

/** Starts the D2 worker (plus `extraJobs`, e.g. the remora jobs) and one indexer per network. */
export function startMoneyRuntime(
  extraJobs: Record<string, JobHandler> = {},
  hooks: {
    onHatchery?: (
      network: SuiNetwork,
      events: Parameters<NonNullable<IndexerOptions["onHatchery"]>>[0],
    ) => Promise<unknown>;
  } = {},
): () => Promise<void> {
  const stops: (() => void | Promise<void>)[] = [];
  if (env.WORKER === "on") {
    stops.push(
      startWorker(
        db,
        { ...extraJobs, [WAKE_ANCHOR]: wakeAnchorHandler({ db, networks, log }) },
        { log },
      ),
    );
  }
  if (env.INDEXER === "on") {
    for (const n of networks.list()) {
      if (!n.available || !n.packageId) continue;
      stops.push(
        startIndexer({
          network: n.network,
          packageId: n.packageId,
          client: networks.client(n.network),
          db,
          log,
          hatcheryPackageId: n.hatcheryPackageId,
          ...(hooks.onHatchery
            ? { onHatchery: (events) => hooks.onHatchery?.(n.network, events) ?? Promise.resolve() }
            : {}),
        }),
      );
    }
  }
  log.info("money.runtime", { worker: env.WORKER, indexer: env.INDEXER });
  return async () => {
    await Promise.allSettled(stops.map((s) => s()));
  };
}
