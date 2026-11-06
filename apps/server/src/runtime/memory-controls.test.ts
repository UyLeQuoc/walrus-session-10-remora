import { normalizeSuiAddress } from "@mysten/sui/utils";
import { and, createDb, eq, remoraMemories, remoras } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { afterAll, describe, expect, it } from "vitest";
import { forgetNamespace, memoryIndexFor } from "./memory-controls.ts";

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;
const OPERATOR = { key: "00", accountId: "0x1", serverUrl: "http://relayer.test" };

describe.skipIf(!local)("forget all in Postgres (F4, ADR-0153)", () => {
  const db = createDb(local as string);
  const OWNER = normalizeSuiAddress(`0x0f4${process.pid.toString(16)}`);
  afterAll(async () => {
    await db.delete(remoras).where(eq(remoras.ownerAddress, OWNER));
  });

  it("waits for the namespace's running writes before the relayer forgets, and hides one that lands late", async () => {
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "researcher",
        name: "Researcher",
        config: {},
        status: "active",
        address: OWNER,
      })
      .returning();
    if (!r) throw new Error("no remora");
    await db.insert(remoraMemories).values([
      { remoraId: r.id, namespace: "sources", blobId: "blob-stored", status: "stored" },
      { remoraId: r.id, namespace: "sources", jobId: "job-running", status: "pending" },
      { remoraId: r.id, namespace: "feedback", jobId: "job-other", status: "pending" },
    ]);
    const calls: string[] = [];
    const relayer = {
      async waitForJobs(ns: string, jobIds: readonly string[]) {
        calls.push(`wait ${ns} ${jobIds.join(",")}`);
        return 1;
      },
      async forget(ns: string) {
        calls.push(`forget ${ns}`);
        return { deleted: 1, namespace: ns, owner: OWNER };
      },
    };
    const ref = { id: r.id, name: r.name, ownerAddress: OWNER };
    const out = await forgetNamespace(
      db,
      OPERATOR,
      ref,
      ["me", "sources", "feedback"],
      "sources",
      relayer,
    );
    expect(calls).toEqual([
      `wait remora:${r.id}:sources job-running`,
      `forget remora:${r.id}:sources`,
    ]);
    expect(out).toMatchObject({ namespace: "sources", deleted: 1, pending: 1 });
    expect(out.note).toMatch(/dropped 1 from its index; 1 still being written are hidden/);
    // The late write lands after the forget: our own filter still skips it on recall.
    await memoryIndexFor(db).onWrite(ref, "sources", {
      outcome: "stored",
      jobId: "job-running",
      blobId: "blob-late",
    } as never);
    const skipped = await memoryIndexFor(db).skipped(ref);
    expect(skipped).toEqual(expect.arrayContaining(["blob-stored", "blob-late"]));
    const [other] = await db
      .select()
      .from(remoraMemories)
      .where(and(eq(remoraMemories.remoraId, r.id), eq(remoraMemories.namespace, "feedback")));
    expect(other?.hiddenAt).toBeNull();
  });
});
