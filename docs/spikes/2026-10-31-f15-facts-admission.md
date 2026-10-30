# F15: memory facts and admission, after Dewee (Oct 31, 2026)

**The request.** Uy asked to apply the key idea in
[the Dewee memory write-up](https://zuey.me/articles/dewee-memory-khi-ai-khong-chi-biet-nho?lang=vi):
memory has to know what is still true, who said it, and what is worth putting in front of the model.
Uy was asleep and asked for a decision rather than questions. The decision is
[ADR-0074](../adr/0074-memory-facts-and-admission.md), and the UI requests are in the
[handoff to Huấn](../handoffs/2026-10-31-uy-to-huan-f15-facts.md).

**Taken from Dewee:**
- memory facts with deterministic reconciliation, authority ranking, valid and observed times, and
  `asOf`;
- memory admission that fails open.

**Not taken:** dreaming, the knowledge graph, the vault and passive channel memory. The ADR says why.
Only the article was read: no Dewee code was read or copied.

## What was built
| Where | What |
|---|---|
| `packages/memory/src/facts.ts` | The fact shape, `reconcile` (extend, create, history, supersede, dispute, skip), `currentAt`, the `SOURCE` line parser. Pure and deterministic |
| `packages/memory/src/admission.ts` | `admit` (stale, repeats, 10 in total, 8 per namespace, about 600 tokens) and `judgeAdmitted` (an optional model pass with a 1.5 s cap that only drops and fails open) |
| `packages/db` `memory_facts` | An additive table with a partial unique index (one active value per single-valued slot) and a GIN index on the evidence |
| `apps/server/src/runtime/facts.ts` | The ledger: extract (parser, or the small model in the background), reconcile under a per-slot advisory lock, owner corrections, `validity` for admission, `list`/`asOf`, `resolve`; `withFacts` around the remora's memory; `admitMemories` for a turn |
| Scout and its `memory_recall` tool | Read only admitted memories, plus "what's true now". The Wake cites only admitted memories, and the answer event carries the admission report |
| Memory controls | A correction is the owner's; forget all retracts the namespace's facts |
| `feedback.ts` | Track records are written with `dedupe: false` (the bug below) |
| Routes | `GET /api/remoras/:id/facts[?asOf=]` and `POST /api/remoras/:id/facts/:factId/resolve` |
| MCP | `remora_facts` (new); `remora_recall` marks memories that no longer hold |
| Env | `MEMORY_FACTS` (on by default) and `MEMORY_ADMISSION_JUDGE` (off by default) |

## A bug this found: Scout stopped learning about a source after its first score
`probe:facts:walrus`, phase 2, ran on the real relayer:
- two track-record lines were written and settled;
- a third line for the same source came back `saved=false` with "Already in memory, nothing written".

A source's next score differs from the last only in its numbers, so it falls within the semantic
duplicate distance (0.25). In production every 👍/👎 after the first was swallowed.

**Fix:** `dedupe: false` for each write, following the ADR-0063 rule for structured records. The
ledger supersedes the old score. **Rerun:** the third line is stored, and the active fact is
`10 calls · 2 useful · 8 noise · $0.050 per useful answer`. Scores already lost can't be recovered.

## Checks
| Check | Result |
|---|---|
| `bun run typecheck` | 20/20 tasks |
| `bun run lint` | clean (767 files) |
| `bun run test` | 15/15 tasks: server 306, memory 71, web 353, core 20, schema 56, the rest unchanged. F15 adds 23 in `packages/memory` (16 reconcile, 6 admission, 1 for the per-write dedupe) and 12 in the server (9 ledger tests on local Postgres, 2 MCP, 1 Scout end to end) |
| `bun scripts/check-links.ts` | clean |
| Local schema push | `memory_facts` created on the Docker Postgres (port 5434), additive only. **Not pushed to any shared database.** |

### The ledger tests (`apps/server/src/runtime/facts.test.ts`, real Postgres)
- A newer track record supersedes the last, admission keeps only the current one, and no model tokens
  are spent on it.
- `asOf` answers what held between two writes.
- An agent's claim is disputed against the owner's and isn't admitted. The owner accepts it, and it
  becomes the value. A settled fact can't be settled again.
- A sibling remora reading the shared `me` gets the same verdicts, which per-remora skips never gave
  it.
- A change dated next month keeps today's value and the plan live, and `asOf` in December gives the
  new value.
- An owner's correction supersedes what the corrected memory said, including a slot it didn't
  restate. A sibling's recall of the corrected line is replaced by one "what's true now" line.
- Scope: another owner's remora sees nothing.
- Two writers racing on one empty slot leave exactly one active value (the advisory lock).

### The extractor on the real model (`bun run --filter @remora/server probe:facts`)
- **Model:** `google/gemini-2.5-flash`, the configured small model (`LLM_SMALL_MODEL` falls back to
  `LLM_MODEL`).
- **Corpus:** seven memories folded through `reconcile`:
  - a reply language and length;
  - a role and an employer;
  - tea, then coffee;
  - a move to Company B dated December 1;
  - an agent's guess that the owner prefers English;
  - a one-off question about a match.

| Run | Result |
|---|---|
| 1 (first prompt) | 6/6, but the checks were too weak. "I drink tea every morning" gave no fact, so coffee had nothing to replace. "I switched from tea to coffee" came back `inferred`, which ranks as the extractor's claim and would only have disputed an owner-stated tea. The prompt was tightened (habits are facts; a value stated in other words is explicit), and two checks were added |
| 2, 3, 4 | **7/7 each.** Tea is recorded and superseded by coffee as the owner's. Vietnamese and Company A hold on Oct 31, and Company B on Dec 15. The agent's English is disputed. The match question gives no fact |

- **Cost:** about 2,700 tokens per 7 extractions (about 390 each), 1.1–2.7 s each, off the reply path.
- **Slot names vary between runs** (`owner.drink`, `owner.drinks[morning]`, `owner.drinks[every_morning]`).
  Within one ledger they're stable, because the extractor is given the existing slots.
- **Vietnamese, one manual run:**
  - "Trả lời mình bằng tiếng Việt, ngắn gọn thôi" gives `owner.reply_language = Vietnamese`. "Ngắn gọn"
    was not recorded as its own fact.
  - "Từ 1/12 mình chuyển qua làm ở Company B" gives `owner.employer = Company B` from `2026-12-01`.
  - "Đừng bao giờ trả quá 0.02 USDC cho một bản tóm tắt của brief" gives
    `owner.max_price[brief_summary] = 0.02 USDC`.
  - "Hôm nay hỏi kèo trận tối nay" gives no fact.

### On Walrus Memory (`bun run --filter @remora/server probe:facts:walrus`)
- **Setup:** the relayer was checked first (`bun run diagnose:memory`: nothing broken, 359 memories
  visible). The probe used a throwaway remora on the local DB and a throwaway namespace on the
  operator account. The namespace was forgotten afterwards.
- **Final run:**
  - two lines accepted in about 2 s and settled at 32 s (`8MesCz8U…`, `mt1X1C9l…`);
  - the ledger has v1 superseded and v2 active;
  - recall returns both (distance 0.742 and 0.747);
  - admission keeps v2 and rejects v1 as `superseded`;
  - a third line, once the first two are searchable, is stored, and the active value moves to it.
- **4/4 checks.**

## Not verified
- **The judge on a live model.** It's off by default. Its fail-open paths are unit-tested.
- **E2E and the web.** There's no UI yet, and the burner is empty (ADR-0071). The UI is in the handoff.
- **Deployed environments.** Telegram and the deployed server weren't tried. `memory_facts` is not on
  any shared database.
- **The hippo-style person chat** (`@remora/core`: `/chat` and the channel bots) doesn't use the ledger
  yet.

## The list for Uy
1. **Before deploying, push the schema by hand:** `memory_facts` goes to the target database
   (deploy.md step 2). Until it exists, writes log `facts.observe_failed`, turns fall back to plain
   recall (it fails open), and `/facts` returns 500.
2. **`MEMORY_ADMISSION_JUDGE`** stays off. Turn it on to try the model pass. It costs one check-model
   call per turn and at most 1.5 s.
3. **Huấn:** the [handoff](../handoffs/2026-10-31-uy-to-huan-f15-facts.md) asks for:
   - a contract PR (it can ride with H2–H6);
   - "What's true now", disputes and as-of on the memory page;
   - the admission report in Why?.
4. **The blog's "how it learned over time":** `reef:brief.track_record` versions, with timestamps and
   Walrus blob ids, are real material. `probe:facts:walrus` reproduces them in about 35 s.
5. **Lost track-record updates:** every score after a source's first was dropped in production until
   now. Only new scores will land.
6. **Next:** U9 (`pbcopy < docs/goals/uy-09-testnet-launch.prompt.txt`).
