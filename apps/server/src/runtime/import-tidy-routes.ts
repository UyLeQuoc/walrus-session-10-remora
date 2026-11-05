/**
 * The HTTP side of A4 and A3 (ADR-0146, ADR-0147), mounted inside the remora routes after the wallet
 * and id checks, so every route answers for the signed-in owner only:
 * - `POST /api/remoras/:id/import/preview {fileName?, text}` → candidate lines and a preview id;
 * - `POST /api/remoras/:id/import/commit {previewId, ticked, namespace}` → written and index ids;
 * - `GET /api/remoras/:id/tidy` → recent tidies and open conflicts (the Tidied tab);
 * - `POST /api/remoras/:id/tidy` → tidy now;
 * - `POST /api/approvals/:id/conflict-resolve {keep: "a" | "b"}`, `POST …/conflict-dismiss`.
 */
import type { SuiNetwork } from "@remora/chain";
import { and, eq, isNotNull, ne, remoraEvents, remoraMemories } from "@remora/db";
import {
  createClient,
  createMemoryPort,
  limiterFor,
  RelayerExtras,
  runLimited,
} from "@remora/memory";
import type { Context, Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import type { RuntimeDeps } from "./deps.ts";
import {
  type Analyzer,
  commitImport,
  importError,
  importNamespaces,
  prepareImport,
  savePreview,
  stagingNamespace,
} from "./import.ts";
import { IMPORT_MAX_BYTES, MAX_TICKED } from "./import-parse.ts";
import { namespaceFor, type RemoraRef } from "./memory.ts";
import { memoryIndexFor } from "./memory-controls.ts";
import { RemoraError, type RemoraService } from "./remoras.ts";
import { dismissConflict, resolveConflict, tidy, tidyView } from "./tidy.ts";

type OwnerApp = Hono<{ Variables: { owner: string; network: SuiNetwork } }>;
type Operator = { key: string; accountId: string; serverUrl: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PreviewBody = z.object({
  fileName: z.string().max(200).optional(),
  text: z.string().min(1).max(IMPORT_MAX_BYTES),
});
const CommitBody = z.object({
  previewId: z.string().regex(UUID),
  ticked: z.array(z.number().int().nonnegative()).min(1).max(MAX_TICKED),
  namespace: z.string().min(1).max(40),
});
const ResolveBody = z.object({ keep: z.enum(["a", "b"]) });
/** The analyzer's own deadline per chunk: one slow chunk leaves the rest to the line split. */
const ANALYZE_TIMEOUT_MS = 45_000;

const approvalId = (c: Context) => {
  const v = c.req.param("id") ?? "";
  if (!UUID.test(v)) throw new RemoraError("approval.not_found", "Not found.", 404);
  return v;
};

/** The relayer's `analyze`, writing its extractions only to the staging namespace. */
function analyzerFor(operator: Operator, r: RemoraRef): Analyzer {
  const namespace = stagingNamespace(r);
  const client = createClient({ mode: "guest", ...operator, namespace });
  const limiter = limiterFor(operator.key);
  return async (text, occurredAt) => {
    const signal = AbortSignal.timeout(ANALYZE_TIMEOUT_MS);
    const out = await runLimited(limiter, () =>
      client.analyze(text, { namespace, signal, ...(occurredAt ? { occurredAt } : {}) }),
    );
    return out.facts.map((f) => f.text);
  };
}

export function mountImportTidy(
  app: OwnerApp,
  d: { runtime: RuntimeDeps; service: RemoraService; operator?: Operator },
) {
  const { runtime: rt, service } = d;

  app.post(
    "/api/remoras/:id/import/preview",
    bodyLimit({
      maxSize: IMPORT_MAX_BYTES + 64 * 1024,
      onError: (c) =>
        c.json(
          { error: { code: "import.too_big", message: "Import at most 5 MB at a time." } },
          413,
        ),
    }),
    async (c) => {
      const r = await service.get(c.req.param("id"), c.get("owner"));
      const body = PreviewBody.safeParse(await c.req.json().catch(() => null));
      if (!body.success)
        throw new RemoraError(
          "import.bad_request",
          "Paste the text or upload a file (5 MB at most).",
        );
      if (!rt.limiter.take(`import:${r.id}`, { limit: 6, ms: 3_600_000 }).allowed)
        throw new RemoraError("rate_limited", "Six imports an hour: try again later.", 409);
      const prepared = await prepareImport(
        { ...(body.data.fileName ? { fileName: body.data.fileName } : {}), text: body.data.text },
        d.operator ? analyzerFor(d.operator, r) : undefined,
      ).catch(importError);
      const stored = savePreview(prepared, { owner: c.get("owner"), remoraId: r.id });
      const namespaces = importNamespaces(service.config(r).namespaces);
      return c.json({
        previewId: stored.id,
        fileName: stored.fileName,
        sha8: stored.sha8,
        kind: stored.kind,
        chunks: stored.chunks,
        analyzed: stored.analyzed,
        failed: stored.failed,
        scrubbed: stored.scrubbed,
        candidates: stored.candidates,
        namespaces,
        defaultNamespace: namespaces.includes("me") ? "me" : (namespaces[0] ?? "me"),
        maxTicked: MAX_TICKED,
        source: `SOURCE: import ${stored.fileName} ${stored.sha8}`,
        expiresAt: new Date(stored.createdAt + 30 * 60_000).toISOString(),
      });
    },
  );

  app.post("/api/remoras/:id/import/commit", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const body = CommitBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success)
      throw new RemoraError(
        "import.bad_request",
        `Tick 1 to ${MAX_TICKED} lines and pick a namespace.`,
      );
    const operator = d.operator;
    if (!operator) throw new RemoraError("memory.unavailable", "Memory isn't set up here.", 409);
    const index = memoryIndexFor(rt.db);
    const out = await commitImport(
      {
        log: rt.log,
        writer: (ref, ns) =>
          createMemoryPort({
            scope: { mode: "guest", ...operator, namespace: namespaceFor(ref, ns) },
            by: "import",
            channel: "remora",
            onWrite: (e) =>
              index.onWrite(ref, ns, e).catch((err) => {
                rt.log.warn("memory.index_failed", { remora: ref.id, ns, error: err });
                return undefined;
              }),
          }),
        knownHashes: async (ref, ns) => {
          const rows = await rt.db
            .select({ sha: remoraMemories.textSha256 })
            .from(remoraMemories)
            .where(
              and(
                eq(remoraMemories.remoraId, ref.id),
                eq(remoraMemories.namespace, ns),
                ne(remoraMemories.status, "failed"),
                isNotNull(remoraMemories.textSha256),
              ),
            );
          return new Set(rows.flatMap((x) => (x.sha ? [x.sha] : [])));
        },
        record: async (ref, summary, payload) => {
          await rt.db
            .insert(remoraEvents)
            .values({ remoraId: ref.id, network: r.network, type: "action", summary, payload });
        },
        forgetStaging: async (ref) => {
          await new RelayerExtras(operator).forget(stagingNamespace(ref));
        },
      },
      r,
      c.get("owner"),
      body.data,
      service.config(r).namespaces,
    );
    return c.json(out);
  });

  app.get("/api/remoras/:id/tidy", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json(await tidyView(rt, r));
  });

  app.post("/api/remoras/:id/tidy", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    if (!rt.limiter.take(`tidy:${r.id}`, { limit: 6, ms: 3_600_000 }).allowed)
      throw new RemoraError("rate_limited", "Six tidies an hour: try again later.", 409);
    const out = await tidy(rt, r, { trigger: "owner" });
    return c.json({ ...out, ...(await tidyView(rt, r)) });
  });

  app.post("/api/approvals/:id/conflict-resolve", async (c) => {
    const body = ResolveBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw new RemoraError("conflict.bad_request", "Say which one holds.");
    return c.json(
      await resolveConflict(rt, service, c.get("owner"), approvalId(c), body.data.keep),
    );
  });

  app.post("/api/approvals/:id/conflict-dismiss", async (c) =>
    c.json(await dismissConflict(rt, c.get("owner"), approvalId(c))),
  );
}
