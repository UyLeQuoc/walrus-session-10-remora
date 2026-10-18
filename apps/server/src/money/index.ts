/** Wires the money domain (A9·be, A4·be, E2, G1/G2, D1, D2) to the real env; tests use the factories directly. */
import { createLogger } from "@remora/chain";
import { db } from "../context.ts";
import { env } from "../env/load.ts";
import { startWorker } from "../runtime/jobs.ts";
import { startIndexer } from "../triggers/indexer.ts";
import { createNetworks } from "./networks.ts";
import { WAKE_ANCHOR, wakeAnchorHandler } from "./pay.ts";
import { createMoneyRoutes } from "./routes.ts";

export const log = createLogger({ service: "server" });
export const networks = createNetworks(env);
export const moneyRoutes = createMoneyRoutes({ networks, log });

/** Starts the D2 worker and one indexer per available network. Returns a stop function. */
export function startMoneyRuntime(): () => Promise<void> {
  const stops: (() => void | Promise<void>)[] = [];
  if (env.WORKER === "on") {
    stops.push(
      startWorker(db, { [WAKE_ANCHOR]: wakeAnchorHandler({ db, networks, log }) }, { log }),
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
        }),
      );
    }
  }
  log.info("money.runtime", { worker: env.WORKER, indexer: env.INDEXER });
  return async () => {
    await Promise.allSettled(stops.map((s) => s()));
  };
}
