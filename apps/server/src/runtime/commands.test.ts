/**
 * C2 chat commands (ADR-0123) with the model mocked: the prefilter, the typed command, which remora
 * it means, the change card's diff, and (on local Postgres) the card's life in a thread, a room and
 * Telegram: Apply for settings, a transaction and its confirm for limits, nobody else's taps.
 */
import { randomBytes } from "node:crypto";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import {
  createDb,
  eq,
  ownerSettings,
  remoraEvents,
  remoras,
  roomMessages,
  rooms,
} from "@remora/db";
import { loadEnv } from "@remora/memory";
import { ChangeCard } from "@remora/schema";
import { MemoryKeyStore, RemoraSigner } from "@remora/signer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRemoraBot } from "../channels/remora-bot.ts";
import { createNetworks } from "../money/networks.ts";
import { REEF, type ResolvedReef } from "../money/reef.ts";
import { TEMPLATES } from "../templates/index.ts";
import type { Brain } from "./brain.ts";
import {
  type CommandAnswer,
  type CommandInput,
  hhmm,
  looksLikeCommand,
  planChange,
  resolveTarget,
  saleSlugFor,
  toCommand,
} from "./commands.ts";
import type { RuntimeDeps } from "./deps.ts";
import { SlidingLimiter } from "./limits.ts";
import { createRemoraService, type Remora } from "./remoras.ts";
import { defaultRoom, postToRoom } from "./rooms.ts";
import { createSteer, telegramCard } from "./steer.ts";
import { postMessage } from "./threads.ts";

const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
const LINH = `0x${"1e".repeat(32)}`;

const none: CommandAnswer = {
  kind: "none",
  remora: null,
  limitUsdc: null,
  perPaymentUsdc: null,
  text: null,
  replace: null,
  priceUsdc: null,
  on: null,
  start: null,
  end: null,
  name: null,
  address: null,
};
const said = (a: Partial<CommandAnswer>): CommandAnswer => ({ ...none, ...a });

let n = 0;
const row = (o: Partial<Remora>): Remora =>
  ({
    id: `00000000-0000-4000-8000-${String(++n).padStart(12, "0")}`,
    ownerAddress: normalizeSuiAddress("0x0f"),
    network: "testnet",
    template: "scout",
    name: "Researcher",
    status: "active",
    address: normalizeSuiAddress("0x5c"),
    discName: "remora-x",
    discId: normalizeSuiAddress("0xd1"),
    allowanceId: normalizeSuiAddress("0xa11"),
    capId: normalizeSuiAddress("0xca"),
    playground: false,
    shadowUntil: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    config: {
      persona: "You are the owner's Researcher.",
      budget: {
        coinType: USDC,
        windowLimit: "500000",
        window: "month",
        perPaymentCap: "50000",
        payees: ["reef:sui-risk"],
      },
    },
    ...o,
  }) as Remora;

const kindName = (t: string) => (TEMPLATES as Record<string, { name: string }>)[t]?.name ?? t;
const quiet = { start: null, end: null, timezone: "Asia/Ho_Chi_Minh" };

describe("the prefilter", () => {
  it("lets settings changes through, in English and Vietnamese", () => {
    for (const t of [
      "raise Researcher's monthly limit to 1 USDC",
      "pause Sentinel at night",
      "pause Researcher",
      "resume Researcher",
      "rename Scout to Sage",
      "sell Researcher's answers for 0.02",
      `add Linh ${LINH} as a contact to Errand`,
      "set the per-payment cap to 0.1",
      "tạm dừng Researcher",
      "đổi tên Scout thành Sage",
    ])
      expect(looksLikeCommand(t), t).toBe(true);
  });
  it("leaves questions and rules alone, without a model call", () => {
    for (const t of [
      "Is package 0x2 safe to depend on?",
      "what's the SUI price today?",
      "ignore incoming SUI under 0.01",
      "always ping me for anything over 1 SUI",
      "how much did you spend this week?",
    ])
      expect(looksLikeCommand(t), t).toBe(false);
  });
});

describe("the typed command", () => {
  it("turns the model's flat answer into one command, or none", () => {
    expect(toCommand(none)).toBeNull();
    expect(toCommand(said({ kind: "limit", remora: "Researcher", limitUsdc: 1 }))).toEqual({
      kind: "limit",
      remora: "Researcher",
      limitUsdc: 1,
      perPaymentUsdc: null,
    });
    expect(toCommand(said({ kind: "quiet", remora: "Sentinel" }))).toEqual({
      kind: "quiet",
      remora: "Sentinel",
      start: "22:00",
      end: "07:00",
    });
    expect(toCommand(said({ kind: "quiet", start: "11pm", end: "6am" }))).toMatchObject({
      start: "23:00",
      end: "06:00",
    });
    expect(toCommand(said({ kind: "rename", remora: "Scout", text: "  " }))).toBeNull();
    expect(hhmm("25:00", "22:00")).toBeNull();
  });
});

describe("which remora", () => {
  const researcher = row({ name: "Researcher" });
  const scout = row({ name: "Scout", template: "scout" });
  const watcher = row({ name: "Cold wallet", template: "sentinel", discId: null });
  const retired = row({ name: "Ghost", status: "retired" });
  const mine = [researcher, scout, watcher, retired];

  it("matches a name, then a kind, then part of a name", () => {
    expect(resolveTarget("researcher's", mine, kindName)).toEqual({ remora: researcher });
    expect(resolveTarget("Wallet watcher", mine, kindName)).toEqual({ remora: watcher });
    expect(resolveTarget("cold", mine, kindName)).toEqual({ remora: watcher });
    expect(resolveTarget(null, mine, kindName, scout)).toEqual({ remora: scout });
    expect(resolveTarget("yourself", mine, kindName, scout)).toEqual({ remora: scout });
  });
  it("asks which when two fit or none does, and never offers a retired one", () => {
    const two = [scout, row({ name: "Scout 2" }), retired];
    expect(resolveTarget("Researcher", two, kindName)).toEqual({
      reply: "Which one: Scout, Scout 2? Say its name.",
    });
    expect(resolveTarget("Ghost", mine, kindName)).toEqual({
      reply: 'I can\'t find a remora called "Ghost". Yours: Researcher, Scout, Cold wallet.',
    });
    expect(resolveTarget(null, mine, kindName)).toMatchObject({ reply: /^Which one/ });
  });
});

describe("the change card", () => {
  const ctx = { quiet, contacts: false };
  const plan = (c: Parameters<typeof planChange>[0], r: Remora, x = ctx) => {
    const out = planChange(c, r, x);
    if ("reply" in out) throw new Error(out.reply);
    return out.plan;
  };

  it("a limit is a signed revoke-and-reissue with the new budget", () => {
    const p = plan({ kind: "limit", remora: null, limitUsdc: 1, perPaymentUsdc: null }, row({}));
    expect(p).toMatchObject({
      title: "Raise Researcher's limit",
      sign: true,
      diff: [{ label: "Monthly limit", before: "0.5 USDC", after: "1 USDC" }],
      apply: { kind: "budget", budget: { windowLimit: "1000000", perPaymentCap: "50000" } },
      before: "500000/50000",
    });
  });
  it("refuses limits it can't set, with the reason", () => {
    const r = row({});
    const watcher = row({ name: "Sentinel", template: "sentinel", discId: null, config: {} });
    expect(
      planChange({ kind: "limit", remora: null, limitUsdc: 0.01, perPaymentUsdc: null }, r, ctx),
    ).toEqual({
      reply: "The most it pays at once (0.05 USDC) would be over its monthly limit (0.01 USDC).",
    });
    expect(
      planChange({ kind: "limit", remora: null, limitUsdc: 1, perPaymentUsdc: null }, watcher, ctx),
    ).toEqual({ reply: "Sentinel never pays, so it has no spending limit." });
  });
  it("pausing a Disc is signed; pausing a read-only remora is a tap", () => {
    expect(plan({ kind: "pause", remora: null }, row({})).sign).toBe(true);
    const watcher = row({ name: "Sentinel", template: "sentinel", discId: null });
    expect(plan({ kind: "pause", remora: null }, watcher)).toMatchObject({
      sign: false,
      apply: { kind: "pause", paused: true, disc: false },
    });
  });
  it("'at night' maps to the owner's quiet hours, and says so", () => {
    const p = plan({ kind: "quiet", remora: "Sentinel", start: "22:00", end: "07:00" }, row({}));
    expect(p).toMatchObject({
      sign: false,
      diff: [{ label: "Quiet hours", before: "off", after: "22:00–07:00" }],
      note: expect.stringContaining("can't pause on a schedule"),
    });
  });
  it("selling sets a price in range, under a name of its own", () => {
    const r = row({ name: "Researcher" });
    expect(plan({ kind: "sell", remora: null, on: true, priceUsdc: 0.02 }, r)).toMatchObject({
      sign: false,
      apply: { kind: "sell", on: true, slug: saleSlugFor(r), price: "20000" },
    });
    expect(planChange({ kind: "sell", remora: null, on: true, priceUsdc: 1 }, r, ctx)).toEqual({
      reply: "Set a price from 0.005 to 0.05 USDC an answer.",
    });
    expect(saleSlugFor({ id: "3f9a0000-0000", name: "Bản tin Đà Nẵng" })).toBe(
      "ban-tin-da-nang-3f9a",
    );
  });
  it("a contact is signed, and waits for contacts to exist", () => {
    const errand = row({ name: "Errand", template: "errand" });
    const c = { kind: "contact" as const, remora: null, name: "Linh", address: LINH };
    expect(planChange(c, errand, ctx)).toEqual({ reply: "Contacts aren't available yet." });
    expect(plan(c, errand, { quiet, contacts: true })).toMatchObject({
      sign: true,
      diff: [{ label: "Contacts", before: "none", after: "Linh (0x1e1e…1e1e)" }],
      apply: { kind: "contact", name: "Linh", address: LINH },
    });
  });
  it("Telegram shows Apply for a setting and a sign link for a limit", () => {
    const id = "11111111-2222-4333-8444-555555555555";
    const rename = {
      title: "Rename Scout",
      diff: [{ label: "Name", before: "Scout", after: "Sage" }],
      sign: false,
    };
    const tap = telegramCard("https://web.test", id, rename);
    expect(tap.text).toBe("Rename Scout\nName: Scout → Sage");
    expect(tap.buttons.map((b) => b.data)).toEqual([`chg:${id}:a`, `chg:${id}:x`]);
    const signed = telegramCard("https://web.test", id, { ...rename, sign: true });
    expect(signed.text).toContain(`Sign it in your wallet: https://web.test/changes/${id}`);
    expect(signed.buttons[0]).toEqual({
      label: "Sign in wallet",
      url: `https://web.test/changes/${id}`,
    });
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("change cards end to end on Postgres", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x${randomBytes(32).toString("hex")}`);
  const STRANGER = normalizeSuiAddress(`0x${randomBytes(32).toString("hex")}`);
  const PKG = normalizeSuiAddress("0xcc");
  const DISC = normalizeSuiAddress("0xd1");
  const created: string[] = [];
  const reef: ResolvedReef[] = REEF.map((e) => ({
    ...e,
    url: `http://m.test${e.path}`,
    payTo: normalizeSuiAddress("0x3e"),
  }));
  const client = {
    core: {
      getTransaction: async () => ({
        Transaction: {
          effects: {
            status: { success: true, error: null },
            changedObjects: [
              { objectId: normalizeSuiAddress("0xd2"), idOperation: "Created" },
              { objectId: normalizeSuiAddress("0xa12"), idOperation: "Created" },
              { objectId: normalizeSuiAddress("0xcb"), idOperation: "Created" },
            ],
          },
          objectTypes: {
            [normalizeSuiAddress("0xd2")]: `${PKG}::disc::Disc`,
            [normalizeSuiAddress("0xa12")]:
              `0x2::allowance::Allowance<0x2::balance::Balance<${USDC}>>`,
            [normalizeSuiAddress("0xcb")]:
              `0x2::allowance::AllowanceCap<0x2::balance::Balance<${USDC}>>`,
          },
          transaction: { sender: OWNER },
        },
      }),
    },
  } as unknown as SuiGrpcClient;
  const networks = createNetworks(
    { TATUM_API_KEY_TESTNET: "t" },
    {
      testnet: {
        remoraPackageId: PKG,
        discRegistryId: normalizeSuiAddress("0x47"),
        usdcCoinType: USDC,
      },
      mainnet: { remoraPackageId: null, discRegistryId: null, usdcCoinType: USDC },
    },
    () => client,
  );
  const signer = new RemoraSigner(new MemoryKeyStore(), new Uint8Array(randomBytes(32)));
  const log = createLogger({}, () => {});
  const brain = {
    answerModel: "fake",
    answer: async () => ({ text: "an answer", tokens: 1 }),
    parseRule: async () => ({ rule: null, tokens: 0 }),
    check: { check: async () => ({ verdict: "allow" as const, reason: "" }) },
  } satisfies Brain;
  const rt: RuntimeDeps = {
    db,
    networks,
    signer,
    log,
    reef: () => reef,
    memory: { recall: async () => [], remember: async () => ({ saved: true, note: "" }) },
    brain,
    notifier: { send: async () => "sent" },
    limiter: new SlidingLimiter(),
    dailyTokens: 100_000,
    webBase: "https://web.test",
  };
  const service = createRemoraService({ db, networks, signer, reef: () => reef, log });
  /** What the parse model "reads" in each line; anything else is not a command. */
  const lines: Record<string, CommandAnswer> = {
    "rename yourself to Sage": said({ kind: "rename", text: "Sage" }),
    "rename Lookout to Night owl": said({ kind: "rename", remora: "Lookout", text: "Night owl" }),
    "pause Lookout": said({ kind: "pause", remora: "Lookout" }),
    "pause Lookout at night": said({ kind: "quiet", remora: "Lookout" }),
    "raise Researcher's monthly limit to 2 USDC": said({
      kind: "limit",
      remora: "Researcher",
      limitUsdc: 2,
    }),
    "rename Zed to Ace": said({ kind: "rename", remora: "Zed", text: "Ace" }),
    [`add Linh ${LINH} as a contact to Researcher`]: said({
      kind: "contact",
      remora: "Researcher",
      name: "Linh",
      address: LINH,
    }),
  };
  const asked: CommandInput[] = [];
  const parse = async (i: CommandInput) => {
    asked.push(i);
    return lines[i.text] ?? none;
  };
  const contactCalls: unknown[][] = [];
  const steer = createSteer({
    runtime: rt,
    service,
    parse,
    draft: async () => {
      throw new Error("not in this test");
    },
  });
  const withContacts = createSteer({
    runtime: rt,
    service,
    parse,
    draft: async () => {
      throw new Error("not in this test");
    },
    contactsTx: async (...args) => {
      contactCalls.push(["tx", ...args]);
      return "TX-JSON";
    },
    confirmContacts: async (...args) => {
      contactCalls.push(["confirm", ...args]);
      return null;
    },
  });
  const card = async (eventId: string) => {
    const [e] = await db.select().from(remoraEvents).where(eq(remoraEvents.id, eventId));
    return ChangeCard.parse(e?.payload);
  };

  let researcher: Remora;
  let lookout: Remora;
  beforeAll(async () => {
    const s = await service.create({
      owner: OWNER,
      network: "testnet",
      template: "scout",
      name: "Researcher",
    });
    created.push(s.remora.id);
    const [r] = await db
      .update(remoras)
      .set({
        status: "active",
        discId: DISC,
        allowanceId: normalizeSuiAddress("0xa11"),
        capId: normalizeSuiAddress("0xca"),
      })
      .where(eq(remoras.id, s.remora.id))
      .returning();
    if (!r) throw new Error("no researcher");
    researcher = r;
    const w = await service.create({
      owner: OWNER,
      network: "testnet",
      template: "sentinel",
      name: "Lookout",
    });
    created.push(w.remora.id);
    lookout = w.remora;
  });
  afterAll(async () => {
    await db.delete(rooms).where(eq(rooms.ownerAddress, OWNER));
    await db.delete(ownerSettings).where(eq(ownerSettings.ownerAddress, OWNER));
    for (const id of created) await db.delete(remoras).where(eq(remoras.id, id));
  });

  it("a 1-1 thread answers 'rename yourself' with a card; Apply renames it, once", async () => {
    const out = await postMessage(rt, lookout, "rename yourself to Sage", steer.inThread);
    expect(out.eventIds).toHaveLength(1);
    const id = out.eventIds[0] ?? "";
    expect(await card(id)).toMatchObject({
      target: lookout.id,
      title: "Rename Lookout",
      diff: [{ label: "Name", before: "Lookout", after: "Sage" }],
      sign: false,
      status: "pending",
    });
    expect(asked.at(-1)).toMatchObject({ here: "Lookout" });
    await expect(steer.apply(STRANGER, id)).rejects.toMatchObject({ status: 403 });
    const applied = await steer.apply(OWNER, id);
    expect(applied.change).toMatchObject({ status: "applied" });
    expect(applied.change).not.toHaveProperty("apply");
    expect((await service.get(lookout.id, OWNER)).name).toBe("Sage");
    await expect(steer.apply(OWNER, id)).rejects.toMatchObject({ code: "change.decided" });
    await service.edit(lookout.id, OWNER, { name: "Lookout" });
  });

  it("a line that isn't a command goes on to the remora", async () => {
    const before = asked.length;
    expect(await steer.inThread(lookout, "what do you watch?")).toBeNull();
    expect(asked.length).toBe(before);
  });

  it("a stale card expires instead of applying", async () => {
    const [id] = (await steer.inThread(lookout, "rename Lookout to Night owl")) ?? [];
    await service.edit(lookout.id, OWNER, { name: "Lookout!" });
    await expect(steer.apply(OWNER, id ?? "")).rejects.toMatchObject({ code: "change.stale" });
    expect((await card(id ?? "")).status).toBe("expired");
    await service.edit(lookout.id, OWNER, { name: "Lookout" });
  });

  it("Telegram: the linked owner's card applies on a tap; a stranger's tap does nothing", async () => {
    const bot = createRemoraBot({
      runtime: rt,
      service,
      steer,
      network: "testnet",
      ownerOf: async (tg) => (tg === "1" ? OWNER : tg === "2" ? STRANGER : null),
      link: async () => "",
    });
    const reply = await bot.command({ id: "1", name: "uy" }, "pause Lookout");
    expect(reply?.text).toBe("Pause Lookout\nStatus: shadow → paused");
    const apply = reply?.buttons?.[0]?.data ?? "";
    expect(apply).toMatch(/^chg:[0-9a-f-]{36}:a$/);
    expect(await bot.callback({ id: "2" }, apply)).toBe("That change isn't yours.");
    expect(await bot.command({ id: "3", name: "x" }, "pause Lookout")).toBeNull();
    expect(await bot.callback({ id: "1" }, apply)).toBe("Done: Pause Lookout.");
    expect((await service.get(lookout.id, OWNER)).status).toBe("paused");
    await service.setPaused(lookout.id, OWNER, false);
  });

  it("'pause … at night' sets the owner's quiet hours on Apply", async () => {
    const out = await steer.inTelegram(OWNER, "testnet", "pause Lookout at night");
    const id = /chg:([0-9a-f-]{36}):a/.exec(out?.buttons?.[0]?.data ?? "")?.[1] ?? "";
    await steer.apply(OWNER, id);
    const [s] = await db.select().from(ownerSettings).where(eq(ownerSettings.ownerAddress, OWNER));
    expect(s).toMatchObject({ quietStart: "22:00", quietEnd: "07:00" });
  });

  it("a limit comes back as a sign link: no tap applies it, the transaction and confirm do", async () => {
    const out = await steer.inTelegram(
      OWNER,
      "testnet",
      "raise Researcher's monthly limit to 2 USDC",
    );
    expect(out?.text).toContain("Monthly limit: 1 USDC → 2 USDC");
    const link = out?.buttons?.[0]?.url ?? "";
    expect(link).toMatch(/^https:\/\/web\.test\/changes\/[0-9a-f-]{36}$/);
    const id = link.split("/").pop() ?? "";
    await expect(steer.apply(OWNER, id)).rejects.toMatchObject({ code: "change.needs_signature" });
    expect(await steer.tap(OWNER, `chg:${id}:a`)).toBe("This one needs your signature.");
    await expect(steer.tx(STRANGER, id)).rejects.toMatchObject({ status: 403 });
    const { transaction } = await steer.tx(OWNER, id);
    const calls = Transaction.from(transaction)
      .getData()
      .commands.map((c) => c.MoveCall && `${c.MoveCall.module}::${c.MoveCall.function}`);
    expect(calls).toContain("disc::issue");
    const done = await steer.confirm(OWNER, id, "Dg1111111111111111111111111111111111");
    expect(done.change).toMatchObject({ status: "applied", digest: expect.any(String) });
    const r = await service.get(researcher.id, OWNER);
    expect(service.config(r).budget?.windowLimit).toBe("2000000");
    expect(r.discId).toBe(normalizeSuiAddress("0xd2"));
  });

  it("a contact waits for contacts, then is a transaction through the contacts dependency", async () => {
    const text = `add Linh ${LINH} as a contact to Researcher`;
    expect(await steer.inTelegram(OWNER, "testnet", text)).toEqual({
      text: "Contacts aren't available yet.",
    });
    const out = await withContacts.inTelegram(OWNER, "testnet", text);
    const id = out?.buttons?.[0]?.url?.split("/").pop() ?? "";
    expect(await withContacts.tx(OWNER, id)).toEqual({ transaction: "TX-JSON" });
    await withContacts.confirm(OWNER, id, "Dg2222222222222222222222222222222222");
    expect(contactCalls).toEqual([
      ["tx", researcher.id, OWNER, [{ name: "Linh", address: LINH }]],
      [
        "confirm",
        researcher.id,
        OWNER,
        "Dg2222222222222222222222222222222222",
        [{ name: "Linh", address: LINH }],
      ],
    ]);
  });

  it("a room posts the owner's line and the card as the target's line; unknown names ask", async () => {
    const room = await defaultRoom(db, OWNER, "testnet");
    const out = await postToRoom(rt, room, "pause Lookout", steer.inRoom);
    expect(out).toMatchObject({ route: "signal", routedTo: [lookout.id] });
    const [line] = await db
      .select()
      .from(roomMessages)
      .where(eq(roomMessages.id, out.replies[0] ?? ""));
    expect(line).toMatchObject({ author: "remora", remoraId: lookout.id, text: "Pause Lookout" });
    const asked = await postToRoom(rt, room, "rename Zed to Ace", steer.inRoom);
    const [sys] = await db
      .select()
      .from(roomMessages)
      .where(eq(roomMessages.id, asked.replies[0] ?? ""));
    expect(sys).toMatchObject({ author: "system", text: expect.stringMatching(/can't find/) });
  });
});
