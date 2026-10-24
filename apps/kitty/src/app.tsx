/**
 * Kitty's API and web (KT3, ADR-0062). Server-rendered like Receipts: the pot page, joining with one
 * signature (a labelled test member's key held by the server, since there's no Enoki key), approvals,
 * and "What Kitty learned".
 */
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { and, desc, eq, inArray, like } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import {
  type ActionDeps,
  ActionError,
  approve,
  createPot,
  joinPot,
  leavePot,
  maybeSuggest,
  potView,
  propose,
  spendAuto,
} from "./actions.ts";
import { ChainAbort, explorerTx, micro, usd } from "./chain.ts";
import { memories, pots, proposals, pulls } from "./db/index.ts";
import { Layout } from "./web/layout.tsx";

export interface AppDeps extends ActionDeps {
  keeper: string;
}

const when = (d: Date) => `${d.toISOString().slice(5, 10)} ${d.toISOString().slice(11, 16)} UTC`;

export function createApp(deps: AppDeps) {
  const { db } = deps;
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof ActionError) return c.json({ error: err.code, message: err.message }, 409);
    if (err instanceof ChainAbort)
      return c.json({ error: "aborted", message: err.detail, digest: err.digest }, 409);
    if (err instanceof z.ZodError)
      return c.json({ error: "bad_request", message: err.message }, 400);
    deps.log?.("http.error", { error: String(err) });
    return c.json({ error: "internal", message: "Something went wrong." }, 500);
  });

  // ---------- JSON API ----------

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/api/pots", async (c) => {
    const b = z
      .object({
        creator: z.string(),
        name: z.string().min(1).max(60),
        goalUsd: z.number().positive(),
        deadline: z.string(),
        quorum: z.number().int().min(1).default(2),
        autoOkUsd: z.number().min(0).default(0),
        windowMinutes: z
          .number()
          .int()
          .positive()
          .default(60 * 24 * 7),
      })
      .parse(await c.req.json());
    return c.json(
      await createPot(deps, {
        creator: b.creator,
        name: b.name,
        goal: micro(b.goalUsd),
        deadline: new Date(b.deadline),
        quorum: b.quorum,
        autoOkCap: micro(b.autoOkUsd),
        windowMs: b.windowMinutes * 60_000,
        keeper: deps.keeper,
      }),
      201,
    );
  });

  app.post("/api/pots/:id/join", async (c) => {
    const b = z
      .object({
        member: z.string(),
        name: z.string().min(1).max(40),
        capUsd: z.number().positive(),
      })
      .parse(await c.req.json());
    return c.json(
      await joinPot(deps, {
        potId: c.req.param("id"),
        member: b.member,
        name: b.name,
        capPerWindow: micro(b.capUsd),
        test: true,
      }),
      201,
    );
  });

  app.post("/api/pots/:id/proposals", async (c) => {
    const b = z
      .discriminatedUnion("kind", [
        z.object({
          kind: z.literal("spend"),
          proposer: z.string(),
          payee: z.string(),
          amountUsd: z.number().positive(),
          memo: z.string().max(80),
        }),
        z.object({ kind: z.literal("auto_cap"), proposer: z.string(), capUsd: z.number().min(0) }),
        z.object({ kind: z.literal("close"), proposer: z.string() }),
      ])
      .parse(await c.req.json());
    const p =
      b.kind === "spend"
        ? { kind: "spend" as const, payee: b.payee, amount: micro(b.amountUsd), memo: b.memo }
        : b.kind === "auto_cap"
          ? { kind: "auto_cap" as const, cap: micro(b.capUsd) }
          : { kind: "close" as const };
    return c.json(await propose(deps, c.req.param("id"), b.proposer, p), 201);
  });

  app.post("/api/pots/:id/proposals/:seq/approve", async (c) => {
    const b = z
      .object({ member: z.string(), execute: z.boolean().default(false) })
      .parse(await c.req.json());
    const r = await approve(
      deps,
      c.req.param("id"),
      Number(c.req.param("seq")),
      b.member,
      b.execute,
    );
    return c.json(r, 200);
  });

  app.post("/api/pots/:id/spend-auto", async (c) => {
    const b = z
      .object({
        member: z.string(),
        payee: z.string(),
        amountUsd: z.number().positive(),
        memo: z.string().max(80),
      })
      .parse(await c.req.json());
    return c.json(
      await spendAuto(deps, {
        potId: c.req.param("id"),
        member: b.member,
        payee: b.payee,
        amount: micro(b.amountUsd),
        memo: b.memo,
      }),
      201,
    );
  });

  app.post("/api/pots/:id/leave", async (c) => {
    const b = z.object({ member: z.string() }).parse(await c.req.json());
    return c.json(await leavePot(deps, c.req.param("id"), b.member));
  });

  app.get("/api/pots/:id", async (c) => {
    const v = await potView(deps, c.req.param("id"));
    if (!v) return c.json({ error: "not_found" }, 404);
    return c.json(
      JSON.parse(JSON.stringify(v, (_k, x) => (typeof x === "bigint" ? x.toString() : x))),
    );
  });

  app.get("/api/pots/:id/memories", async (c) =>
    c.json(await potMemories(deps, c.req.param("id"))),
  );

  // ---------- pages ----------

  app.get("/", async (c) => {
    const ps = await db.select().from(pots).orderBy(desc(pots.createdAt)).limit(20);
    return c.html(
      <Layout title="Kitty">
        <h1>The group pot that saves itself</h1>
        <p class="muted">
          Everyone signs once. Kitty pulls each share right after that person's payday, never more
          than the cap they set, and spends only the way the group agreed. A Move contract holds the
          pot, not a friend.
        </p>
        <h2>Pots</h2>
        {ps.length ? null : <p class="muted">No pots yet.</p>}
        {ps.map((p) => (
          <div class="card">
            <a href={`/pots/${p.id}`}>{p.name}</a>{" "}
            <span class="muted">
              goal {usd(p.goal)} by {when(p.deadline)}
            </span>
            {p.closed ? <span class="tag">closed</span> : null}
          </div>
        ))}
      </Layout>,
    );
  });

  app.get("/pots/:id", async (c) => {
    const potId = c.req.param("id");
    const v = await potView(deps, potId);
    if (!v) return c.notFound();
    const { pot, onchain } = v;
    const totalIn = v.members.reduce((s, m) => s + m.contributed, 0n);
    const pct = pot.goal > 0n ? Math.min(100, Number((totalIn * 100n) / pot.goal)) : 0;
    const reasons = await reasonsFor(
      deps,
      v.members.map((m) => m.scheduleMemoryId).filter((x): x is string => !!x),
    );
    const recentPulls = await db
      .select()
      .from(pulls)
      .where(eq(pulls.potId, potId))
      .orderBy(desc(pulls.createdAt))
      .limit(12);
    const suggestion = pot.closed ? null : await maybeSuggest(deps, potId);
    const free = [...deps.keys.keys()].filter((a) => !v.members.some((m) => m.address === a));
    /** Active members whose (test) key Kitty holds: they can sign from this page. */
    const signers = v.members.filter((m) => m.active && deps.keys.has(m.address));
    return c.html(
      <Layout title={`${pot.name} · Kitty`} potId={potId}>
        <h1>{pot.name}</h1>
        <div class="card">
          <div class="row" style="justify-content:space-between">
            <strong>
              {usd(totalIn)} of {usd(pot.goal)}
            </strong>
            <span class="muted">by {when(pot.deadline)}</span>
          </div>
          <div class="bar">
            <i style={`width:${pct}%`} />
          </div>
          <p class="muted">
            In the pot now: {onchain ? usd(onchain.balance) : "…"} · spent{" "}
            {onchain ? usd(onchain.totalOut) : "…"} · quorum {pot.quorum} · auto-ok up to{" "}
            {usd(onchain?.autoOkCap ?? pot.autoOkCap)}
            {pot.closed ? " · closed" : ""}
          </p>
        </div>
        {suggestion ? (
          <div class="card call">
            🧠 Kitty suggests: make {suggestion.category} spends automatic up to{" "}
            {usd(suggestion.cap)}. The group approved {suggestion.n} of them, each within 10
            minutes. Voting it in is a proposal like any other; the contract enforces the result.
            {signers.length ? (
              <form class="inline" method="post" action={`/pots/${potId}/suggest`}>
                <input type="hidden" name="cap" value={String(suggestion.cap)} />
                <select name="member">
                  {signers.map((m) => (
                    <option value={m.address}>{m.name} (test)</option>
                  ))}
                </select>
                <button type="submit">Propose it</button>
              </form>
            ) : null}
          </div>
        ) : null}
        <h2>Members</h2>
        {v.members.map((m) => {
          const r = m.scheduleMemoryId ? reasons.get(m.scheduleMemoryId) : null;
          return (
            <div class="card">
              <div class="row" style="justify-content:space-between">
                <strong>
                  {m.name}
                  {m.test ? <span class="tag">test</span> : null}
                  {m.active ? null : <span class="tag">left</span>}
                </strong>
                <span class="muted">
                  put in {usd(m.contributed)} · cap {usd(m.capPerWindow)} per{" "}
                  {Math.round(pot.windowMs / 60_000)} min
                </span>
              </div>
              <div class="muted">
                Next pull:{" "}
                {m.active ? (m.nextPullAt ? when(m.nextPullAt) : "when due") : "none (left)"}
              </div>
              {r ? (
                <span class="chip">
                  🧠 {r.text}
                  {r.blobId ? <span class="tag">blob {r.blobId.slice(0, 10)}…</span> : null}
                </span>
              ) : null}
            </div>
          );
        })}
        {!pot.closed && free.length ? (
          <form class="inline" method="post" action={`/pots/${potId}/join`}>
            <select name="member">
              {free.map((a) => (
                <option value={a}>test member {a.slice(0, 8)}…</option>
              ))}
            </select>
            <input name="name" placeholder="Name" required maxlength={40} />
            <input
              name="cap"
              type="number"
              step="0.01"
              min="0.01"
              value="0.40"
              style="width:80px"
            />
            $ per window
            <button type="submit">Join with one signature</button>
          </form>
        ) : null}
        <h2>Proposals</h2>
        {v.proposals.length ? null : <p class="muted">None yet.</p>}
        {signers.length && !pot.closed ? (
          <form class="inline" method="post" action={`/pots/${potId}/proposals`}>
            <select name="member">
              {signers.map((m) => (
                <option value={m.address}>{m.name} (test)</option>
              ))}
            </select>
            <input name="memo" placeholder="What for (e.g. food tacos)" required maxlength={80} />
            <input
              name="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="$"
              style="width:80px"
              required
            />
            <input name="payee" placeholder="Pay to 0x…" required pattern="0x[0-9a-fA-F]{1,64}" />
            <button type="submit">Propose a spend</button>
          </form>
        ) : null}
        {v.proposals.map((p) => (
          <div class="card">
            #{p.seq}{" "}
            {p.kind === "spend"
              ? `${p.memo}: ${usd(p.amount ?? 0n)}`
              : p.kind === "auto_cap"
                ? `auto-ok cap → ${usd(p.amount ?? 0n)}`
                : "close the pot"}
            <span class="tag">
              {p.approvals.length} of {pot.quorum}
            </span>
            {!p.executed && !pot.closed ? (
              <form
                class="inline"
                method="post"
                action={`/pots/${potId}/proposals/${p.seq}/approve`}
              >
                <select name="member">
                  {signers
                    .filter((m) => !p.approvals.some((a) => a.member === m.address))
                    .map((m) => (
                      <option value={m.address}>{m.name} (test)</option>
                    ))}
                </select>
                <button type="submit">Approve</button>
              </form>
            ) : null}
            {p.executed ? <span class="tag ok">done</span> : null}
            {p.digest ? (
              <a class="tag" href={explorerTx(p.digest)}>
                tx
              </a>
            ) : null}
          </div>
        ))}
        <h2>Pulls</h2>
        {recentPulls.map((p) => (
          <div class="card">
            <span
              class={p.status === "sent" ? "tag ok" : p.status === "skipped" ? "tag" : "tag no"}
            >
              {p.status}
            </span>{" "}
            {p.reason}
            {p.digest ? (
              <a class="tag" href={explorerTx(p.digest)}>
                tx
              </a>
            ) : null}
          </div>
        ))}
      </Layout>,
    );
  });

  app.post("/pots/:id/join", async (c) => {
    const potId = c.req.param("id");
    const form = await c.req.parseBody();
    const cap = Number(form.cap);
    await joinPot(deps, {
      potId,
      member: normalizeSuiAddress(String(form.member)),
      name: String(form.name).slice(0, 40),
      capPerWindow: micro(Number.isFinite(cap) && cap > 0 ? cap : 0.4),
      test: true,
    });
    return c.redirect(`/pots/${potId}`);
  });

  const back = (potId: string) => `/pots/${potId}`;
  const refused = (potId: string, err: unknown) => (
    <Layout title="Not done" potId={potId}>
      <h1>Not done</h1>
      <p class="no">
        {err instanceof ChainAbort
          ? `The chain refused it: ${err.detail.slice(0, 300)}`
          : String((err as Error).message ?? err)}
      </p>
      <a href={back(potId)}>Back to the pot</a>
    </Layout>
  );

  app.post("/pots/:id/proposals", async (c) => {
    const potId = c.req.param("id");
    const form = await c.req.parseBody();
    try {
      await propose(deps, potId, String(form.member), {
        kind: "spend",
        payee: normalizeSuiAddress(String(form.payee)),
        amount: micro(Number(form.amount)),
        memo: String(form.memo).slice(0, 80),
      });
      return c.redirect(back(potId));
    } catch (err) {
      return c.html(refused(potId, err), 409);
    }
  });

  app.post("/pots/:id/proposals/:seq/approve", async (c) => {
    const potId = c.req.param("id");
    const seq = Number(c.req.param("seq"));
    const form = await c.req.parseBody();
    const [pot] = await db.select().from(pots).where(eq(pots.id, potId));
    const [p] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.potId, potId), eq(proposals.seq, seq)));
    if (!pot || !p) return c.notFound();
    try {
      // The approval that reaches quorum executes in the same transaction.
      await approve(deps, potId, seq, String(form.member), p.approvals.length + 1 >= pot.quorum);
      return c.redirect(back(potId));
    } catch (err) {
      return c.html(refused(potId, err), 409);
    }
  });

  app.post("/pots/:id/suggest", async (c) => {
    const potId = c.req.param("id");
    const form = await c.req.parseBody();
    try {
      await propose(deps, potId, String(form.member), {
        kind: "auto_cap",
        cap: BigInt(String(form.cap)),
      });
      return c.redirect(back(potId));
    } catch (err) {
      return c.html(refused(potId, err), 409);
    }
  });

  app.get("/pots/:id/learned", async (c) => {
    const potId = c.req.param("id");
    const rows = await potMemories(deps, potId);
    return c.html(
      <Layout title="What Kitty learned" potId={potId}>
        <h1>What Kitty learned</h1>
        <p class="muted">
          Every reason Kitty gives is a Walrus Memory (mainnet): paydays, skips, how the group
          approves, the rules it voted.
        </p>
        {rows.map((r) => (
          <div class="card">
            <div class="row" style="justify-content:space-between">
              <span class="tag">{r.namespace.split(":").at(-1)}</span>
              <span class="muted">{when(r.createdAt)}</span>
            </div>
            <code>{r.text || "(text pending)"}</code>
            <div class="muted">{r.blobId ? `blob ${r.blobId}` : `status ${r.status}`}</div>
          </div>
        ))}
      </Layout>,
    );
  });

  return app;
}

async function reasonsFor(deps: Pick<ActionDeps, "db">, ids: string[]) {
  if (!ids.length) return new Map<string, { text: string; blobId: string | null }>();
  const rows = await deps.db.select().from(memories).where(inArray(memories.id, ids));
  return new Map(rows.map((r) => [r.id, { text: r.text, blobId: r.blobId }]));
}

export async function potMemories(deps: Pick<ActionDeps, "db">, potId: string) {
  return deps.db
    .select()
    .from(memories)
    .where(like(memories.namespace, `kitty:pot:${potId}:%`))
    .orderBy(desc(memories.createdAt))
    .limit(200);
}
