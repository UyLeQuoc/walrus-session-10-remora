/**
 * The routes for statements (E6) and config history (N11), ADR-0122, mounted on the W2 app so they
 * share its session check, its network and its error sentences. Statements read the owner's remoras
 * on the session's network; history reads one of the owner's remoras.
 */
import type { SuiNetwork } from "@remora/chain";
import type { Hono } from "hono";
import type { Listings } from "../money/listings.ts";
import type { RuntimeDeps } from "./deps.ts";
import { listVersions, restoreVersion, versionDiff } from "./history.ts";
import { type Remora, RemoraError, type RemoraService } from "./remoras.ts";
import {
  checkMonth,
  dayIn,
  loadLedger,
  monthEnd,
  ownerTimezone,
  paymentsIn,
  statementCsv,
  statementOf,
} from "./statements.ts";

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

  /** The month asked for (default: this month where the owner is) and everything to compute it. */
  const month = async (owner: string, network: SuiNetwork, asked: string | undefined) => {
    const timezone = await ownerTimezone(rt.db, owner);
    const m = checkMonth(asked ?? dayIn(timezone)(new Date()).slice(0, 7));
    const mine = await service.list(owner, network);
    const ledger = await loadLedger(
      rt.db,
      mine.map((r) => r.id),
      network,
      monthEnd(m),
      rt.reef(network),
    );
    return { month: m, timezone, ledger, names: new Map(mine.map((r) => [r.id, r.name])) };
  };

  app.get("/api/statements", async (c) => {
    const s = await month(c.get("owner"), c.get("network"), c.req.query("month"));
    return c.json(statementOf({ ...s, network: c.get("network") }));
  });

  app.get("/api/statements/csv", async (c) => {
    const network = c.get("network");
    const s = await month(c.get("owner"), network, c.req.query("month"));
    c.header("content-type", "text/csv; charset=utf-8");
    c.header(
      "content-disposition",
      `attachment; filename="remora-statement-${network}-${s.month}.csv"`,
    );
    return c.body(
      statementCsv(paymentsIn(s.month, s.timezone, s.ledger.payments), s.names, rt.webBase),
    );
  });

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
