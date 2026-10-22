/**
 * H7 (ADR-0051): the playground's public API. No wallet: the session token rides in an httpOnly
 * cookie, or in `x-remora-playground` from another origin, and each route answers only for it.
 */
import type { Context } from "hono";
import { Hono } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { clientAddress } from "../iplimit.ts";
import { isOpsError, recordError } from "../ops/signals.ts";
import { RemoraError } from "../runtime/remoras.ts";
import { ask, availability, createSession, getSession, type PlaygroundDeps } from "./service.ts";

export const PLAYGROUND_COOKIE = "remora_playground";
export const PLAYGROUND_HEADER = "x-remora-playground";

/** The same address the server's per-IP ceiling uses; a soft limit (the Disc is the hard one). */
const clientIp = (c: Context) => clientAddress(c.req.raw.headers);

export function createPlaygroundRoutes(deps: () => PlaygroundDeps) {
  const app = new Hono();
  const token = (c: Context) =>
    c.req.header(PLAYGROUND_HEADER) ?? getCookie(c, PLAYGROUND_COOKIE) ?? "";

  app.onError((err, c) => {
    const route = `${c.req.method} ${c.req.routePath}`;
    if (err instanceof RemoraError) {
      if (isOpsError(err.code, err.status)) recordError(route, err.code, err.message);
      return c.json({ error: { code: err.code, message: err.message } }, err.status as 400);
    }
    recordError(route, "unknown", (err as Error).message);
    deps().runtime.log.error("api.playground_failed", { path: c.req.path, error: err });
    return c.json({ error: { code: "unknown", message: "Something went wrong." } }, 500);
  });

  app.get("/api/playground", async (c) => {
    const p = deps();
    return c.json({ ...(await availability(p)), limits: p.limits, network: p.network });
  });

  app.post("/api/playground/session", async (c) => {
    const p = deps();
    const { token: t, session } = await createSession(p, clientIp(c));
    setCookie(c, PLAYGROUND_COOKIE, t, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/api/playground",
      maxAge: p.limits.ttlMinutes * 60,
    });
    return c.json({ session, token: t }, 201);
  });

  app.get("/api/playground/session", async (c) =>
    c.json({ session: await getSession(deps(), token(c)) }),
  );

  app.post("/api/playground/ask", async (c) => {
    const b = (await c.req.json().catch(() => ({}))) as { question?: unknown };
    if (typeof b.question !== "string")
      throw new RemoraError("playground.bad_question", "Ask something.");
    return c.json({ session: await ask(deps(), token(c), b.question) });
  });

  app.delete("/api/playground/session", (c) => {
    deleteCookie(c, PLAYGROUND_COOKIE, { path: "/api/playground" });
    return c.json({ ok: true });
  });

  return app;
}
