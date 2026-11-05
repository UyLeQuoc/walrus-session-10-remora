/**
 * U19 B1 (ADR-0145): the auditor's Wake bundle and its routes. The bundle leaves question text out
 * unless the owner ticks it, is canonical (the same rows give the same bytes), holds only this
 * remora's receipts in range, and carries a Merkle proof for each anchored Wake. The owner routes
 * answer only the remora's owner; the public route gives only what the page needs to decrypt.
 */
import { randomBytes, randomUUID } from "node:crypto";
import type { SuiGrpcClient } from "@mysten/sui/grpc";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { createLogger } from "@remora/chain";
import { createDb, inArray, receipts, remoraEvents, remoras } from "@remora/db";
import { loadEnv } from "@remora/memory";
import {
  AuditAccess,
  AuditBundle,
  canonicalJson,
  DEPLOYMENTS,
  intentHash,
  merkleRoot,
  verifyMerkleProof,
  type Wake,
  type WakesAnchored,
  wakeLeaf,
} from "@remora/schema";
import { MemoryKeyStore, RemoraSigner } from "@remora/signer";
import { afterAll, describe, expect, it } from "vitest";
import { createNetworks } from "../money/networks.ts";
import {
  AUDIT_SHARED,
  type AuditEventRow,
  type AuditReceiptRow,
  auditorOf,
  auditRange,
  buildAuditBundle,
  bundleBytes,
  loadAuditBundle,
} from "./audit.ts";
import { SlidingLimiter } from "./limits.ts";
import { createRemoraService } from "./remoras.ts";
import { createRemoraRoutes } from "./routes.ts";

const AGENT = normalizeSuiAddress(`0x${"5c".repeat(32)}`);
const OWNER = normalizeSuiAddress(`0x${"0a".repeat(32)}`);
const PAY_TO = normalizeSuiAddress(`0x${"3e".repeat(32)}`);
const USDC = `${normalizeSuiAddress("0xa1ec")}::usdc::USDC`;
const REMORA = {
  id: "8f0c2a50-4c1d-4d6e-9a43-2b2d9b0f7a11",
  name: "Researcher",
  address: AGENT,
  ownerAddress: OWNER,
  network: "testnet" as const,
};
const at = (h: number) => new Date(Date.UTC(2026, 10, 5, h));
const range = { from: at(0), to: at(12) };

const wake = (h: number, decision: Wake["intent"]["decision"], tx?: string): Wake => ({
  v: 1,
  remora: REMORA.id,
  agent: AGENT,
  ts: at(h).toISOString(),
  intent: {
    trigger: { kind: "message", ref: "web" },
    inputs: { via: "tatum", objects: [], sha256: "1".repeat(64) },
    memories: [{ blobId: `blob-${h}-abcdefgh`, namespace: "sources", distance: 0.2 }],
    model: { id: "google/gemini-2.5-flash", promptSha256: "2".repeat(64) },
    decision,
    sonar: { verdict: "allow", reasons: ["within budget"] },
  },
  result: tx ? { tx } : { responseSha256: "3".repeat(64) },
});

const DIGEST = "8e7xNd69jvuY42tYAnQW4ZenJZYYbRjtWtJqtiLe5a7T";
const paid = wake(
  2,
  {
    action: "pay",
    payee: "reef:weather",
    payTo: PAY_TO,
    amount: "10000",
    coinType: USDC,
    reason: "the weather service answers this",
  },
  DIGEST,
);
const answered = wake(3, { action: "answer", reason: "answered after: paid reef:weather" });
const row = (id: string, w: Wake, h: number, extra: Partial<AuditReceiptRow> = {}) =>
  ({
    id,
    remoraId: REMORA.id,
    network: "testnet",
    wake: w,
    intentHash: intentHash(w.intent),
    txDigest: w.result.tx ?? null,
    createdAt: at(h),
    ...extra,
  }) satisfies AuditReceiptRow;

const PAID_ID = "00000000-0000-4000-8000-000000000002";
const ANSWER_ID = "00000000-0000-4000-8000-000000000003";
const rows: AuditReceiptRow[] = [
  row(PAID_ID, paid, 2),
  row(ANSWER_ID, answered, 3),
  // Another remora's Wake, another network, and Wakes outside the range: never in the bundle.
  row("00000000-0000-4000-8000-000000000004", answered, 4, { remoraId: randomUUID() }),
  row("00000000-0000-4000-8000-000000000005", answered, 5, { network: "mainnet" }),
  row("00000000-0000-4000-8000-000000000006", answered, 12),
  row("00000000-0000-4000-8000-000000000001", answered, 0, {
    createdAt: new Date(at(0).getTime() - 1),
  }),
];
const PAY_EVENT = "10000000-0000-4000-8000-000000000001";
const QUESTION = 'Weather in <b>Hanoi</b>? <img src=x onerror="alert(1)">';
const events: AuditEventRow[] = [
  { id: PAY_EVENT, receiptId: PAID_ID, payload: { kind: "paid", amount: "10000" } },
  {
    id: "10000000-0000-4000-8000-000000000002",
    receiptId: ANSWER_ID,
    payload: { question: QUESTION, outcomes: [{ kind: "paid", eventId: PAY_EVENT }] },
  },
];
const leaves = [wakeLeaf(answered), "a".repeat(64), "b".repeat(64)];
const batch: WakesAnchored = {
  network: "testnet",
  packageId: DEPLOYMENTS.testnet.anchorPackageId as string,
  anchorer: AGENT,
  root: merkleRoot(leaves),
  digest: "Fq8nB6Lrj5HHPpwbqPhwZ2CyGSL9xVLpnU1QZHGQ1gcs",
  count: 3,
  fromMs: at(3).getTime(),
  toMs: at(4).getTime(),
  leaves: leaves.map((leaf, i) => ({
    kind: "wake" as const,
    ref: i === 0 ? ANSWER_ID : randomUUID(),
    leaf,
  })),
};
const NOW = at(13);
const build = (includeQuestions: boolean, rs = rows) =>
  buildAuditBundle({
    remora: REMORA,
    range,
    includeQuestions,
    receipts: rs,
    anchors: [{ payload: batch, createdAt: at(4) }],
    events,
    now: NOW,
  });

describe("the auditor's Wake bundle (B1)", () => {
  it("holds only this remora's receipts in range, oldest first, with payments and anchors", () => {
    const b = AuditBundle.parse(build(false));
    expect(b.wakes.map((w) => w.receiptId)).toEqual([PAID_ID, ANSWER_ID]);
    expect(b.count).toBe(2);
    expect(b.remora).toEqual({
      id: REMORA.id,
      name: "Researcher",
      agent: AGENT,
      owner: OWNER,
      network: "testnet",
    });
    const [p, a] = b.wakes;
    expect(p?.payment).toEqual({
      digest: DIGEST,
      amount: "10000",
      payee: "reef:weather",
      payTo: PAY_TO,
      coinType: USDC,
    });
    expect(p?.anchor).toBeNull();
    expect(p?.intentHash).toBe(intentHash(paid.intent));
    expect(p?.memories).toEqual(["blob-2-abcdefgh"]);
    expect(a?.payment).toBeNull();
    // The anchored Wake's proof reaches the batch's root from the Wake as shipped.
    expect(a?.anchor).toMatchObject({ digest: batch.digest, index: 0, count: 3 });
    expect(verifyMerkleProof(wakeLeaf(a?.wake as Wake), a?.anchor?.proof ?? [], batch.root)).toBe(
      true,
    );
  });

  it("leaves question text out by default and puts it in when ticked", () => {
    const off = build(false);
    expect(off.includesQuestions).toBe(false);
    expect(off.wakes.every((w) => w.question === undefined)).toBe(true);
    expect(canonicalJson(off)).not.toContain("Hanoi");
    const on = build(true);
    expect(on.includesQuestions).toBe(true);
    // The answer's own Wake and the payment it made both carry the question.
    expect(on.wakes.map((w) => w.question)).toEqual([QUESTION, QUESTION]);
  });

  it("is canonical: the same rows in any order give the same bytes, keys sorted", () => {
    const one = bundleBytes(build(true));
    const two = bundleBytes(build(true, [...rows].reverse()));
    expect(Buffer.from(one).equals(Buffer.from(two))).toBe(true);
    const text = new TextDecoder().decode(one);
    expect(text.startsWith('{"count":2,"includesQuestions":true,"kind":"remora.audit"')).toBe(true);
    expect(JSON.parse(text)).toEqual(JSON.parse(canonicalJson(JSON.parse(text))));
  });

  it("reads a range of dates, a whole last day included, and refuses a bad one", () => {
    expect(auditRange("2026-11-01", "2026-11-05", at(13).getTime())).toEqual({
      from: new Date("2026-11-01T00:00:00.000Z"),
      to: new Date("2026-11-06T00:00:00.000Z"),
    });
    expect(() => auditRange("2026-11-05", "2026-11-01")).toThrow(/after the start/);
    expect(() => auditRange("x", "2026-11-01")).toThrow(/start and an end/);
    expect(() => auditRange("2099-01-01", "2099-01-02", at(13).getTime())).toThrow(/future/);
  });

  it("takes an address or a .sui name as the auditor", async () => {
    const core = {
      resolveNameServiceAddress: async ({ name }: { name: string }) => ({
        address: name === "linh.sui" ? PAY_TO : null,
      }),
      defaultNameServiceName: async () => ({ data: { name: null } }),
    };
    expect(await auditorOf(core, "linh.sui")).toEqual({ address: PAY_TO, name: "linh.sui" });
    expect(await auditorOf(core, "0x3e")).toEqual({
      address: normalizeSuiAddress("0x3e"),
      name: null,
    });
    await expect(auditorOf(core, "nobody.sui")).rejects.toMatchObject({ code: "name.unknown" });
    await expect(auditorOf(core, "bob")).rejects.toMatchObject({ code: "audit.auditor" });
  });
});

loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("auditor access with a database (B1)", () => {
  const db = createDb(local as string);
  const me = normalizeSuiAddress(`0x${randomBytes(32).toString("hex")}`);
  const other = normalizeSuiAddress(`0x${randomBytes(32).toString("hex")}`);
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
    reef: () => [],
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
  const service = createRemoraService({ db, networks, signer, reef: () => [], log });
  let signedIn: string | null = me;
  const app = createRemoraRoutes({ service, runtime, owner: async () => signedIn });
  const req = (path: string, method = "GET", body?: unknown) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json", "x-remora-network": "testnet" },
      ...(body && method !== "GET" ? { body: JSON.stringify(body) } : {}),
    });
  const made: string[] = [];
  afterAll(async () => {
    await db.delete(receipts).where(inArray(receipts.remoraId, made));
    await db.delete(remoras).where(inArray(remoras.ownerAddress, [me, other]));
  });

  const remora = async (owner: string, name: string) => {
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: owner,
        network: "testnet",
        template: "scout",
        name,
        config: {},
        status: "active",
        address: AGENT,
      })
      .returning();
    if (!r) throw new Error("no remora");
    made.push(r.id);
    return r;
  };

  it("reads only this remora's receipts inside the range", async () => {
    const mine = await remora(me, "Mine");
    const theirs = await remora(me, "Sibling");
    const t0 = Date.now() - 3 * 86_400_000;
    const put = (remoraId: string, offsetH: number) =>
      db
        .insert(receipts)
        .values({
          network: "testnet",
          remoraId,
          agent: AGENT,
          wake: { ...answered, remora: remoraId } as unknown as Record<string, unknown>,
          intentHash: intentHash(answered.intent),
          createdAt: new Date(t0 + offsetH * 3_600_000),
        })
        .returning({ id: receipts.id });
    const [inside] = await put(mine.id, 2);
    await put(mine.id, -2);
    await put(mine.id, 30);
    await put(theirs.id, 2);
    const b = await loadAuditBundle(
      db,
      mine,
      { from: new Date(t0), to: new Date(t0 + 24 * 3_600_000) },
      false,
    );
    expect(b.wakes.map((w) => w.receiptId)).toEqual([inside?.id]);
  });

  it("answers the owner routes only for the owner, and the public route with no session", async () => {
    const mine = await remora(me, "Audited");
    const capsuleId = normalizeSuiAddress(`0x${randomBytes(32).toString("hex")}`);
    const draft = {
      keyId: "ab".repeat(32),
      blobId: "audit-blob-abcdefgh",
      count: 2,
      expiresMs: Date.now() + 7 * 86_400_000,
      auditor: other,
      auditorName: null,
      range: { from: range.from.toISOString(), to: range.to.toISOString() },
      includeQuestions: false,
    };
    await db.insert(remoraEvents).values({
      remoraId: mine.id,
      network: "testnet",
      type: "action",
      summary: "Shared 2 Wakes with an auditor.",
      payload: { kind: AUDIT_SHARED, capsuleId, digest: DIGEST, ...draft },
    });
    signedIn = me;
    const list = await req(`/api/remoras/${mine.id}/audits`);
    expect(list.status).toBe(200);
    expect(((await list.json()) as { shares: unknown[] }).shares).toEqual([
      expect.objectContaining({
        capsuleId,
        auditor: other,
        revoked: null,
        path: `/audit/${capsuleId}`,
      }),
    ]);
    const revoke = await req(`/api/remoras/${mine.id}/audits/${capsuleId}/revoke`, "POST");
    expect(revoke.status).toBe(200);
    expect(((await revoke.json()) as { transaction: string }).transaction).toContain("revoke");
    const unknown = normalizeSuiAddress(`0x${randomBytes(32).toString("hex")}`);
    expect((await req(`/api/remoras/${mine.id}/audits/${unknown}/revoke`, "POST")).status).toBe(
      404,
    );

    // Someone else's wallet: every owner route says no.
    signedIn = other;
    for (const [path, method] of [
      [`/api/remoras/${mine.id}/audits`, "GET"],
      [`/api/remoras/${mine.id}/audits`, "POST"],
      [`/api/remoras/${mine.id}/audits/confirm`, "POST"],
      [`/api/remoras/${mine.id}/audits/${capsuleId}/revoke`, "POST"],
      [`/api/remoras/${mine.id}/audits/${capsuleId}/revoke/confirm`, "POST"],
    ] as const)
      expect((await req(path, method, {})).status, `${method} ${path}`).toBe(403);
    signedIn = null;
    expect((await req(`/api/remoras/${mine.id}/audits`)).status).toBe(401);

    // The public route: no session, only what the page needs, never the bundle.
    const pub = await req(`/api/audit/${capsuleId}`);
    expect(pub.status).toBe(200);
    const access = (await pub.json()) as Record<string, unknown>;
    expect(AuditAccess.parse(access)).toMatchObject({
      capsuleId,
      blobId: draft.blobId,
      keyId: draft.keyId,
      packageId: DEPLOYMENTS.testnet.capsulePackageId,
      network: "testnet",
      remora: "Audited",
      auditor: other,
    });
    expect(Object.keys(access).sort()).toEqual([
      "auditor",
      "blobId",
      "capsuleId",
      "count",
      "expiresMs",
      "keyId",
      "network",
      "packageId",
      "range",
      "remora",
    ]);
    expect((await req(`/api/audit/${unknown}`)).status).toBe(404);
    expect((await req("/api/audit/not-an-id")).status).toBe(404);
  });
});
