# Request: show skipped duplicate writes in the memory inspector

- **Date:** 2026-10-31
- **From:** Uy's agent ([ADR-0086](../adr/0086-owner-memory-first-and-visible-duplicates.md))
- **To:** Huấn
- **Status: all on `main`. Please review it.**
  - The server side landed first.
  - Contract PR [#18](https://github.com/UyLeQuoc/walrus-session-10-remora/pull/18) is merged
    (`4f0180c`) before your review ([ADR-0087](../adr/0087-uy-merges-additive-contract-prs.md)).
  - **Claimed by Uy's agent (ADR-0027) and done:** the UI below. Uy asked the agent to do it all. You
    had no commit, branch or PR on the inspector. Change the copy or the layout as you like.

## What changed on the server
`GET /api/remoras/:id/memory` returns two new fields:
- **`rows[].duplicateWrites`** (a number, default 0): how many later writes were skipped because they
  matched this memory.
- **`duplicates`** (default `[]`): the newest 20 skipped writes. Each is
  `{ namespace, type, blobId, at }`.
  - `blobId` is the memory the write matched.
  - `type` is the skipped write's own type, or `null`.

A row's `type`, `hiddenAt` and `supersededBy` no longer come from a duplicate row. Before, a skipped
`episode` could relabel a `rule`.

## The ask (`apps/web`, memory inspector): done by Uy's agent, for your review
1. **A badge in `RowFlags`:** when `duplicateWrites > 0`, show "N later writes matched this". This is
   the case to notice: a write that differed only in its numbers was skipped.
2. **A short "Skipped as already known" list** under the table, from `duplicates`.
   - Each line names the namespace, the skipped type and when it happened.
   - It links to the matched row.
   - Hide the list when it's empty.
3. **Copy, for you to word.** Explain that the memory already held something close enough. If the new
   one was really different, the owner can correct the old one.

**As built** (`memory-page.tsx`, test in `remora-pages.test.tsx`):
- **`RowFlags` badge:** "2 later writes matched this" (`data-testid="duplicate-writes"`).
- **A `SettingsSection` called "Skipped as already known"** under the table. Each item is
  `data-testid="memory-duplicate"` and shows the namespace, the type, "matched" plus the blob, and the
  time.
  - The namespace filter applies to it.
  - It's hidden when the list is empty.
- **Description:** "These writes were close enough to a memory already stored that nothing new was
  written. If one was really new, correct the memory it matched."
- **Not done:** a link to the matched row (rows have no anchors yet) and no e2e (`e2e/` is yours).

## Contract PR [#18](https://github.com/UyLeQuoc/walrus-session-10-remora/pull/18)
- It adds `duplicateWrites` to the row schema and `duplicates` to `InspectorResponse`, both with
  defaults. Older payloads still parse.
- It updates the `inspector.json` fixture and the fixture test.
- No other web import changes.

## Also in ADR-0086, nothing for you to do
Admission now ranks the owner's memories first, at 1.2× similarity. The owner's word reaches the model
before an agent's near-copy. Nothing in the API changes for this.
