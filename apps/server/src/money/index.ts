/** Wires the money domain (A9·be, A4·be) to the real env; tests use `createMoneyRoutes` directly. */
import { createLogger } from "@remora/chain";
import { env } from "../env/load.ts";
import { createNetworks } from "./networks.ts";
import { createMoneyRoutes } from "./routes.ts";

export const log = createLogger({ service: "server" });
export const networks = createNetworks(env);
export const moneyRoutes = createMoneyRoutes({ networks, log });
