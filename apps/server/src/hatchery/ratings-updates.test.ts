/**
 * D2 + D3 (ADR-0149, ADR-0150): ratings signed as personal messages, one per address with the last
 * one winning, weighted by paid calls; the badge escapes its text; template updates diff a new version
 * against what the remora runs, apply through the config history, never apply money by themselves,
 * and a decline is remembered. Pure parts always run; the rest on a local Postgres.
 */
import { randomBytes } from "node:crypto";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import {
  approvals,
  createDb,
  eq,
  hatcheryForks,
  hatcheryTemplates,
  inArray,
  remoraEvents,
  remoras,
  rooms,
} from "@remora/db";
import { addressFromSignature, loadEnv } from "@remora/memory";
import { HatcheryListing, type TeamFile, TemplateAnalytics, TemplateUpdates } from "@remora/schema";
import { MemoryKeyStore, RemoraSigner } from "@remora/signer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNetworks } from "../money/networks.ts";
import { REEF as LISTED_REEF, type ResolvedReef } from "../money/reef.ts";
import type { Brain } from "../runtime/brain.ts";
import type { RuntimeDeps } from "../runtime/deps.ts";
import { listVersions } from "../runtime/history.ts";
import { SlidingLimiter } from "../runtime/limits.ts";
import type { RemoraMemory } from "../runtime/memory.ts";
import { createRemoraService, type Remora, type RemoraService } from "../runtime/remoras.ts";
import { createRemoraRoutes } from "../runtime/routes.ts";
import {
  badgeFor,
  badgeSvg,
  escapeXml,
  latestPerRater,
  RATED_EVENT,
  rateTemplate,
  ratingMessage,
  ratingToSign,
  ratingWeight,
  scrubRating,
  templateAnalytics,
  weightedRating,
} from "./ratings.ts";
import { gallery, type HatcheryDeps, listing } from "./service.ts";
import {
  acceptTemplateUpdate,
  currentSide,
  declineTemplateUpdate,
  mergeTriggers,
  offerTemplateUpdates,
  sideOf,
  templateUpdatesOf,
  updateChanges,
} from "./updates.ts";

const entry = (over: Partial<TeamFile["remoras"][number]> = {}): TeamFile["remoras"][number] => ({
  template: "scout",
  name: "Desk",
  persona: "You are a careful desk.",
  watch: [],
  rules: [],
  schedules: [],
  items: [],
  covers: [],
  ...over,
});

describe("ratings (D2, pure)", () => {
  it("scrubs credentials, emails, handles and phone numbers, and keeps prices", () => {
    const out = scrubRating(
      "Great!\nMail me at linh@example.com or @linh_sui, call +84 912 345 678. Paid 0.015 USDC. key sk-abcdefghijklmnopqrstu",
    );
    expect(out).not.toMatch(/linh@example\.com|@linh_sui|912 345 678|sk-abcdef/);
    expect(out).toContain("[email removed]");
    expect(out).toContain("[handle removed]");
    expect(out).toContain("[phone removed]");
    expect(out).toContain("0.015 USDC");
    expect(out).not.toContain("\n");
    expect(scrubRating("x".repeat(400))).toHaveLength(280);
    // Scrubbing what was scrubbed changes nothing, so the signed hash holds.
    expect(scrubRating(out)).toBe(out);
  });

  it("verifies a personal-message signature over the rebuilt message, and nothing else", async () => {
    const kp = new Ed25519Keypair();
    const fields = {
      network: "testnet",
      templateId: normalizeSuiAddress("0x7e"),
      stars: 4,
      text: "Useful.",
      at: "2026-11-05T10:00:00.000Z",
    };
    const message = ratingMessage(fields);
    expect(message).toContain(`Template: ${fields.templateId}`);
    expect(message).toContain("Stars: 4 of 5");
    expect(message).toMatch(/Text SHA-256: [0-9a-f]{64}/);
    const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(message));
    expect(await addressFromSignature(message, signature)).toBe(kp.toSuiAddress());
    // The same signature over 5 stars is someone else's (or nobody's).
    const forged = await addressFromSignature(ratingMessage({ ...fields, stars: 5 }), signature);
    expect(forged).not.toBe(kp.toSuiAddress());
  });

  it("keeps one rating per address, the last signed, and weighs by paid calls", () => {
    const t = normalizeSuiAddress("0x7e");
    const a = normalizeSuiAddress("0xa");
    const base = { templateId: t, rater: a, text: "", createdAt: new Date(1) };
    const kept = latestPerRater([
      { ...base, stars: 5, at: "2026-11-05T10:00:00.000Z" },
      { ...base, stars: 2, at: "2026-11-05T11:00:00.000Z" },
      // An older signature sent again later doesn't win.
      { ...base, stars: 5, at: "2026-11-05T10:00:00.000Z", createdAt: new Date(9) },
    ]);
    expect(kept.map((x) => x.stars)).toEqual([2]);
    expect(ratingWeight(0)).toBe(1);
    expect(ratingWeight(1)).toBe(2);
    expect(ratingWeight(3)).toBe(3);
    expect(ratingWeight(10_000)).toBe(6);
    expect(
      weightedRating([
        { stars: 2, weight: 1 },
        { stars: 5, weight: 3 },
      ]),
    ).toEqual({ stars: 4.3, count: 2 });
    expect(weightedRating([])).toBeNull();
  });

  it("escapes the badge's text: no markup, no scripts, control characters gone", () => {
    const svg = badgeSvg(`<script>alert("x")</script> & 'q'\u0007`, 3);
    expect(svg.startsWith("<svg ")).toBe(true);
    expect(svg).not.toContain("<script");
    expect(svg).toContain("&lt;script&gt;");
    expect(svg).toContain("&amp;");
    expect(svg).toContain("&quot;");
    expect(svg).toContain("&#39;");
    expect(svg).not.toContain("\u0007");
    expect(svg).toContain("3 hatches");
    expect(badgeSvg("One", 1)).toContain("One · 1 hatch<");
    expect(badgeSvg("", null)).toContain("template not found");
    expect(escapeXml(`a<b>"c"&'d'`)).toBe("a&lt;b&gt;&quot;c&quot;&amp;&#39;d&#39;");
  });
});

describe("template updates (D3, pure)", () => {
  const v1 = sideOf(entry({ budget: { monthlyUsd: 0.3, perPaymentUsd: 0.025 } }));
  const v2 = sideOf(
    entry({
      persona: "You are a sharper desk.",
      budget: { monthlyUsd: 0.5, perPaymentUsd: 0.025 },
      triggers: [{ kind: "price", symbol: "SUI", above: 5 }],
    }),
  );

  it("offers only what the author changed and the remora doesn't already have", () => {
    const now = { ...v1, rules: [] };
    const changes = updateChanges(v1, v2, now);
    expect(changes.map((c) => [c.field, c.apply])).toEqual([
      ["persona", "direct"],
      ["triggers", "direct"],
      ["budget", "signature"],
    ]);
    // Tools and Reef services come from the kind: unchanged, not offered.
    expect(changes.some((c) => c.field === "tools" || c.field === "payees")).toBe(false);
    // An owner who already wrote the new persona isn't offered it.
    expect(
      updateChanges(v1, v2, { ...now, persona: v2.persona }).map((c) => c.field),
    ).not.toContain("persona");
    // A field the author didn't touch stays the owner's, even when the owner changed it.
    expect(updateChanges(v1, { ...v1, persona: v1.persona }, { ...now, persona: "Mine." })).toEqual(
      [],
    );
  });

  it("merges lists: the author's removals go, additions come, the owner's own stay", () => {
    const owner = {
      kind: "webhook" as const,
      id: "own",
      name: "ci",
    };
    const old = { kind: "price" as const, id: "p1", symbol: "WAL", below: 0.2 };
    const merged = mergeTriggers(
      [{ kind: "message" }, owner, old],
      [{ kind: "price", symbol: "WAL", below: 0.2 }],
      [{ kind: "price", symbol: "sui", above: 5 }],
    );
    expect(merged.slice(0, 2)).toEqual([{ kind: "message" }, owner]);
    expect(merged[2]).toMatchObject({ kind: "price", symbol: "SUI", above: 5, paused: true });
    expect(merged).toHaveLength(3);
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("D2 + D3 on Postgres", () => {
  const db = createDb(local as string);
  const tag = `${process.pid.toString(16)}${randomBytes(2).toString("hex")}`;
  const AUTHOR = normalizeSuiAddress(`0xa7${tag}`);
  const raterA = new Ed25519Keypair();
  const raterB = new Ed25519Keypair();
  const outsider = new Ed25519Keypair();
  const HATCHER = normalizeSuiAddress(`0xb7${tag}`);
  const owners = [AUTHOR, HATCHER, raterA.toSuiAddress(), raterB.toSuiAddress()];
  const templates: string[] = [];
  const signer = new RemoraSigner(new MemoryKeyStore(), new Uint8Array(randomBytes(32)));
  const networks = createNetworks(
    { TATUM_API_KEY_TESTNET: "t" },
    {
      testnet: {
        remoraPackageId: normalizeSuiAddress("0xcc"),
        discRegistryId: normalizeSuiAddress("0x47"),
        hatcheryPackageId: normalizeSuiAddress("0x4a7c"),
        hatcheryRegistryId: normalizeSuiAddress("0x4a7c0"),
        usdcCoinType: `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`,
      },
      mainnet: { remoraPackageId: null, discRegistryId: null, usdcCoinType: "0x2::usdc::USDC" },
    },
    () => ({}) as never,
  );
  // Every listed service, as the scout template pays all of them.
  const reef: ResolvedReef[] = LISTED_REEF.map((e) => ({
    ref: `reef:${e.slug}` as const,
    slug: e.slug,
    name: e.slug,
    description: "",
    path: `/${e.slug}`,
    price: "10000",
    url: `http://m.test/${e.slug}`,
    payTo: normalizeSuiAddress("0x3e"),
  }));
  const remembered: string[] = [];
  const memory: RemoraMemory = {
    recall: async () => [],
    async remember(_r, _ns, _type, text) {
      remembered.push(text);
      return { saved: true, note: "" };
    },
  };
  const brain: Brain = {
    answerModel: "fake/model",
    answer: async () => ({ text: "ok", tokens: 1 }),
    parseRule: async () => ({ rule: null, tokens: 0 }),
    check: { check: async () => ({ verdict: "allow", reason: "fine" }) },
  };
  const notes: string[] = [];
  const runtime: RuntimeDeps = {
    db,
    networks,
    signer,
    log: createLogger({}, () => {}),
    reef: () => reef,
    memory,
    brain,
    notifier: {
      send: async (_to, m) => {
        notes.push(m.text);
        return "sent";
      },
    },
    limiter: new SlidingLimiter(),
    dailyTokens: 100_000,
    webBase: "http://web.test",
  };
  const base = createRemoraService({
    db,
    networks,
    signer,
    reef: () => reef,
    log: createLogger({}, () => {}),
  });
  // The money part is a transaction the owner signs; here it's only built, never sent.
  const built: unknown[] = [];
  const service: RemoraService = {
    ...base,
    budgetTx: async (_id, _owner, budget) => {
      built.push(budget);
      return "BUDGET_TX";
    },
  };
  const h: HatcheryDeps = {
    runtime,
    service,
    walrus: {
      put: async () => ({ blobId: "unused" }),
      get: async () => "",
    },
    webBase: "http://web.test",
  };

  const tid = (n: number) => normalizeSuiAddress(`0x7e${tag}${n}`);
  /** A base58 publish digest per template. */
  const digestOf = (n: number) => `Dg${n}${tag.replace(/0/g, "z")}`.padEnd(44, "Z");
  const team = (name: string, e: TeamFile["remoras"][number]): Record<string, unknown> => ({
    schema: "remora.team/v1",
    name,
    remoras: [e],
  });
  async function template(
    n: number,
    t: Record<string, unknown>,
    parent: string | null = null,
    author = AUTHOR,
  ) {
    const id = tid(n);
    templates.push(id);
    await db.insert(hatcheryTemplates).values({
      templateId: id,
      network: "testnet",
      blobId: `Bl0b${tag}x${n}`,
      author,
      parent,
      publishDigest: digestOf(n),
      name: String(t.name),
      team: t,
      verdict: "pass",
    });
    return id;
  }
  async function remoraOf(owner: string, template: "scout" | "sentinel"): Promise<Remora> {
    const out = await base.create({
      owner,
      network: "testnet",
      template,
      ...(template === "sentinel" ? { watch: [owner] } : {}),
    });
    const [row] = await db
      .update(remoras)
      .set({ status: "shadow" })
      .where(eq(remoras.id, out.remora.id))
      .returning();
    if (!row) throw new Error("no remora");
    return row;
  }

  afterAll(async () => {
    const mine = await db
      .select({ id: remoras.id })
      .from(remoras)
      .where(inArray(remoras.ownerAddress, owners));
    const ids = mine.map((x) => x.id);
    if (ids.length) await db.delete(remoras).where(inArray(remoras.id, ids));
    if (templates.length) {
      await db.delete(hatcheryForks).where(inArray(hatcheryForks.templateId, templates));
      await db.delete(hatcheryTemplates).where(inArray(hatcheryTemplates.templateId, templates));
    }
    await db.delete(rooms).where(inArray(rooms.ownerAddress, owners));
  });

  describe("ratings (D2)", () => {
    let T = "";
    let rA: Remora;
    let rB: Remora;
    beforeAll(async () => {
      T = await template(1, team(`Rated ${tag}`, entry({ template: "sentinel", name: "W" })));
      rA = await remoraOf(raterA.toSuiAddress(), "sentinel");
      rB = await remoraOf(raterB.toSuiAddress(), "sentinel");
      await db.insert(hatcheryForks).values([
        {
          network: "testnet",
          templateId: T,
          by: raterA.toSuiAddress(),
          txDigest: `F${tag}a`,
          remoraIds: [rA.id],
        },
        {
          network: "testnet",
          templateId: T,
          by: raterB.toSuiAddress(),
          txDigest: `F${tag}b`,
          remoraIds: [rB.id],
        },
      ]);
    });

    const rate = async (kp: Ed25519Keypair, stars: number, text: string, at = new Date()) => {
      const m = await ratingToSign(h, T, { stars, text }, at);
      const { signature } = await kp.signPersonalMessage(new TextEncoder().encode(m.message));
      return rateTemplate(h, T, { stars, text: m.text, at: m.at, signature }, at.getTime());
    };

    it("stores a signed rating as a template.rated event, scrubbed, and checks who signed", async () => {
      const out = await rate(raterA, 4, "Quiet and right. Ping @someone");
      expect(out.rating).toEqual({ stars: 4, count: 1 });
      expect(out.mine.text).toBe("Quiet and right. Ping [handle removed]");
      const [e] = await db
        .select()
        .from(remoraEvents)
        .where(eq(remoraEvents.remoraId, rA.id))
        .then((rows) => rows.filter((x) => x.type === RATED_EVENT));
      expect(e?.payload).toMatchObject({ templateId: T, rater: raterA.toSuiAddress(), stars: 4 });
      // Anyone can check it again from what's stored.
      const p = e?.payload as { message: string; signature: string };
      expect(await addressFromSignature(p.message, p.signature)).toBe(raterA.toSuiAddress());

      // Signed over 3 stars, sent as 5: refused.
      const m = await ratingToSign(h, T, { stars: 3, text: "" });
      const { signature } = await raterB.signPersonalMessage(new TextEncoder().encode(m.message));
      await expect(
        rateTemplate(h, T, { stars: 5, text: "", at: m.at, signature }),
      ).rejects.toMatchObject({ code: "rating.bad_signature" });
      // Someone who never hatched it here can't rate it.
      await expect(rate(outsider, 5, "")).rejects.toMatchObject({ code: "rating.not_hatched" });
      // An old signature is refused.
      const old = new Date(Date.now() - 11 * 60_000);
      const late = await ratingToSign(h, T, { stars: 5, text: "" }, old);
      const s2 = await raterA.signPersonalMessage(new TextEncoder().encode(late.message));
      await expect(
        rateTemplate(h, T, { stars: 5, text: "", at: late.at, signature: s2.signature }),
      ).rejects.toMatchObject({ code: "rating.expired" });
    });

    it("keeps one rating per address (the last wins) and weighs each by paid calls", async () => {
      const later = new Date(Date.now() + 1_000);
      expect((await rate(raterA, 2, "Changed my mind.", later)).rating).toEqual({
        stars: 2,
        count: 1,
      });
      // B's remora paid three times: its rating weighs 1 + log2(4) = 3.
      await db.insert(remoraEvents).values(
        [1, 2, 3].map((i) => ({
          remoraId: rB.id,
          network: "testnet" as const,
          type: "payment",
          summary: `Paid ${i}`,
          payload: { amount: "10000" },
        })),
      );
      expect((await rate(raterB, 5, "Worth it.")).rating).toEqual({ stars: 4.3, count: 2 });
      const [listing] = (await gallery(h, "testnet", { q: `Rated ${tag}` })).map((x) =>
        HatcheryListing.parse(x),
      );
      expect(listing?.rating).toEqual({ stars: 4.3, count: 2 });
    });

    it("shows its author the numbers and the ratings, and nobody else", async () => {
      const a = TemplateAnalytics.parse(await templateAnalytics(db, AUTHOR, T));
      expect(a).toMatchObject({ hatches: 2, remoras: 2, rating: { stars: 4.3, count: 2 } });
      expect(a.ratings.map((x) => [x.stars, x.paidCalls, x.weight])).toEqual(
        expect.arrayContaining([
          [2, 0, 1],
          [5, 3, 3],
        ]),
      );
      await expect(templateAnalytics(db, raterA.toSuiAddress(), T)).rejects.toMatchObject({
        code: "hatchery.not_author",
      });
    });

    it("serves the badge with the live count, by id or publish digest, and keeps ratings out of the feed", async () => {
      const byId = await badgeFor(db, T, 1);
      expect(byId.found).toBe(true);
      expect(byId.svg).toContain(`Rated ${tag} · 2 hatches`);
      expect((await badgeFor(db, digestOf(1), 2)).svg).toContain("2 hatches");
      expect((await badgeFor(db, "Dg9".padEnd(44, "Q"), 3)).found).toBe(false);
      const app = createRemoraRoutes({
        service,
        runtime,
        owner: async () => raterB.toSuiAddress(),
        hatchery: { walrus: h.walrus, webBase: h.webBase },
      });
      const res = await app.request(`/badge/${T}.svg`);
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("image/svg+xml");
      expect(res.headers.get("cache-control")).toContain("public");
      expect(await res.text()).toContain("2 hatches");
      expect((await app.request("/badge/nope.svg")).status).toBe(404);
      const feed = (await (
        await app.request(`/api/feed?remora=${rB.id}`, {
          headers: { "x-remora-network": "testnet" },
        })
      ).json()) as { events: { type: string }[] };
      expect(feed.events.map((e) => e.type)).toContain("payment");
      expect(feed.events.map((e) => e.type)).not.toContain(RATED_EVENT);
    });
  });

  describe("template updates (D3)", () => {
    const P1 = "You are the desk. Answer in two lines.";
    const P2 = "You are the desk. Answer in two lines, with the source first.";
    const v1 = entry({
      name: "Desk",
      persona: P1,
      budget: { monthlyUsd: 0.3, perPaymentUsd: 0.025 },
    });
    const v2 = entry({
      name: "Desk",
      persona: P2,
      budget: { monthlyUsd: 0.5, perPaymentUsd: 0.025 },
      triggers: [{ kind: "price", symbol: "SUI", above: 5 }],
    });
    let T1 = "";
    let T2 = "";
    let r: Remora;
    beforeAll(async () => {
      T1 = await template(11, team(`Desk ${tag}`, v1));
      T2 = await template(12, team(`Desk ${tag}`, v2), T1);
      r = await remoraOf(HATCHER, "scout");
      // As a hatch of v1 leaves it: v1's persona and limit, and a Disc.
      const config = {
        ...r.config,
        persona: P1,
        budget: {
          coinType: `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`,
          windowLimit: "300000",
          window: "month",
          perPaymentCap: "25000",
          payees: sideOf(v1).payees,
        },
      };
      const [row] = await db
        .update(remoras)
        .set({
          config,
          discId: normalizeSuiAddress("0xd15c"),
          allowanceId: normalizeSuiAddress("0xa11"),
          capId: normalizeSuiAddress("0xca9"),
          discName: "desk",
        })
        .where(eq(remoras.id, r.id))
        .returning();
      if (!row) throw new Error("no remora");
      r = row;
      await db.insert(hatcheryForks).values({
        network: "testnet",
        templateId: T1,
        by: HATCHER,
        txDigest: `F${tag}h`,
        remoraIds: [r.id],
      });
    });

    it("offers v2 once to the remora hatched from v1, with the diff", async () => {
      const first = await offerTemplateUpdates(h, T2);
      expect(first.offered).toHaveLength(1);
      expect((await offerTemplateUpdates(h, T2)).offered).toEqual([]);
      expect(notes.at(-1)).toContain("new version");
      const view = TemplateUpdates.parse(await templateUpdatesOf(db, r));
      expect(view.open).toMatchObject({ status: "pending", from: T1, to: T2, version: 2 });
      expect(view.open?.changes.map((c) => [c.field, c.apply])).toEqual([
        ["persona", "direct"],
        ["triggers", "direct"],
        ["budget", "signature"],
      ]);
      // The gallery shows one card per line of versions: v2, not v1.
      const shown = (await gallery(h, "testnet", { q: `Desk ${tag}` })).map((l) => l.templateId);
      expect(shown).toContain(T2);
      expect(shown).not.toContain(T1);
      expect((await listing(h, "testnet", T1)).listing.newer).toBe(T2);
      // A remix by someone else isn't an update for v1's hatchers.
      const remix = await template(13, team("Remix", { ...v2, persona: "Remixed." }), T1, HATCHER);
      expect((await offerTemplateUpdates(h, remix)).offered).toEqual([]);
    });

    it("accepts through the config history; the spending limit waits for a signature", async () => {
      const view = await templateUpdatesOf(db, r);
      const out = await acceptTemplateUpdate(h, HATCHER, r.id, view.open?.id ?? "");
      expect(out.applied).toEqual(["persona", "triggers"]);
      expect(out.sign).toMatchObject({
        kind: "budget",
        transaction: "BUDGET_TX",
        budget: { windowLimit: "500000", perPaymentCap: "25000", window: "month" },
      });
      const [now] = await db.select().from(remoras).where(eq(remoras.id, r.id));
      const c = now?.config as {
        persona: string;
        budget: { windowLimit: string };
        triggers: { kind: string; paused?: boolean }[];
      };
      expect(c.persona).toBe(P2);
      expect(c.triggers).toContainEqual(
        expect.objectContaining({ kind: "price", symbol: "SUI", paused: true }),
      );
      // Money never applies by itself: the limit is still v1's until the owner signs.
      expect(c.budget.windowLimit).toBe("300000");
      const [newest] = await listVersions(db, now as Remora);
      expect(newest?.summary).toContain("template v2");
      expect(newest?.fields).toEqual(expect.arrayContaining(["persona", "triggers"]));
      const [ev] = await db
        .select()
        .from(remoraEvents)
        .where(eq(remoraEvents.id, newest?.id ?? ""));
      expect(ev?.payload).toMatchObject({ source: "template v2", template: { from: T1, to: T2 } });
      // Accepted, with the limit still to sign.
      const after = await templateUpdatesOf(db, now as Remora);
      expect(after.open).toMatchObject({ status: "approved", moneyOpen: true });
      r = now as Remora;
    });

    it("remembers a decline and never offers that version again", async () => {
      const T3 = await template(
        14,
        team(`Desk ${tag}`, { ...v2, persona: "You are the desk. One line." }),
        T2,
      );
      expect((await offerTemplateUpdates(h, T3)).offered).toHaveLength(1);
      const view = await templateUpdatesOf(db, r);
      // Diffed against v2, which it accepted: only the persona changed since.
      expect(view.open?.changes.map((c) => c.field)).toEqual(["persona"]);
      expect(view.open?.version).toBe(3);
      await declineTemplateUpdate(h, HATCHER, view.open?.id ?? "", "I like two lines", r.id);
      expect(remembered.at(-1)).toMatch(
        /TEMPLATE_UPDATE .* v3 .* declined · because I like two lines/,
      );
      const [a] = await db
        .select()
        .from(approvals)
        .where(eq(approvals.id, view.open?.id ?? ""));
      expect(a?.status).toBe("rejected");
      expect((await offerTemplateUpdates(h, T3)).offered).toEqual([]);
      const [still] = await db.select().from(remoras).where(eq(remoras.id, r.id));
      if (!still) throw new Error("no remora");
      expect(currentSide(still, []).persona).toBe(P2);
    });
  });
});
