/** ADR-0143's owner routes on Postgres: add, tick, remove, and the token never comes back. */
import { randomBytes, randomUUID } from "node:crypto";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, eq, remoraEvents, remoras } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { MemoryKeyStore, RemoraSigner } from "@remora/signer";
import { Hono } from "hono";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createNetworks } from "../money/networks.ts";
import type { RuntimeDeps } from "../runtime/deps.ts";
import { SlidingLimiter } from "../runtime/limits.ts";
import { createRemoraService } from "../runtime/remoras.ts";
import { createRemoraRoutes } from "../runtime/routes.ts";
import { createTestMcpServer, publicDns, TEST_URL } from "./test-server.test-util.ts";

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("MCP server routes (ADR-0143)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x0d${process.pid.toString(16)}`);
  const OTHER = normalizeSuiAddress("0x0bad");
  const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
  const TOKEN = "sk-mcp-route-secret-123";
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
  const mcp = createTestMcpServer({ token: TOKEN, session: true });
  const rt = {
    db,
    log,
    networks,
    signer,
    limiter: new SlidingLimiter(),
    webBase: "http://web.test",
    mcp: { fetch: mcp.fetch, resolve: publicDns, timeoutMs: 2_000 },
  } as unknown as RuntimeDeps;
  const app = new Hono();
  app.route(
    "/",
    createRemoraRoutes({
      service: createRemoraService({ db, networks, signer, reef: () => [], log }),
      runtime: rt,
      owner: async (c) => c.req.header("x-test-owner") ?? null,
    }),
  );
  const as = async (owner: string | null, method: string, path: string, body?: unknown) => {
    const res = await app.request(path, {
      method,
      headers: {
        "x-remora-network": "testnet",
        ...(owner ? { "x-test-owner": owner } : {}),
        ...(body === undefined ? {} : { "content-type": "application/json" }),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const text = await res.text();
    return { status: res.status, text, json: JSON.parse(text || "null") as unknown };
  };
  const id = randomUUID();

  beforeAll(async () => {
    await db.insert(remoras).values({
      id,
      ownerAddress: OWNER,
      network: "testnet",
      template: "scout",
      name: "Mcp routes",
      status: "active",
      address: OWNER,
      config: {
        version: 1,
        id,
        name: "Mcp routes",
        template: "scout",
        persona: "You are the owner's Researcher.",
        tools: ["pay"],
        triggers: [{ kind: "message" }],
        budget: null,
        status: "active",
        identity: { address: OWNER },
        namespaces: ["me"],
      },
    });
  });
  afterAll(async () => {
    await db.delete(remoraEvents).where(eq(remoraEvents.remoraId, id));
    await db.delete(remoras).where(eq(remoras.id, id));
  });

  it("only the owner reads or changes its servers", async () => {
    expect((await as(null, "GET", `/api/remoras/${id}/mcp`)).status).toBe(401);
    expect((await as(OTHER, "GET", `/api/remoras/${id}/mcp`)).status).toBe(403);
    expect((await as(OTHER, "POST", `/api/remoras/${id}/mcp`, { url: TEST_URL })).status).toBe(403);
    const empty = await as(OWNER, "GET", `/api/remoras/${id}/mcp`);
    expect(empty.json).toEqual({ servers: [] });
  });

  it("adds a server, ticks only read-only tools, and never returns the token", async () => {
    const added = await as(OWNER, "POST", `/api/remoras/${id}/mcp`, {
      url: TEST_URL,
      name: "Glossary",
      token: TOKEN,
    });
    expect(added.status).toBe(201);
    const server = (added.json as { server: Record<string, unknown> }).server;
    expect(server).toMatchObject({
      url: TEST_URL,
      name: "glossary",
      host: "mcp.test",
      tools: [],
      hidden: 3,
      hasToken: true,
    });
    const sid = String(server.id);

    const write = await as(OWNER, "PUT", `/api/remoras/${id}/mcp/${sid}/tools`, {
      tools: ["lookup", "write_note"],
    });
    expect(write.status).toBe(400);
    expect(write.text).toContain("mcp.not_read_only");
    const ok = await as(OWNER, "PUT", `/api/remoras/${id}/mcp/${sid}/tools`, {
      tools: ["lookup", "fetch_page"],
    });
    expect(ok.status).toBe(200);
    expect(ok.text).toContain('"tools":["lookup","fetch_page"]');

    const list = await as(OWNER, "GET", `/api/remoras/${id}/mcp`);
    const remora = await as(OWNER, "GET", `/api/remoras/${id}`);
    expect(remora.status).toBe(200);
    expect((remora.json as { remora: { config: { mcp: unknown } } }).remora.config.mcp).toEqual([
      { id: sid, url: TEST_URL, name: "glossary", tools: ["lookup", "fetch_page"] },
    ]);
    for (const r of [added, ok, list, remora]) {
      expect(r.text).not.toContain(TOKEN);
      expect(r.text).not.toContain("tokenEnc");
    }
    const [row] = await db.select().from(remoras).where(eq(remoras.id, id));
    const stored = JSON.stringify((row?.config as { mcp?: unknown } | undefined)?.mcp);
    expect(stored).toContain("tokenEnc");
    expect(stored).not.toContain(TOKEN);

    expect((await as(OWNER, "DELETE", `/api/remoras/${id}/mcp/${sid}`)).status).toBe(200);
    expect((await as(OWNER, "GET", `/api/remoras/${id}/mcp`)).json).toEqual({ servers: [] });
    expect((await as(OWNER, "DELETE", `/api/remoras/${id}/mcp/${sid}`)).status).toBe(404);
  });

  it("refuses a server it can't reach safely, and bad input", async () => {
    const http = await as(OWNER, "POST", `/api/remoras/${id}/mcp`, {
      url: "http://mcp.test/mcp",
    });
    expect(http.status).toBe(400);
    expect(http.json).toMatchObject({ error: { code: "mcp.unreachable" } });
    const noToken = await as(OWNER, "POST", `/api/remoras/${id}/mcp`, { url: TEST_URL });
    expect(noToken.json).toMatchObject({
      error: { code: "mcp.unreachable", message: "Couldn't connect: The server asks for a token." },
    });
    expect((await as(OWNER, "POST", `/api/remoras/${id}/mcp`, { url: 5 })).status).toBe(400);
    expect((await as(OWNER, "DELETE", `/api/remoras/${id}/mcp/nope`)).status).toBe(404);
  });
});
