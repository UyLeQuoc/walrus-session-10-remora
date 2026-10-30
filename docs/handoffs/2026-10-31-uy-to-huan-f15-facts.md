# Landed (backend): memory facts and admission (F15), with UI and contract requests

- **Date:** 2026-10-31
- **From:** Uy's agent ([ADR-0074](../adr/0074-memory-facts-and-admission.md),
  [exit note](../spikes/2026-10-31-f15-facts-admission.md))
- **To:** Huấn
- **Status:** the backend and MCP are on `main`. The UI is yours to take or leave.

Nothing under `apps/web`, `packages/schema`, `lib/api.ts`, `routes.tsx` or `apps/server/src/copy`
changed. Every e2e selector and every string is as it was.

## What changed that the web can see
- **Scout reads only admitted memories.** Before a turn, memories that no longer hold (superseded or
  disputed in the facts ledger), repeats and overflow are dropped.
  - The model gets "what's true now" for any slot a dropped memory spoke about.
  - The Wake's `intent.memories` lists only the admitted memories. Its shape is unchanged.
- **The `answer` event payload has a new `admission` key:**
  ```ts
  admission: {
    recalled: number;
    admitted: number;
    rejected: { blobId: string; namespace: string; reason:
      "duplicate" | "superseded" | "disputed" | "over_namespace_cap" | "over_candidate_cap"
      | "over_budget" | "not_useful" }[];
    judged: "kept_all" | "filtered" | "failed_open" | "skipped";
    facts: { id: string; slot: string }[]; // the "what's true now" lines the model got
  }
  ```

## New endpoints (owner session, like the other `/api/remoras/:id/*`)
- `GET /api/remoras/:id/facts[?asOf=<ISO date>]` → `{ asOf: string | null, facts: FactView[], disputes: number }`
  - Without `asOf`: every fact except retracted ones, ordered by slot, then version (a timeline per slot).
  - With `asOf`: only the facts in effect at that moment.
- `POST /api/remoras/:id/facts/:factId/resolve` with `{ accept: boolean }` → `{ fact: FactView }`
  - Only a `disputed` fact can be settled. Accept means "the owner says it now": the fact becomes the
    slot's value and the old one ends. Reject retracts it.
- **`FactView`** (`apps/server/src/runtime/facts.ts`):
  ```ts
  {
    id; namespace /* me | feedback | sources */; slot /* "owner.reply_language" */;
    subject; predicate; qualifier: string | null; value; cardinality: "one" | "many";
    validFrom: string | null; validUntil: string | null; expiresAt: string | null; observedAt: string;
    assertedBy: "owner" | "runtime" | "agent" | "extractor"; verification: "explicit" | "inferred";
    confidence: number; status: "active" | "superseded" | "disputed" | "retracted"; version: number;
    writer /* remora name | mcp:<client> | owner */; extractor: string | null;
    recordedAt: string; closedAt: string | null;
    supersedes: string | null; supersededBy: string | null; disputes: string | null;
    blobIds: string[]; hidden: boolean;
  }
  ```
- **Error codes** (copy keys `error.<code>`, if you want them):
  - `facts.unavailable` (409);
  - `facts.bad_date` (400);
  - `fact.not_found` (404);
  - `fact.not_disputed` (409);
  - `fact.bad_request` (400).

## Requests (yours to decide)
1. **Contract PR.** Move `FactView` and the two responses into `packages/schema`, and add the calls to
   `lib/api.ts`. It can ride with the H2–H6 contract PR.
2. **"What's true now" on the remora's memory page.**
   - One row per slot: its current value, since when, and who said it ("you", "Remora's records", "an
     agent", "read between the lines").
   - It expands to the slot's history, with superseded versions muted and links to the blobs.
3. **Disputes.**
   - A count badge.
   - Each dispute shows the claim, who made it and the value it contradicts, with Accept and Reject
     buttons.
4. **As of.** A date control that refetches with `?asOf=`. "What did Scout believe about brief on
   Oct 28" is the blog's "how it learned over time".
5. **Why?** Show the `admission` report, for example "Left out: 1 superseded memory".

## Unchanged
- Copy, routes, `lib/api.ts`, `packages/schema`, and every e2e spec and test id.
