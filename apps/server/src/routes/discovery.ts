/**
 * U19 C4 (ADR-0141): the public facilitator's Bazaar catalog, `GET /api/facilitator/discovery/resources`
 * (`?type&payTo&network&scheme&limit&offset`). Public and read-only; the API's per-address ceiling
 * applies, and the catalog is built at most once a minute.
 */
import { Hono } from "hono";
import { createDiscovery, discoveryQuery } from "../money/discovery.ts";
import { log, networks } from "../money/index.ts";
import { reef, reputation } from "../runtime/index.ts";

const discovery = createDiscovery({
  entries: () => reef("testnet"),
  scores: () => reputation.scores("testnet"),
  config: () => {
    const c = networks.config("testnet");
    return { usdc: c.usdcCoinType, facilitatorUrl: c.facilitatorUrl };
  },
  disc: process.env.MERCHANT_REQUIRE_DISC === "1",
  allowPrivate: !process.env.RAILWAY_ENVIRONMENT && process.env.NODE_ENV !== "production",
  log,
});

export const discoveryRoutes = new Hono();

discoveryRoutes.get("/api/facilitator/discovery/resources", async (c) => {
  const q = discoveryQuery.safeParse(c.req.query());
  if (!q.success)
    return c.json(
      {
        error: {
          code: "discovery.bad_query",
          message: "limit is 1–100 and offset 0 or more, both whole numbers.",
        },
      },
      400,
    );
  c.header("cache-control", "public, max-age=60");
  return c.json(await discovery.resources(q.data));
});
