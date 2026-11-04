/**
 * The HTTP side of U18 C1 + C2 (ADR-0123), mounted inside the remora routes after the wallet check
 * and before the id check (`draft` isn't an id), so every route answers for the signed-in owner only:
 * - `POST /api/remoras/draft {text}` → `{ok, draft, issues}` or `{ok: false, refused}`;
 * - `POST /api/remoras/:id/setup` → a draft's persona, schedule and rules after the hatch;
 * - `GET /api/changes/:id`, `POST …/apply`, `…/decline`, `…/tx`, `…/confirm {digest}`: change cards.
 */
import type { SuiNetwork } from "@remora/chain";
import type { Context, Hono } from "hono";
import { z } from "zod";
import { SetupInput } from "./draft.ts";
import { RemoraError } from "./remoras.ts";
import type { Steer } from "./steer.ts";

type OwnerApp = Hono<{ Variables: { owner: string; network: SuiNetwork } }>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DIGEST = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const DraftBody = z.object({ text: z.string().trim().min(1).max(1_000) });
const ConfirmBody = z.object({ digest: z.string().regex(DIGEST) });

const idOf = (c: Context, what: "change" | "remora") => {
  const id = c.req.param("id") ?? "";
  if (!UUID.test(id))
    throw new RemoraError(
      `${what}.not_found`,
      what === "change" ? "No such change." : "Not found.",
      404,
    );
  return id;
};

async function parsed<T>(c: Context, schema: z.ZodType<T>, message: string): Promise<T> {
  const out = schema.safeParse(await c.req.json().catch(() => null));
  if (!out.success) throw new RemoraError("steer.bad_request", message);
  return out.data;
}

export function mountSteer(app: OwnerApp, steer: Steer) {
  app.post("/api/remoras/draft", async (c) => {
    const { text } = await parsed(
      c,
      DraftBody,
      "Say what it should do, in up to 1,000 characters.",
    );
    return c.json(await steer.draft(c.get("owner"), c.get("network"), text));
  });

  app.post("/api/remoras/:id/setup", async (c) => {
    const input = await parsed(c, SetupInput, "Send the reviewed persona, schedule or rules.");
    return c.json(await steer.setup(c.get("owner"), idOf(c, "remora"), input));
  });

  app.get("/api/changes/:id", async (c) =>
    c.json(await steer.view(c.get("owner"), idOf(c, "change"))),
  );
  app.post("/api/changes/:id/apply", async (c) =>
    c.json(await steer.apply(c.get("owner"), idOf(c, "change"))),
  );
  app.post("/api/changes/:id/decline", async (c) =>
    c.json(await steer.decline(c.get("owner"), idOf(c, "change"))),
  );
  app.post("/api/changes/:id/tx", async (c) =>
    c.json(await steer.tx(c.get("owner"), idOf(c, "change"))),
  );
  app.post("/api/changes/:id/confirm", async (c) => {
    const { digest } = await parsed(c, ConfirmBody, "That isn't a transaction digest.");
    return c.json(await steer.confirm(c.get("owner"), idOf(c, "change"), digest));
  });
}
