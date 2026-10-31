/**
 * F15 (ADR-0074): the facts ledger and memory admission, after Dewee's memory design
 * (zuey.me, "Dewee Memory: Khi AI không chỉ biết nhớ…", Oct 28 2026).
 *
 * Every memory a remora writes to `me`, `feedback` or `sources` is also read for the facts it asserts:
 * Remora's own `SOURCE` lines by a parser, free text by the parse model when one is configured. Each
 * fact goes through `reconcile` (packages/memory/src/facts.ts) under a per-slot lock, so the ledger
 * holds one current value per slot, its history, and the disputes the owner settles. Authority
 * comes from who wrote the memory: the owner's corrections, then the runtime's records, then agents.
 *
 * Before a turn reads its recall, `admitMemories` asks the ledger which recalled blobs no longer
 * hold, drops them and repeats, caps what's left, and hands the model the current value of any slot
 * a dropped blob was about. The Wake cites only what was admitted. Every step fails open: a ledger
 * or judge error leaves recall as it was.
 */
import { randomUUID } from "node:crypto";
import type { Logger } from "@remora/chain";
import { and, type Db, eq, inArray, memoryFacts, ne, remoraMemories, sql } from "@remora/db";
import {
  AUTHORITIES,
  type Authority,
  admit,
  currentAt,
  effectiveAt,
  type Fact,
  type FactInput,
  type JudgeOutcome,
  judgeAdmitted,
  type MemoryType,
  parseSourceLine,
  type Reconciliation,
  type Rejected,
  reconcile,
  redactCredentials,
  type Staleness,
  slotKey,
  type UsefulnessJudge,
  VERIFICATIONS,
  type Verification,
} from "@remora/memory";
import { namespaceFor, type Recalled, type RemoraMemory, type RemoraRef } from "./memory.ts";
import { RemoraError } from "./remoras.ts";

/** What the parse model reads out of free text. Who asserted it comes from the writer, not the model. */
export type ExtractedFact = Omit<FactInput, "assertedBy" | "observedAt">;

export type FactExtractor = (input: {
  text: string;
  /** Slots already in this scope, so the model reuses `owner.reply_language` instead of a twin. */
  slots: string[];
  today: string;
}) => Promise<{ facts: ExtractedFact[]; tokens: number; model: string }>;

/** Namespaces whose memories assert facts. Rules, episodes and Wakes are events, not facts. */
export const FACT_NAMESPACES = ["me", "feedback", "sources"] as const;
const NO_FACTS: ReadonlySet<MemoryType> = new Set(["wake", "rule"]);

export interface ObservedWrite {
  ns: string;
  type: MemoryType;
  text: string;
  /** The `remora_memories` row of the write: the evidence. */
  memoryId?: string;
  /** The remora's name, `mcp:<client>` or `owner`. */
  writer: string;
  assertedBy: Authority;
  /** The blob an owner's correction replaces: whatever it asserted stops holding. */
  replaces?: string;
  observedAt?: Date;
}

export interface FactOutcome {
  slot: string;
  action: Reconciliation["action"];
  factId: string | null;
}

export interface FactView extends Fact {
  namespace: string;
  slot: string;
  writer: string;
  extractor: string | null;
  recordedAt: string;
  closedAt: string | null;
  supersedes: string | null;
  supersededBy: string | null;
  disputes: string | null;
  /** The Walrus blobs it rests on (none until a write lands). */
  blobIds: string[];
  /** Every memory it rests on is hidden by the owner. */
  hidden: boolean;
}

export interface FactLedger {
  /** Extract, reconcile and record a write's facts. Never throws; failures are logged. */
  observe(r: RemoraRef, w: ObservedWrite): Promise<FactOutcome[]>;
  /**
   * For admission: which recalled blobs no longer hold (every fact they asserted is out of effect),
   * the facts now in effect in the slots those blobs were about, and which blobs the owner stands
   * behind (a live fact the owner asserted rests on them), which admission ranks first (ADR-0086).
   */
  validity(
    r: RemoraRef,
    namespaces: string[],
    blobIds: string[],
    at?: Date,
  ): Promise<{ stale: Map<string, Staleness>; current: FactView[]; owner: Set<string> }>;
  /** Every fact in the remora's namespaces except retracted ones, or only those in effect at `asOf`. */
  list(r: RemoraRef, namespaces: string[], opts?: { asOf?: Date }): Promise<FactView[]>;
  /** The owner settles a dispute: accept makes it the slot's value from now, reject retracts it. */
  resolve(r: RemoraRef, namespaces: string[], factId: string, accept: boolean): Promise<FactView>;
  /** Writes still being read; tests wait on it. */
  idle(): Promise<void>;
}

type Row = typeof memoryFacts.$inferSelect;
type NewRow = typeof memoryFacts.$inferInsert;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

const iso = (d: Date | null) => (d ? d.toISOString() : null);
const date = (s: string | null | undefined) => (s ? new Date(s) : null);
const rankA = (a: Authority) => AUTHORITIES.indexOf(a);
const rankV = (v: Verification) => VERIFICATIONS.indexOf(v);

/** `source_memory_ids && ARRAY[…]::uuid[]`: postgres-js would send a bare array as text[]. */
const restsOn = (ids: string[]) =>
  sql`${memoryFacts.sourceMemoryIds} && ARRAY[${sql.join(
    ids.map((id) => sql`${id}`),
    sql`, `,
  )}]::uuid[]`;

function toFact(row: Row): Fact {
  return {
    id: row.id,
    subject: row.subject,
    predicate: row.predicate,
    qualifier: row.qualifier,
    value: row.value,
    cardinality: row.cardinality,
    validFrom: iso(row.validFrom),
    validUntil: iso(row.validUntil),
    expiresAt: iso(row.expiresAt),
    observedAt: row.observedAt.toISOString(),
    assertedBy: row.assertedBy,
    verification: row.verification,
    confidence: row.confidence,
    status: row.status,
    version: row.version,
  };
}

/** The remora's fact namespaces as full ids: the scope every query filters by. */
const scopeOf = (r: RemoraRef, namespaces: string[]) =>
  namespaces
    .filter((ns) => (FACT_NAMESPACES as readonly string[]).includes(ns))
    .map((ns) => namespaceFor(r, ns));

const shortNs = (r: RemoraRef, full: string) =>
  full === namespaceFor(r, "me") ? "me" : (full.split(":").at(-1) ?? full);

const inEffect = (rows: Row[], at: Date) =>
  new Set(currentAt(rows.map(toFact), at.getTime()).map((f) => f.id));

export function createFactLedger(
  db: Db,
  opts: {
    log: Logger;
    extract?: FactExtractor;
    /** Model tokens spent extracting, counted against the remora's daily cap. */
    onTokens?: (r: RemoraRef, tokens: number) => Promise<void>;
    now?: () => Date;
  },
): FactLedger {
  const now = () => opts.now?.() ?? new Date();
  const pending = new Set<Promise<unknown>>();

  async function views(r: RemoraRef, rows: Row[]): Promise<FactView[]> {
    const ids = [...new Set(rows.flatMap((f) => f.sourceMemoryIds))];
    const mems = ids.length
      ? await db
          .select({
            id: remoraMemories.id,
            blobId: remoraMemories.blobId,
            hiddenAt: remoraMemories.hiddenAt,
          })
          .from(remoraMemories)
          .where(inArray(remoraMemories.id, ids))
      : [];
    const byId = new Map(mems.map((m) => [m.id, m]));
    return rows.map((f) => {
      const src = f.sourceMemoryIds.flatMap((id) => byId.get(id) ?? []);
      return {
        ...toFact(f),
        namespace: shortNs(r, f.namespace),
        slot: f.slot,
        writer: f.writer,
        extractor: f.extractor,
        recordedAt: f.createdAt.toISOString(),
        closedAt: iso(f.closedAt),
        supersedes: f.supersedes,
        supersededBy: f.supersededBy,
        disputes: f.disputes,
        blobIds: src.flatMap((m) => (m.blobId ? [m.blobId] : [])),
        hidden: src.length > 0 && src.every((m) => m.hiddenAt),
      };
    });
  }

  /** More evidence for a held value; a stronger source raises its standing. */
  async function strengthen(
    tx: Tx,
    f: Row,
    c: FactInput,
    memoryId: string | undefined,
    extra: Partial<NewRow>,
  ) {
    const stronger =
      rankA(c.assertedBy) > rankA(f.assertedBy) ||
      (rankA(c.assertedBy) === rankA(f.assertedBy) &&
        rankV(c.verification) > rankV(f.verification));
    await tx
      .update(memoryFacts)
      .set({
        sourceMemoryIds:
          memoryId && !f.sourceMemoryIds.includes(memoryId)
            ? [...f.sourceMemoryIds, memoryId]
            : f.sourceMemoryIds,
        observedAt: new Date(Math.max(f.observedAt.getTime(), Date.parse(c.observedAt))),
        confidence: Math.max(f.confidence, c.confidence),
        ...(stronger ? { assertedBy: c.assertedBy, verification: c.verification } : {}),
        ...extra,
      })
      .where(eq(memoryFacts.id, f.id));
  }

  /** One candidate, under its slot's lock: read the slot, decide, write. */
  async function apply(
    r: RemoraRef,
    namespace: string,
    c: FactInput,
    meta: { memoryId?: string; writer: string; extractor: string | null },
  ): Promise<FactOutcome> {
    const slot = slotKey(c);
    return db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`${namespace}|${slot}`}))`);
      const rows = await tx
        .select()
        .from(memoryFacts)
        .where(
          and(
            eq(memoryFacts.namespace, namespace),
            eq(memoryFacts.slot, slot),
            ne(memoryFacts.status, "retracted"),
          ),
        );
      const d = reconcile(c, rows.map(toFact), now().getTime());
      const id = randomUUID();
      const insert = (extra: Partial<NewRow>) =>
        tx.insert(memoryFacts).values({
          id,
          ownerAddress: r.ownerAddress.toLowerCase(),
          namespace,
          slot,
          subject: c.subject,
          predicate: c.predicate,
          qualifier: c.qualifier ?? null,
          value: c.value,
          cardinality: c.cardinality,
          validFrom: date(c.validFrom),
          validUntil: date(c.validUntil),
          expiresAt: date(c.expiresAt),
          observedAt: new Date(c.observedAt),
          assertedBy: c.assertedBy,
          verification: c.verification,
          confidence: c.confidence,
          version: Math.max(0, ...rows.map((x) => x.version)) + 1,
          sourceMemoryIds: meta.memoryId ? [meta.memoryId] : [],
          remoraId: r.id,
          writer: meta.writer,
          extractor: meta.extractor,
          ...extra,
        });
      const row = (fid: string) => rows.find((x) => x.id === fid) as Row;
      switch (d.action) {
        case "skip":
          return { slot, action: d.action, factId: null };
        case "extend":
          await strengthen(
            tx,
            row(d.factId),
            c,
            meta.memoryId,
            d.activate ? { status: "active", disputes: null } : {},
          );
          return { slot, action: d.action, factId: d.factId };
        case "create":
          await insert({});
          return { slot, action: d.action, factId: id };
        case "history":
          await insert({
            status: "superseded",
            validUntil: new Date(d.validUntil),
            supersededBy: d.supersededBy,
            closedAt: now(),
          });
          return { slot, action: d.action, factId: id };
        case "dispute":
          await insert({ status: "disputed", disputes: d.factId });
          return { slot, action: d.action, factId: id };
        case "supersede": {
          const next = d.promote ?? id;
          // The old version closes first: the one-active index allows no overlap.
          await tx
            .update(memoryFacts)
            .set({
              status: "superseded",
              validUntil: new Date(d.validUntil),
              supersededBy: next,
              closedAt: now(),
            })
            .where(eq(memoryFacts.id, d.factId));
          if (d.promote) {
            await strengthen(tx, row(d.promote), c, meta.memoryId, {
              status: "active",
              disputes: null,
              supersedes: d.factId,
            });
          } else {
            await insert({ supersedes: d.factId });
          }
          return { slot, action: d.action, factId: next };
        }
      }
    });
  }

  async function candidates(
    r: RemoraRef,
    namespace: string,
    w: ObservedWrite,
    observedAt: string,
  ): Promise<{ facts: FactInput[]; extractor: string | null }> {
    const parsed = w.type === "source" ? parseSourceLine(w.text, observedAt) : null;
    if (parsed) return { facts: [{ ...parsed, assertedBy: w.assertedBy }], extractor: null };
    if (!opts.extract) return { facts: [], extractor: null };
    const slots = await db
      .selectDistinct({ slot: memoryFacts.slot })
      .from(memoryFacts)
      .where(and(eq(memoryFacts.namespace, namespace), ne(memoryFacts.status, "retracted")))
      .limit(60);
    const out = await opts.extract({
      // The same redaction the port applies before Walrus.
      text: redactCredentials(w.text).text.slice(0, 2_000),
      slots: slots.map((s) => s.slot),
      today: observedAt.slice(0, 10),
    });
    if (out.tokens) await opts.onTokens?.(r, out.tokens).catch(() => {});
    return {
      extractor: out.model,
      facts: out.facts.slice(0, 5).map((f) => ({
        ...f,
        observedAt,
        // What the model read between the lines is the extractor's claim, never the writer's.
        assertedBy: f.verification === "inferred" ? "extractor" : w.assertedBy,
      })),
    };
  }

  /**
   * The owner corrected a memory: whatever it asserted that the correction didn't already settle
   * stops holding now, and stays as history.
   */
  async function correctedAway(
    r: RemoraRef,
    namespace: string,
    blobId: string,
    done: FactOutcome[],
  ) {
    const mems = await db
      .select({ id: remoraMemories.id })
      .from(remoraMemories)
      .where(and(eq(remoraMemories.remoraId, r.id), eq(remoraMemories.blobId, blobId)));
    if (!mems.length) return;
    const settled = new Set(done.flatMap((o) => (o.factId ? [o.factId] : [])));
    const rows = await db
      .select()
      .from(memoryFacts)
      .where(
        and(
          eq(memoryFacts.namespace, namespace),
          inArray(memoryFacts.status, ["active", "disputed"]),
          restsOn(mems.map((m) => m.id)),
        ),
      );
    for (const f of rows.filter((x) => !settled.has(x.id))) {
      await db
        .update(memoryFacts)
        .set(
          f.status === "active"
            ? { status: "superseded", validUntil: now(), closedAt: now() }
            : { status: "retracted", closedAt: now() },
        )
        .where(eq(memoryFacts.id, f.id));
    }
  }

  async function observe(r: RemoraRef, w: ObservedWrite): Promise<FactOutcome[]> {
    if (!(FACT_NAMESPACES as readonly string[]).includes(w.ns) || NO_FACTS.has(w.type)) return [];
    const namespace = namespaceFor(r, w.ns);
    const observedAt = (w.observedAt ?? now()).toISOString();
    const { facts, extractor } = await candidates(r, namespace, w, observedAt);
    const out: FactOutcome[] = [];
    for (const c of facts) {
      out.push(await apply(r, namespace, c, { memoryId: w.memoryId, writer: w.writer, extractor }));
    }
    if (w.replaces && w.assertedBy === "owner") await correctedAway(r, namespace, w.replaces, out);
    return out;
  }

  return {
    observe(r, w) {
      const p = observe(r, w).catch((err) => {
        opts.log.warn("facts.observe_failed", { remora: r.id, ns: w.ns, error: err });
        return [] as FactOutcome[];
      });
      pending.add(p);
      void p.finally(() => pending.delete(p));
      return p;
    },

    async validity(r, namespaces, blobIds, at = now()) {
      const stale = new Map<string, Staleness>();
      const owner = new Set<string>();
      const scope = scopeOf(r, namespaces);
      if (!blobIds.length || !scope.length) return { stale, current: [], owner };
      const mems = await db
        .select({ id: remoraMemories.id, blobId: remoraMemories.blobId })
        .from(remoraMemories)
        .where(inArray(remoraMemories.blobId, blobIds));
      if (!mems.length) return { stale, current: [], owner };
      const asserted = await db
        .select()
        .from(memoryFacts)
        .where(
          and(
            inArray(memoryFacts.namespace, scope),
            ne(memoryFacts.status, "retracted"),
            restsOn(mems.map((m) => m.id)),
          ),
        );
      const holding = inEffect(asserted, at);
      // In effect now, or the slot's latest value still to come ("from next month, B").
      const live = (f: Row) =>
        holding.has(f.id) ||
        (f.status === "active" && !(f.expiresAt && f.expiresAt.getTime() <= at.getTime()));
      const staleSlots = new Set<string>();
      for (const m of mems) {
        const mine = asserted.filter((f) => f.sourceMemoryIds.includes(m.id));
        if (m.blobId && mine.some((f) => f.assertedBy === "owner" && live(f))) owner.add(m.blobId);
        // A blob the ledger knows nothing about, or that still asserts something live, stays.
        if (!m.blobId || !mine.length || mine.some(live)) continue;
        stale.set(m.blobId, mine.every((f) => f.status === "disputed") ? "disputed" : "superseded");
        for (const f of mine) staleSlots.add(`${f.namespace}|${f.slot}`);
      }
      if (!staleSlots.size) return { stale, current: [], owner };
      const slotRows = await db
        .select()
        .from(memoryFacts)
        .where(
          and(
            inArray(memoryFacts.namespace, scope),
            inArray(
              memoryFacts.slot,
              [...staleSlots].map((k) => k.slice(k.indexOf("|") + 1)),
            ),
            inArray(memoryFacts.status, ["active", "superseded"]),
          ),
        );
      const inSlots = slotRows.filter((f) => staleSlots.has(`${f.namespace}|${f.slot}`));
      const inForce = inEffect(inSlots, at);
      const current = await views(
        r,
        inSlots.filter((f) => inForce.has(f.id)),
      );
      return { stale, current: current.filter((f) => !f.hidden), owner };
    },

    async list(r, namespaces, o = {}) {
      const scope = scopeOf(r, namespaces);
      if (!scope.length) return [];
      const rows = await db
        .select()
        .from(memoryFacts)
        .where(and(inArray(memoryFacts.namespace, scope), ne(memoryFacts.status, "retracted")))
        .orderBy(memoryFacts.slot, memoryFacts.version);
      if (!o.asOf) return views(r, rows);
      const live = inEffect(rows, o.asOf);
      return views(
        r,
        rows.filter((f) => live.has(f.id)),
      );
    },

    async resolve(r, namespaces, factId, accept) {
      const [f] = await db
        .select()
        .from(memoryFacts)
        .where(
          and(eq(memoryFacts.id, factId), inArray(memoryFacts.namespace, scopeOf(r, namespaces))),
        );
      if (!f) throw new RemoraError("fact.not_found", "This remora holds no such fact.", 404);
      if (f.status !== "disputed")
        throw new RemoraError("fact.not_disputed", "Only a disputed fact can be settled.", 409);
      if (accept) {
        // The owner says it now: the same reconcile as any owner statement, which promotes the row.
        await apply(
          r,
          f.namespace,
          {
            ...toFact(f),
            validFrom: null,
            observedAt: now().toISOString(),
            assertedBy: "owner",
            verification: "explicit",
            confidence: 1,
          },
          { writer: "owner", extractor: f.extractor },
        );
      } else {
        await db
          .update(memoryFacts)
          .set({ status: "retracted", closedAt: now() })
          .where(eq(memoryFacts.id, f.id));
      }
      const [after] = await db.select().from(memoryFacts).where(eq(memoryFacts.id, f.id));
      return (await views(r, [after as Row]))[0] as FactView;
    },

    async idle() {
      while (pending.size) await Promise.allSettled([...pending]);
    },
  };
}

/**
 * Every accepted write is also read for facts, in the background: a reply never waits on the parse
 * model. Who asserted it: `asserted` when the caller knows (the owner's correction), an MCP client
 * as an agent, anything else the runtime.
 */
export function withFacts(memory: RemoraMemory, ledger: FactLedger): RemoraMemory {
  return {
    recall: (r, query, namespaces, limit) => memory.recall(r, query, namespaces, limit),
    async remember(r, ns, type, text, o) {
      const res = await memory.remember(r, ns, type, text, o);
      if (res.saved && res.indexId) {
        const assertedBy = o?.asserted ?? (o?.by?.startsWith("mcp:") ? "agent" : "runtime");
        void ledger.observe(r, {
          ns,
          type,
          text,
          memoryId: res.indexId,
          writer: assertedBy === "owner" ? "owner" : (o?.by ?? r.name),
          assertedBy,
          ...(o?.replaces ? { replaces: o.replaces } : {}),
        });
      }
      return res;
    },
  };
}

export interface AdmittedMemories {
  memories: Recalled[];
  /** The current value of each slot a dropped memory was about, as lines for the model. */
  facts: string[];
  report: {
    recalled: number;
    admitted: number;
    rejected: Rejected[];
    judged: JudgeOutcome;
    facts: { id: string; slot: string }[];
  };
}

const SAID_BY: Record<Authority, string> = {
  owner: "said by the owner",
  runtime: "from your own records",
  agent: "said by an agent",
  extractor: "read between the lines",
};

export const factLine = (f: Fact) =>
  `${f.subject} · ${f.predicate}${f.qualifier ? ` (${f.qualifier})` : ""}: ${f.value} (since ${effectiveAt(f).slice(0, 10)}, ${SAID_BY[f.assertedBy]})`;

/**
 * Admission for one turn: what the model reads out of what recall found. Deterministic first, then
 * the optional judge; never more than recall found, and a failure leaves recall as it was.
 */
export async function admitMemories(
  deps: { facts?: FactLedger; log?: Logger; judge?: UsefulnessJudge },
  r: RemoraRef,
  question: string,
  recalled: Recalled[],
  namespaces: string[],
): Promise<AdmittedMemories> {
  let stale = new Map<string, Staleness>();
  let current: FactView[] = [];
  let owner = new Set<string>();
  if (deps.facts && recalled.length) {
    try {
      ({ stale, current, owner } = await deps.facts.validity(
        r,
        namespaces,
        recalled.map((m) => m.blobId),
      ));
    } catch (err) {
      deps.log?.warn("facts.validity_failed", { remora: r.id, error: err });
    }
  }
  const judged = await judgeAdmitted(
    question,
    admit(recalled, stale, undefined, owner),
    deps.judge,
  );
  // A current fact the admitted memories already state needs no line of its own.
  const admitted = new Set(judged.admitted.map((m) => m.blobId));
  const shown = current.filter((f) => !f.blobIds.some((b) => admitted.has(b))).slice(0, 8);
  return {
    memories: judged.admitted,
    facts: shown.map(factLine),
    report: {
      recalled: recalled.length,
      admitted: judged.admitted.length,
      rejected: judged.rejected,
      judged: judged.judged,
      facts: shown.map((f) => ({ id: f.id, slot: f.slot })),
    },
  };
}
