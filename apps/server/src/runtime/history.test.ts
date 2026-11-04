import { randomBytes } from "node:crypto";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger, type SuiNetwork } from "@remora/chain";
import { and, createDb, eq, inArray, remoraEvents, remoras } from "@remora/db";
import { DiscBcs } from "@remora/disc-sdk";
import { loadEnv } from "@remora/memory";
import { ConfigHistory, ConfigRestore, ConfigVersionDiff } from "@remora/schema";
import { MemoryKeyStore, RemoraSigner } from "@remora/signer";
import { Hono } from "hono";
import { afterAll, describe, expect, it } from "vitest";
import type { Listings } from "../money/listings.ts";
import { createNetworks } from "../money/networks.ts";
import { REEF, type ResolvedReef } from "../money/reef.ts";
import type { RuntimeDeps } from "./deps.ts";
import { type ConfigEvent, restoredTriggers, versionsOf } from "./history.ts";
import { mountLedger, type OwnerApp } from "./ledger-routes.ts";
import { createRemoraService, RemoraError } from "./remoras.ts";
import { setSale } from "./sales.ts";

const at = (m: number) => new Date(Date.UTC(2026, 10, 5, 10, m));
const change = (id: string, m: number, payload: Record<string, unknown>): ConfigEvent => ({
  id,
  at: at(m),
  summary: id,
  payload,
});

describe("config versions (N11)", () => {
  it("starts from the config before the first change, and the newest is current", () => {
    const v1 = { name: "A", persona: "p" };
    const v2 = { name: "B", persona: "p", revision: 2 };
    const v3 = { name: "B", persona: "q", revision: 3 };
    const out = versionsOf(
      [
        change("e1", 1, { previous: v1, after: v2, revision: 2 }),
        change("e2", 2, { previous: v2, after: v3, revision: 3 }),
      ],
      { config: v3, createdAt: at(0) },
    );
    expect(out.map((v) => [v.id, v.revision, v.fields, v.current])).toEqual([
      ["initial", 1, [], false],
      ["e1", 2, ["name"], false],
      ["e2", 3, ["persona"], true],
    ]);
  });

  it("reads an older edit event that kept only `previous`", () => {
    const v1 = { name: "A" };
    const v2 = { name: "B", revision: 2 };
    const v3 = { name: "C", revision: 3 };
    const out = versionsOf(
      [
        change("e1", 1, { previous: v1, revision: 2 }),
        change("e2", 2, { previous: v2, revision: 3 }),
      ],
      { config: v3, createdAt: at(0) },
    );
    expect(out.map((v) => [v.id, v.config.name])).toEqual([
      ["initial", "A"],
      ["e1", "B"],
      ["e2", "C"],
    ]);
    expect(versionsOf([], { config: v1, createdAt: at(0) })).toEqual([
      expect.objectContaining({ id: "initial", current: true, config: v1 }),
    ]);
  });

  it("never brings back a webhook rotated or removed since (its secret is derived from its id)", () => {
    const old = [
      { kind: "message" },
      { kind: "webhook", id: "hook-1" },
      { kind: "webhook", id: "h2" },
    ];
    expect(restoredTriggers(old, [{ kind: "webhook", id: "h2" }])).toEqual([
      { kind: "message" },
      { kind: "webhook", id: "h2" },
    ]);
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("config history round trip (N11)", () => {
  const db = createDb(local as string);
  const PKG = normalizeSuiAddress("0xcc");
  const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
  const OWNER = normalizeSuiAddress(`0x4c${randomBytes(8).toString("hex")}`);
  const PAYTO = normalizeSuiAddress("0x3e");
  const DISC = normalizeSuiAddress("0xd15c");
  const reef: ResolvedReef[] = REEF.map((e) => ({
    ...e,
    url: `http://m.test${e.path}`,
    payTo: PAYTO,
  }));
  const created: string[] = [];
  afterAll(async () => {
    if (created.length) await db.delete(remoras).where(inArray(remoras.id, created));
  });

  // The owner's budget and payee transactions, read back from a fake chain.
  const fake = {
    core: {
      getTransaction: async () => ({
        Transaction: {
          effects: {
            status: { success: true, error: null },
            changedObjects: [
              { objectId: DISC, idOperation: "Created" },
              { objectId: normalizeSuiAddress("0xa11"), idOperation: "Created" },
              { objectId: normalizeSuiAddress("0xca"), idOperation: "Created" },
            ],
          },
          objectTypes: {
            [DISC]: `${PKG}::disc::Disc`,
            [normalizeSuiAddress("0xa11")]: `0x2::allowance::Allowance<${USDC}>`,
            [normalizeSuiAddress("0xca")]: `0x2::allowance::AllowanceCap<${USDC}>`,
          },
          transaction: { sender: OWNER },
        },
      }),
      getObject: async ({ objectId }: { objectId: string }) => ({
        object: {
          objectId,
          type: "",
          content: DiscBcs.serialize({
            id: DISC,
            owner: OWNER,
            name: "x",
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
    txReadAttempts: 1,
  });
  let refreshed = 0;
  const listings = {
    refresh: async () => {
      refreshed++;
    },
  } as unknown as Listings;
  const runtime = { db } as unknown as RuntimeDeps;
  const app: OwnerApp = new Hono();
  app.use("*", async (c, next) => {
    c.set("owner", OWNER);
    c.set("network", "testnet" as SuiNetwork);
    await next();
  });
  app.onError((err, c) =>
    err instanceof RemoraError
      ? c.json({ error: err.code }, err.status)
      : c.json({ error: String(err) }, 500),
  );
  mountLedger(app, { service, runtime, listings });
  const get = async (path: string) => (await app.request(path)).json();
  const restore = (id: string, version: string) =>
    app.request(`/api/remoras/${id}/history/${version}/restore`, { method: "POST" });

  it("records each change with the config before and after, diffs a version and restores it", async () => {
    const { remora } = await service.create({
      owner: OWNER,
      network: "testnet",
      template: "scout",
    });
    created.push(remora.id);
    await db
      .update(remoras)
      .set({
        status: "active",
        discId: DISC,
        allowanceId: normalizeSuiAddress("0xa11"),
        capId: normalizeSuiAddress("0xca"),
      })
      .where(eq(remoras.id, remora.id));
    const first = await service.get(remora.id, OWNER);
    const budget = service.config(first).budget;
    if (!budget) throw new Error("a scout has a budget");

    await service.edit(remora.id, OWNER, { name: "Scout B", persona: "Answers in one line." });
    await service.confirmBudget(remora.id, OWNER, "DgBudget", {
      ...budget,
      windowLimit: "2000000",
    });
    await setSale(runtime, listings, await service.get(remora.id, OWNER), {
      on: true,
      slug: `h-${randomBytes(4).toString("hex")}`,
      price: "20000",
    });

    const [edited] = await db
      .select()
      .from(remoraEvents)
      .where(and(eq(remoraEvents.remoraId, remora.id), eq(remoraEvents.type, "config_changed")))
      .orderBy(remoraEvents.createdAt)
      .limit(1);
    expect(edited?.summary).toBe("Scout B's settings changed (revision 2).");
    expect(edited?.payload).toMatchObject({
      previous: { name: first.name },
      after: { name: "Scout B", revision: 2 },
      revision: 2,
      fields: ["name", "persona"],
    });

    const history = ConfigHistory.parse(await get(`/api/remoras/${remora.id}/history`));
    expect(history.versions.map((v) => [v.revision, v.fields, v.current])).toEqual([
      [4, ["sell"], true],
      [3, ["budget"], false],
      [2, ["name", "persona"], false],
      [1, [], false],
    ]);
    expect(history.versions[1]?.summary).toBe("Scout B's budget changed.");

    const diff = ConfigVersionDiff.parse(await get(`/api/remoras/${remora.id}/history/initial`));
    expect(diff.changes.map((c) => [c.field, c.restore])).toEqual([
      ["name", "direct"],
      ["persona", "direct"],
      ["sell", "direct"],
      ["budget", "signature"],
    ]);
    expect(diff.changes[0]).toMatchObject({ current: "Scout B", version: first.name });

    // The settings come back at once; the limit comes back as a transaction for the owner.
    const res = await restore(remora.id, "initial");
    expect(res.status).toBe(200);
    const out = ConfigRestore.parse(await res.json());
    expect(out.applied.sort()).toEqual(["name", "persona", "sell"]);
    expect(out.remora.name).toBe(first.name);
    expect(out.remora.config.persona).toBe(service.config(first).persona);
    expect(refreshed).toBe(2);
    expect(out.sign?.kind).toBe("budget");
    if (out.sign?.kind !== "budget") throw new Error("no budget transaction");
    expect(out.sign.budget.windowLimit).toBe("1000000");
    const calls = (
      JSON.parse(out.sign.transaction).commands as { MoveCall?: { function: string } }[]
    ).flatMap((c) => (c.MoveCall ? [c.MoveCall.function] : []));
    expect(calls).toEqual(expect.arrayContaining(["revoke", "issue"]));
    // Nothing moved yet: the limit is still the new one until the owner signs.
    expect(service.config(await service.get(remora.id, OWNER)).budget?.windowLimit).toBe("2000000");

    // The owner signs; the usual confirm applies it, and nothing is left to restore.
    await service.confirmBudget(remora.id, OWNER, "DgRestore", out.sign.budget);
    const after = ConfigVersionDiff.parse(await get(`/api/remoras/${remora.id}/history/initial`));
    expect(after.changes).toEqual([]);

    // Payees alone come back through `disc::set_payees`.
    const before = ConfigHistory.parse(await get(`/api/remoras/${remora.id}/history`)).versions[0];
    await service.confirmPayees(remora.id, OWNER, "DgPayees", ["reef:weather"]);
    const back = ConfigRestore.parse(await (await restore(remora.id, before?.id ?? "")).json());
    expect(back.applied).toEqual([]);
    expect(back.sign).toMatchObject({ kind: "payees", payees: budget.payees });
  });

  it("refuses an unknown version and a retired remora", async () => {
    const id = created[0] ?? "";
    expect((await restore(id, "00000000-0000-4000-8000-000000000000")).status).toBe(404);
    expect((await restore(id, "not-a-version")).status).toBe(404);
    await db.update(remoras).set({ status: "retired" }).where(eq(remoras.id, id));
    expect((await restore(id, "initial")).status).toBe(409);
  });
});
