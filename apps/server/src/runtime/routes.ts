/**
 * The W2 API (B1/B6–B9, C1/C2, E4, F3/F6, G3, A5, A7/H5, N1/N2/N4/N5/N6/N10/N12/N13). Every route
 * answers for the signed-in wallet only, on the session's network (ADR-0026). Owner transactions come
 * back unsigned; the wallet signs and executes them, then the matching `/confirm` reads the chain.
 * Errors are `{ error: { code, message } }` with a human sentence where copy has one (N6).
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { SuiNetwork } from "@remora/chain";
import {
  and,
  desc,
  eq,
  gt,
  inArray,
  lt,
  ownerSettings,
  receipts,
  remoraEvents,
  remoras,
  rooms,
  sentinelRules,
  sourceStats,
} from "@remora/db";
import { decodeHeader, PAYMENT_RESPONSE_HEADER } from "@remora/disc-sdk";
import { addressFromSignature } from "@remora/memory";
import { type PaidContext, x402 } from "@remora/merchant";
import { Budget } from "@remora/schema";
import type { Context } from "hono";
import { Hono } from "hono";
import { placeholders, render } from "../copy/keys.ts";
import {
  confirmDeprecate,
  confirmHatch,
  confirmPublish,
  consent,
  deprecateTx,
  gallery,
  type HatcheryDeps,
  hatchTx,
  listing,
  publishTx,
  shareLinks,
  shareReview,
} from "../hatchery/service.ts";
import {
  COMMUNITY_PER_OWNER,
  type CommunityListing,
  listingMessage,
  listingsOf,
  probeX402,
} from "../money/community.ts";
import { type Listings, SALE_SLUG } from "../money/listings.ts";
import { NETWORK_HEADER, NetworkUnavailableError, resolveNetwork } from "../money/networks.ts";
import { reefServices } from "../money/reef.ts";
import { isOpsError, recordError } from "../ops/signals.ts";
import { answersQuestions } from "../templates/index.ts";
import { previewSchedule } from "../triggers/schedule.ts";
import { approvalPay, approvalPayTx, listApprovals, rejectApproval } from "./approvals.ts";
import { briefNow, briefView, setBriefItems } from "./briefer.ts";
import { remoraCost } from "./cost.ts";
import { crewMembers, crewOf, crewView, pauseCrew } from "./crews.ts";
import type { RuntimeDeps } from "./deps.ts";
import { giveFeedback } from "./feedback.ts";
import type { InspectorRow } from "./inspector.ts";
import { learningSeries, proofBetween, proofsFor } from "./learning.ts";
import { MemoryTimeout } from "./memory.ts";
import {
  correct,
  enrichRows,
  exportMarkdown,
  exportMemories,
  forgetNamespace,
  recentDuplicates,
  setHidden,
} from "./memory-controls.ts";
import { type Remora, RemoraError, type RemoraService } from "./remoras.ts";
import {
  defaultRoom,
  postToRoom,
  RESPONDERS,
  type Room as RoomRow,
  roomLines,
  roomView,
} from "./rooms.ts";
import { recordSale, type SaleInput, saleView, sellAnswer, setSale } from "./sales.ts";
import {
  addSchedule,
  approveYes,
  queueFirstRun,
  removeSchedule,
  setSchedulePaused,
} from "./schedules.ts";
import { scoutAsk } from "./scout.ts";
import { teach } from "./sentinel.ts";
import type { Steer } from "./steer.ts";
import { mountSteer } from "./steer-routes.ts";
import { applyTeam, confirmTeam, exportTeam, previewTeam } from "./teams.ts";
import { tgOverview, tgPauseAll } from "./tg.ts";
import { postMessage, withApprovalState } from "./threads.ts";
import { verifyWake } from "./verify.ts";
import { publicWake, shareWake, unshareWake } from "./wake-share.ts";

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
  /** A5: whether a Telegram chat redeemed this owner's link code (Huấn's handoff). */
  telegramLinked?: (owner: string) => Promise<boolean>;
  /** Writes we made per namespace (memory_index), for the F6 comparison. */
  written?: (r: Remora) => Promise<Record<string, number>>;
  /** The operator's Walrus Memory account: forget-all and export read it directly (F4, F8). */
  operator?: { key: string; accountId: string; serverUrl: string };
  /** The Hatchery (M1–M7): Walrus storage and share links. */
  hatchery?: Omit<HatcheryDeps, "runtime" | "service">;
  /** E11 (ADR-0111): remoras on sale. */
  listings?: Listings;
  /** H3 (ADR-0115): the owner behind a Telegram Mini App's signed launch data, or null. */
  tgOwner?: (initData: string) => Promise<string | null>;
  /** U18 C1 + C2 (ADR-0123): describe the job, chat commands and their change cards. */
  steer?: Steer;
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
    const route = `${c.req.method} ${c.req.routePath}`;
    if (err instanceof RemoraError && isOpsError(err.code, err.status))
      recordError(route, err.code, err.message);
    else if (!(err instanceof RemoraError) && !(err instanceof NetworkUnavailableError))
      recordError(
        route,
        err instanceof MemoryTimeout ? "relayer.slow" : "unknown",
        (err as Error).message,
      );
    if (err instanceof RemoraError) {
      return c.json(
        { error: { code: err.code, message: humanError(err.code, err.message) } },
        err.status as 400,
      );
    }
    if (err instanceof NetworkUnavailableError) {
      return c.json({ error: { code: err.code, message: err.message } }, 400);
    }
    // A throttled relayer is a "try again", not a server failure (ADR-0049).
    if (err instanceof MemoryTimeout) {
      return c.json(
        { error: { code: "relayer.slow", message: humanError("relayer.slow", err.message) } },
        409,
      );
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
    "/api/rooms",
    "/api/rooms/*",
    "/api/teams/*",
    "/api/proofs/*",
    "/api/learning/*",
    "/api/hatchery/publish",
    "/api/hatchery/publish/*",
    "/api/hatchery/:id/hatch",
    "/api/hatchery/:id/hatch/*",
    "/api/hatchery/:id/deprecate",
    "/api/hatchery/:id/deprecate/*",
    "/api/wakes/*",
    "/api/account/*",
    "/api/reef/probe",
    "/api/reef/listings",
    "/api/reef/listings/*",
    "/api/changes/*",
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

  // Before the id check: `/api/remoras/draft` isn't an id (ADR-0123).
  if (d.steer) mountSteer(app, d.steer);

  // Ids are UUIDs; anything else is a 404 rather than a database error.
  for (const path of [
    "/api/remoras/:id",
    "/api/remoras/:id/*",
    "/api/approvals/:id/*",
    "/api/events/:id/*",
    "/api/rooms/:id",
    "/api/rooms/:id/*",
    "/api/wakes/:id/*",
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
    const b = await body<{
      template?: string;
      name?: string;
      budget?: unknown;
      watch?: string[];
      items?: string[];
    }>(c);
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
    // ADR-0106: a Briefer starts with its list and its brief's schedule.
    if (out.remora.template === "briefer" && Array.isArray(b.items) && b.items.length)
      await setBriefItems(
        rt,
        out.remora,
        b.items.filter((x) => typeof x === "string"),
      );
    // N13: a Disc-less remora is ready now; a paying one after its confirm.
    if (!out.transaction) await queueFirstRun(rt, out.remora.id);
    return c.json({ remora: await view(out.remora), transaction: out.transaction }, 201);
  });

  app.get("/api/remoras/:id", async (c) =>
    c.json({ remora: await view(await service.get(c.req.param("id"), c.get("owner"))) }),
  );

  app.patch("/api/remoras/:id", async (c) => {
    const b = await body<{
      name?: string;
      persona?: string;
      watch?: string[];
      model?: string | null;
    }>(c);
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
    if (!answersQuestions(r.template))
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

  // ── The Telegram Mini App (H3, ADR-0115): no session, just Telegram's signed launch data ──
  const tgOwner = async (c: Context) => {
    const owner = d.tgOwner ? await d.tgOwner(c.req.header("x-telegram-init-data") ?? "") : null;
    if (!owner)
      throw new RemoraError(
        "tg.unlinked",
        "Open this from Remora's Telegram bot, after linking Telegram in Settings.",
        403,
      );
    return owner;
  };
  app.get("/api/tg/me", async (c) => c.json(await tgOverview(rt, await tgOwner(c))));
  app.post("/api/tg/pause", async (c) => {
    const { paused } = await body<{ paused?: unknown }>(c);
    const owner = await tgOwner(c);
    await tgPauseAll(rt, owner, paused !== false);
    return c.json(await tgOverview(rt, owner));
  });

  // ── Crews (ADR-0114): the members, their spend, pause together, retire together ──
  app.get("/api/remoras/:id/crew", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json(await crewView(rt, r));
  });

  app.post("/api/remoras/:id/crew/pause", async (c) => {
    const { paused } = await body<{ paused?: unknown }>(c);
    const r = await service.get(c.req.param("id"), c.get("owner"));
    if (!crewOf(r)) throw new RemoraError("crew.none", `${r.name} isn't in a crew.`, 404);
    await pauseCrew(rt, r, paused !== false);
    return c.json(await crewView(rt, await service.get(r.id, c.get("owner"))));
  });

  /** One transaction revokes every member's Disc; the confirm retires them. */
  const crewIds = async (c: Context) => {
    const r = await service.get(c.req.param("id") ?? "", c.get("owner"));
    if (!crewOf(r)) throw new RemoraError("crew.none", `${r.name} isn't in a crew.`, 404);
    return { r, ids: (await crewMembers(rt, r)).map((m) => m.id) };
  };
  app.post("/api/remoras/:id/crew/retire", async (c) => {
    const { r, ids } = await crewIds(c);
    return c.json(await service.retireAllTx(c.get("owner"), r.network, { ids }));
  });
  app.post("/api/remoras/:id/crew/retire/confirm", async (c) => {
    const { digest } = await body<{ digest?: string }>(c);
    const { r, ids } = await crewIds(c);
    return c.json(
      await service.confirmRetireAll(
        c.get("owner"),
        r.network,
        digest ? digestOf(digest) : undefined,
        { ids },
      ),
    );
  });

  // ── Selling answers (E11, ADR-0111) ───────────────────────────────────────
  const listings = d.listings;
  const sales = () => {
    if (!listings) throw new RemoraError("sale.unavailable", "Selling isn't on here.", 409);
    return listings;
  };

  app.get("/api/remoras/:id/sell", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json(serialize(await saleView(rt, sales(), r)));
  });

  app.put("/api/remoras/:id/sell", async (c) => {
    const b = await body<SaleInput>(c);
    const r = await service.get(c.req.param("id"), c.get("owner"));
    await setSale(rt, sales(), r, b);
    return c.json(serialize(await saleView(rt, sales(), await service.get(r.id, c.get("owner")))));
  });

  /** The payees its Disc allows, set with one owner signature (`disc::set_payees`). */
  const payeeRefs = (v: unknown) => {
    if (!Array.isArray(v) || v.some((x) => typeof x !== "string" || !/^reef:[a-z0-9-]+$/.test(x)))
      throw new RemoraError("payees.bad", "Send the services as reef: references.");
    return v as string[];
  };
  app.post("/api/remoras/:id/payees", async (c) => {
    const { payees } = await body<{ payees?: unknown }>(c);
    return c.json({
      transaction: await service.payeesTx(c.req.param("id"), c.get("owner"), payeeRefs(payees)),
    });
  });
  app.post("/api/remoras/:id/payees/confirm", async (c) => {
    const b = await body<{ digest?: unknown; payees?: unknown }>(c);
    return c.json({
      remora: await view(
        await service.confirmPayees(
          c.req.param("id"),
          c.get("owner"),
          digestOf(b.digest),
          payeeRefs(b.payees),
        ),
      ),
    });
  });

  // ── List your API (E8, ADR-0113) ─────────────────────────────────────────
  const allowPrivate = !process.env.RAILWAY_ENVIRONMENT && process.env.NODE_ENV !== "production";
  const probeFor = (url: unknown) => {
    const usdc = rt.networks.config("testnet").usdcCoinType;
    if (typeof url !== "string" || !usdc)
      throw new RemoraError("listing.bad_url", "Send the API's URL.");
    return probeX402(url, { usdc, allowPrivate, ...(rt.fetch ? { fetch: rt.fetch } : {}) });
  };
  const listingSlug = (v: unknown) => {
    const slug = String(v ?? "")
      .trim()
      .replace(/^@/, "")
      .toLowerCase();
    if (!SALE_SLUG.test(slug))
      throw new RemoraError(
        "listing.bad_slug",
        "Pick a name of 3–32 lowercase letters, digits or dashes, like haiku-shop.",
      );
    return slug;
  };
  const mineListed = async (owner: string) =>
    (await service.list(owner, "testnet")).flatMap((r) =>
      r.status === "retired" ? [] : listingsOf(r.config).map((l) => ({ ...l, remoraId: r.id })),
    );

  app.post("/api/reef/probe", async (c) => {
    const b = await body<{ url?: unknown; slug?: unknown }>(c);
    const slug = listingSlug(b.slug);
    const probe = await probeFor(b.url);
    const owner = normalizeSuiAddress(c.get("owner"));
    return c.json({ probe, message: listingMessage({ ...probe, slug, lister: owner }) });
  });

  app.get("/api/reef/listings", async (c) =>
    c.json({ listings: await mineListed(c.get("owner")) }),
  );

  app.post("/api/reef/listings", async (c) => {
    const b = await body<{ url?: unknown; slug?: unknown; blurb?: unknown; signature?: unknown }>(
      c,
    );
    const slug = listingSlug(b.slug);
    const owner = normalizeSuiAddress(c.get("owner"));
    // Probed again: the owner signed what the API asked for a moment ago, and it must still match.
    const probe = await probeFor(b.url);
    const message = listingMessage({ ...probe, slug, lister: owner });
    const signer =
      typeof b.signature === "string"
        ? await addressFromSignature(message, b.signature, rt.networks.client("testnet"))
        : null;
    if (!signer || normalizeSuiAddress(signer) !== owner)
      throw new RemoraError(
        "listing.bad_signature",
        "That signature isn't yours over this listing. Probe it again and sign.",
      );
    const mine = await mineListed(owner);
    const again = mine.find((l) => l.slug === slug);
    if (!again && (sales().taken(slug) || mine.length >= COMMUNITY_PER_OWNER))
      throw new RemoraError(
        "listing.taken",
        sales().taken(slug)
          ? `@${slug} is taken. Pick another name.`
          : `You can list ${COMMUNITY_PER_OWNER} APIs.`,
        409,
      );
    const holders = (await service.list(owner, "testnet"))
      .filter((r) => r.status !== "retired")
      .sort((a, z) => z.createdAt.getTime() - a.createdAt.getTime());
    const holder = holders.find((r) => r.id === again?.remoraId) ?? holders[0];
    if (!holder)
      throw new RemoraError(
        "listing.no_remora",
        "Make a remora first: a listing lives with one of your remoras.",
        409,
      );
    const listing: CommunityListing = {
      ...probe,
      slug,
      blurb: String(b.blurb ?? "")
        .trim()
        .slice(0, 140),
      network: "testnet",
      lister: owner,
      probedAt: new Date().toISOString(),
      message,
      signature: String(b.signature),
    };
    const kept = listingsOf(holder.config).filter((l) => l.slug !== slug);
    await rt.db
      .update(remoras)
      .set({ config: { ...holder.config, listings: [...kept, listing] }, updatedAt: new Date() })
      .where(eq(remoras.id, holder.id));
    await rt.db.insert(remoraEvents).values({
      remoraId: holder.id,
      network: holder.network,
      type: "action",
      summary: `Listed @${slug} in the Reef (${probe.url}).`,
      payload: { kind: "listing", slug, url: probe.url, payTo: probe.payTo, price: probe.price },
    });
    await sales().refresh();
    return c.json({ listing: { ...listing, remoraId: holder.id } });
  });

  app.delete("/api/reef/listings/:slug", async (c) => {
    const slug = listingSlug(c.req.param("slug"));
    const owner = c.get("owner");
    for (const r of await service.list(owner, "testnet")) {
      const all = listingsOf(r.config);
      if (!all.some((l) => l.slug === slug)) continue;
      await rt.db
        .update(remoras)
        .set({
          config: { ...r.config, listings: all.filter((l) => l.slug !== slug) },
          updatedAt: new Date(),
        })
        .where(eq(remoras.id, r.id));
    }
    await sales().refresh();
    return c.json({ ok: true });
  });

  /**
   * The paid door: `GET /api/x402/r/:slug?q=`. No session: anyone's remora (or any x402 client) pays
   * the owner's address, and the answer settles only once it's written.
   */
  app.get("/api/x402/r/:slug", async (c) => {
    const slug = c.req.param("slug");
    const network = listings
      ? rt.networks
          .list()
          .map((n) => n.network)
          .find((n) => !!listings.bySlug(n, slug))
      : undefined;
    const found = network ? listings?.bySlug(network, slug) : undefined;
    if (!found)
      return c.json(
        { error: { code: "sale.not_found", message: `No remora sells as @${slug}.` } },
        404,
      );
    const question = (c.req.query("q") ?? "").trim();
    if (!question || question.length > 500)
      return c.json(
        {
          error: {
            code: "sale.bad_question",
            message: "Ask a question of 1–500 characters (?q=).",
          },
        },
        400,
      );
    const net = network ? rt.networks.config(network) : null;
    if (!network || !net?.facilitatorUrl || !net.usdcCoinType)
      return c.json(
        { error: { code: "network.unavailable", message: "Payments are off here." } },
        503,
      );
    const paid = x402({
      amount: found.price,
      description: `${found.name}'s answer`,
      settle: "after",
      maxTimeoutSeconds: 120,
      ...(rt.fetch ? { fetch: rt.fetch } : {}),
      networks: {
        [network]: {
          payTo: found.payTo,
          asset: net.usdcCoinType,
          facilitatorUrl: net.facilitatorUrl,
        },
      },
    });
    const early = await paid(c as never, async () => {
      const payer = (c as unknown as { get(k: "x402"): PaidContext }).get("x402").payer;
      const [seller] = await rt.db.select().from(remoras).where(eq(remoras.id, found.sellerId));
      try {
        if (!seller)
          throw new RemoraError("sale.closed", `@${slug} isn't answering right now.`, 409);
        const out = await sellAnswer(rt, seller, slug, question, payer);
        c.res = c.json(out);
      } catch (err) {
        const e =
          err instanceof RemoraError
            ? err
            : new RemoraError("sale.failed", `@${slug} couldn't answer, so nothing was charged.`);
        if (!(err instanceof RemoraError)) rt.log.warn("sale.failed", { slug, error: err });
        // Any non-2xx means the payment is never settled.
        const status = e.code === "sale.timeout" ? 504 : e.code === "sale.failed" ? 502 : e.status;
        c.res = c.json({ error: { code: e.code, message: e.message } }, status as 409);
      }
    });
    if (early) return early;
    const header = c.res.headers.get(PAYMENT_RESPONSE_HEADER);
    if (c.res.status === 200 && header) {
      const settled = decodeHeader<{ transaction?: string; payer?: string }>(header);
      const out = (await c.res.clone().json()) as { eventId?: string };
      const [seller] = await rt.db.select().from(remoras).where(eq(remoras.id, found.sellerId));
      if (seller && settled.transaction)
        await recordSale(rt, seller, {
          slug,
          buyer: settled.payer ?? "",
          amount: found.price,
          digest: settled.transaction,
          eventId: out.eventId ?? "",
        }).catch((err) => rt.log.warn("sale.record_failed", { slug, error: err }));
    }
    return c.res;
  });

  // ── The Briefer (ADR-0106): its list, Run now, and what its page shows ────────
  app.get("/api/remoras/:id/brief", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json(await briefView(rt, r));
  });

  app.put("/api/remoras/:id/brief/items", async (c) => {
    const { items } = await body<{ items?: unknown }>(c);
    if (!Array.isArray(items) || items.some((x) => typeof x !== "string"))
      throw new RemoraError("brief.bad_items", "Send the list as text, one item each.");
    const r = await service.get(c.req.param("id"), c.get("owner"));
    await setBriefItems(rt, r, items as string[]);
    return c.json(await briefView(rt, await service.get(r.id, c.get("owner"))));
  });

  app.post("/api/remoras/:id/brief/run", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const res = await briefNow(rt, r);
    return c.json(
      serialize({
        answer: res.answer,
        eventId: res.eventId,
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

  app.post("/api/remoras/:id/schedules/:scheduleId/:action{pause|resume}", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const s = await setSchedulePaused(
      rt,
      r,
      c.req.param("scheduleId"),
      c.req.param("action") === "pause",
    );
    return c.json({ schedule: s });
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
    const after = c.req.query("after");
    const valid = (d: string | undefined) => !!d && !Number.isNaN(Date.parse(d));
    const rows = await rt.db
      .select()
      .from(remoraEvents)
      .where(
        and(
          inArray(remoraEvents.remoraId, ids),
          ...(type ? [inArray(remoraEvents.type, type.split(","))] : []),
          ...(valid(before) ? [lt(remoraEvents.createdAt, new Date(before as string))] : []),
          ...(valid(after) ? [gt(remoraEvents.createdAt, new Date(after as string))] : []),
        ),
      )
      .orderBy(desc(remoraEvents.createdAt))
      .limit(Math.min(Number(c.req.query("limit") ?? 50) || 50, 200));
    // A thread reads oldest first (ADR-0042); approval cards carry their current state.
    const ordered = c.req.query("order") === "asc" ? rows.reverse() : rows;
    const events = await withApprovalState(rt.db, ordered);
    const names = new Map(mine.map((r) => [r.id, r.name]));
    return c.json({ events: events.map((e) => ({ ...e, remora: names.get(e.remoraId) ?? "" })) });
  });

  // ── 1-1 threads and rooms (ADR-0042) ──────────────────────────────────────
  app.post("/api/remoras/:id/messages", async (c) => {
    const { text } = await body<{ text?: string }>(c);
    if (!text?.trim()) throw new RemoraError("message.empty", "Say something.");
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json(await postMessage(rt, r, text.trim().slice(0, 1_000)), 201);
  });

  const myRoom = async (c: Context): Promise<RoomRow> => {
    const [room] = await rt.db
      .select()
      .from(rooms)
      .where(eq(rooms.id, c.req.param("id") ?? ""));
    if (!room || room.ownerAddress !== c.get("owner") || room.network !== c.get("network"))
      throw new RemoraError("room.not_found", "No such room.", 404);
    return room;
  };

  app.get("/api/rooms", async (c) => {
    await defaultRoom(rt.db, c.get("owner"), c.get("network"));
    const mine = await rt.db
      .select()
      .from(rooms)
      .where(and(eq(rooms.ownerAddress, c.get("owner")), eq(rooms.network, c.get("network"))))
      .orderBy(desc(rooms.isDefault), rooms.createdAt);
    return c.json({ rooms: await Promise.all(mine.map((r) => roomView(rt.db, r))) });
  });

  const roomPatch = async (
    c: Context,
    b: { name?: string; responder?: string; leadId?: string | null; memberIds?: string[] },
  ) => {
    if (b.responder !== undefined && !RESPONDERS.includes(b.responder as never))
      throw new RemoraError("room.bad_responder", "Mentions, lead or auto.");
    const mine = await service.list(c.get("owner"), c.get("network"));
    const ids = new Set(mine.map((r) => r.id));
    if (b.memberIds?.some((id) => !ids.has(id)))
      throw new RemoraError("room.bad_member", "Only your own remoras can join.");
    if (b.leadId && !ids.has(b.leadId))
      throw new RemoraError("room.bad_lead", "The lead must be one of your remoras.");
    return {
      ...(b.name !== undefined ? { name: b.name.trim().slice(0, 40) || "Room" } : {}),
      ...(b.responder !== undefined
        ? { responder: b.responder as "mentions" | "lead" | "auto" }
        : {}),
      ...(b.leadId !== undefined ? { leadId: b.leadId } : {}),
      ...(b.memberIds !== undefined ? { memberIds: [...new Set(b.memberIds)] } : {}),
    };
  };

  app.post("/api/rooms", async (c) => {
    const b = await body<{
      name?: string;
      responder?: string;
      leadId?: string | null;
      memberIds?: string[];
    }>(c);
    const patch = await roomPatch(c, { ...b, name: b.name ?? "Room" });
    const [room] = await rt.db
      .insert(rooms)
      .values({ ownerAddress: c.get("owner"), network: c.get("network"), name: "Room", ...patch })
      .returning();
    if (!room) throw new RemoraError("room.create_failed", "Couldn't make that room.");
    return c.json({ room: await roomView(rt.db, room) }, 201);
  });

  app.patch("/api/rooms/:id", async (c) => {
    const room = await myRoom(c);
    const b = await body<{
      name?: string;
      responder?: string;
      leadId?: string | null;
      memberIds?: string[];
    }>(c);
    // The Team room always holds every live remora.
    const patch = await roomPatch(c, room.isDefault ? { ...b, memberIds: undefined } : b);
    const [updated] = await rt.db.update(rooms).set(patch).where(eq(rooms.id, room.id)).returning();
    return c.json({ room: await roomView(rt.db, updated ?? room) });
  });

  app.get("/api/rooms/:id/messages", async (c) => {
    const room = await myRoom(c);
    const after = c.req.query("after");
    return c.json({
      messages: await roomLines(
        rt.db,
        room,
        after && !Number.isNaN(Date.parse(after)) ? new Date(after) : undefined,
      ),
    });
  });

  app.post("/api/rooms/:id/messages", async (c) => {
    const room = await myRoom(c);
    const { text } = await body<{ text?: string }>(c);
    if (!text?.trim()) throw new RemoraError("message.empty", "Say something.");
    return c.json(await postToRoom(rt, room, text.trim().slice(0, 1_000)), 201);
  });

  // ── Teams from Markdown (ADR-0042) ────────────────────────────────────────
  app.post("/api/teams/preview", async (c) => {
    const { markdown } = await body<{ markdown?: string }>(c);
    return c.json(previewTeam(String(markdown ?? "")));
  });

  app.post("/api/teams/apply", async (c) => {
    const { markdown } = await body<{ markdown?: string }>(c);
    return c.json(
      await applyTeam(rt, service, c.get("owner"), c.get("network"), String(markdown ?? "")),
      201,
    );
  });

  app.post("/api/teams/confirm", async (c) => {
    const b = await body<{ digest?: string; remoraIds?: string[] }>(c);
    const ids = (b.remoraIds ?? []).filter((id) => UUID.test(id));
    return c.json(await confirmTeam(rt, service, c.get("owner"), ids, digestOf(b.digest)));
  });

  app.get("/api/teams/export", async (c) => {
    const md = await exportTeam(rt, c.get("owner"), c.get("network"));
    return c.body(md, 200, {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": 'attachment; filename="remora-team.md"',
    });
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
    c.json(await approveYes(rt, c.get("owner"), c.req.param("id"))),
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
          { error: { code: "wake.not_found", message: "No receipt with that id or digest." } },
          404,
        );
  });

  const inspectRows = async (r: Remora, namespaces: string[]) => {
    const stored = d.inspect
      ? await d.inspect(r, namespaces)
      : { rows: [] as InspectorRow[], counts: {} as Record<string, number> };
    return { ...stored, rows: await enrichRows(rt.db, r, stored.rows) };
  };

  app.get("/api/remoras/:id/memory", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const namespaces = service.config(r).namespaces;
    const q = c.req.query("q");
    // `ns` narrows a search to one namespace (the MCP mapping, F9).
    const ns = c.req.query("ns");
    if (ns && !namespaces.includes(ns))
      throw new RemoraError("memory.bad_namespace", `This remora has no ${ns} memories.`);
    const [stored, found, written, duplicates] = await Promise.all([
      inspectRows(r, namespaces),
      q ? rt.memory.recall(r, q, ns ? [ns] : namespaces, 10) : Promise.resolve([]),
      d.written ? d.written(r) : Promise.resolve({} as Record<string, number>),
      // ADR-0086: writes skipped as duplicates are shown, never silent.
      recentDuplicates(rt.db, r),
    ]);
    // F6: our writes against what the relayer reports; a gap is a warning, never a restore().
    const mismatches = Object.entries(written)
      .filter(([n, count]) => (stored.counts[n] ?? 0) < count)
      .map(([n, count]) => ({ namespace: n, written: count, relayer: stored.counts[n] ?? 0 }));
    return c.json({ namespaces, ...stored, written, mismatches, results: found, duplicates });
  });

  // ── M1–M7: the Hatchery ────────────────────────────────────────────────────
  const hatch = (): HatcheryDeps => {
    if (!d.hatchery)
      throw new RemoraError("hatchery.unavailable", "Templates aren't set up here.", 409);
    return { ...d.hatchery, runtime: rt, service };
  };
  const OBJECT_ID = /^0x[0-9a-fA-F]{64}$/;
  const templateId = (c: Context) => {
    const id = c.req.param("id") ?? "";
    if (!OBJECT_ID.test(id))
      throw new RemoraError("hatchery.not_found", "No template with that id here.", 404);
    return id;
  };
  const networkOf = (c: Context) => resolveNetwork(rt.networks, c.req.header(NETWORK_HEADER));

  app.post("/api/remoras/:id/share", async (c) =>
    c.json({ review: await shareReview(hatch(), c.get("owner"), c.req.param("id")) }),
  );

  app.post("/api/hatchery/publish", async (c) => {
    const b = await body<{ markdown?: string; parent?: string | null }>(c);
    if (typeof b.markdown !== "string")
      throw new RemoraError("hatchery.bad_request", "Send the reviewed file.");
    if (b.parent && !OBJECT_ID.test(b.parent))
      throw new RemoraError("hatchery.bad_request", "The parent isn't a template id.");
    return c.json(
      await publishTx(hatch(), c.get("owner"), c.get("network"), {
        markdown: b.markdown,
        parent: b.parent ?? null,
      }),
    );
  });

  app.post("/api/hatchery/publish/confirm", async (c) => {
    const { digest } = await body<{ digest?: string }>(c);
    const h = hatch();
    const { listing: l } = await confirmPublish(
      h,
      c.get("owner"),
      c.get("network"),
      digestOf(digest),
    );
    return c.json({ listing: l, links: shareLinks(h, l.templateId) });
  });

  // Public reads: anyone can browse the gallery and read a consent screen before signing in.
  app.get("/api/hatchery", async (c) => {
    const kind = c.req.query("kind");
    const q = c.req.query("q");
    return c.json({
      templates: await gallery(hatch(), networkOf(c), {
        ...(q ? { q } : {}),
        ...(kind ? { kind } : {}),
      }),
    });
  });

  app.get("/api/hatchery/:id", async (c) => {
    const h = hatch();
    const { listing: l, row } = await listing(h, networkOf(c), templateId(c));
    return c.json({ listing: l, links: shareLinks(h, l.templateId), markdown: row.markdown });
  });

  app.get("/api/hatchery/:id/consent", async (c) => {
    const { markdown: _m, ...rest } = await consent(hatch(), networkOf(c), templateId(c));
    return c.json({ consent: rest });
  });

  app.post("/api/hatchery/:id/hatch", async (c) =>
    c.json(await hatchTx(hatch(), c.get("owner"), c.get("network"), templateId(c))),
  );

  app.post("/api/hatchery/:id/hatch/confirm", async (c) => {
    const b = await body<{ remoraIds?: string[]; digest?: string }>(c);
    const ids = (b.remoraIds ?? []).filter((x) => UUID.test(x));
    return c.json(
      await confirmHatch(hatch(), c.get("owner"), c.get("network"), {
        templateId: templateId(c),
        remoraIds: ids,
        digest: digestOf(b.digest),
      }),
    );
  });

  app.post("/api/hatchery/:id/deprecate", async (c) =>
    c.json(await deprecateTx(hatch(), c.get("owner"), c.get("network"), templateId(c))),
  );

  app.post("/api/hatchery/:id/deprecate/confirm", async (c) => {
    const { digest } = await body<{ digest?: string }>(c);
    const { listing: l } = await confirmDeprecate(
      hatch(),
      c.get("owner"),
      c.get("network"),
      digestOf(digest),
    );
    return c.json({ listing: l });
  });

  // ── G5 + L1: Proof of Learning and learning charts ─────────────────────────
  app.get("/api/remoras/:id/proofs", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json({ proofs: await proofsFor(rt.db, r) });
  });

  app.get("/api/proofs/:before/:after", async (c) => {
    const before = c.req.param("before");
    const after = c.req.param("after");
    if (!UUID.test(before) || !UUID.test(after))
      throw new RemoraError("proof.not_found", "Those aren't decision ids.", 404);
    const [row] = await rt.db
      .select({ remoraId: receipts.remoraId })
      .from(receipts)
      .where(eq(receipts.id, after));
    if (!row) throw new RemoraError("proof.not_found", "No such decision.", 404);
    const r = await service.get(row.remoraId, c.get("owner"));
    return c.json({ proof: await proofBetween(rt.db, r, before, after) });
  });

  app.get("/api/remoras/:id/learning", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    return c.json({ series: await learningSeries(rt.db, r) });
  });

  /** L1: every remora's series in one file, for the blog post's charts. */
  app.get("/api/learning/export", async (c) => {
    const mine = (await service.list(c.get("owner"), c.get("network"))).filter(
      (r) => r.status !== "creating",
    );
    const out = [];
    for (const r of mine)
      out.push({
        id: r.id,
        name: r.name,
        template: r.template,
        series: await learningSeries(rt.db, r),
      });
    c.header(
      "content-disposition",
      `attachment; filename="remora-learning-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    return c.json({
      exportedAt: new Date().toISOString(),
      network: c.get("network"),
      remoras: out,
    });
  });

  // ── F4/F8: the owner's controls over a remora's memory ────────────────────
  app.post("/api/remoras/:id/memory/hide", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const b = await body<{ blobId?: string; namespace?: string; hidden?: boolean }>(c);
    if (!b.blobId || !b.namespace)
      throw new RemoraError("memory.bad_request", "Say which memory (blob id and namespace).");
    return c.json(
      await setHidden(rt.db, r, service.config(r).namespaces, {
        blobId: b.blobId,
        namespace: b.namespace,
        hidden: b.hidden !== false,
      }),
    );
  });

  app.post("/api/remoras/:id/memory/correct", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const b = await body<{ blobId?: string; namespace?: string; text?: string }>(c);
    if (!b.blobId || !b.namespace || typeof b.text !== "string")
      throw new RemoraError("memory.bad_request", "Say which memory and what the right fact is.");
    return c.json(
      await correct(rt.db, rt.memory, r, service.config(r).namespaces, {
        blobId: b.blobId,
        namespace: b.namespace,
        text: b.text,
      }),
    );
  });

  app.post("/api/remoras/:id/memory/forget", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const b = await body<{ namespace?: string }>(c);
    if (!d.operator) throw new RemoraError("memory.unavailable", "Memory isn't set up here.", 409);
    if (!b.namespace) throw new RemoraError("memory.bad_request", "Say which namespace.");
    return c.json(
      await forgetNamespace(rt.db, d.operator, r, service.config(r).namespaces, b.namespace),
    );
  });

  // ── F15: the facts behind memory (ADR-0074) ────────────────────────────────
  app.get("/api/remoras/:id/facts", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    if (!rt.facts) throw new RemoraError("facts.unavailable", "Facts aren't set up here.", 409);
    const raw = c.req.query("asOf");
    const asOf = raw ? new Date(raw) : undefined;
    if (asOf && Number.isNaN(asOf.getTime()))
      throw new RemoraError("facts.bad_date", "asOf must be a date (ISO 8601).");
    const facts = await rt.facts.list(r, service.config(r).namespaces, asOf ? { asOf } : {});
    return c.json({
      asOf: asOf?.toISOString() ?? null,
      facts,
      disputes: facts.filter((f) => f.status === "disputed").length,
    });
  });

  app.post("/api/remoras/:id/facts/:factId/resolve", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    if (!rt.facts) throw new RemoraError("facts.unavailable", "Facts aren't set up here.", 409);
    const factId = c.req.param("factId");
    if (!UUID.test(factId))
      throw new RemoraError("fact.not_found", "This remora holds no such fact.", 404);
    const b = await body<{ accept?: boolean }>(c);
    if (typeof b.accept !== "boolean")
      throw new RemoraError("fact.bad_request", "Say whether to accept it (true) or reject it.");
    return c.json({
      fact: await rt.facts.resolve(r, service.config(r).namespaces, factId, b.accept),
    });
  });

  app.get("/api/remoras/:id/memory/export", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    if (!d.operator) throw new RemoraError("memory.unavailable", "Memory isn't set up here.", 409);
    const { rows } = await inspectRows(r, service.config(r).namespaces);
    const file = await exportMemories(rt.db, d.operator, r, rows);
    const stem = `${r.name.replace(/[^\w-]+/g, "-").toLowerCase()}-memory-${file.exportedAt.slice(0, 10)}`;
    if (c.req.query("format") === "md") {
      c.header("content-type", "text/markdown; charset=utf-8");
      c.header("content-disposition", `attachment; filename="${stem}.md"`);
      return c.body(exportMarkdown(file));
    }
    c.header("content-disposition", `attachment; filename="${stem}.json"`);
    return c.json(file);
  });

  // ── U9 (ADR-0076): cost card, Reef directory, proof links, leaving Remora ──
  app.get("/api/remoras/:id/cost", async (c) => {
    const r = await service.get(c.req.param("id"), c.get("owner"));
    const month = c.req.query("month") ?? new Date().toISOString().slice(0, 7);
    const deps = {
      db: rt.db,
      defaultModel: rt.brain.answerModel,
      ...(rt.suiUsd ? { suiUsd: rt.suiUsd } : {}),
    };
    const model = service.config(r).model;
    return c.json(
      await remoraCost(deps, { id: r.id, address: r.address, network: r.network, model }, month),
    );
  });

  // Public, like the Reef itself: what a remora may pay, and to which address on this network.
  app.get("/api/reef/services", (c) =>
    c.json(reefServices(rt.reef(resolveNetwork(rt.networks, c.req.header(NETWORK_HEADER))))),
  );

  app.post("/api/wakes/:id/share", async (c) =>
    c.json(await shareWake(rt, c.get("owner"), c.req.param("id"))),
  );

  app.delete("/api/wakes/:id/share", async (c) =>
    c.json(await unshareWake(rt, c.get("owner"), c.req.param("id"))),
  );

  // No session: the token is the capability, and the view is allow-listed (wake-share.ts).
  app.get("/api/public/wakes/:token", async (c) => {
    const view = await publicWake(rt, c.req.param("token"));
    return view
      ? c.json(view)
      : c.json(
          {
            error: { code: "wake.not_shared", message: "This link was revoked or never existed." },
          },
          404,
        );
  });

  /** A8: every memory and every Wake of the owner's remoras on both networks, in one file. */
  app.get("/api/account/export", async (c) => {
    const owner = c.get("owner");
    const mine = [
      ...(await service.list(owner, "testnet")),
      ...(await service.list(owner, "mainnet")),
    ];
    const memories: Record<string, unknown>[] = [];
    if (d.operator) {
      for (const r of mine) {
        const { rows } = await inspectRows(r, service.config(r).namespaces);
        const file = await exportMemories(rt.db, d.operator, r, rows);
        for (const m of file.memories)
          memories.push({ remora: r.name, remoraId: r.id, network: r.network, ...m });
      }
    }
    const wakes = mine.length
      ? await rt.db
          .select()
          .from(receipts)
          .where(
            inArray(
              receipts.remoraId,
              mine.map((r) => r.id),
            ),
          )
          .orderBy(desc(receipts.createdAt))
      : [];
    const exportedAt = new Date().toISOString();
    c.header(
      "content-disposition",
      `attachment; filename="remora-export-${exportedAt.slice(0, 10)}.json"`,
    );
    return c.json({
      v: 1,
      exportedAt,
      memories,
      wakes: wakes.map((w) => ({
        id: w.id,
        remoraId: w.remoraId,
        network: w.network,
        intentHash: w.intentHash,
        txDigest: w.txDigest,
        anchored: w.anchored,
        wakeBlobId: w.wakeBlobId,
        createdAt: w.createdAt.toISOString(),
        wake: w.wake,
      })),
    });
  });

  app.post("/api/account/retire", async (c) =>
    c.json(await service.retireAllTx(c.get("owner"), c.get("network"))),
  );

  app.post("/api/account/retire/confirm", async (c) => {
    const { digest } = await body<{ digest?: string }>(c);
    return c.json(
      await service.confirmRetireAll(
        c.get("owner"),
        c.get("network"),
        digest ? digestOf(digest) : undefined,
      ),
    );
  });

  // ── Settings (A7, H5) and Telegram linking (A5) ───────────────────────────
  app.get("/api/settings", async (c) => {
    const [s] = await rt.db
      .select()
      .from(ownerSettings)
      .where(eq(ownerSettings.ownerAddress, c.get("owner")));
    const telegramLinked = d.telegramLinked ? await d.telegramLinked(c.get("owner")) : false;
    return c.json({
      settings: {
        ...(s ?? {
          ownerAddress: c.get("owner"),
          timezone: "UTC",
          quietStart: null,
          quietEnd: null,
          language: "en",
          notify: "important",
        }),
        telegramLinked,
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
