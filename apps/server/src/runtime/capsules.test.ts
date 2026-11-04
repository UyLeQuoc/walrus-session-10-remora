import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, eq, remoraEvents, remoras } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { afterAll, describe, expect, it } from "vitest";
import { acceptCapsule, capsuleData, capsulesOf, capsuleView } from "./capsules.ts";
import type { RuntimeDeps } from "./deps.ts";

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("memory capsules (A4)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x0ca${process.pid.toString(16)}`);
  const deps = { db, log: createLogger({}, () => {}) } as unknown as RuntimeDeps;
  afterAll(async () => {
    await db.delete(remoras).where(eq(remoras.ownerAddress, OWNER));
  });

  it("reads nothing before the owner accepts, then reads it; an expired capsule is skipped and said", async () => {
    const [g] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "scout",
        name: "Grantee",
        config: {},
        status: "active",
        address: normalizeSuiAddress("0x9a"),
      })
      .returning();
    if (!g) throw new Error("no remora");
    const offer = {
      kind: "capsule_offered",
      capsuleId: "0xcap1",
      keyId: "00".repeat(32),
      blobId: "blob-1",
      count: 3,
      expiresMs: Date.now() - 1_000,
      from: { remora: "Lender", owner: "0x1" },
    };
    await db.insert(remoraEvents).values({
      remoraId: g.id,
      network: "testnet",
      type: "action",
      summary: "Offered",
      payload: offer,
    });
    expect((await capsuleView(deps, g)).offered).toHaveLength(1);
    expect(await capsuleData(deps, g, g.id)).toEqual({ data: [], reads: [] });
    const after = await acceptCapsule(deps, g, "0xcap1");
    expect(capsulesOf(after)).toEqual([
      expect.objectContaining({ id: "0xcap1", count: 3, from: { remora: "Lender", owner: "0x1" } }),
    ]);
    const view = await capsuleView(deps, after);
    expect(view.offered).toHaveLength(0);
    expect(view.reading).toHaveLength(1);
    // It expired: the turn reads nothing, and says why.
    expect(await capsuleData(deps, after, after.id)).toEqual({
      data: [],
      reads: [{ id: "0xcap1", from: "@Lender", ok: false, reason: "expired" }],
    });
    await expect(acceptCapsule(deps, after, "0xnope")).rejects.toMatchObject({
      code: "capsule.not_offered",
    });
  });
});
