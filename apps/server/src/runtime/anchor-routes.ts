/**
 * The HTTP side of B2 (ADR-0139), mounted inside the remora routes after the wallet and id checks:
 * `POST /api/remoras/:id/anchor` runs one Merkle batch now for the signed-in owner's remora, at most
 * once every 5 minutes. The hourly job runs the same batch for every remora.
 */
import type { SuiNetwork } from "@remora/chain";
import type { Hono } from "hono";
import { ANCHOR_MIN_GAP_MS, type AnchorDeps, anchorBatch } from "./anchors.ts";
import { RemoraError, type RemoraService } from "./remoras.ts";

type OwnerApp = Hono<{ Variables: { owner: string; network: SuiNetwork } }>;

export function mountAnchors(app: OwnerApp, d: { service: RemoraService; anchors: AnchorDeps }) {
  app.post("/api/remoras/:id/anchor", async (c) => {
    const r = await d.service.get(c.req.param("id"), c.get("owner"));
    const out = await anchorBatch(d.anchors, r, { minGapMs: ANCHOR_MIN_GAP_MS });
    if (out.ok || out.reason === "nothing_new") return c.json(out);
    throw new RemoraError(`anchor.${out.reason}`, out.message, 409);
  });
}
