/**
 * H7 (ADR-0051): the public playground. A visitor without a wallet gets their own Scout with a $1
 * Disc that the playground wallet issues, funds and signs for: live at once, a few questions, a
 * limited time. The Disc caps the worst case onchain and expires at the session's end; the
 * `playground.expire` job revokes it and retires the Scout. Memory is off unless a separate account
 * is configured, so the operator's relayer budget is never touched.
 */
import { createHash, createHmac, randomBytes } from "node:crypto";
import type { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import type { SuiNetwork } from "@remora/chain";
import { and, count, eq, gt, inArray, lt, playgroundSessions, remoraEvents, sql } from "@remora/db";
import type { Budget, PlaygroundLimits, PlaygroundSession } from "@remora/schema";
import type { RuntimeDeps } from "../runtime/deps.ts";
import { enqueue } from "../runtime/jobs.ts";
import type { RemoraMemory } from "../runtime/memory.ts";
import { type Remora, RemoraError, type RemoraService } from "../runtime/remoras.ts";
import { scoutAsk } from "../runtime/scout.ts";
import { TEMPLATES } from "../templates/index.ts";

export const PLAYGROUND_EXPIRE = "playground.expire";

const USDC_UNIT = 1_000_000n;
/** The Disc: 1 USDC over its life, at most 0.05 a payment (ADR-0051). */
const DISC_UNITS = 1_000_000n;
const PER_PAYMENT = 50_000n;
/** Below these the playground rests rather than start a session it can't pay for. */
export const MIN_FUNDER = { usdc: 100_000n, sui: 20_000_000n };

export interface PlaygroundDeps {
  runtime: RuntimeDeps;
  service: RemoraService;
  network: SuiNetwork;
  /** Null when `PLAYGROUND_FUNDER_KEY` isn't set: the playground is off. */
  funder: Ed25519Keypair | null;
  limits: PlaygroundLimits;
  /** HMAC key for IPs (the session secret). */
  secret: string;
  /** Off by default (a no-op), or a separate Walrus Memory account. */
  memory: RemoraMemory;
  /** Signs a transaction JSON as the funder and executes it; returns the digest. */
  sign: (transaction: string) => Promise<string>;
  /** The funder's USDC and SUI, in smallest units. */
  balances: () => Promise<{ usdc: bigint; sui: bigint }>;
  now?: () => Date;
}

/** Memory off: nothing recalled, nothing written (ADR-0051). */
export const noMemory: RemoraMemory = {
  recall: async () => [],
  remember: async () => ({ saved: false, note: "The playground keeps no memory." }),
};

export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
const ipHash = (p: PlaygroundDeps, ip: string) =>
  createHmac("sha256", p.secret).update(ip).digest("hex");
const usdc = (units: bigint) => {
  const whole = units / USDC_UNIT;
  const cents = ((units % USDC_UNIT) * 100n) / USDC_UNIT;
  return `${whole}.${cents.toString().padStart(2, "0")}`;
};

function funderOf(p: PlaygroundDeps) {
  if (!p.funder)
    throw new RemoraError("playground.off", "The playground isn't open on this server.", 409);
  return { kp: p.funder, address: normalizeSuiAddress(p.funder.toSuiAddress()) };
}

/** What a visitor sees: their Scout, its Disc, the spend, the questions left, the answers. */
export async function sessionView(
  p: PlaygroundDeps,
  row: typeof playgroundSessions.$inferSelect,
): Promise<PlaygroundSession> {
  const r = await p.service.get(row.remoraId, funderOf(p).address);
  const events = await p.runtime.db
    .select()
    .from(remoraEvents)
    .where(and(eq(remoraEvents.remoraId, r.id), inArray(remoraEvents.type, ["answer", "payment"])));
  const payments = new Map(events.filter((e) => e.type === "payment").map((e) => [e.id, e]));
  const spent = [...payments.values()].reduce(
    (s, e) => s + BigInt(String(e.payload.amount ?? 0)),
    0n,
  );
  const answers = events
    .filter((e) => e.type === "answer")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
    .map((e) => {
      const outcomes =
        (e.payload.outcomes as { kind: string; eventId: string }[] | undefined) ?? [];
      return {
        question: String(e.payload.question ?? e.summary),
        answer: String(e.payload.answer ?? ""),
        eventId: e.id,
        verify: e.receiptId ? `/verify/${e.receiptId}` : null,
        paid: outcomes.flatMap((o) => {
          const pay = payments.get(o.eventId);
          return pay
            ? [
                {
                  payee: String(pay.payload.payee) as `reef:${string}`,
                  amountUsdc: usdc(BigInt(String(pay.payload.amount ?? 0))),
                  digest: (pay.payload.digest as string | null) ?? null,
                },
              ]
            : [];
        }),
        at: e.createdAt.toISOString(),
      };
    });
  const now = (p.now ?? (() => new Date()))();
  const status = row.status === "live" && row.expiresAt <= now ? "expired" : row.status;
  return {
    remoraId: r.id,
    name: r.name,
    network: r.network,
    status,
    discId: r.discId,
    issueDigest: row.issueDigest,
    revokeDigest: row.revokeDigest,
    budgetUsdc: usdc(DISC_UNITS),
    spentUsdc: usdc(spent),
    questionsLeft: Math.max(0, p.limits.questionsPerSession - row.questionsUsed),
    expiresAt: row.expiresAt.toISOString(),
    answers,
    limits: p.limits,
  };
}

/** Whether a new session could start now, and why not. */
export async function availability(p: PlaygroundDeps) {
  if (!p.funder) return { open: false, reason: "The playground isn't open on this server." };
  const now = (p.now ?? (() => new Date()))();
  const [live] = await p.runtime.db
    .select({ n: count() })
    .from(playgroundSessions)
    .where(and(eq(playgroundSessions.status, "live"), gt(playgroundSessions.expiresAt, now)));
  if (Number(live?.n ?? 0) >= p.limits.pool)
    return {
      open: false,
      reason: "Every playground Researcher is taken right now. Try again soon.",
    };
  const b = await p.balances().catch(() => null);
  if (!b || b.usdc < MIN_FUNDER.usdc || b.sui < MIN_FUNDER.sui)
    return { open: false, reason: "The playground is resting while its wallet is topped up." };
  return { open: true, reason: null };
}

export async function createSession(p: PlaygroundDeps, ip: string) {
  const { address } = funderOf(p);
  const now = (p.now ?? (() => new Date()))();
  const ipKey = ipHash(p, ip);
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const [today] = await p.runtime.db
    .select({ n: count() })
    .from(playgroundSessions)
    .where(and(eq(playgroundSessions.ipHash, ipKey), gt(playgroundSessions.createdAt, dayStart)));
  if (Number(today?.n ?? 0) >= p.limits.sessionsPerIpPerDay)
    throw new RemoraError(
      "playground.ip_limit",
      `You've started ${p.limits.sessionsPerIpPerDay} playground sessions today. Sign in with a wallet to keep going.`,
      409,
    );
  const open = await availability(p);
  if (!open.open) throw new RemoraError("playground.unavailable", open.reason ?? "", 409);

  const expiresAt = new Date(now.getTime() + p.limits.ttlMinutes * 60_000);
  const coinType = p.runtime.networks.config(p.network).usdcCoinType;
  const budget: Budget = {
    coinType,
    windowLimit: DISC_UNITS.toString(),
    window: "month",
    perPaymentCap: PER_PAYMENT.toString(),
    // The allowance expires onchain at the session's end, even if the expiry job never runs.
    expiresAt: expiresAt.toISOString(),
    payees: [...TEMPLATES.scout.payees],
  };
  const name = `Playground Researcher ${randomBytes(2).toString("hex")}`;
  const created = await p.service.create({
    owner: address,
    network: p.network,
    template: "scout",
    name,
    budget,
    playground: true,
    lifetimeCap: DISC_UNITS,
  });
  if (!created.transaction)
    throw new RemoraError(
      "playground.no_disc",
      "The playground Researcher got no spending limit.",
      409,
    );
  const issueDigest = await p.sign(created.transaction);
  await p.service.confirmIssue(created.remora.id, address, issueDigest);
  // The $1 Disc is the safety: no shadow period (ADR-0051).
  await p.service.activate(created.remora.id, address);
  const token = randomBytes(24).toString("base64url");
  const [row] = await p.runtime.db
    .insert(playgroundSessions)
    .values({
      tokenHash: tokenHash(token),
      remoraId: created.remora.id,
      network: p.network,
      ipHash: ipKey,
      issueDigest,
      expiresAt,
    })
    .returning();
  if (!row) throw new RemoraError("playground.failed", "Couldn't start a session.", 409);
  await enqueue(p.runtime.db, {
    kind: PLAYGROUND_EXPIRE,
    payload: { sessionId: row.id },
    idempotencyKey: `${PLAYGROUND_EXPIRE}:${row.id}`,
    runAt: expiresAt,
  });
  p.runtime.log.info("playground.session", {
    remora: created.remora.id,
    issue: issueDigest,
    expiresAt: expiresAt.toISOString(),
  });
  return { token, session: await sessionView(p, row) };
}

async function byToken(p: PlaygroundDeps, token: string) {
  if (!token)
    throw new RemoraError("playground.no_session", "Start a playground session first.", 404);
  const [row] = await p.runtime.db
    .select()
    .from(playgroundSessions)
    .where(eq(playgroundSessions.tokenHash, tokenHash(token)));
  if (!row) throw new RemoraError("playground.no_session", "That playground session is gone.", 404);
  return row;
}

export async function getSession(p: PlaygroundDeps, token: string) {
  return sessionView(p, await byToken(p, token));
}

export async function ask(p: PlaygroundDeps, token: string, question: string) {
  const row = await byToken(p, token);
  const now = (p.now ?? (() => new Date()))();
  if (row.status !== "live" || row.expiresAt <= now)
    throw new RemoraError(
      "playground.ended",
      "This playground session has ended. Start a new one, or sign in to keep a Researcher of your own.",
      409,
    );
  const q = question.trim();
  if (!q || q.length > 500)
    throw new RemoraError("playground.bad_question", "Ask something up to 500 characters.");
  // Take a question atomically, so two quick asks can't both get the last one.
  const [taken] = await p.runtime.db
    .update(playgroundSessions)
    .set({ questionsUsed: sql`${playgroundSessions.questionsUsed} + 1` })
    .where(
      and(
        eq(playgroundSessions.id, row.id),
        lt(playgroundSessions.questionsUsed, p.limits.questionsPerSession),
      ),
    )
    .returning();
  if (!taken)
    throw new RemoraError(
      "playground.no_questions",
      `That was your ${p.limits.questionsPerSession} questions. Sign in with a wallet to have a Researcher of your own.`,
      409,
    );
  const r = await p.service.get(row.remoraId, funderOf(p).address);
  await scoutAsk(
    { ...p.runtime, memory: p.memory },
    r,
    q,
    { kind: "message", ref: "playground" },
    {
      playground: true,
    },
  );
  return sessionView(p, taken);
}

/** `playground.expire`: revoke the Disc onchain (the funder signs) and retire the Scout. */
export async function expire(p: PlaygroundDeps, sessionId: string) {
  const [row] = await p.runtime.db
    .select()
    .from(playgroundSessions)
    .where(eq(playgroundSessions.id, sessionId));
  if (!row || row.status === "retired") return null;
  const { address } = funderOf(p);
  let r: Remora;
  try {
    r = await p.service.get(row.remoraId, address);
  } catch {
    return null;
  }
  let revokeDigest: string | null = null;
  if (r.status !== "retired") {
    const tx = await p.service.retireTx(r.id, address);
    if (tx) {
      revokeDigest = await p.sign(tx);
      await p.service.confirmRetire(r.id, address, revokeDigest);
    } else {
      await p.service.confirmRetire(r.id, address);
    }
  }
  await p.runtime.db
    .update(playgroundSessions)
    .set({ status: "retired", revokeDigest })
    .where(eq(playgroundSessions.id, row.id));
  p.runtime.log.info("playground.expired", { remora: r.id, revoke: revokeDigest });
  return revokeDigest;
}
