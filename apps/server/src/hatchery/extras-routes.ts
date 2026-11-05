/**
 * The HTTP side of D2 and D3 (ADR-0149, ADR-0150), mounted inside the remora routes:
 * - `GET /badge/:id.svg` (and `/api/badge/:id.svg`): public, cached; a template id or its publish
 *   digest;
 * - `POST /api/hatchery/:id/rating/message {stars, text}` → the text as stored and the message to sign;
 * - `POST /api/hatchery/:id/rating {stars, text, at, signature}` → stored; the signature is the
 *   rater's proof, so no session is needed;
 * - `GET /api/hatchery/:id/rating/me` (signed in) → whether you can rate it, and your rating;
 * - `GET /api/hatchery/:id/analytics` (its author only);
 * - `GET /api/remoras/:id/template-update`, `POST …/template-update/:approvalId/accept`,
 *   `…/decline {reason?}` and `…/sign` (the money part again), for the signed-in owner (the remora
 *   routes' wallet and id checks run first).
 */
import type { SuiNetwork } from "@remora/chain";
import type { Context, Hono } from "hono";
import { RemoraError } from "../runtime/remoras.ts";
import { badgeFor, myRating, rateTemplate, ratingToSign, templateAnalytics } from "./ratings.ts";
import type { HatcheryDeps } from "./service.ts";
import {
  acceptTemplateUpdate,
  declineTemplateUpdate,
  templateUpdatesOf,
  updateMoneyTx,
} from "./updates.ts";

type OwnerApp = Hono<{ Variables: { owner: string; network: SuiNetwork } }>;

const OBJECT_ID = /^0x[0-9a-fA-F]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BADGE_FILE = /^(0x[0-9a-fA-F]{1,64}|[1-9A-HJ-NP-Za-km-z]{32,44})\.svg$/;

const templateParam = (c: Context) => {
  const id = c.req.param("id") ?? "";
  if (!OBJECT_ID.test(id))
    throw new RemoraError("hatchery.not_found", "No template with that id here.", 404);
  return id;
};

const approvalParam = (c: Context) => {
  const id = c.req.param("approvalId") ?? "";
  if (!UUID.test(id)) throw new RemoraError("update.not_found", "No such template update.", 404);
  return id;
};

const json = async (c: Context): Promise<Record<string, unknown>> => {
  const b = await c.req.json().catch(() => ({}));
  return b && typeof b === "object" && !Array.isArray(b) ? (b as Record<string, unknown>) : {};
};

export function mountTemplateExtras(
  app: OwnerApp,
  d: {
    hatchery: () => HatcheryDeps;
    /** The signed-in wallet, for the routes outside the remora routes' wallet check. */
    owner: (c: Context) => Promise<string | null>;
  },
) {
  const needSignIn = (c: Context) =>
    c.json({ error: { code: "auth.required", message: "Sign in with your wallet first." } }, 401);

  // ── D2: the badge ─────────────────────────────────────────────────────────
  const badge = async (c: Context) => {
    const m = BADGE_FILE.exec(c.req.param("file") ?? "");
    const { svg, found } = m?.[1]
      ? await badgeFor(d.hatchery().runtime.db, m[1])
      : await badgeFor(d.hatchery().runtime.db, "");
    return c.body(svg, found ? 200 : 404, {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": found ? "public, max-age=300, s-maxage=300" : "public, max-age=60",
      "x-content-type-options": "nosniff",
      // Opened on its own, the SVG can't run anything or load anything.
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
      "access-control-allow-origin": "*",
    });
  };
  app.get("/badge/:file", badge);
  app.get("/api/badge/:file", badge);

  // ── D2: ratings and the author's view ─────────────────────────────────────
  app.post("/api/hatchery/:id/rating/message", async (c) => {
    const b = await json(c);
    return c.json(await ratingToSign(d.hatchery(), templateParam(c), b));
  });

  app.post("/api/hatchery/:id/rating", async (c) => {
    const b = await json(c);
    return c.json(await rateTemplate(d.hatchery(), templateParam(c), b));
  });

  app.get("/api/hatchery/:id/rating/me", async (c) => {
    const owner = await d.owner(c);
    if (!owner) return needSignIn(c);
    return c.json(await myRating(d.hatchery().runtime.db, templateParam(c), owner));
  });

  app.get("/api/hatchery/:id/analytics", async (c) => {
    const owner = await d.owner(c);
    if (!owner) return needSignIn(c);
    c.header("cache-control", "no-store");
    return c.json(await templateAnalytics(d.hatchery().runtime.db, owner, templateParam(c)));
  });

  // ── D3: template updates ──────────────────────────────────────────────────
  const updates = () => {
    const h = d.hatchery();
    return { runtime: h.runtime, service: h.service };
  };

  app.get("/api/remoras/:id/template-update", async (c) => {
    const u = updates();
    const r = await u.service.get(c.req.param("id"), c.get("owner"));
    return c.json(await templateUpdatesOf(u.runtime.db, r));
  });

  app.post("/api/remoras/:id/template-update/:approvalId/accept", async (c) => {
    const { remora: _r, ...out } = await acceptTemplateUpdate(
      updates(),
      c.get("owner"),
      c.req.param("id"),
      approvalParam(c),
    );
    return c.json(out);
  });

  app.post("/api/remoras/:id/template-update/:approvalId/sign", async (c) =>
    c.json({
      sign: await updateMoneyTx(updates(), c.get("owner"), c.req.param("id"), approvalParam(c)),
    }),
  );

  app.post("/api/remoras/:id/template-update/:approvalId/decline", async (c) => {
    const b = await json(c);
    return c.json(
      await declineTemplateUpdate(
        updates(),
        c.get("owner"),
        approvalParam(c),
        typeof b.reason === "string" ? b.reason : "",
        c.req.param("id"),
      ),
    );
  });
}
