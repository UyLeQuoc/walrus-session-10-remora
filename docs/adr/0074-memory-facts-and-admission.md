# ADR-0074: Memory facts and admission (F15): what still holds, who said it, and what a turn reads

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (asked to apply the Dewee memory design; built by Uy's agent while Uy slept)

## Context
Uy asked to apply the key idea of the Dewee memory write-up
([zuey.me, Oct 28 2026](https://zuey.me/articles/dewee-memory-khi-ai-khong-chi-biet-nho?lang=vi)).
Its thesis is that storing memories is the easy part. The hard part is knowing:
- whether a memory is still true;
- who said it, and whether they had the standing to;
- whether it helps the task in front of the model.

It answers with these parts:
- **memory facts:** subject, predicate and value, with valid-from/until, observed-at, who asserted it,
  and the memories it rests on;
- **a deterministic reconciler:** create, extend, supersede, dispute or skip, with authority
  operator > user > agent > extractor;
- **`as_of` queries;**
- **memory admission:** dedupe, usefulness, a token budget, failing open;
- dreaming, a knowledge graph, a document vault and passive channel memory.

What Remora's memory did before (measured where noted):
- **Corrections were per remora.** Recall is by distance alone. An owner's correction (F4) names the
  blob it replaces, and recall skips that blob, but only for the remora that recorded the correction.
  Skips are per remora, while `me` is shared by all of the owner's remoras.
- **Every recalled memory reached the model.** Scout's turn passed up to 10 recalled memories, and its
  Wake cited all of them.
- **The second track record never landed.** A source's next track record
  (`SOURCE reef:brief · 9 calls · …` after `· 3 calls · …`) sits within the semantic duplicate distance
  of the last one. Once the first was searchable, every later score came back "Already in memory" and
  was never written. Measured on the real relayer by `probe:facts:walrus`. Scout's source learning (F2)
  stopped after its first lesson.
- **An agent's claim read like the owner's word.** An MCP agent's `episode` written into `me` reached
  every remora on equal footing with the owner.

Walrus Memory can't edit or delete a memory, so "what holds now" has to live beside it.

Not taken from Dewee: dreaming, the knowledge graph, the vault and passive channel memory. Each needs
more model calls or infrastructure than the nine days left allow, and none of them fixes something
Remora gets wrong today.

## Decision
- **A facts ledger** (`memory_facts`, an additive table).
  - Each row is one version of one slot (`subject.predicate[qualifier]`) in one full namespace.
  - It holds the value, the cardinality (`one` or `many`), and the times: `valid_from`, `valid_until`,
    `expires_at`, `observed_at`.
  - It records `asserted_by` and `verification`, a `confidence`, and a status: active, superseded,
    disputed or retracted.
  - It keeps the version links (`supersedes`, `superseded_by`, `disputes`), the `remora_memories` rows it
    rests on (the evidence on Walrus), the writer, and the model that extracted it.
  - A partial unique index allows one active value per single-valued slot.
- **`reconcile` is pure and deterministic** (`packages/memory/src/facts.ts`). The same candidate against
  the same slot always gives the same decision.
  - **Extend:** a value the slot already holds gets more evidence. If a source strong enough now states
    a disputed value, that disputed row is promoted.
  - **History:** a closed interval that ended before the active fact began isn't a conflict.
  - **Dispute:** a weaker source opens a dispute, and the active fact stays. Weaker means lower
    authority, or the same authority with weaker verification.
  - **Supersede, later fact:** an equal or stronger fact that takes effect at or after the active one
    supersedes it. The old one ends then: a move dated next month ends the current value next month.
  - **Supersede, stronger source:** a stronger source dated earlier still supersedes, and the weaker
    fact never held.
  - **History, late report:** an equal source dated earlier is a late report, kept as history
    ("in March I worked at A", while B holds since June).
  - **Skip** (nothing is written):
    - the confidence is under 0.5;
    - the fact looks like a credential;
    - a date doesn't parse;
    - it has already expired;
    - it ends before it begins.
- **Authority, strongest first:**
  1. **owner:** corrections from the web, and disputes the owner accepts;
  2. **runtime:** Remora's own records;
  3. **agent:** MCP clients (`mcp:*`);
  4. **extractor:** anything the model only inferred (`verification: inferred`).
- **Where facts come from.** Writes to `me`, `feedback` and `sources` are read for facts. Rules,
  episodes and Wakes are events, not facts.
  - Remora's own `SOURCE` lines are parsed, with no model.
  - Free text goes to the small model (`brain.extractFacts`). It returns at most 5 facts, and it's
    given the slots that already exist so it reuses them.
  - Extraction runs in the background once the relayer accepts the write. A reply never waits on it,
    and its tokens count against the remora's daily cap.
  - `MEMORY_FACTS=off` keeps only the parser.
  - Each fact is applied in a transaction under a per-slot advisory lock.
- **The owner's controls carry through.**
  - A correction supersedes whatever the corrected memory asserted, including slots it didn't
    restate.
  - Forget all retracts the namespace's facts.
  - A fact that rests only on hidden memories is hidden.
- **Track records skip the semantic duplicate check** (`dedupe: false` for each write, the ADR-0063
  rule for structured records). The ledger supersedes the old score instead.
- **Admission** (`packages/memory/src/admission.ts` and `admitMemories`):
  - Rank by distance.
  - Drop a blob whose every fact no longer holds; a blob the ledger knows nothing about stays.
  - Drop repeats.
  - Cap at 10 in total, 8 per namespace and about 600 tokens.
  - Then an optional judge on the check model may only drop memories, takes at most 1.5 s, and fails
    open. It is off by default (`MEMORY_ADMISSION_JUDGE=on`).
  - The model also gets "What's true now": the current value of each slot a dropped memory spoke about.
  - Scout's turn and its `memory_recall` tool both go through admission.
- **The Wake cites only admitted memories.** `intent.memories` keeps its shape, so Proof of Learning's
  memory delta now means what the remora read. The event payload records the admission report: how
  many memories were recalled and admitted, each rejection with its reason, the judge's outcome, and
  the facts shown.
- **API, Uy's lane:**
  - `GET /api/remoras/:id/facts[?asOf=]`;
  - `POST /api/remoras/:id/facts/:factId/resolve { accept }`.

  The response types live in the server until the next contract PR moves them to `packages/schema`.
  Huấn builds the UI ([handoff](../handoffs/2026-10-31-uy-to-huan-f15-facts.md)).
- **MCP:**
  - a new tool, `remora_facts` (`memory:read`): what holds now or `asOf` a date, disputes listed apart,
    framed as untrusted;
  - `remora_recall` marks each memory that no longer holds and adds what holds now.
- **Values are stored in Postgres.** Event payloads already hold questions and answers, and a fact
  value is a short derived string. Walrus stays the evidence. Every query filters by the remora's full
  namespaces. The owner's `me` is shared by the owner's remoras, as it is on Walrus.

## Consequences
- **Validity:** stale track records and corrected lines stop reaching the model. That includes another
  remora's recall of the shared `me`, where per-remora skips didn't reach.
- **Authority:** an agent can't overwrite the owner. Its contradicting claim waits as a dispute the
  owner accepts or rejects.
- **History:** "what held on a date" has an answer with real timestamps. That's material for the blog's
  "how it learned over time".
- **Scout learns again from feedback.** Every new score is written, and only the current one is read.
- **Costs, measured on `google/gemini-2.5-flash`:**
  - one small-model call per free-text write in `me`, `feedback` or `sources`: about 390 tokens and
    1.2–2.6 s, off the reply path;
  - admission adds two indexed queries to a turn.
- **The ledger is derived from Walrus.** Parsed lines replay exactly. Model-extracted facts record the
  model id. A fresh extraction can name a slot differently (`owner.drink` in one run,
  `owner.drinks[morning]` in another), but within one ledger the existing-slot hint keeps the names
  stable.
- **Not done:**
  - dreaming, the knowledge graph, the vault and passive channel memory;
  - the hippo-style person chat (`@remora/core`, `/chat`);
  - facts in the F8 export, which is a schema change;
  - the UI.

  Sentinel's rules stay in `sentinel_rules`.
- **Deploy:** `memory_facts` must be pushed to the target database before this code runs (deploy.md
  step 2, by hand; agents never push shared databases).

## Links
- [The Dewee write-up](https://zuey.me/articles/dewee-memory-khi-ai-khong-chi-biet-nho?lang=vi), the
  source of the ideas; no Dewee code was read or copied.
- Code:
  - `packages/memory/src/facts.ts`, `packages/memory/src/admission.ts`;
  - `apps/server/src/runtime/facts.ts`;
  - `apps/server/scripts/probe-facts.ts`, `apps/server/scripts/probe-facts-walrus.ts`.
- ADRs: [ADR-0030](0030-w2-memory-mode.md) (namespaces),
  [ADR-0048](0048-u7-hatchery-learning-memory-runtime.md) (hide, correct, forget),
  [ADR-0063](0063-structured-records-skip-dedupe.md) (dedupe off for structured records),
  [ADR-0066](0066-agents-use-the-apps-through-mcp.md) and [ADR-0067](0067-mcp-v2-details.md) (MCP).
- [Exit note](../spikes/2026-10-31-f15-facts-admission.md) and
  [handoff to Huấn](../handoffs/2026-10-31-uy-to-huan-f15-facts.md).
