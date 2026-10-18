# ADR-0005: Walrus Memory usage rules (measured by hippo)

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
hippo measured these on mainnet:

- there's no way to delete a current memory, and the Security Delete API only covers legacy V1 blobs;
- `restore()` reports 0 for namespaces that have memories;
- writes take about 24 s and can fail;
- recall sometimes returns empty with `dropped_count > 0`;
- two MemWal deployments are live on mainnet;
- there are at most 20 delegate keys per account;
- the limit is 60 weighted requests/min per key.

## Decision
- **Forgetting:** hide (a local `hidden_at` filter), correct (a supersede memory) and forget all
  (`/api/forget` per namespace). The UI is honest that blobs persist about 210 days.
- **Writes and recall:** writes are async with resubmission. Recall uses the object form only, retries
  empty-with-dropped results, and uses `maxDistance` 0.8.
- **Config:** read the package ID from `GET /config`. `diagnose` gates deploys.
- **Delegates:** one delegate key per remora, so at most about 18 remoras per owner.
- **Recovery:** rebuild from `memory_index` + the read API, never from `restore()`.

## Consequences
- The inspector shows Hide, Correct and Forget all, but no Delete.
- Wakes are written in the background.
- Each remora gets its own rate-limit budget.

## Links
- [tech-reference.md §1.11](../tech-reference.md#111-field-notes-measured-on-mainnet-by-hippo)
