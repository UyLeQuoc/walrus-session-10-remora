/**
 * The routes for config history (N11), ADR-0122, mounted on the W2 app so they share its session
 * check, its network and its error sentences. History reads one of the owner's remoras.
 */
import type { SuiNetwork } from "@remora/chain";
import type { Hono } from "hono";
import type { Listings } from "../money/listings.ts";
import type { RuntimeDeps } from "./deps.ts";
import { listVersions, restoreVersion, versionDiff } from "./history.ts";
import { type Remora, RemoraError, type RemoraService } from "./remoras.ts";

export type OwnerApp = Hono<{ Variables: { owner: string; network: SuiNetwork } }>;

export interface LedgerRouteDeps {
  service: RemoraService;
  runtime: RuntimeDeps;
  listings?: Listings | undefined;
}

const VERSION = /^(initial|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

export function mountLedger(app: OwnerApp, d: LedgerRouteDeps) {
  const { service, runtime: rt } = d;
  const view = (r: Remora) => ({ ...JSON.parse(JSON.stringify(r)), config: service.config(r) });

  const versionId = (v: string | undefined) => {
    if (!v || !VERSION.test(v))
      throw new RemoraError("history.not_found", "No such version of this remora.", 404);
    return v.toLowerCase();
  };

  app.get("/api/remoras/:id/history", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json({ versions: await listVersions(rt.db, r) });
  });

  app.get("/api/remoras/:id/history/:version", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json(await versionDiff(rt.db, r, versionId(c.req.param("version"))));
  });

  app.post("/api/remoras/:id/history/:version/restore", async (c) => {
    const owner = c.get("owner");
    const r = await service.get(c.req.param("id"), owner);
    const out = await restoreVersion(
      { runtime: rt, service, listings: d.listings },
      r,
      owner,
      versionId(c.req.param("version")),
    );
    return c.json({ ...out, remora: view(out.remora) });
  });
}
