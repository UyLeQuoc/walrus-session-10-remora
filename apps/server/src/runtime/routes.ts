/**
 * The W2 API (B1/B6–B9, C1/C2, E4, F3/F6, G3, A5, A7/H5, N1/N2/N4/N5/N6/N10/N12/N13). Every route
 * answers for the signed-in wallet only, on the session's network (ADR-0026). Owner transactions come
 * back unsigned; the wallet signs and executes them, then the matching `/confirm` reads the chain.
 * Errors are `{ error: { code, message } }` with a human sentence where copy has one (N6).
 */
import type { SuiNetwork } from "@remora/chain";
import {
  and,
  desc,
  eq,
  inArray,
  lt,
  ownerSettings,
  receipts,
  remoraEvents,
  remoras,
  sentinelRules,
  sourceStats,
} from "@remora/db";
import { Budget } from "@remora/schema";
import type { Context } from "hono";
import { Hono } from "hono";
import { placeholders, render } from "../copy/keys.ts";
import { NETWORK_HEADER, NetworkUnavailableError, resolveNetwork } from "../money/networks.ts";
import { previewSchedule } from "../triggers/schedule.ts";
import { approvalPay, approvalPayTx, listApprovals, rejectApproval } from "./approvals.ts";
import type { RuntimeDeps } from "./deps.ts";
import { giveFeedback } from "./feedback.ts";
import type { InspectorRow } from "./inspector.ts";
import { type Remora, RemoraError, type RemoraService } from "./remoras.ts";
import { addSchedule, approveSchedule, queueFirstRun, removeSchedule } from "./schedules.ts";
import { scoutAsk } from "./scout.ts";
import { teach } from "./sentinel.ts";
import { verifyWake } from "./verify.ts";

export interface RemoraRouteDeps {
  service: RemoraService;
  runtime: RuntimeDeps;
  /** The signed-in wallet address, or null. */
  owner: (c: Context) => Promise<string | null>;
  /** F3/F6: what the relayer holds for these namespaces. */
  inspect?: (
    r: Remora,
    namespaces: string[],
  ) => Promise<{ rows: InspectorRow[]; counts: Record<string, number> }>;
  /** A5: a Telegram deep link that links the chat to this wallet. */
  telegramLink?: (
    c: Context,
  ) => Promise<{ code: string; url: string | null; expiresInMinutes: number } | null>;
  /** Writes we made per namespace (memory_index), for the F6 comparison. */
  written?: (r: Remora) => Promise<Record<string, number>>;
}

const ADDRESS = /^0x[0-9a-fA-F]{1,64}$/;
const DIGEST = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** N6: the copy sentence for a code when it needs no blanks filled, else the error's own message. */
export function humanError(code: string, message: string): string {
  const key = `error.${code}`;
  try {
    return placeholders(key).length ? message : render(key as Parameters<typeof render>[0]);
  } catch {
    return message;
  }
}

const serialize = (v: unknown): unknown =>
  JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x)));

export function createRemoraRoutes(d: RemoraRouteDeps) {
  const app = new Hono<{ Variables: { owner: string; network: SuiNetwork } }>();
  const { service, runtime: rt } = d;

  app.onError((err, c) => {
    if (err instanceof RemoraError) {
      return c.json(
        { error: { code: err.code, message: humanError(err.code, err.message) } },
        err.status as 400,
      );
    }
    if (err instanceof NetworkUnavailableError) {
      return c.json({ error: { code: err.code, message: err.message } }, 400);
    }
    rt.log.error("api.remora_failed", { path: c.req.path, error: err });
    return c.json(
      { error: { code: "unknown", message: humanError("unknown", "Something went wrong.") } },
      500,
    );
  });

  // Every /api route here needs a wallet session and a network.
  for (const path of [
    "/api/remoras",
    "/api/remoras/*",
    "/api/feed",
    "/api/approvals",
    "/api/approvals/*",
    "/api/events/*",
    "/api/settings",
    "/api/panic",
    "/api/panic/*",
    "/api/telegram/*",
  ]) {
    app.use(path, async (c, next) => {
      const owner = await d.owner(c);
      if (!owner)
        return c.json(
          { error: { code: "auth.required", message: "Sign in with your wallet first." } },
          401,
        );
      c.set("owner", owner);
      c.set("network", resolveNetwork(rt.networks, c.req.header(NETWORK_HEADER)));
      await next();
    });
  }

  // Ids are UUIDs; anything else is a 404 rather than a database error.
  for (const path of [
    "/api/remoras/:id",
    "/api/remoras/:id/*",
    "/api/approvals/:id/*",
    "/api/events/:id/*",
  ]) {
    app.use(path, async (c, next) => {
      if (!UUID.test(c.req.param("id") ?? ""))
        return c.json({ error: { code: "not_found", message: "Not found." } }, 404);
      await next();
    });
  }

  const body = async <T>(c: Context): Promise<T> => (await c.req.json().catch(() => ({}))) as T;
  const digestOf = (v: unknown) => {
    if (typeof v !== "string" || !DIGEST.test(v))
      throw new RemoraError("tx.bad_digest", "That isn't a transaction digest.");
    return v;
  };
  const view = async (r: Remora) => ({ ...(serialize(r) as object), config: service.config(r) });

  // ── Templates and remoras (B1, B6–B9, N3) ─────────────────────────────────
  app.get("/api/templates", (c) => c.json({ templates: service.templates() }));

  app.get("/api/remoras", async (c) => {
    const rows = await service.list(c.get("owner"), c.get("network"));
    return c.json({ remoras: await Promise.all(rows.map(view)) });
  });

  app.post("/api/remoras", async (c) => {
    const b = await body<{ template?: string; name?: string; budget?: unknown; watch?: string[] }>(
      c,
    );
    if (b.watch && (!Array.isArray(b.watch) || b.watch.some((a) => !ADDRESS.test(a)))) {
      throw new RemoraError("funds.bad_address", "Every watched address must be 0x + hex.");
    }
    const budget =
      b.budget === undefined ? undefined : b.budget === null ? null : Budget.parse(b.budget);
    const out = await service.create({
      owner: c.get("owner"),
      network: c.get("network"),
      template: String(b.template ?? ""),
      ...(b.name ? { name: b.name } : {}),
      ...(budget !== undefined ? { budget } : {}),
      ...(b.watch ? { watch: b.watch } : {}),
    });
    // N13: a Disc-less remora is ready now; a paying one after its confirm.
    if (!out.transaction) await queueFirstRun(rt, out.remora.id);
    return c.json({ remora: await view(out.remora), transaction: out.transaction }, 201);
  });

  app.get("/api/remoras/:id", async (c) =>
    c.json({ remora: await view(await service.get(c.req.param("id"), c.get("owner"))) }),
  );

  app.patch("/api/remoras/:id", async (c) => {
    const b = await body<{ name?: string; persona?: string; watch?: string[] }>(c);
    if (b.watch?.some((a) => !ADDRESS.test(a)))
      throw new RemoraError("funds.bad_address", "Every watched address must be 0x + hex.");
    return c.json({ remora: await view(await service.edit(c.req.param("id"), c.get("owner"), b)) });
  });

  app.post("/api/remoras/:id/confirm", async (c) => {
    const { digest } = await body<{ digest?: string }>(c);
    const r = await service.confirmIssue(c.req.param("id"), c.get("owner"), digestOf(digest));
    await queueFirstRun(rt, r.id);
    return c.json({ remora: await view(r) });
  });

  app.post("/api/remoras/:id/activate", async (c) =>
    c.json({ remora: await view(await service.activate(c.req.param("id"), c.get("owner"))) }),
  );

  app.post("/api/remoras/:id/pause", async (c) => {
    const { paused = true } = await body<{ paused?: boolean }>(c);
    const r = await service.get(c.req.param("id"), c.get("owner"));
    if (!r.discId)
      return c.json({
        remora: await view(await service.setPaused(r.id, c.get("owner"), paused)),
        transaction: null,
      });
    return c.json({ transaction: await service.pauseTx(r.id, c.get("owner"), paused) });
  });

  app.post("/api/remoras/:id/pause/confirm", async (c) =>
    c.json({ remora: await view(await service.syncStatus(c.req.param("id"), c.get("owner"))) }),
  );

  app.post("/api/remoras/:id/retire", async (c) =>
    c.json({ transaction: await service.retireTx(c.req.param("id"), c.get("owner")) }),
  );

  app.post("/api/remoras/:id/retire/confirm", async (c) => {
    const { digest } = await body<{ digest?: string }>(c);
    return c.json({
      remora: await view(
        await service.confirmRetire(
          c.req.param("id"),
          c.get("owner"),
          digest ? digestOf(digest) : undefined,
        ),
      ),
    });
  });

  app.post("/api/remoras/:id/budget", async (c) => {
    const { budget } = await body<{ budget?: unknown }>(c);
    return c.json({
      transaction: await service.budgetTx(c.req.param("id"), c.get("owner"), Budget.parse(budget)),
    });
  });

  app.post("/api/remoras/:id/budget/confirm", async (c) => {
    const b = await body<{ digest?: string; budget?: unknown }>(c);
    return c.json({
      remora: await view(
        await service.confirmBudget(
          c.req.param("id"),
          c.get("owner"),
          digestOf(b.digest),
          Budget.parse(b.budget),
        ),
      ),
    });
  });

  app.get("/api/remoras/:id/budget", async (c) =>
    c.json({ meter: serialize(await service.budgetMeter(c.req.param("id"), c.get("owner"))) }),
  );

  app.post("/api/remoras/:id/rotate", async (c) =>
    c.json(await service.rotateTx(c.req.param("id"), c.get("owner"))),
  );

  app.post("/api/remoras/:id/rotate/confirm", async (c) => {
    const b = await body<{ digest?: string; keyId?: string }>(c);
    const id = c.req.param("id");
    if (typeof b.keyId !== "string" || !b.keyId.startsWith(`${id}:`))
      throw new RemoraError("rotate.bad_key", "That key isn't this remora's.");
    return c.json({
      remora: await view(
        await service.confirmRotate(id, c.get("owner"), digestOf(b.digest), b.keyId),
      ),
    });
  });

  // ── Turns: ask Scout, teach Sentinel (C1, C2) ─────────────────────────────
  app.post("/api/remoras/:id/ask", async (c) => {
    const { question } = await body<{ question?: string }>(c);
    if (!question?.trim()) throw new RemoraError("ask.empty", "Ask a question.");
    const r = await service.get(c.req.param("id"), c.get("owner"));
    if (r.template !== "scout")
      throw new RemoraError("ask.unsupported", `${r.name} doesn't answer questions.`);
    const res = await scoutAsk(rt, r, question.trim().slice(0, 1_000), {
      kind: "message",
      ref: "web",
    });
    return c.json(
      serialize({
        answer: res.answer,
        eventId: res.eventId,
        receiptId: res.receiptId,
        outcomes: res.outcomes.map(({ ...o }) =>
          "response" in o ? { ...o, response: undefined } : o,
        ),
      }),
    );
  });

  app.post("/api/remoras/:id/teach", async (c) => {
    const { text } = await body<{ text?: string }>(c);
    if (!text?.trim()) throw new RemoraError("teach.empty", "Tell me the rule.");
    const r = await service.get(c.req.param("id"), c.get("owner"));
    if (r.template !== "sentinel")
      throw new RemoraError("teach.unsupported", `${r.name} doesn't take rules.`);
    return c.json(serialize(await teach(rt, r, text.trim().slice(0, 500))));
  });

  app.get("/api/remoras/:id/rules", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json({
      rules: await rt.db
        .select()
        .from(sentinelRules)
        .where(eq(sentinelRules.remoraId, r.id))
        .orderBy(desc(sentinelRules.createdAt)),
    });
  });

  app.delete("/api/remoras/:id/rules/:ruleId", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    if (!UUID.test(c.req.param("ruleId")))
      throw new RemoraError("rule.not_found", "No such rule.", 404);
    await rt.db
      .delete(sentinelRules)
      .where(and(eq(sentinelRules.remoraId, r.id), eq(sentinelRules.id, c.req.param("ruleId"))));
    return c.json({ ok: true });
  });

  app.get("/api/remoras/:id/sources", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json({
      sources: serialize(
        await rt.db.select().from(sourceStats).where(eq(sourceStats.remoraId, r.id)),
      ),
    });
  });

  // ── Schedules (D1 cron, N12) ──────────────────────────────────────────────
  app.post("/api/schedule/preview", async (c) => {
    const { text } = await body<{ text?: string }>(c);
    const p = previewSchedule(String(text ?? ""));
    return p
      ? c.json(p)
      : c.json(
          {
            error: { code: "schedule.unparsed", message: `I can't read "${text}" as a schedule.` },
          },
          400,
        );
  });

  app.post("/api/remoras/:id/schedules", async (c) => {
    const b = await body<{ when?: string; question?: string }>(c);
    if (!b.when || !b.question?.trim())
      throw new RemoraError("schedule.empty", "Say when and what to ask.");
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json(await addSchedule(rt, r, b.when, b.question.trim()), 201);
  });

  app.get("/api/remoras/:id/schedules", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json({ schedules: (r.config as { schedules?: unknown[] }).schedules ?? [] });
  });

  app.delete("/api/remoras/:id/schedules/:scheduleId", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    await removeSchedule(rt, r, c.req.param("scheduleId"));
    return c.json({ ok: true });
  });

  // ── Feed, Why?, feedback (N1, N4, N19) ────────────────────────────────────
  app.get("/api/feed", async (c) => {
    const mine = await service.list(c.get("owner"), c.get("network"));
    const only = c.req.query("remora");
    const ids = mine.filter((r) => !only || r.id === only).map((r) => r.id);
    if (!ids.length) return c.json({ events: [] });
    const type = c.req.query("type");
    const before = c.req.query("before");
    const events = await rt.db
      .select()
      .from(remoraEvents)
      .where(
        and(
          inArray(remoraEvents.remoraId, ids),
          ...(type ? [inArray(remoraEvents.type, type.split(","))] : []),
          ...(before && !Number.isNaN(Date.parse(before))
            ? [lt(remoraEvents.createdAt, new Date(before))]
            : []),
        ),
      )
      .orderBy(desc(remoraEvents.createdAt))
      .limit(Math.min(Number(c.req.query("limit") ?? 50) || 50, 200));
    const names = new Map(mine.map((r) => [r.id, r.name]));
    return c.json({ events: events.map((e) => ({ ...e, remora: names.get(e.remoraId) ?? "" })) });
  });

  app.get("/api/events/:id/why", async (c) => {
    const [row] = await rt.db
      .select({ e: remoraEvents, r: remoras })
      .from(remoraEvents)
      .innerJoin(remoras, eq(remoras.id, remoraEvents.remoraId))
      .where(eq(remoraEvents.id, c.req.param("id")));
    if (!row || row.r.ownerAddress !== c.get("owner"))
      throw new RemoraError("event.not_found", "No such event.", 404);
    const [wake] = row.e.receiptId
      ? await rt.db.select().from(receipts).where(eq(receipts.id, row.e.receiptId))
      : [];
    return c.json({ event: row.e, remora: row.r.name, wake: wake ?? null });
  });

  app.post("/api/events/:id/feedback", async (c) => {
    const { verdict } = await body<{ verdict?: string }>(c);
    if (verdict !== "useful" && verdict !== "noise")
      throw new RemoraError("feedback.bad", "Say useful or noise.");
    return c.json(await giveFeedback(rt, c.get("owner"), c.req.param("id"), verdict));
  });

  // ── Approval inbox (N2, E4) ───────────────────────────────────────────────
  app.get("/api/approvals", async (c) => {
    const rows = await listApprovals(rt, c.get("owner"), c.get("network"));
    const status = c.req.query("status") ?? "pending";
    return c.json({
      approvals: rows
        .filter((x) => status === "all" || x.a.status === status)
        .map((x) => ({ ...x.a, remora: x.remora })),
    });
  });

  app.post("/api/approvals/:id/pay-tx", async (c) =>
    c.json(serialize(await approvalPayTx(rt, c.get("owner"), c.req.param("id")))),
  );

  app.post("/api/approvals/:id/pay", async (c) => {
    const b = await body<{ transaction?: string; signature?: string }>(c);
    if (!b.transaction || !b.signature)
      throw new RemoraError("approval.unsigned", "Sign the payment first.");
    return c.json(
      await approvalPay(rt, c.get("owner"), c.req.param("id"), {
        transaction: b.transaction,
        signature: b.signature,
      }),
    );
  });

  app.post("/api/approvals/:id/approve", async (c) =>
    c.json(await approveSchedule(rt, c.get("owner"), c.req.param("id"))),
  );

  app.post("/api/approvals/:id/reject", async (c) => {
    await rejectApproval(rt, c.get("owner"), c.req.param("id"));
    return c.json({ ok: true });
  });

  // ── Panic button (N10) ────────────────────────────────────────────────────
  app.post("/api/panic", async (c) =>
    c.json(await service.panicTx(c.get("owner"), c.get("network"))),
  );

  app.post("/api/panic/confirm", async (c) => {
    const { digest } = await body<{ digest?: string }>(c);
    return c.json(
      await service.confirmPanic(
        c.get("owner"),
        c.get("network"),
        digest ? digestOf(digest) : undefined,
      ),
    );
  });

  // ── Verify, memory (G3, F3, F6) ───────────────────────────────────────────
  // Public like the chain it checks: anyone holding a digest can verify it.
  app.get("/api/verify/:ref", async (c) => {
    const res = await verifyWake(rt, c.req.param("ref"));
    return res.found
      ? c.json(serialize(res))
      : c.json(
          { error: { code: "wake.not_found", message: "No Wake with that id or digest." } },
          404,
        );
  });

  app.get("/api/remoras/:id/memory", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const namespaces = service.config(r).namespaces;
    const q = c.req.query("q");
    const [stored, found, written] = await Promise.all([
      d.inspect
        ? d.inspect(r, namespaces)
        : Promise.resolve({ rows: [] as InspectorRow[], counts: {} as Record<string, number> }),
      q ? rt.memory.recall(r, q, namespaces, 10) : Promise.resolve([]),
      d.written ? d.written(r) : Promise.resolve({} as Record<string, number>),
    ]);
    // F6: our writes against what the relayer reports; a gap is a warning, never a restore().
    const mismatches = Object.entries(written)
      .filter(([ns, n]) => (stored.counts[ns] ?? 0) < n)
      .map(([ns, n]) => ({ namespace: ns, written: n, relayer: stored.counts[ns] ?? 0 }));
    return c.json({ namespaces, ...stored, written, mismatches, results: found });
  });

  // ── Settings (A7, H5) and Telegram linking (A5) ───────────────────────────
  app.get("/api/settings", async (c) => {
    const [s] = await rt.db
      .select()
      .from(ownerSettings)
      .where(eq(ownerSettings.ownerAddress, c.get("owner")));
    return c.json({
      settings: s ?? {
        ownerAddress: c.get("owner"),
        timezone: "UTC",
        quietStart: null,
        quietEnd: null,
        language: "en",
        notify: "important",
      },
    });
  });

  app.put("/api/settings", async (c) => {
    const b = await body<{
      timezone?: string;
      quietStart?: string | null;
      quietEnd?: string | null;
      language?: string;
      notify?: string;
    }>(c);
    const hhmm = (v: unknown) =>
      v === null ||
      v === undefined ||
      (typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v));
    if (!hhmm(b.quietStart) || !hhmm(b.quietEnd))
      throw new RemoraError("settings.bad_time", "Quiet hours are HH:MM.");
    if (b.timezone !== undefined) {
      try {
        new Intl.DateTimeFormat("en", { timeZone: b.timezone });
      } catch {
        throw new RemoraError("settings.bad_timezone", "That isn't a timezone.");
      }
    }
    if (b.language !== undefined && b.language !== "en" && b.language !== "vi")
      throw new RemoraError("settings.bad_language", "English or Vietnamese.");
    if (b.notify !== undefined && !["all", "important", "digest"].includes(b.notify))
      throw new RemoraError("settings.bad_notify", "all, important or digest.");
    const patch = {
      ...(b.timezone !== undefined ? { timezone: b.timezone } : {}),
      ...(b.quietStart !== undefined ? { quietStart: b.quietStart } : {}),
      ...(b.quietEnd !== undefined ? { quietEnd: b.quietEnd } : {}),
      ...(b.language !== undefined ? { language: b.language as "en" | "vi" } : {}),
      ...(b.notify !== undefined ? { notify: b.notify as "all" | "important" | "digest" } : {}),
      updatedAt: new Date(),
    };
    const [s] = await rt.db
      .insert(ownerSettings)
      .values({ ownerAddress: c.get("owner"), ...patch })
      .onConflictDoUpdate({ target: ownerSettings.ownerAddress, set: patch })
      .returning();
    return c.json({ settings: s });
  });

  app.post("/api/telegram/link", async (c) => {
    const link = d.telegramLink ? await d.telegramLink(c) : null;
    return link
      ? c.json(link)
      : c.json(
          { error: { code: "telegram.off", message: "Telegram isn't set up on this server." } },
          400,
        );
  });

  // Mounted beside the other groups, which carry no typed variables.
  return app as unknown as Hono;
}
