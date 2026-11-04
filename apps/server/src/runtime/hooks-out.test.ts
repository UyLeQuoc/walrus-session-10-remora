import { createLogger } from "@remora/chain";
import { createDb, eq, jobs, remoraEvents, remoras, sql } from "@remora/db";
import { loadEnv } from "@remora/memory";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  approvalHookOf,
  DELIVER_JOB,
  deliver,
  deliverHandler,
  emitHook,
  HOOK_LOG_MAX,
  type HookDeps,
  hookEventOf,
  hookLogOf,
  hookSecretOf,
  outboundSecret,
  scanHookEvents,
  signatureHeader,
  targetProblem,
  verifyHookSignature,
} from "./hooks-out.ts";

const SERVER = "s".repeat(48);
const REMORA = "0b6c0a8e-7c1d-4a4e-9a51-6f0c2f4c9d11";
const DIGEST = "7NYf3QGEsdGQ1JAbmP3fnGMAwHgSDF7SLc4pHM9pZdqK";

describe("outbound signatures (ADR-0121)", () => {
  it("signs t.body, and a receiver accepts it within 5 minutes only", () => {
    const secret = outboundSecret(SERVER, REMORA);
    const body = '{"id":"e1","type":"payment.settled"}';
    const t = 1_793_800_000;
    const header = signatureHeader(secret, body, t);
    expect(header).toMatch(/^t=1793800000,v1=[0-9a-f]{64}$/);
    expect(verifyHookSignature(secret, body, header, t + 299)).toBe(true);
    expect(verifyHookSignature(secret, body, header, t + 301)).toBe(false);
    expect(verifyHookSignature(secret, `${body} `, header, t)).toBe(false);
    expect(verifyHookSignature(outboundSecret(SERVER, REMORA, "rotated"), body, header, t)).toBe(
      false,
    );
    expect(verifyHookSignature(secret, body, header.replace(/t=\d+/, `t=${t + 1}`), t)).toBe(false);
    expect(verifyHookSignature(secret, body, null, t)).toBe(false);
  });

  it("rotating the remora's key changes its secret", () => {
    const before = hookSecretOf({ secret: SERVER }, { id: REMORA, config: {} });
    const after = hookSecretOf(
      { secret: SERVER },
      { id: REMORA, config: { hooks: { key: "k2" } } },
    );
    expect(before).toBe(outboundSecret(SERVER, REMORA));
    expect(after).not.toBe(before);
  });
});

describe("where hooks may go (SSRF)", () => {
  const publicDns = async () => ["93.184.216.34"];
  const privateDns = async () => ["10.0.0.7"];

  it("production: https to public addresses only", async () => {
    const o = { production: true, resolve: publicDns };
    expect(await targetProblem("https://hooks.example.com/r", o)).toBeNull();
    expect(await targetProblem("http://hooks.example.com/r", o)).toBe(
      "Hooks are sent over https only.",
    );
    expect(await targetProblem("http://localhost:9999/r", o)).toBe(
      "Hooks are sent over https only.",
    );
    expect(await targetProblem("https://127.0.0.1/r", o)).toBe(
      "Hooks go to public addresses only.",
    );
    expect(await targetProblem("https://[::1]/r", o)).toBe("Hooks go to public addresses only.");
    expect(await targetProblem("https://inside.example.com/r", { ...o, resolve: privateDns })).toBe(
      "Hooks go to public addresses only.",
    );
    expect(await targetProblem("https://169.254.169.254/latest", o)).toBe(
      "Hooks go to public addresses only.",
    );
    expect(await targetProblem("https://u:p@hooks.example.com/r", o)).toBe(
      "Leave credentials out of the URL.",
    );
    expect(await targetProblem("not a url", o)).toBe("That isn't a URL.");
    expect(
      await targetProblem("https://nowhere.example.com/r", { ...o, resolve: async () => [] }),
    ).toBe("That host doesn't resolve.");
  });

  it("locally: http to localhost too, but still no other private address", async () => {
    const o = { production: false, resolve: privateDns };
    expect(await targetProblem("http://localhost:9999/r", o)).toBeNull();
    expect(await targetProblem("http://127.0.0.1:9999/r", o)).toBeNull();
    expect(await targetProblem("http://192.168.1.5/r", o)).toBe(
      "Hooks are sent over https (http only to localhost).",
    );
    expect(await targetProblem("https://192.168.1.5/r", o)).toBe(
      "Hooks go to public addresses only.",
    );
  });
});

describe("which rows become hook events", () => {
  const web = "http://web.test";
  const row = (type: string, payload: Record<string, unknown>) => ({
    id: "e1",
    remoraId: REMORA,
    network: "testnet" as const,
    type,
    summary: "s",
    payload,
  });

  it("a settled payment, with its digest; an unsettled one isn't sent", () => {
    expect(
      hookEventOf(row("payment", { payee: "reef:price", amount: "5000", digest: DIGEST }), web),
    ).toEqual({
      type: "payment.settled",
      data: {
        eventId: "e1",
        payee: "reef:price",
        label: "Prices",
        amount: "5000",
        digest: DIGEST,
        network: "testnet",
        why: `${web}/remoras/${REMORA}?event=e1`,
      },
    });
    expect(hookEventOf(row("payment", { payee: "reef:price", digest: null }), web)).toBeNull();
  });

  it("an answer, a price hike (either spelling), and nothing for other rows", () => {
    expect(
      hookEventOf(row("answer", { question: "q", answer: "a", digests: [DIGEST] }), web),
    ).toEqual({
      type: "answer.ready",
      data: {
        eventId: "e1",
        question: "q",
        answer: "a",
        digests: [DIGEST],
        why: `${web}/remoras/${REMORA}?event=e1`,
      },
    });
    expect(
      hookEventOf(row("price_hike", { merchant: "m", from: "10000", to: "15000" }), web)?.type,
    ).toBe("price.hike");
    expect(hookEventOf(row("price.hike", {}), web)?.type).toBe("price.hike");
    expect(hookEventOf(row("blocked", {}), web)).toBeNull();
    expect(hookEventOf(row("hook_delivery", {}), web)).toBeNull();
  });

  it("a budget proposal is proposal.made; every other approval is approval.asked", () => {
    const a = (kind: string, payload: Record<string, unknown> = {}) => ({
      id: "a1",
      remoraId: REMORA,
      kind: kind as "budget_change",
      summary: "s",
      payload,
    });
    expect(approvalHookOf(a("budget_change"), web).type).toBe("proposal.made");
    expect(approvalHookOf(a("schedule", { kind: "proposal" }), web).type).toBe("proposal.made");
    expect(approvalHookOf(a("over_limit_payment"), web)).toEqual({
      type: "approval.asked",
      data: {
        approvalId: "a1",
        kind: "over_limit_payment",
        summary: "s",
        review: `${web}/approvals`,
      },
    });
  });
});

// Runs against local Docker Postgres; skipped where there's no database (CI).
loadEnv();
const url = process.env.DATABASE_URL;
const local = url && /localhost|127\.0\.0\.1/.test(url) ? url : undefined;

describe.skipIf(!local)("outbound delivery on Postgres (J3)", () => {
  const db = createDb(local as string);
  const OWNER = `0x0e${process.pid.toString(16).padStart(62, "0")}`;
  const received: { headers: Headers; body: string }[] = [];
  let status = 200;
  const h: HookDeps = {
    rt: { db, log: createLogger({}, () => {}), webBase: "http://web.test" },
    secret: SERVER,
    production: false,
    fetch: (async (_url: string | URL | Request, init?: RequestInit) => {
      received.push({ headers: new Headers(init?.headers), body: String(init?.body) });
      return new Response("ok", { status });
    }) as typeof fetch,
  };
  let remoraId = "";
  const load = async (id: string) => {
    const [r] = await db.select().from(remoras).where(eq(remoras.id, id));
    return r ?? null;
  };

  beforeAll(async () => {
    const [r] = await db
      .insert(remoras)
      .values({
        ownerAddress: OWNER,
        network: "testnet",
        template: "scout",
        name: "Hooks out",
        status: "active",
        address: OWNER,
        config: {
          triggers: [{ kind: "message" }],
          hooks: {
            out: [
              { id: "out-pay", url: "http://localhost:9999/pay", events: ["payment.settled"] },
              { id: "out-ans", url: "http://localhost:9999/ans", events: ["answer.ready"] },
            ],
          },
        },
      })
      .returning();
    if (!r) throw new Error("no remora");
    remoraId = r.id;
  });
  afterAll(async () => {
    await db.delete(jobs).where(sql`${jobs.payload}->>'remoraId' = ${remoraId}`);
    await db.delete(remoras).where(eq(remoras.id, remoraId));
  });

  it("a settled payment row is queued once, for the URL that asked for payments", async () => {
    const since = new Date(Date.now() - 1_000);
    const [e] = await db
      .insert(remoraEvents)
      .values({
        remoraId,
        network: "testnet",
        type: "payment",
        summary: "Paid 5000 to price",
        payload: { payee: "reef:price", amount: "5000", digest: DIGEST },
      })
      .returning();
    if (!e) throw new Error("no event");
    expect(await scanHookEvents(h, since)).toBeGreaterThanOrEqual(1);
    // A second pass over the same rows queues nothing new (the job's key is the row's id).
    await scanHookEvents(h, since);
    const queued = await db
      .select()
      .from(jobs)
      .where(sql`${jobs.kind} = ${DELIVER_JOB} and ${jobs.payload}->>'remoraId' = ${remoraId}`);
    expect(queued).toHaveLength(1);
    expect(queued[0]?.idempotencyKey).toBe(`hook:out-pay:${e.id}`);

    // The worker's attempt: a signed POST carrying the real digest.
    const job = queued[0];
    if (!job) throw new Error("no job");
    await deliverHandler(h, load)(job.payload, { attempts: 1 });
    const got = received.at(-1);
    if (!got) throw new Error("nothing received");
    const body = JSON.parse(got.body);
    expect(body).toMatchObject({
      id: e.id,
      type: "payment.settled",
      remoraId,
      data: { digest: DIGEST, amount: "5000", payee: "reef:price" },
    });
    const r = await load(remoraId);
    if (!r) throw new Error("gone");
    expect(
      verifyHookSignature(hookSecretOf(h, r), got.body, got.headers.get("remora-signature")),
    ).toBe(true);
    expect(got.headers.get("remora-event")).toBe("payment.settled");
    expect(hookLogOf(r).at(-1)).toMatchObject({ id: e.id, status: "ok", code: 200, attempt: 1 });
  });

  it("a failed delivery throws, so the queue backs off and retries it", async () => {
    status = 503;
    const r = await load(remoraId);
    if (!r) throw new Error("gone");
    await emitHook({ db }, r, "answer.ready", { answer: "hi" }, { id: "evt-retry" });
    const [job] = await db
      .select()
      .from(jobs)
      .where(eq(jobs.idempotencyKey, "hook:out-ans:evt-retry"));
    if (!job) throw new Error("not queued");
    await expect(deliverHandler(h, load)(job.payload, { attempts: 2 })).rejects.toThrow(
      "hook out-ans: answered 503",
    );
    status = 200;
    expect(hookLogOf((await load(remoraId)) ?? r).at(-1)).toMatchObject({
      status: "failed",
      code: 503,
      attempt: 2,
    });
  });

  it("keeps the last 20 attempts", async () => {
    const r = await load(remoraId);
    const hook = r?.config && (r.config as { hooks: { out: { id: string }[] } }).hooks.out[0];
    if (!r || !hook) throw new Error("no hook");
    for (let i = 0; i < HOOK_LOG_MAX + 3; i++)
      await deliver(
        h,
        r,
        { id: "out-pay", url: "http://localhost:9999/pay", events: ["payment.settled"] },
        { id: `n${i}`, type: "test", remoraId, createdAt: new Date().toISOString(), data: {} },
      );
    const log = hookLogOf((await load(remoraId)) ?? r);
    expect(log).toHaveLength(HOOK_LOG_MAX);
    expect(log.at(-1)?.id).toBe(`n${HOOK_LOG_MAX + 2}`);
    expect(log[0]?.id).toBe("n3");
  });

  it("a URL that turned private is refused and logged, not retried", async () => {
    const r = await load(remoraId);
    if (!r) throw new Error("gone");
    const out = await deliver(
      { ...h, production: true },
      r,
      { id: "out-x", url: "https://10.1.2.3/x", events: ["answer.ready"] },
      { id: "priv", type: "test", remoraId, createdAt: new Date().toISOString(), data: {} },
    );
    expect(out).toMatchObject({ status: "refused", error: "Hooks go to public addresses only." });
  });
});
