/**
 * Against the local dev database (ADR-0060). CI has no Postgres, so these skip themselves there,
 * the way Remora's memory tests skip without credentials.
 */
import { randomUUID } from "node:crypto";
import { eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createBot } from "./bot.ts";
import type { Anchorer } from "./chain.ts";
import { anchors, createDb, events, groups, members, picks } from "./db/index.ts";
import { rootFromProof } from "./merkle.ts";
import { anchorPending, logPick, PickError, receiptFor } from "./picks.ts";
import { verifyReceipt } from "./verify.ts";

const url = process.env.DATABASE_URL ?? "postgres://remora:remora@localhost:5434/remora";
const db = createDb(url);
let up = false;
const tag = randomUUID().slice(0, 8);
const groupId = `test-${tag}`;
const memberId = `m-${tag}`;
const open = `test:open:${tag}`;
const locked = `test:locked:${tag}`;

beforeAll(async () => {
  up = await Promise.race([
    db.execute("select 1 from receipts.events limit 1").then(() => true),
    new Promise<boolean>((r) => setTimeout(() => r(false), 2000)),
  ]).catch(() => false);
  if (!up) return;
  const now = Date.now();
  await db
    .insert(groups)
    .values({ id: groupId, name: "unit test", telegramChatId: `-${tag.replace(/\D/g, "1")}` });
  await db
    .insert(members)
    .values({ id: memberId, groupId, name: "Tess", test: true, telegramUserId: "42" });
  // Made-up teams, so the bot can't match tonight's real games in the shared dev database.
  const base = { league: "NBA", kind: "game", noLabel: "Wombats win", status: "scheduled" };
  await db.insert(events).values([
    {
      ...base,
      id: open,
      title: "Wombats at Zebras",
      yesLabel: "Zebras win",
      startsAt: new Date(now + 3600_000),
      refs: { home: "ZZZ", away: "WWW", homeShort: "Zebras" },
    },
    {
      ...base,
      id: locked,
      title: "Wombats at Yaks",
      yesLabel: "Yaks win",
      startsAt: new Date(now - 60_000),
      refs: { home: "YYY", away: "WWW", homeShort: "Yaks" },
    },
  ]);
});

afterAll(async () => {
  if (!up) return;
  const ids = (
    await db.select({ a: picks.anchorId }).from(picks).where(eq(picks.groupId, groupId))
  ).map((r) => r.a);
  await db.delete(picks).where(eq(picks.groupId, groupId));
  const fake = ids.filter((a): a is string => !!a);
  if (fake.length) await db.delete(anchors).where(inArray(anchors.id, fake));
  await db.delete(members).where(eq(members.groupId, groupId));
  await db.delete(events).where(inArray(events.id, [open, locked]));
  await db.delete(groups).where(eq(groups.id, groupId));
});

const fakeChain = (): Anchorer & { roots: string[] } => {
  const roots: string[] = [];
  return {
    roots,
    network: "testnet",
    packageId: "0x1",
    async anchor(root) {
      roots.push(root);
      return { digest: `digest-${roots.length}`, tsMs: Date.now() };
    },
    async read(digest) {
      const root = roots[Number(digest.split("-")[1]) - 1];
      return root
        ? { digest, success: true, root, count: 1, tsMs: Date.now() - 1000, sender: "0x1" }
        : null;
    },
  };
};

describe("picks against the database", () => {
  it("refuses a pick at or after lock, a bad confidence, and a second pick", async (ctx) => {
    if (!up) return ctx.skip();
    const deps = { db, memory: null, anchorer: null };
    await expect(
      logPick(deps, { groupId, memberId, eventId: locked, side: "yes", confidence: 70 }),
    ).rejects.toMatchObject({ code: "locked" });
    await expect(
      logPick(deps, { groupId, memberId, eventId: open, side: "yes", confidence: 40 }),
    ).rejects.toBeInstanceOf(PickError);
    const r = await logPick(deps, {
      groupId,
      memberId,
      eventId: open,
      side: "no",
      confidence: "65%",
    });
    expect(r.pick.confidence).toBe(0.65);
    await expect(
      logPick(deps, { groupId, memberId, eventId: open, side: "yes", confidence: 70 }),
    ).rejects.toMatchObject({ code: "duplicate" });
  });

  it("anchors pending picks in one batch, and the receipt verifies", async (ctx) => {
    if (!up) return ctx.skip();
    const chain = fakeChain();
    const batch = await anchorPending({ db, anchorer: chain }, groupId);
    expect(batch?.count).toBeGreaterThan(0);
    const [p] = await db.select().from(picks).where(eq(picks.groupId, groupId));
    const receipt = await receiptFor(db, p?.id as string);
    expect(receipt?.anchor?.digest).toBe(batch?.digest);
    expect(rootFromProof(receipt?.leaf as string, receipt?.proof ?? [])).toBe(batch?.root);
    const v = await verifyReceipt(chain, receipt as NonNullable<typeof receipt>);
    expect(v.checks.find((c) => c.name === "proof reaches the onchain root")?.ok).toBe(true);
  });
});

describe("the Telegram bot", () => {
  it("logs /pick by team name and refuses a late one", async (ctx) => {
    if (!up) return ctx.skip();
    await db.delete(picks).where(eq(picks.groupId, groupId));
    const sent: string[] = [];
    const bot = createBot("123:test", { db, memory: null, anchorer: null, baseUrl: "http://r" }, {
      id: 123,
      is_bot: true,
      first_name: "Receipts",
      username: "receipts_test_bot",
      can_join_groups: true,
      can_read_all_group_messages: false,
      supports_inline_queries: false,
      can_connect_to_business: false,
      has_main_web_app: false,
    } as never);
    bot.api.config.use(async (_prev, method, payload) => {
      if (method === "sendMessage") sent.push((payload as { text: string }).text);
      return { ok: true, result: true } as never;
    });
    const [g] = await db.select().from(groups).where(eq(groups.id, groupId));
    const message = (text: string) => ({
      update_id: Math.floor(Math.random() * 1e9),
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        chat: { id: Number(g?.telegramChatId), type: "group" as const, title: "unit test" },
        from: { id: 42, is_bot: false, first_name: "Tess" },
        text,
        entities: [
          { type: "bot_command" as const, offset: 0, length: text.split(" ")[0]?.length ?? 0 },
        ],
      },
    });
    await bot.handleUpdate(message("/pick Zebras 70") as never);
    expect(sent.at(-1)).toMatch(/Locked in: Zebras win at 70%/);
    await bot.handleUpdate(message("/pick Yaks 70") as never);
    expect(sent.at(-1)).toMatch(/No open market|Locked at/);
  });
});
