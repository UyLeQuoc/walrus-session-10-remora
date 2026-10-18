/** Starts the facilitator: `PORT=8798 tsx src/main.ts` (ports 8787/5173 belong to another project). */
import { serve } from "@hono/node-server";
import { loadEnv } from "@remora/memory";
import { createFacilitatorApp } from "./app.ts";
import { checkSponsorBalances, facilitatorDepsFromEnv } from "./config.ts";
import { createFacilitator } from "./facilitator.ts";

loadEnv();
const deps = facilitatorDepsFromEnv();
const app = createFacilitatorApp(createFacilitator(deps));
const port = Number(process.env.FACILITATOR_PORT ?? 8798);
const low = BigInt(process.env.SPONSOR_LOW_BALANCE_MIST ?? 200_000_000);
const check = () =>
  checkSponsorBalances(deps, low).catch((e) =>
    deps.log.error("sponsor.balance_check", { error: e }),
  );
void check();
setInterval(check, 5 * 60_000).unref();
serve({ fetch: app.fetch, port }, (info) =>
  deps.log.info("facilitator.up", { port: info.port, networks: Object.keys(deps.networks) }),
);
