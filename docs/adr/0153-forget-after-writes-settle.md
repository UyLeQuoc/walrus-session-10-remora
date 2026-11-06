# ADR-0153: Forget a namespace only after its writes settle

- **Status:** Accepted
- **Date:** 2026-11-06
- **Deciders:** Uy ("lam het", on the list that included re-checking "forget all"), Uy's agent

## Context
- **The report:** during the U19 A4 run, `POST /api/forget` on import's staging namespace answered
  `deleted: 0` twice, and recall still found all three staged facts
  ([ADR-0146](0146-import-notes.md)). The U19 exit note asked for F4's "forget all"
  ([ADR-0048](0048-u7-hatchery-learning-memory-runtime.md)) to be re-checked, since it uses the same
  route.
- **Measured on the mainnet relayer, Nov 6** (operator account, throwaway namespaces, 6 writes in
  total):
  - **Settled `remember` writes:** 2 lines, recall finds both. Forget answered `deleted: 2`, stats
    said 0 left, and recall found nothing.
  - **Settled `analyze` writes,** in a `remora:<id>:import-staging`-shaped namespace: 2 facts, jobs
    waited for. Forget answered `deleted: 2`, and recall found nothing.
  - **Forget right after `analyze` returned** (status `pending`): `deleted: 0`, stats 0. The 2 jobs
    then settled, stats said 2, and recall found both. A second forget answered `deleted: 2`.
- **So the route works.** It drops only what the relayer has indexed. `remember` and `analyze` accept
  first, then embed, encrypt, upload and index each memory in a background job. A forget that runs
  before those jobs finish misses them, and they land afterwards.
- **Import hit exactly that.** Preview runs `analyze`, and the commit asked for the forget straight
  away. In the e2e that was seconds later, while the staged jobs were still running.
- **F4 has the same race,** for writes still pending in the namespace. Our own filter already hid
  them: `forgetNamespace` sets `hidden_at` on every row in the namespace, pending ones included, so
  recall skips their blobs when they land. Only the relayer's index kept them.

## Decision
- **`forgetSettled(relayer, namespace, jobIds)`** in `@remora/memory` waits for the given jobs
  through the SDK's `waitForRememberJobs`, then forgets. It returns the relayer's `deleted` and how
  many jobs were still `pending` when the wait gave up. A failed wait counts every job as pending,
  and the forget still runs. `RelayerExtras.waitForJobs` does the wait.
- **Import:** the preview keeps the `job_ids` its `analyze` calls returned (`stagedJobs`, in
  memory with the preview). The commit hands them to the staging forget in the background, so the
  owner's commit doesn't wait. That forget waits up to 120 s, then logs `import.staging_forgot`
  with the two counts. No turn reads the staging namespace, which is still the guard.
- **"Forget all" (F4):** it waits up to 30 s for the namespace's `pending` rows in `remora_memories`,
  then forgets. It hides every row and retracts the facts as before.
  - The response adds `deleted` and `pending`.
  - The note says what Walrus Memory dropped from its index, and that writes still running are
    hidden when they land.
- **Not changed:**
  - the chat's `/memory forget all` (`chat/commands.ts`, the hippo path), which has no job ids to
    wait on;
  - the web's Forget all dialog, which already shows the note.

## Consequences
- **What the owner sees:** after a forget all, the relayer's index no longer holds what was settled
  or settled within 30 s. Anything later is still skipped by our filter, and the note says so.
- **A forget-all request can take up to 30 s** while writes are pending. That's rare, since writes
  settle in about 24 s.
- **Staging is still not always emptied:**
  - after a server restart between preview and commit, since the job ids live in memory;
  - for a preview that is never committed.

  Nothing reads the staging namespace, so neither case leaks into a turn.
- **Tests:**
  - `packages/memory/src/relayer.test.ts`: a fake relayer that indexes on settle.
  - `apps/server/src/runtime/memory-controls.test.ts` (Postgres): the wait comes before the forget,
    and a write that lands late stays skipped.
  - `import.test.ts`: the staged jobs reach the forget, and the commit doesn't wait for it.
- **Production gets this with the next deploy.** Nothing changes in the schema.
- **[tech-reference §1.11](../tech-reference.md):** the Deletion row now names the race.

## Links
- [ADR-0048](0048-u7-hatchery-learning-memory-runtime.md) · [ADR-0146](0146-import-notes.md) ·
  [U19 exit note](../spikes/2026-11-05-u19-exit.md) · `packages/memory/src/relayer.ts` ·
  `apps/server/src/runtime/memory-controls.ts` · `apps/server/src/runtime/import-tidy-routes.ts`
