/**
 * ADR-0121's HTTP surface.
 * - `POST /api/hooks/:remoraId/:id`: the webhook door. No session; a signature over the body
 *   (`X-Remora-Signature`, or GitHub's `X-Hub-Signature-256`), 64 KB at most, 30 a minute per hook.
 *   It's outside the per-address gate so GitHub's shared addresses aren't throttled, but a bad
 *   signature still counts against the caller's address.
 * - `/api/remoras/:id/hooks…`: the owner's reads and changes, behind the wallet session.
 */

import type { Context } from "hono";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import { z } from "zod";
import { checkAddress, clientAddress } from "../iplimit.ts";
import { HOOK_ID, HOOK_MAX_BYTES } from "../triggers/webhook.ts";
import {
  addOutHook,
  addPriceTrigger,
  addWebhook,
  type HooksDeps,
  hooksView,
  outSecret,
  receiveWebhook,
  removeOutHook,
  removePriceTrigger,
  removeWebhook,
  rotateOutSecret,
  rotateWebhook,
  sendTest,
  setPricePaused,
  webhookSecret,
} from "./hooks.ts";
import { RemoraError, type RemoraService } from "./remoras.ts";
import { humanError } from "./routes.ts";

export interface HookRouteDeps {
  service: RemoraService;
  hooks: HooksDeps;
  /** The signed-in wallet address, or null. */
  owner: (c: Context) => Promise<string | null>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NO_STORE = { "cache-control": "no-store" };

const PriceInput = z.object({
  symbol: z.string().min(1).max(10),
  above: z.number().optional(),
  below: z.number().optional(),
});
const Paused = z.object({ paused: z.boolean() });
const WebhookInput = z.object({ name: z.string().optional() });

const fail = (
  c: Context,
  status: 400 | 401 | 404 | 409 | 413 | 429 | 500,
  code: string,
  message: string,
) => c.json({ error: { code, message } }, status);

export function createHookRoutes(d: HookRouteDeps) {
  const app = new Hono<{ Variables: { owner: string } }>();
  const h = d.hooks;

  app.onError((err, c) => {
    if (err instanceof RemoraError)
      return c.json(
        { error: { code: err.code, message: humanError(err.code, err.message) } },
        err.status,
      );
    h.rt.log.error("api.hooks_failed", { path: c.req.path, error: err });
    return fail(c, 500, "unknown", "Something went wrong.");
  });

  app.post(
    "/api/hooks/:remoraId/:id",
    bodyLimit({
      maxSize: HOOK_MAX_BYTES,
      onError: (c) => fail(c, 413, "hook.too_big", "A webhook body is 64 KB at most."),
    }),
    async (c) => {
      const remoraId = c.req.param("remoraId");
      const id = c.req.param("id");
      if (!UUID.test(remoraId) || !HOOK_ID.test(id))
        return fail(c, 404, "hook.not_found", "No such webhook.");
      const out = await receiveWebhook(h, {
        remoraId,
        id,
        body: new Uint8Array(await c.req.arrayBuffer()),
        signature: c.req.header("x-remora-signature") ?? c.req.header("x-hub-signature-256"),
        ...(c.req.header("x-github-event") ? { event: c.req.header("x-github-event") } : {}),
        ...(c.req.header("x-github-delivery") || c.req.header("x-remora-delivery")
          ? { delivery: c.req.header("x-github-delivery") ?? c.req.header("x-remora-delivery") }
          : {}),
        ...(c.req.header("content-type") ? { contentType: c.req.header("content-type") } : {}),
      });
      if (out.ok) return c.json({ ok: true, queued: out.queued }, out.queued ? 202 : 200);
      switch (out.reason) {
        case "bad_signature": {
          const gate = checkAddress(clientAddress(c.req.raw.headers));
          if (!gate.allowed) {
            c.header("retry-after", String(gate.retryAfterSeconds));
            return fail(c, 429, "rate_limited", gate.message);
          }
          return fail(c, 401, "hook.bad_signature", "The signature doesn't match this webhook.");
        }
        case "not_found":
          return fail(c, 404, "hook.not_found", "No such webhook.");
        case "rate_limited":
          c.header("retry-after", String(Math.ceil((out.retryAfterMs ?? 60_000) / 1000)));
          return fail(c, 429, "rate_limited", "30 deliveries a minute per webhook.");
        case "not_active":
          return fail(c, 409, "remora.not_active", "That remora is paused.");
        default: {
          const never: never = out.reason;
          return never;
        }
      }
    },
  );

  for (const path of ["/api/remoras/:id/hooks", "/api/remoras/:id/hooks/*"]) {
    app.use(path, async (c, next) => {
      const owner = await d.owner(c);
      if (!owner) return fail(c, 401, "auth.required", "Sign in with your wallet first.");
      if (!UUID.test(c.req.param("id") ?? "")) return fail(c, 404, "not_found", "Not found.");
      c.set("owner", owner);
      await next();
    });
  }

  const mine = (c: Context<{ Variables: { owner: string } }>) =>
    d.service.get(c.req.param("id") ?? "", c.get("owner"));
  const body = async (c: Context) => (await c.req.json().catch(() => ({}))) as unknown;
  const parsed = <T>(schema: z.ZodType<T>, v: unknown): T => {
    const out = schema.safeParse(v);
    if (!out.success) throw new RemoraError("hooks.bad_input", "That request isn't right.");
    return out.data;
  };

  app.get("/api/remoras/:id/hooks", async (c) => c.json(hooksView(h, await mine(c))));

  app.post("/api/remoras/:id/hooks/in", async (c) => {
    const { name } = parsed(WebhookInput, await body(c));
    return c.json({ hook: await addWebhook(h, await mine(c), name || undefined) }, 201, NO_STORE);
  });
  app.get("/api/remoras/:id/hooks/in/:hookId/secret", async (c) =>
    c.json({ hook: webhookSecret(h, await mine(c), c.req.param("hookId")) }, 200, NO_STORE),
  );
  app.post("/api/remoras/:id/hooks/in/:hookId/rotate", async (c) =>
    c.json({ hook: await rotateWebhook(h, await mine(c), c.req.param("hookId")) }, 200, NO_STORE),
  );
  app.delete("/api/remoras/:id/hooks/in/:hookId", async (c) => {
    await removeWebhook(h, await mine(c), c.req.param("hookId"));
    return c.json({ ok: true });
  });

  app.post("/api/remoras/:id/hooks/price", async (c) => {
    const input = parsed(PriceInput, await body(c));
    return c.json({ trigger: await addPriceTrigger(h, await mine(c), input) }, 201);
  });
  app.patch("/api/remoras/:id/hooks/price/:triggerId", async (c) => {
    const { paused } = parsed(Paused, await body(c));
    return c.json({
      trigger: await setPricePaused(h, await mine(c), c.req.param("triggerId"), paused),
    });
  });
  app.delete("/api/remoras/:id/hooks/price/:triggerId", async (c) => {
    await removePriceTrigger(h, await mine(c), c.req.param("triggerId"));
    return c.json({ ok: true });
  });

  app.post("/api/remoras/:id/hooks/out", async (c) => {
    const b = (await body(c)) as { url?: unknown; events?: unknown };
    return c.json({ hook: await addOutHook(h, await mine(c), b) }, 201);
  });
  app.get("/api/remoras/:id/hooks/out/secret", async (c) =>
    c.json({ secret: outSecret(h, await mine(c)) }, 200, NO_STORE),
  );
  app.post("/api/remoras/:id/hooks/out/rotate", async (c) =>
    c.json({ secret: await rotateOutSecret(h, await mine(c)) }, 200, NO_STORE),
  );
  app.post("/api/remoras/:id/hooks/out/:hookId/test", async (c) =>
    c.json({ delivery: await sendTest(h, await mine(c), c.req.param("hookId")) }),
  );
  app.delete("/api/remoras/:id/hooks/out/:hookId", async (c) => {
    await removeOutHook(h, await mine(c), c.req.param("hookId"));
    return c.json({ ok: true });
  });

  // Mounted beside the other groups, which carry no typed variables.
  return app as unknown as Hono;
}
