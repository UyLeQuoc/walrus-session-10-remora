/** ADR-0121's routes on Postgres: the signed webhook door, and the owner's hook settings. */
import { createHmac, randomBytes } from "node:crypto";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, eq, jobs, remoras, sql } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { MemoryKeyStore, RemoraSigner } from "@remora/signer";
import { Hono } from "hono";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetAddressLimits } from "../iplimit.ts";
import { createNetworks } from "../money/networks.ts";
import type { RuntimeDeps } from "./deps.ts";
import { HOOK_JOB, type HooksDeps } from "./hooks.ts";
import { verifyHookSignature } from "./hooks-out.ts";
import { createHookRoutes } from "./hooks-routes.ts";
import { SlidingLimiter } from "./limits.ts";
import { createRemoraService } from "./remoras.ts";

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("hook routes (ADR-0121)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x0c${process.pid.toString(16)}`);
  const OTHER = normalizeSuiAddress("0x0bad");
  const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
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
    () => ({}) as unknown as SuiGrpcClient,
  );
  const log = createLogger({}, () => {});
  const signer = new RemoraSigner(new MemoryKeyStore(), new Uint8Array(randomBytes(32)));
  const received: { headers: Headers; body: string }[] = [];
  const rt = {
    db,
    log,
    limiter: new SlidingLimiter(),
    webBase: "http://web.test",
  } as unknown as RuntimeDeps;
  const hooks: HooksDeps = {
    rt,
    secret: "s".repeat(48),
    base: "http://api.test",
    production: false,
    fetch: (async (_u: string | URL | Request, init?: RequestInit) => {
      received.push({ headers: new Headers(init?.headers), body: String(init?.body) });
      return new Response("ok");
    }) as typeof fetch,
  };
  const app = new Hono();
  app.route(
    "/",
    createHookRoutes({
      service: createRemoraService({ db, networks, signer, reef: () => [], log }),
      hooks,
      owner: async (c) => c.req.header("x-test-owner") ?? null,
    }),
  );
  const as = (owner: string | null, method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: {
        ...(owner ? { "x-test-owner": owner } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  let id = "";

  beforeAll(async () => {
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "scout",
        name: "Routes",
        status: "active",
        address: OWNER,
        config: { triggers: [{ kind: "message" }] },
      })
      .returning();
    if (!r) throw new Error("no remora");
    id = r.id;
  });
  beforeEach(resetAddressLimits);
  afterAll(async () => {
    await db.delete(jobs).where(sql`${jobs.payload}->>'remoraId' = ${id}`);
    await db
      .delete(jobs)
      .where(sql`${jobs.kind} = ${HOOK_JOB.pricePoll} and ${jobs.status} = 'queued'`);
    await db.delete(remoras).where(eq(remoras.id, id));
  });

  it("the owner's settings need the owner's session", async () => {
    expect((await as(null, "GET", `/api/remoras/${id}/hooks`)).status).toBe(401);
    expect((await as(OTHER, "GET", `/api/remoras/${id}/hooks`)).status).toBe(403);
    expect((await as(OWNER, "GET", "/api/remoras/not-a-uuid/hooks")).status).toBe(404);
    const view = await as(OWNER, "GET", `/api/remoras/${id}/hooks`);
    expect(view.status).toBe(200);
    expect(await view.json()).toMatchObject({ wakes: true, inbound: [], price: [], out: [] });
  });

  it("a signed POST is queued as a wake; unsigned, oversized or unknown ones are refused", async () => {
    const made = await as(OWNER, "POST", `/api/remoras/${id}/hooks/in`, { name: "github" });
    expect(made.status).toBe(201);
    expect(made.headers.get("cache-control")).toBe("no-store");
    const { hook } = (await made.json()) as { hook: { id: string; url: string; secret: string } };
    expect(hook.url).toBe(`http://api.test/api/hooks/${id}/${hook.id}`);
    const revealed = await as(OWNER, "GET", `/api/remoras/${id}/hooks/in/${hook.id}/secret`);
    expect(((await revealed.json()) as { hook: { secret: string } }).hook.secret).toBe(hook.secret);
    expect((await as(OTHER, "GET", `/api/remoras/${id}/hooks/in/${hook.id}/secret`)).status).toBe(
      403,
    );

    const path = `/api/hooks/${id}/${hook.id}`;
    const body = JSON.stringify({ action: "opened", issue: { title: "Docs typo" } });
    const signed = (b: string) => ({
      "x-hub-signature-256": `sha256=${createHmac("sha256", hook.secret).update(b).digest("hex")}`,
      "x-github-event": "issues",
      "content-type": "application/json",
    });
    const ok = await app.request(path, { method: "POST", headers: signed(body), body });
    expect(ok.status).toBe(202);
    const [job] = await db
      .select()
      .from(jobs)
      .where(sql`${jobs.kind} = ${HOOK_JOB.hookWake} and ${jobs.payload}->>'remoraId' = ${id}`);
    expect(job?.payload).toMatchObject({ hookId: hook.id, body, event: "issues" });

    const unsigned = await app.request(path, { method: "POST", body });
    expect(unsigned.status).toBe(401);
    expect(await unsigned.json()).toEqual({
      error: { code: "hook.bad_signature", message: "The signature doesn't match this webhook." },
    });
    const forged = await app.request(path, {
      method: "POST",
      headers: { "x-remora-signature": `sha256=${"0".repeat(64)}` },
      body,
    });
    expect(forged.status).toBe(401);
    const big = "x".repeat(64 * 1024 + 1);
    expect(
      (await app.request(path, { method: "POST", headers: signed(big), body: big })).status,
    ).toBe(413);
    expect((await app.request(`/api/hooks/${id}/!bad`, { method: "POST", body })).status).toBe(404);
  });

  it("a flood of bad signatures from one address is cut off", async () => {
    const path = `/api/hooks/${id}/abcdefgh12345678`;
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++)
      statuses.push(
        (
          await app.request(path, {
            method: "POST",
            headers: { "x-forwarded-for": "203.0.113.9" },
            body: "{}",
          })
        ).status,
      );
    expect(statuses.slice(0, 30).every((s) => s === 401)).toBe(true);
    expect(statuses[30]).toBe(429);
  });

  it("price triggers: added, refused when the threshold is wrong", async () => {
    const add = await as(OWNER, "POST", `/api/remoras/${id}/hooks/price`, {
      symbol: "BTC",
      above: 200_000,
    });
    expect(add.status).toBe(201);
    const bad = await as(OWNER, "POST", `/api/remoras/${id}/hooks/price`, {
      symbol: "BTC",
      below: -1,
    });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toEqual({
      error: { code: "price.bad_threshold", message: "A threshold is a price in USD above zero." },
    });
    const unknown = await as(OWNER, "POST", `/api/remoras/${id}/hooks/price`, {
      symbol: "DOGE",
      above: 1,
    });
    expect(unknown.status).toBe(400);
  });

  it("outbound: a URL with events, a signed Send test, and the delivery in the view", async () => {
    const refused = await as(OWNER, "POST", `/api/remoras/${id}/hooks/out`, {
      url: "http://10.0.0.1/x",
      events: ["payment.settled"],
    });
    expect(refused.status).toBe(400);
    const none = await as(OWNER, "POST", `/api/remoras/${id}/hooks/out`, {
      url: "http://localhost:9999/x",
      events: [],
    });
    expect(none.status).toBe(400);
    const add = await as(OWNER, "POST", `/api/remoras/${id}/hooks/out`, {
      url: "http://localhost:9999/x",
      events: ["payment.settled", "answer.ready"],
    });
    expect(add.status).toBe(201);
    const { hook } = (await add.json()) as { hook: { id: string } };

    const test = await as(OWNER, "POST", `/api/remoras/${id}/hooks/out/${hook.id}/test`);
    expect(await test.json()).toMatchObject({
      delivery: { status: "ok", code: 200, type: "test" },
    });
    const secret = (
      (await (await as(OWNER, "GET", `/api/remoras/${id}/hooks/out/secret`)).json()) as {
        secret: string;
      }
    ).secret;
    const got = received.at(-1);
    expect(verifyHookSignature(secret, got?.body ?? "", got?.headers.get("remora-signature"))).toBe(
      true,
    );

    const view = (await (await as(OWNER, "GET", `/api/remoras/${id}/hooks`)).json()) as {
      out: unknown[];
      deliveries: { type: string; status: string }[];
    };
    expect(view.out).toHaveLength(1);
    expect(view.deliveries[0]).toMatchObject({ type: "test", status: "ok" });
    expect(JSON.stringify(view)).not.toContain(secret);

    // Rotating the signing secret: the old one no longer verifies a new test.
    const rotated = (
      (await (await as(OWNER, "POST", `/api/remoras/${id}/hooks/out/rotate`)).json()) as {
        secret: string;
      }
    ).secret;
    expect(rotated).not.toBe(secret);
    await as(OWNER, "POST", `/api/remoras/${id}/hooks/out/${hook.id}/test`);
    const again = received.at(-1);
    const header = again?.headers.get("remora-signature");
    expect(verifyHookSignature(rotated, again?.body ?? "", header)).toBe(true);
    expect(verifyHookSignature(secret, again?.body ?? "", header)).toBe(false);

    expect((await as(OWNER, "DELETE", `/api/remoras/${id}/hooks/out/${hook.id}`)).status).toBe(200);
  });
});
