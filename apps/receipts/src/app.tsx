/**
 * Receipts' API and web (RC2–RC5, ADR-0061). One Hono app: JSON under `/api`, server-rendered pages
 * everywhere else, so the web has no build step and the same handlers serve the bot's links.
 */
import { randomUUID } from "node:crypto";
import { desc, eq, inArray, like } from "drizzle-orm";
import { Hono } from "hono";
import { z } from "zod";
import type { Anchorer } from "./chain.ts";
import { explorerTx } from "./chain.ts";
import { type Db, events, groups, members, memories, picks, quotes } from "./db/index.ts";
import { openEvents } from "./ingest.ts";
import {
  forecastsOf,
  learn,
  marketProbs,
  memberVoice,
  type ReceiptsCall,
  receiptsCall,
} from "./learn.ts";
import { pct } from "./markets.ts";
import type { ReceiptsMemory } from "./memory.ts";
import { anchorPending, logPick, PickError, type Receipt, receiptFor } from "./picks.ts";
import { calibration, statsByVoice, walkForward } from "./scoring.ts";
import { verifyReceipt } from "./verify.ts";
import { Curve } from "./web/chart.tsx";
import { Layout } from "./web/layout.tsx";

export interface AppDeps {
  db: Db;
  memory: ReceiptsMemory | null;
  anchorer: Anchorer | null;
  log?: (msg: string, data?: Record<string, unknown>) => void;
  now?: () => Date;
}

const SOURCE_LABEL: Record<string, string> = {
  books: "Books (DraftKings)",
  polymarket: "Polymarket",
  kalshi: "Kalshi",
};

async function labeller(db: Db, groupId: string) {
  const ms = await db.select().from(members).where(eq(members.groupId, groupId));
  const names = new Map(ms.map((m) => [memberVoice(m.id), `${m.name}${m.test ? " (test)" : ""}`]));
  return (voice: string) => SOURCE_LABEL[voice] ?? names.get(voice) ?? voice;
}

const when = (d: Date) => `${d.toISOString().slice(5, 10)} ${d.toISOString().slice(11, 16)} UTC`;

const pickBody = z.object({
  groupId: z.string(),
  memberId: z.string(),
  eventId: z.string(),
  side: z.enum(["yes", "no"]),
  confidence: z.union([z.number(), z.string()]),
  note: z.string().optional(),
});

export function createApp(deps: AppDeps) {
  const { db } = deps;
  const app = new Hono();
  const now = () => deps.now?.() ?? new Date();

  const call = async (groupId: string, eventId: string): Promise<ReceiptsCall | null> => {
    if (!deps.memory) return null;
    return receiptsCall(
      { db, memory: deps.memory, labels: await labeller(db, groupId) },
      groupId,
      eventId,
    ).catch(() => null);
  };

  // ---------- JSON API ----------

  app.get("/health", (c) => c.json({ ok: true }));

  app.post("/api/groups", async (c) => {
    const { name } = z.object({ name: z.string().min(1).max(80) }).parse(await c.req.json());
    const id = randomUUID();
    await db.insert(groups).values({ id, name });
    return c.json({ id, name }, 201);
  });

  app.post("/api/groups/:id/members", async (c) => {
    const body = z
      .object({ name: z.string().min(1).max(60), test: z.boolean().default(false) })
      .parse(await c.req.json());
    const id = randomUUID();
    await db
      .insert(members)
      .values({ id, groupId: c.req.param("id"), name: body.name, test: body.test });
    return c.json({ id, ...body }, 201);
  });

  app.get("/api/groups/:id/events", async (c) => {
    const open = await openEvents(db, now());
    const qs = open.length
      ? await db
          .select()
          .from(quotes)
          .where(
            inArray(
              quotes.eventId,
              open.map((e) => e.id),
            ),
          )
      : [];
    return c.json(
      open.map((e) => ({
        ...e,
        quotes: Object.fromEntries(
          qs.filter((q) => q.eventId === e.id).map((q) => [q.voice, q.prob]),
        ),
      })),
    );
  });

  app.post("/api/picks", async (c) => {
    const body = pickBody.parse(await c.req.json());
    try {
      const r = await logPick(
        {
          db,
          memory: deps.memory,
          anchorer: deps.anchorer,
          ...(deps.log ? { log: deps.log } : {}),
        },
        { ...body, now: now() },
      );
      return c.json({ pick: r.pick, nudge: r.nudge }, 201);
    } catch (err) {
      if (err instanceof PickError)
        return c.json(
          { error: err.code, message: err.message },
          err.code === "not_found" ? 404 : 409,
        );
      throw err;
    }
  });

  app.post("/api/anchor", async (c) =>
    c.json(
      (await anchorPending({
        db,
        anchorer: deps.anchorer,
        ...(deps.log ? { log: deps.log } : {}),
      })) ?? { anchored: 0 },
    ),
  );

  app.get("/api/groups/:id/calls/:eventId", async (c) => {
    const r = await call(c.req.param("id"), c.req.param("eventId"));
    return r ? c.json(r) : c.json({ error: "unavailable" }, 503);
  });

  app.get("/api/receipts/:pickId", async (c) => {
    const r = await receiptFor(db, c.req.param("pickId"));
    return r ? c.json(r) : c.json({ error: "not_found" }, 404);
  });

  app.post("/api/verify", async (c) => {
    if (!deps.anchorer) return c.json({ error: "no chain" }, 503);
    return c.json(await verifyReceipt(deps.anchorer, (await c.req.json()) as Receipt));
  });

  app.post("/api/groups/:id/learn", async (c) => {
    if (!deps.memory) return c.json({ error: "no memory" }, 503);
    return c.json(await learn({ db, memory: deps.memory }, c.req.param("id"), now()));
  });

  app.get("/api/groups/:id/scores", async (c) => c.json(await scores(db, c.req.param("id"))));

  app.get("/api/groups/:id/learning", async (c) => c.json(await learning(db, c.req.param("id"))));

  app.get("/api/groups/:id/memories", async (c) =>
    c.json(await groupMemories(db, c.req.param("id"))),
  );

  // ---------- pages ----------

  app.get("/", async (c) => {
    const gs = await db.select().from(groups).orderBy(desc(groups.createdAt)).limit(20);
    return c.html(
      <Layout title="Receipts">
        <h1>The group-chat pick'em that keeps the receipts</h1>
        <p class="muted">
          Log a pick before lock and it's sealed on Sui. After the final whistle everyone is scored
          against the books, Polymarket and Kalshi, and Receipts learns who to trust on what.
        </p>
        <h2>Groups</h2>
        {gs.map((g) => (
          <div class="card">
            <a href={`/g/${g.id}`}>{g.name}</a>
            {g.telegramChatId ? <span class="tag">Telegram</span> : null}
          </div>
        ))}
        <form class="inline" method="post" action="/groups">
          <input name="name" placeholder="New group name" required maxlength={80} />
          <button type="submit">Create</button>
        </form>
      </Layout>,
    );
  });

  app.post("/groups", async (c) => {
    const form = await c.req.parseBody();
    const name = String(form.name ?? "")
      .trim()
      .slice(0, 80);
    if (!name) return c.redirect("/");
    const id = randomUUID();
    await db.insert(groups).values({ id, name });
    return c.redirect(`/g/${id}`);
  });

  app.post("/g/:id/members", async (c) => {
    const form = await c.req.parseBody();
    const name = String(form.name ?? "")
      .trim()
      .slice(0, 60);
    if (name) {
      await db
        .insert(members)
        .values({ id: randomUUID(), groupId: c.req.param("id"), name, test: false });
    }
    return c.redirect(`/g/${c.req.param("id")}`);
  });

  app.get("/g/:id", async (c) => {
    const groupId = c.req.param("id");
    const [group] = await db.select().from(groups).where(eq(groups.id, groupId));
    if (!group) return c.notFound();
    const ms = await db.select().from(members).where(eq(members.groupId, groupId));
    const open = (await openEvents(db, now())).slice(0, 14);
    const markets = await marketProbs(
      db,
      groupId,
      open.map((e) => e.id),
    );
    const label = await labeller(db, groupId);
    const calls = new Map<string, ReceiptsCall | null>();
    for (const e of open) calls.set(e.id, await call(groupId, e.id));
    return c.html(
      <Layout title={`${group.name} · Receipts`} groupId={groupId}>
        <h1>{group.name}</h1>
        <p class="muted">
          {ms.length} member{ms.length === 1 ? "" : "s"}:{" "}
          {ms.map((m) => `${m.name}${m.test ? " (test)" : ""}`).join(", ") || "none yet"}
        </p>
        <form class="inline" method="post" action={`/g/${groupId}/members`}>
          <input name="name" placeholder="Add a member" maxlength={60} />
          <button type="submit">Add</button>
        </form>
        <h2>Open markets</h2>
        {open.length ? null : (
          <p class="muted">Nothing open right now. The worker loads NBA, EPL and the midterms.</p>
        )}
        {open.map((e) => {
          const m = markets.find((x) => x.eventId === e.id);
          const k = calls.get(e.id);
          return (
            <div class="card">
              <div class="row" style="justify-content:space-between">
                <strong>{e.title}</strong>
                <span class="muted">
                  {e.league} · locks {when(e.startsAt)}
                </span>
              </div>
              <div class="muted">Yes = {e.yesLabel}</div>
              <div class="voices">
                {Object.entries(m?.probs ?? {}).map(([v, p]) => (
                  <div class="voice">
                    {label(v)}
                    <b>{pct(p)}</b>
                  </div>
                ))}
              </div>
              {k && k.prob !== null ? (
                <div class="call">
                  <strong>
                    Receipts: {pct(k.prob)} {e.yesLabel}
                  </strong>
                  {k.average !== null ? (
                    <span class="muted"> · plain average {pct(k.average)}</span>
                  ) : null}
                  {k.chips.map((ch) => (
                    <span class="chip">
                      🧠 {ch.text}
                      {ch.blobId ? <span class="tag">blob {ch.blobId.slice(0, 10)}…</span> : null}
                    </span>
                  ))}
                </div>
              ) : null}
              {ms.length ? (
                <form class="inline" method="post" action={`/g/${groupId}/pick`}>
                  <input type="hidden" name="eventId" value={e.id} />
                  <select name="memberId">
                    {ms.map((mm) => (
                      <option value={mm.id}>
                        {mm.name}
                        {mm.test ? " (test)" : ""}
                      </option>
                    ))}
                  </select>
                  <select name="side">
                    <option value="yes">{e.yesLabel}</option>
                    <option value="no">{e.noLabel}</option>
                  </select>
                  <input
                    name="confidence"
                    type="number"
                    min="50"
                    max="99"
                    value="65"
                    style="width:70px"
                  />
                  %<button type="submit">Pick</button>
                </form>
              ) : null}
            </div>
          );
        })}
        <RecentPicks db={db} groupId={groupId} label={label} />
      </Layout>,
    );
  });

  app.post("/g/:id/pick", async (c) => {
    const groupId = c.req.param("id");
    const form = await c.req.parseBody();
    try {
      const r = await logPick(
        {
          db,
          memory: deps.memory,
          anchorer: deps.anchorer,
          ...(deps.log ? { log: deps.log } : {}),
        },
        {
          groupId,
          memberId: String(form.memberId),
          eventId: String(form.eventId),
          side: form.side === "no" ? "no" : "yes",
          confidence: String(form.confidence),
          now: now(),
        },
      );
      const q = r.nudge ? `?nudge=${encodeURIComponent(r.nudge.text)}` : "";
      return c.redirect(`/p/${r.pick.id}${q}`);
    } catch (err) {
      if (!(err instanceof PickError)) throw err;
      return c.html(
        <Layout title="Pick refused" groupId={groupId}>
          <h1>Pick refused</h1>
          <p class="no">{err.message}</p>
          <a href={`/g/${groupId}`}>Back to the board</a>
        </Layout>,
        409,
      );
    }
  });

  app.get("/p/:pickId", async (c) => {
    const r = await receiptFor(db, c.req.param("pickId"));
    if (!r) return c.notFound();
    const [ev] = await db.select().from(events).where(eq(events.id, r.event.id));
    const [m] = await db.select().from(members).where(eq(members.id, r.pick.memberId));
    const result =
      deps.anchorer && r.anchor ? await verifyReceipt(deps.anchorer, r).catch(() => null) : null;
    const nudge = c.req.query("nudge");
    return c.html(
      <Layout title="Receipt" groupId={r.pick.groupId}>
        <h1>🧾 Receipt</h1>
        {nudge ? <p class="chip">🧠 {nudge}</p> : null}
        <div class="card">
          <strong>{r.event.title}</strong>
          <div>
            {m?.name}
            {m?.test ? " (test)" : ""}: {r.pick.side === "yes" ? ev?.yesLabel : ev?.noLabel} at{" "}
            {pct(r.pick.confidence)}
          </div>
          <div class="muted">
            Logged {r.pick.createdAt} · locks {r.event.locksAt}
          </div>
        </div>
        <h2>Verify</h2>
        {result ? (
          <div class="card">
            <strong class={result.ok ? "ok" : "no"}>
              {result.ok ? "Verified on Sui" : "Not verified"}
            </strong>
            <table>
              {result.checks.map((ch) => (
                <tr>
                  <td class={ch.ok ? "ok" : "no"}>{ch.ok ? "✓" : "✗"}</td>
                  <td>{ch.name}</td>
                  <td class="muted">
                    <code>{ch.detail}</code>
                  </td>
                </tr>
              ))}
            </table>
            {r.anchor ? (
              <p>
                <a href={explorerTx(r.anchor.digest)}>Anchor transaction on Suiscan (testnet)</a>
              </p>
            ) : null}
          </div>
        ) : (
          <p class="muted">
            Not anchored yet. Batches go out every 10 minutes, and right away before a lock.
          </p>
        )}
        <p class="muted">
          Anyone can check this without trusting us: <code>POST /api/verify</code> with{" "}
          <a href={`/api/receipts/${r.pick.id}`}>the receipt JSON</a>.
        </p>
      </Layout>,
    );
  });

  app.get("/g/:id/scores", async (c) => {
    const groupId = c.req.param("id");
    const label = await labeller(db, groupId);
    const s = await scores(db, groupId);
    return c.html(
      <Layout title="Scores · Receipts" groupId={groupId}>
        <h1>Who was right</h1>
        <p class="muted">
          Brier score (lower is better), shrunk toward a coin flip until there's enough data.
          Backfilled markets count.
        </p>
        {s.map((lg) => (
          <div class="card">
            <h2 style="margin-top:0">{lg.league}</h2>
            <table>
              <tr>
                <th>Voice</th>
                <th>n</th>
                <th>Right</th>
                <th>Brier</th>
              </tr>
              {lg.voices.map((v) => (
                <tr>
                  <td>{label(v.voice)}</td>
                  <td>{v.n}</td>
                  <td>
                    {v.hits}/{v.n}
                  </td>
                  <td>{v.brier.toFixed(3)}</td>
                </tr>
              ))}
            </table>
          </div>
        ))}
      </Layout>,
    );
  });

  app.get("/g/:id/learning", async (c) => {
    const groupId = c.req.param("id");
    const l = await learning(db, groupId);
    return c.html(
      <Layout title="Learning · Receipts" groupId={groupId}>
        <h1>Is Receipts getting better?</h1>
        <p class="muted">
          Walk-forward over every resolved market: each call is weighted only by what was learned
          before it. Backfilled games (NBA since Oct 20) are real lines and real results, fetched
          after the fact and labelled.
        </p>
        {l.map((lg) => (
          <div class="card">
            <h2 style="margin-top:0">
              {lg.league} <span class="tag">{lg.backfilled} backfilled</span>
            </h2>
            <Curve points={lg.curve} title={`${lg.league} learning curve`} />
          </div>
        ))}
      </Layout>,
    );
  });

  app.get("/g/:id/memory", async (c) => {
    const groupId = c.req.param("id");
    const rows = await groupMemories(db, groupId);
    return c.html(
      <Layout title="What it learned · Receipts" groupId={groupId}>
        <h1>What Receipts learned</h1>
        <p class="muted">
          Every conclusion it acts on is a Walrus Memory (mainnet). The board's 🧠 chips cite these
          blobs.
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

function RecentPicks(props: { db: Db; groupId: string; label: (v: string) => string }) {
  return (async () => {
    const rows = await props.db
      .select({ p: picks, e: events })
      .from(picks)
      .innerJoin(events, eq(picks.eventId, events.id))
      .where(eq(picks.groupId, props.groupId))
      .orderBy(desc(picks.createdAt))
      .limit(20);
    if (!rows.length) return <p class="muted">No picks yet.</p>;
    return (
      <>
        <h2>Recent picks</h2>
        {rows.map(({ p, e }) => (
          <div class="card">
            <a href={`/p/${p.id}`}>{e.title}</a>: {props.label(memberVoice(p.memberId))} →{" "}
            {p.side === "yes" ? e.yesLabel : e.noLabel} {pct(p.confidence)}
            {p.anchorId ? (
              <span class="tag">anchored</span>
            ) : (
              <span class="tag">pending anchor</span>
            )}
            {e.outcome !== null ? (
              <span class={(e.outcome === 1) === (p.side === "yes") ? "tag ok" : "tag no"}>
                {(e.outcome === 1) === (p.side === "yes") ? "right" : "wrong"}
              </span>
            ) : null}
          </div>
        ))}
      </>
    );
  })();
}

export async function scores(db: Db, groupId: string) {
  const forecasts = forecastsOf(await marketProbs(db, groupId));
  const stats = statsByVoice(forecasts);
  const leagues = [...new Set(stats.map((s) => s.league))].sort();
  return leagues.map((league) => ({
    league,
    voices: stats.filter((s) => s.league === league).sort((a, b) => a.shrunk - b.shrunk),
    calibration: calibration(forecasts.filter((f) => f.league === league)),
  }));
}

export async function learning(db: Db, groupId: string) {
  const markets = (await marketProbs(db, groupId)).filter((m) => m.outcome !== null);
  const evs = markets.length
    ? await db
        .select({ id: events.id, backfill: events.backfill })
        .from(events)
        .where(
          inArray(
            events.id,
            markets.map((m) => m.eventId),
          ),
        )
    : [];
  const back = new Set(evs.filter((e) => e.backfill).map((e) => e.id));
  const leagues = [...new Set(markets.map((m) => m.league))].sort();
  return leagues.map((league) => {
    const ms = markets.filter((m) => m.league === league);
    return {
      league,
      backfilled: ms.filter((m) => back.has(m.eventId)).length,
      curve: walkForward(ms.map((m) => ({ ...m, outcome: m.outcome as 0 | 1 }))),
    };
  });
}

export async function groupMemories(db: Db, groupId: string) {
  const ms = await db.select({ id: members.id }).from(members).where(eq(members.groupId, groupId));
  const rows = await db
    .select()
    .from(memories)
    .where(like(memories.namespace, `receipts:%`))
    .orderBy(desc(memories.createdAt))
    .limit(200);
  const mine = new Set(ms.map((m) => `receipts:member:${m.id}:insights`));
  return rows.filter(
    (r) => r.namespace.startsWith(`receipts:group:${groupId}:`) || mine.has(r.namespace),
  );
}
