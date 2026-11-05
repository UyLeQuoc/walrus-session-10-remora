/**
 * The HTTP side of A1 and A2 (ADR-0136, ADR-0137), mounted inside the remora routes after the wallet
 * and id checks, so every route answers for the signed-in owner only:
 * - `GET /api/remoras/:id/replay` → past questions and recent runs;
 * - `POST /api/remoras/:id/replay {questions, t0?}` → `{runId}` (one at a time, 3 an hour);
 * - `GET /api/remoras/:id/replay/:runId` → the run so far;
 * - `GET /api/remoras/:id/rules` → accepted rules and the open proposal;
 * - `POST /api/remoras/:id/rules/check` → run the heartbeat now;
 * - `POST /api/remoras/:id/rules/:ruleId/remove`;
 * - `POST /api/approvals/:id/rule-accept`, `POST /api/approvals/:id/rule-decline`.
 */
import type { SuiNetwork } from "@remora/chain";
import type { Context, Hono } from "hono";
import { z } from "zod";
import { canonicalName, isSuiName, namesOf, resolveName } from "../money/names.ts";
import { NETWORK_HEADER, resolveNetwork } from "../money/networks.ts";
import { billAction, billOf, readBillPhoto } from "./bill.ts";
import type { RuntimeDeps } from "./deps.ts";
import { acceptRule, declineRule, heartbeat, removeRule, rulesView } from "./heartbeat.ts";
import { RemoraError, type RemoraService } from "./remoras.ts";
import { pastQuestions, replayRun, replayRuns, startReplay } from "./replay.ts";

type OwnerApp = Hono<{ Variables: { owner: string; network: SuiNetwork } }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ReplayBody = z.object({
  questions: z.array(z.string().trim().min(1).max(500)).min(1).max(12),
  t0: z.iso.datetime({ offset: true }).optional(),
});

const uuidParam = (c: Context, name: string, what: string) => {
  const v = c.req.param(name) ?? "";
  if (!UUID.test(v)) throw new RemoraError(`${what}.not_found`, "Not found.", 404);
  return v;
};

const BillBody = z.object({ image: z.string().min(16).max(7_200_000) });
const BillAct = z.union([
  z.object({
    kind: z.literal("split"),
    with: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
    amount: z.string().max(16).optional(),
  }),
  z.object({
    kind: z.literal("pay"),
    to: z.string().trim().min(1).max(40),
    amount: z.string().max(16).optional(),
  }),
]);

export function mountReplay(app: OwnerApp, d: { runtime: RuntimeDeps; service: RemoraService }) {
  const { runtime: rt, service } = d;

  app.get("/api/remoras/:id/replay", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const [questions, runs] = await Promise.all([pastQuestions(rt, r), replayRuns(rt, r)]);
    return c.json({
      questions,
      runs,
      defaultT0: new Date(r.createdAt.getTime() + 86_400_000).toISOString(),
    });
  });

  app.post("/api/remoras/:id/replay", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const body = ReplayBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success)
      throw new RemoraError("replay.bad_request", "Send 1 to 12 questions, and T₀ as a date.");
    const { runId } = await startReplay(rt, r, {
      questions: body.data.questions,
      ...(body.data.t0 ? { t0: new Date(body.data.t0) } : {}),
    });
    return c.json({ runId }, 202);
  });

  app.get("/api/remoras/:id/replay/:runId", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json(await replayRun(rt, r, uuidParam(c, "runId", "replay")));
  });

  app.get("/api/remoras/:id/rules", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json(await rulesView(rt, r));
  });

  app.post("/api/remoras/:id/rules/check", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const out = await heartbeat(rt, r);
    return c.json({ ...out, ...(await rulesView(rt, r)) });
  });

  app.post("/api/remoras/:id/rules/:ruleId/remove", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    await removeRule(rt, service, r, c.req.param("ruleId") ?? "");
    return c.json(await rulesView(rt, await service.get(r.id, c.get("owner"))));
  });

  // C2 (ADR-0138): a bill from a photo. The image is read and dropped; only the card is kept.
  app.post("/api/remoras/:id/bill", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const body = BillBody.safeParse(await c.req.json().catch(() => null));
    if (!body.success) throw new RemoraError("bill.bad_request", "Attach one photo of a bill.");
    const b64 = body.data.image.replace(/^data:[^;]+;base64,/, "");
    return c.json(await readBillPhoto(rt, r, new Uint8Array(Buffer.from(b64, "base64")), "web"));
  });

  app.get("/api/remoras/:id/bill/:eventId", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json(await billOf(rt, r, uuidParam(c, "eventId", "bill")));
  });

  app.post("/api/remoras/:id/bill/:eventId/act", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const body = BillAct.safeParse(await c.req.json().catch(() => null));
    if (!body.success)
      throw new RemoraError("bill.bad_request", "Split it with someone, or pay a contact.");
    return c.json(await billAction(rt, r, uuidParam(c, "eventId", "bill"), body.data));
  });

  // C1 (ADR-0144): `.sui` names, both ways, over gRPC NameService (cached an hour).
  // Public, like the chain it reads: pay links and public pages show names to signed-out visitors.
  const namesNet = (c: Context) => resolveNetwork(rt.networks, c.req.header(NETWORK_HEADER));
  const namesLimited = () => {
    if (!rt.limiter.take("names", { limit: 600, ms: 60_000 }).allowed)
      throw new RemoraError("rate_limited", "Too many name lookups: try again in a minute.", 409);
  };
  app.get("/api/names/resolve", async (c) => {
    namesLimited();
    const name = String(c.req.query("name") ?? "");
    if (!isSuiName(name)) throw new RemoraError("name.bad", "That isn't a .sui name.");
    const core = rt.networks.client(namesNet(c)).core;
    const address = await resolveName(core, name);
    return c.json({ name: canonicalName(name), address });
  });

  app.get("/api/names", async (c) => {
    namesLimited();
    const list = String(c.req.query("addresses") ?? "")
      .split(",")
      .map((a) => a.trim())
      .filter((a) => /^0x[0-9a-fA-F]{1,64}$/.test(a));
    const core = rt.networks.client(namesNet(c)).core;
    return c.json({ names: await namesOf(core, list) });
  });

  app.post("/api/approvals/:id/rule-accept", async (c) =>
    c.json(await acceptRule(rt, service, c.get("owner"), uuidParam(c, "id", "approval"))),
  );

  app.post("/api/approvals/:id/rule-decline", async (c) =>
    c.json(await declineRule(rt, c.get("owner"), uuidParam(c, "id", "approval"))),
  );
}
