/**
 * H7 (ADR-0051) in-process: a visitor's session gets a live Scout with a $1 Disc that the funder
 * issues and signs for (a fake chain), questions run out, the pool and per-IP limits hold, the
 * funder's balance gates new sessions, the expiry revokes and retires, and playground Scouts never
 * show up in the funder's own views or touch the operator's memory. Real Postgres.
 */
import { randomBytes } from "node:crypto";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, eq, inArray, jobs, playgroundSessions, remoras } from "@remora/db";
import { AllowanceBcs, AllowanceCapBcs, DiscBcs } from "@remora/disc-sdk";
import { loadEnv } from "@remora/memory";
import { PlaygroundSession } from "@remora/schema";
import { MemoryKeyStore, RemoraSigner } from "@remora/signer";
import { afterAll, describe, expect, it } from "vitest";
import { createNetworks } from "../money/networks.ts";
import type { ResolvedReef } from "../money/reef.ts";
import type { Brain } from "../runtime/brain.ts";
import type { RuntimeDeps } from "../runtime/deps.ts";
import { SlidingLimiter } from "../runtime/limits.ts";
import type { RemoraMemory } from "../runtime/memory.ts";
import { createRemoraService } from "../runtime/remoras.ts";
import { membersOf } from "../runtime/rooms.ts";
import { createPlaygroundRoutes } from "./routes.ts";
import {
  ask,
  availability,
  createSession,
  expire,
  getSession,
  noMemory,
  PLAYGROUND_EXPIRE,
  type PlaygroundDeps,
} from "./service.ts";

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

const PKG = normalizeSuiAddress("0xcc");
const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
const PAYTO = normalizeSuiAddress("0x3e");
const reef: ResolvedReef[] = ["sui-risk", "odds", "brief"].map((slug) => ({
  ref: `reef:${slug}` as const,
  slug,
  name: slug,
  description: "",
  path: `/${slug}`,
  price: "10000",
  url: `http://m.test/${slug}`,
  payTo: PAYTO,
}));

describe.skipIf(!local)("playground (H7, ADR-0051)", () => {
  const db = createDb(local as string);
  const funder = new Ed25519Keypair();
  const FUNDER = normalizeSuiAddress(funder.toSuiAddress());
  const ids = {
    disc: normalizeSuiAddress("0xd1"),
    allowance: normalizeSuiAddress("0xa11"),
    cap: normalizeSuiAddress("0xca"),
  };
  let discName = "";
  const fake = {
    core: {
      getTransaction: async () => ({
        Transaction: {
          effects: {
            status: { success: true, error: null },
            changedObjects: [
              { objectId: ids.disc, idOperation: "Created" },
              { objectId: ids.allowance, idOperation: "Created" },
              { objectId: ids.cap, idOperation: "Created" },
            ],
          },
          objectTypes: {
            [ids.disc]: `${PKG}::disc::Disc`,
            [ids.allowance]: `0x2::allowance::Allowance<0x2::balance::Balance<${USDC}>>`,
            [ids.cap]: `0x2::allowance::AllowanceCap<0x2::balance::Balance<${USDC}>>`,
          },
          transaction: { sender: FUNDER },
        },
      }),
      getObject: async ({ objectId }: { objectId: string }) => ({
        object: {
          objectId,
          type: "",
          content:
            objectId === ids.allowance
              ? AllowanceBcs.serialize({
                  id: objectId,
                  settings: {
                    funder: FUNDER,
                    spender: null,
                    app: null,
                    lifetime_cap: null,
                    start_timestamp_ms: null,
                    expiration_timestamp_ms: null,
                    rate_limit: null,
                    name: discName,
                  },
                  current_spend: 0n,
                }).toBytes()
              : objectId === ids.cap
                ? AllowanceCapBcs.serialize({ id: objectId, allowance: ids.allowance }).toBytes()
                : DiscBcs.serialize({
                    id: ids.disc,
                    owner: FUNDER,
                    name: discName,
                    payees: { contents: [PAYTO] },
                    per_payment_cap: 50_000n,
                    paused: false,
                    version: 1n,
                  }).toBytes(),
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
    () => fake,
  );
  const service = createRemoraService({
    db,
    networks,
    signer: new RemoraSigner(new MemoryKeyStore(), new Uint8Array(randomBytes(32))),
    reef: () => reef,
    log: createLogger({}, () => {}),
  });
  // The operator's memory must never be touched by a playground turn.
  const operatorCalls: string[] = [];
  const operatorMemory: RemoraMemory = {
    recall: async () => {
      operatorCalls.push("recall");
      return [];
    },
    remember: async () => {
      operatorCalls.push("remember");
      return { saved: true, note: "" };
    },
  };
  const brain: Brain = {
    answerModel: "fake/model",
    answer: async (i) => ({ text: `answered: ${i.question}`, tokens: 3 }),
    parseRule: async () => ({ rule: null, tokens: 0 }),
    check: { check: async () => ({ verdict: "allow", reason: "fine" }) },
  };
  const runtime: RuntimeDeps = {
    db,
    networks,
    signer: new RemoraSigner(new MemoryKeyStore(), new Uint8Array(randomBytes(32))),
    log: createLogger({}, () => {}),
    reef: () => reef,
    memory: operatorMemory,
    brain,
    notifier: { send: async () => "sent" },
    limiter: new SlidingLimiter(),
    dailyTokens: 100_000,
    webBase: "http://web.test",
    buildKind: async () => new Uint8Array([0]),
  };
  const signed: string[] = [];
  let balances = { usdc: 900_000n, sui: 500_000_000n };
  const p = (o: Partial<PlaygroundDeps> = {}): PlaygroundDeps => ({
    runtime,
    service,
    network: "testnet",
    funder,
    limits: {
      questionsPerSession: 2,
      sessionsPerIpPerDay: 2,
      pool: 2,
      ttlMinutes: 60,
      discUsdc: "1.00",
    },
    secret: "s".repeat(32),
    memory: noMemory,
    async sign(json) {
      const tx = JSON.parse(json) as { sender: string };
      expect(normalizeSuiAddress(tx.sender)).toBe(FUNDER);
      // The fake chain matches created objects by the newest playground Scout's Disc name.
      const rows = await db.select().from(remoras).where(eq(remoras.ownerAddress, FUNDER));
      discName =
        rows.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0]?.discName ?? "";
      const digest = `DgPg${process.pid}x${signed.length + 1}`;
      signed.push(digest);
      return digest;
    },
    balances: async () => balances,
    ...o,
  });

  afterAll(async () => {
    const mine = await db
      .select({ id: remoras.id })
      .from(remoras)
      .where(eq(remoras.ownerAddress, FUNDER));
    const remoraIds = mine.map((r) => r.id);
    if (remoraIds.length) {
      const sessions = await db
        .select({ id: playgroundSessions.id })
        .from(playgroundSessions)
        .where(inArray(playgroundSessions.remoraId, remoraIds));
      for (const s of sessions)
        await db.delete(jobs).where(eq(jobs.idempotencyKey, `${PLAYGROUND_EXPIRE}:${s.id}`));
      await db.delete(remoras).where(inArray(remoras.id, remoraIds));
    }
  });

  let token = "";
  it("gives a visitor a live Scout with a $1 Disc the funder signed for", async () => {
    const out = await createSession(p(), "203.0.113.7");
    token = out.token;
    const s = PlaygroundSession.parse(out.session);
    expect(s).toMatchObject({
      status: "live",
      budgetUsdc: "1.00",
      spentUsdc: "0.00",
      questionsLeft: 2,
      discId: ids.disc,
    });
    expect(s.issueDigest).toBe(signed[0]);
    const [row] = await db.select().from(remoras).where(eq(remoras.id, s.remoraId));
    expect(row).toMatchObject({ status: "active", playground: true, ownerAddress: FUNDER });
    // The Disc's budget: 1 USDC for its whole life, expiring with the session.
    const config = row?.config as
      | { budget?: { windowLimit: string; perPaymentCap: string; expiresAt: string } }
      | undefined;
    const budget = config?.budget;
    expect(budget).toMatchObject({ windowLimit: "1000000", perPaymentCap: "50000" });
    expect(Date.parse(budget?.expiresAt ?? "")).toBe(Date.parse(s.expiresAt));
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.kind, PLAYGROUND_EXPIRE))
      .orderBy(jobs.createdAt);
    expect(job).toBeTruthy();
  });

  it("keeps playground Scouts out of the funder's own views", async () => {
    expect(await service.list(FUNDER, "testnet")).toEqual([]);
    expect(
      await membersOf(db, {
        ownerAddress: FUNDER,
        network: "testnet",
        isDefault: true,
        memberIds: [],
      } as never),
    ).toEqual([]);
  });

  it("answers within the question limit, without the operator's memory", async () => {
    const one = await ask(p(), token, "hello there");
    expect(one.answers[0]).toMatchObject({
      question: "hello there",
      answer: "answered: hello there",
    });
    expect(one.answers[0]?.verify).toMatch(/^\/verify\//);
    expect(one.questionsLeft).toBe(1);
    await ask(p(), token, "and again");
    await expect(ask(p(), token, "one more")).rejects.toMatchObject({
      code: "playground.no_questions",
    });
    expect(operatorCalls).toEqual([]);
    expect((await getSession(p(), token)).questionsLeft).toBe(0);
  });

  it("holds the per-IP limit, the pool, and the funder's balance", async () => {
    await createSession(p(), "203.0.113.7");
    await expect(createSession(p(), "203.0.113.7")).rejects.toMatchObject({
      code: "playground.ip_limit",
    });
    // Two live sessions now: the pool (2) is full.
    expect((await availability(p())).open).toBe(false);
    await expect(createSession(p(), "198.51.100.9")).rejects.toMatchObject({
      code: "playground.unavailable",
    });
    balances = { usdc: 10_000n, sui: 500_000_000n };
    const resting = await availability(
      p({
        limits: {
          questionsPerSession: 2,
          sessionsPerIpPerDay: 2,
          pool: 10,
          ttlMinutes: 60,
          discUsdc: "1.00",
        },
      }),
    );
    expect(resting).toMatchObject({ open: false, reason: expect.stringMatching(/resting/) });
    balances = { usdc: 900_000n, sui: 500_000_000n };
  });

  it("revokes the Disc and retires the Scout when the session ends", async () => {
    // This test's first session, not the oldest in a database the e2e also writes to.
    const first = await getSession(p(), token);
    const [row] = await db
      .select()
      .from(playgroundSessions)
      .where(eq(playgroundSessions.remoraId, first.remoraId));
    if (!row) throw new Error("no session");
    const revoke = await expire(p(), row.id);
    expect(revoke).toBe(signed.at(-1));
    const s = await getSession(p(), token);
    expect(s).toMatchObject({ status: "retired", revokeDigest: revoke });
    const [r] = await db.select().from(remoras).where(eq(remoras.id, s.remoraId));
    expect(r?.status).toBe("retired");
    expect(await expire(p(), row.id)).toBeNull(); // idempotent
    await expect(ask(p(), token, "still there?")).rejects.toMatchObject({
      code: "playground.ended",
    });
  });

  it("serves the session over HTTP with a cookie, and refuses when the playground is off", async () => {
    const routes = createPlaygroundRoutes(() =>
      p({
        limits: {
          questionsPerSession: 2,
          sessionsPerIpPerDay: 5,
          pool: 10,
          ttlMinutes: 60,
          discUsdc: "1.00",
        },
      }),
    );
    const res = await routes.request("/api/playground/session", {
      method: "POST",
      headers: { "x-forwarded-for": "192.0.2.44" },
    });
    expect(res.status).toBe(201);
    expect(res.headers.get("set-cookie")).toMatch(/remora_playground=.*HttpOnly/i);
    const { token: t } = (await res.json()) as { token: string };
    const got = await routes.request("/api/playground/session", {
      headers: { "x-remora-playground": t },
    });
    expect(((await got.json()) as { session: { status: string } }).session.status).toBe("live");
    const off = createPlaygroundRoutes(() => p({ funder: null }));
    const refused = await off.request("/api/playground/session", { method: "POST" });
    expect(refused.status).toBe(409);
    expect((await off.request("/api/playground")).status).toBe(200);
  });
});
