import { randomBytes } from "node:crypto";
import { verifyTransactionSignature } from "@mysten/sui/verify";
import { createDb, eq, remoraKeys } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { RemoraSigner } from "@remora/signer";
import { afterAll, describe, expect, it } from "vitest";
import { PgKeyStore } from "./keys.ts";

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("PgKeyStore (B4)", () => {
  const db = createDb(local as string);
  const id = `test-remora-${process.pid}`;
  afterAll(async () => {
    await db.delete(remoraKeys).where(eq(remoraKeys.remoraId, id));
  });

  it("persists only the sealed key and signs after a reload", async () => {
    const kek = new Uint8Array(randomBytes(32));
    const address = await new RemoraSigner(new PgKeyStore(db), kek).create(id, "testnet");
    const [row] = await db.select().from(remoraKeys).where(eq(remoraKeys.remoraId, id));
    expect(row?.address).toBe(address);
    expect(JSON.stringify(row?.sealed)).not.toMatch(/suiprivkey/);
    // A fresh signer (as after a restart) reads it back from Postgres.
    const sig = await new RemoraSigner(new PgKeyStore(db), kek).signTransaction(
      id,
      new Uint8Array([9]),
    );
    expect((await verifyTransactionSignature(new Uint8Array([9]), sig)).toSuiAddress()).toBe(
      address,
    );
  });
});
