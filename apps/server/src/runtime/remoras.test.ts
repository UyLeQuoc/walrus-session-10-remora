import { randomBytes } from "node:crypto";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { Transaction } from "@mysten/sui/transactions";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, eq, remoraEvents, remoras } from "@remora/db";
import { AllowanceBcs, AllowanceCapBcs, DiscBcs } from "@remora/disc-sdk";
import { loadEnv } from "@remora/memory";
import { MemoryKeyStore, RemoraSigner } from "@remora/signer";
import { afterAll, describe, expect, it } from "vitest";
import { createNetworks } from "../money/networks.ts";
import type { ResolvedReef } from "../money/reef.ts";
import { createRemoraService, defaultBudget, issueArgs } from "./remoras.ts";

const PKG = normalizeSuiAddress("0xcc");
const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
const OWNER = normalizeSuiAddress("0x0f0f");
const STRANGER = normalizeSuiAddress("0xbad");
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

describe("budget → Disc", () => {
  it("maps a monthly budget to a rate limit, a 12-month cap and Reef payees", () => {
    const b = defaultBudget("scout", USDC);
    if (!b) throw new Error("scout has a budget");
    const a = issueArgs("remora-x", OWNER, b, reef, new Date("2026-10-19T00:00:00Z"));
    expect(a.rateLimit).toEqual({ months: 1, limit: 1_000_000n });
    expect(a.lifetimeCap).toBe(12_000_000n);
    expect(a.perPaymentCap).toBe(50_000n);
    expect(a.payees).toEqual([PAYTO]);
    expect(defaultBudget("sentinel", USDC)).toBeNull();
    expect(() => issueArgs("x", OWNER, { ...b, payees: ["reef:nope"] }, reef, new Date())).toThrow(
      /isn't in the Reef/,
    );
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("remora service (B1, B3, B8, N5)", () => {
  const db = createDb(local as string);
  const created: string[] = [];
  afterAll(async () => {
    for (const id of created) await db.delete(remoras).where(eq(remoras.id, id));
  });

  let discName = "";
  /** The Disc was revoked outside Remora: reading it says "not found". */
  let discGone = false;
  const DISC = normalizeSuiAddress("0xd1");
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
              { objectId: normalizeSuiAddress("0xf1e1d"), idOperation: "Created" },
            ],
          },
          objectTypes: {
            [DISC]: `${PKG}::disc::Disc`,
            [normalizeSuiAddress("0xa11")]:
              `0x2::allowance::Allowance<0x2::balance::Balance<${USDC}>>`,
            [normalizeSuiAddress("0xca")]:
              `0x2::allowance::AllowanceCap<0x2::balance::Balance<${USDC}>>`,
            [normalizeSuiAddress("0xf1e1d")]:
              `0x2::dynamic_field::Field<${PKG}::disc::DiscKey,0x2::object::ID>`,
          },
          transaction: { sender: OWNER },
        },
      }),
      getObject: async ({ objectId }: { objectId: string }) => {
        if (discGone && objectId === DISC) throw new Error(`Object ${DISC} not found`);
        return {
          object: {
            objectId,
            type: "",
            // Confirm matches each created object by the Disc name (team imports issue several).
            content:
              objectId === normalizeSuiAddress("0xa11")
                ? AllowanceBcs.serialize({
                    id: objectId,
                    settings: {
                      funder: OWNER,
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
                : objectId === normalizeSuiAddress("0xca")
                  ? AllowanceCapBcs.serialize({
                      id: objectId,
                      allowance: normalizeSuiAddress("0xa11"),
                    }).toBytes()
                  : DiscBcs.serialize({
                      id: DISC,
                      owner: OWNER,
                      name: discName,
                      payees: { contents: [PAYTO] },
                      per_payment_cap: 50_000n,
                      paused: false,
                      version: 1n,
                    }).toBytes(),
          },
        };
      },
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

  it("creates Scout with a one-PTB issue transaction for the owner to sign", async () => {
    const { remora, transaction } = await service.create({
      owner: OWNER,
      network: "testnet",
      template: "scout",
    });
    created.push(remora.id);
    discName = remora.discName ?? "";
    expect(remora.status).toBe("creating");
    const tx = JSON.parse(transaction ?? "{}");
    expect(tx.sender).toBe(OWNER);
    const calls = tx.commands
      .filter((c: { MoveCall?: { module: string; function: string } }) => c.MoveCall)
      .map(
        (c: { MoveCall: { module: string; function: string } }) =>
          `${c.MoveCall.module}::${c.MoveCall.function}`,
      );
    expect(calls).toEqual([
      "allowance::calendar_rate_limit",
      "option::some",
      "allowance::propose_for_app",
      "disc::issue",
    ]);

    // Confirm from the chain: the Disc (not the DiscKey field) is recorded and shadow mode starts.
    const confirmed = await service.confirmIssue(remora.id, OWNER, "Dg1");
    expect(confirmed).toMatchObject({
      status: "shadow",
      discId: DISC,
      allowanceId: normalizeSuiAddress("0xa11"),
    });
    expect(confirmed.shadowUntil).toBeInstanceOf(Date);
    await expect(service.confirmIssue(remora.id, OWNER, "Dg1")).rejects.toMatchObject({
      code: "remora.already_confirmed",
    });

    const live = await service.activate(remora.id, OWNER);
    expect(live.status).toBe("active");
    const feed = await db.select().from(remoraEvents).where(eq(remoraEvents.remoraId, remora.id));
    expect(feed.map((e) => e.summary)).toEqual(
      expect.arrayContaining([expect.stringMatching(/is live/)]),
    );
  });

  it("retires a remora whose Disc was already revoked elsewhere, with nothing to sign (B8)", async () => {
    const [scout] = (await service.list(OWNER, "testnet")).filter((r) => r.discId === DISC);
    if (!scout) throw new Error("no confirmed Scout");
    discGone = true;
    try {
      expect(await service.retireTx(scout.id, OWNER)).toBeNull();
      const retired = await service.confirmRetire(scout.id, OWNER);
      expect(retired).toMatchObject({ status: "retired", discId: null });
    } finally {
      discGone = false;
    }
  });

  it("creates read-only Sentinel without a Disc, watching the owner by default", async () => {
    const { remora, transaction } = await service.create({
      owner: OWNER,
      network: "testnet",
      template: "sentinel",
    });
    created.push(remora.id);
    expect(transaction).toBeNull();
    expect(remora.status).toBe("shadow");
    const cfg = service.config(remora);
    expect(cfg.triggers[0]).toMatchObject({ kind: "chain", addresses: [OWNER] });
    expect(cfg.budget).toBeNull();
  });

  it("refuses strangers, unknown templates and unavailable networks", async () => {
    const [mine] = await service.list(OWNER, "testnet");
    if (!mine) throw new Error("no remora");
    await expect(service.activate(mine.id, STRANGER)).rejects.toMatchObject({
      code: "remora.not_owner",
      status: 403,
    });
    await expect(
      service.create({ owner: OWNER, network: "testnet", template: "errand" }),
    ).rejects.toMatchObject({
      code: "template.unknown",
    });
    await expect(
      service.create({ owner: OWNER, network: "mainnet", template: "scout" }),
    ).rejects.toMatchObject({
      code: "network.unavailable",
    });
  });

  it("issues a whole team's Discs in ONE owner transaction (ADR-0042)", async () => {
    const team = await service.createTeam(OWNER, "testnet", [
      { template: "scout", name: "Scout A" },
      { template: "scout", name: "Scout B" },
      { template: "sentinel", name: "Watcher" },
    ]);
    for (const r of team.remoras) created.push(r.id);
    expect(team.remoras.map((r) => r.status)).toEqual(["creating", "creating", "shadow"]);
    const tx = Transaction.from(team.transaction ?? "").getData();
    const calls = tx.commands.map(
      (c) => c.MoveCall && `${c.MoveCall.module}::${c.MoveCall.function}`,
    );
    expect(calls.filter((c) => c === "disc::issue")).toHaveLength(2);
    expect(calls.filter((c) => c === "allowance::propose_for_app")).toHaveLength(2);
    expect(tx.sender).toBe(OWNER);
  });
});
