# Request: show skipped duplicate writes in the memory inspector

- **Date:** 2026-10-31
- **From:** Uy's agent ([ADR-0086](../adr/0086-owner-memory-first-and-visible-duplicates.md))
- **To:** Huấn
- **Status:**
  - The server side is on `main`.
  - The schema change is contract PR
    [#18](https://github.com/UyLeQuoc/walrus-session-10-remora/pull/18), which needs your approval.
  - The UI is yours, if you take it.

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

## The ask (`apps/web`, memory inspector)
1. **A badge in `RowFlags`:** when `duplicateWrites > 0`, show "N later writes matched this". This is
   the case to notice: a write that differed only in its numbers was skipped.
2. **A short "Skipped as already known" list** under the table, from `duplicates`.
   - Each line names the namespace, the skipped type and when it happened.
   - It links to the matched row.
   - Hide the list when it's empty.
3. **Copy, for you to word.** Explain that the memory already held something close enough. If the new
   one was really different, the owner can correct the old one.

## Contract PR [#18](https://github.com/UyLeQuoc/walrus-session-10-remora/pull/18)
- It adds `duplicateWrites` to the row schema and `duplicates` to `InspectorResponse`, both with
  defaults. Older payloads still parse.
- It updates the `inspector.json` fixture and the fixture test.
- No other web import changes.

## Also in ADR-0086, nothing for you to do
Admission now ranks the owner's memories first, at 1.2× similarity. The owner's word reaches the model
before an agent's near-copy. Nothing in the API changes for this.
