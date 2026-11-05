/**
 * The HTTP side of U19 B1 (ADR-0145), mounted inside the remora routes:
 * - owner only (the wallet session and the id checks run first, and `service.get` checks the owner):
 *   `GET/POST /api/remoras/:id/audits`, `POST …/audits/confirm`, `POST …/audits/:capsuleId/revoke`
 *   and `…/revoke/confirm`;
 * - public: `GET /api/audit/:capsuleId`, only what the auditor's page needs to fetch and decrypt the
 *   bundle (blob id, key id, package, network). The plaintext never leaves the server but sealed.
 */
import type { Context } from "hono";
import {
  type AuditDeps,
  auditAccess,
  auditRevokeTx,
  auditShares,
  auditShareTx,
  confirmAuditRevoke,
  confirmAuditShare,
} from "./audit.ts";
import type { OwnerApp } from "./ledger-routes.ts";
import { RemoraError, type RemoraService } from "./remoras.ts";

const DIGEST = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const digestOf = (v: unknown) => {
  if (typeof v !== "string" || !DIGEST.test(v))
    throw new RemoraError("tx.bad_digest", "That isn't a transaction digest.");
  return v;
};

const body = async <T>(c: Context): Promise<T> => (await c.req.json().catch(() => ({}))) as T;

export function mountAudits(
  app: OwnerApp,
  d: { service: Pick<RemoraService, "get">; runtime: AuditDeps },
) {
  const { service, runtime: rt } = d;

  app.get("/api/remoras/:id/audits", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json({ shares: await auditShares(rt.db, r) });
  });

  app.post("/api/remoras/:id/audits", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const b = await body<{
      from?: string;
      to?: string;
      auditor?: string;
      days?: number;
      includeQuestions?: boolean;
    }>(c);
    return c.json(
      await auditShareTx(rt, r, {
        from: String(b.from ?? ""),
        to: String(b.to ?? ""),
        auditor: String(b.auditor ?? ""),
        days: Number(b.days ?? 7),
        includeQuestions: b.includeQuestions === true,
      }),
    );
  });

  app.post("/api/remoras/:id/audits/confirm", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const b = await body<{ digest?: string; draft?: unknown }>(c);
    return c.json(await confirmAuditShare(rt, r, digestOf(b.digest), b.draft));
  });

  app.post("/api/remoras/:id/audits/:capsuleId/revoke", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json(await auditRevokeTx(rt, r, c.req.param("capsuleId")));
  });

  app.post("/api/remoras/:id/audits/:capsuleId/revoke/confirm", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const b = await body<{ digest?: string }>(c);
    return c.json(await confirmAuditRevoke(rt, r, c.req.param("capsuleId"), digestOf(b.digest)));
  });

  // No session: the capsule id is in the link, and Seal decides who can open the bundle.
  app.get("/api/audit/:capsuleId", async (c) => {
    const access = await auditAccess(rt.db, c.req.param("capsuleId"));
    return access
      ? c.json(access)
      : c.json(
          { error: { code: "audit.not_found", message: "No auditor share with that id." } },
          404,
        );
  });
}
