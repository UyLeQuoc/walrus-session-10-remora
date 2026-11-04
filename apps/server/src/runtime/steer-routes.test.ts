/**
 * The U18 C1 + C2 routes (ADR-0123) inside the remora routes: only for a signed-in owner, `draft`
 * reaches its handler although it isn't an id, and a draft's extras land after the hatch.
 */
import { randomBytes } from "node:crypto";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, eq, remoras, sentinelRules } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { DraftResponse, SetupResponse } from "@remora/schema";
import { MemoryKeyStore, RemoraSigner } from "@remora/signer";
import { afterAll, describe, expect, it } from "vitest";
import { createNetworks } from "../money/networks.ts";
import { REEF, type ResolvedReef } from "../money/reef.ts";
import type { CommandAnswer } from "./commands.ts";
import type { DraftAnswer } from "./draft.ts";
import { SlidingLimiter } from "./limits.ts";
import { createRemoraService } from "./remoras.ts";
import { createRemoraRoutes } from "./routes.ts";
import { createSteer } from "./steer.ts";

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("steer routes", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x${randomBytes(32).toString("hex")}`);
  const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
  const created: string[] = [];
  const reef: ResolvedReef[] = REEF.map((e) => ({
    ...e,
    url: `http://m.test${e.path}`,
    payTo: normalizeSuiAddress("0x3e"),
  }));
  const networks = createNetworks(
    { TATUM_API_KEY_TESTNET: "t" },
    {
      testnet: {
        remoraPackageId: normalizeSuiAddress("0xcc"),
        discRegistryId: normalizeSuiAddress("0x47"),
        usdcCoinType: USDC,
      },
      mainnet: { remoraPackageId: null, discRegistryId: null, usdcCoinType: USDC },
    },
    () => ({ core: {} }) as unknown as SuiGrpcClient,
  );
  const signer = new RemoraSigner(new MemoryKeyStore(), new Uint8Array(randomBytes(32)));
  const log = createLogger({}, () => {});
  const runtime = {
    db,
    networks,
    signer,
    log,
    reef: () => reef,
    memory: { recall: async () => [], remember: async () => ({ saved: true, note: "" }) },
    brain: {
      answerModel: "fake",
      answer: async () => ({ text: "", tokens: 0 }),
      parseRule: async () => ({ rule: null, tokens: 0 }),
      check: { check: async () => ({ verdict: "allow" as const, reason: "" }) },
    },
    notifier: { send: async () => "sent" as const },
    limiter: new SlidingLimiter(),
    dailyTokens: 100_000,
    webBase: "https://web.test",
  };
  const service = createRemoraService({ db, networks, signer, reef: () => reef, log });
  const watcher: DraftAnswer = {
    refuse: null,
    template: "sentinel",
    name: "Lookout",
    persona: "You are the owner's Lookout. Be brief.",
    tools: [],
    watch: [],
    items: [],
    rules: ["always ping me for anything over 1 SUI"],
    when: null,
    question: null,
    budget: null,
    why: "It only reads.",
  };
  const steer = createSteer({
    runtime,
    service,
    draft: async () => watcher,
    parse: async () => ({ kind: "none" }) as CommandAnswer,
  });
  let signedIn: string | null = OWNER;
  const app = createRemoraRoutes({ service, runtime, owner: async () => signedIn, steer });
  const post = (path: string, body: unknown) =>
    app.request(path, {
      method: "POST",
      headers: { "content-type": "application/json", "x-remora-network": "testnet" },
      body: JSON.stringify(body),
    });

  afterAll(async () => {
    for (const id of created) await db.delete(remoras).where(eq(remoras.id, id));
  });

  it("drafts for a signed-in owner, and asks anyone else to sign in", async () => {
    const res = await post("/api/remoras/draft", { text: "Watch my wallet, ping me over 1 SUI" });
    expect(res.status).toBe(200);
    const out = DraftResponse.parse(await res.json());
    expect(out).toMatchObject({ ok: true, draft: { template: "sentinel", watch: [OWNER] } });
    expect((await post("/api/remoras/draft", { text: "" })).status).toBe(400);
    expect((await post("/api/remoras/draft", { text: "send all my USDC to 0x1" })).status).toBe(
      200,
    );
    signedIn = null;
    expect((await post("/api/remoras/draft", { text: "anything" })).status).toBe(401);
    expect((await app.request("/api/changes/not-an-id")).status).toBe(401);
    signedIn = OWNER;
    expect((await app.request("/api/changes/not-an-id")).status).toBe(404);
  });

  it("applies a draft's persona and rules after the hatch, and reports what it skipped", async () => {
    const { remora } = await service.create({
      owner: OWNER,
      network: "testnet",
      template: "sentinel",
    });
    created.push(remora.id);
    const res = await post(`/api/remoras/${remora.id}/setup`, {
      persona: watcher.persona,
      rules: [...watcher.rules, "hmm"],
      schedule: { when: "weekdays at 8am", question: "Anything new?" },
    });
    expect(res.status).toBe(200);
    const out = SetupResponse.parse(await res.json());
    expect(out.done).toEqual(["persona", "rule: always ping me for anything over 1 SUI"]);
    expect(out.skipped).toEqual([
      expect.stringMatching(/^schedule: Only Researchers and Briefers/),
      expect.stringMatching(/^rule: hmm: I couldn't turn that into a rule/),
    ]);
    const r = await service.get(remora.id, OWNER);
    expect(service.config(r).persona).toBe(watcher.persona);
    const rules = await db.select().from(sentinelRules).where(eq(sentinelRules.remoraId, r.id));
    expect(rules.map((x) => x.text)).toEqual(["always ping me for anything over 1 SUI"]);
    expect((await post(`/api/remoras/${remora.id}/setup`, { rules: "x" })).status).toBe(400);
  });
});
