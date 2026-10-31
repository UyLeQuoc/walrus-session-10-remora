# Drafts: MemWal issues worth filing (Uy sends them)

> **Drafts only** ([ADR-0081](../adr/0081-launch-story.md)). Nothing here has been posted.
> - Before filing, check whether hippo already filed it and whether the current SDK and relayer still do
>   this.
> - Each draft gives a measurement and a request, not a complaint.
>
> Last session's winner filed its friction log upstream. The Walrus team picks Best Walrus Memory.

## 1. `/health` answers 200 while the embedding behind recall and remember is failing
- **Seen:** Oct 22, 2026, about 14:00–14:32 UTC, on the mainnet relayer.
  - `/health` answered `ok`.
  - Every `remember` and `recall` failed behind it, with an embedding 401.
- **Impact.** A client that gates on `/health` thinks memory works. Remora now builds its health from
  its own recent recall and write failures ([ADR-0055](../adr/0055-memory-failures-in-health.md)).
- **Ask.** Either:
  - include the embedding and search path in `/health`, or
  - add `/health/deep` with one cheap embed round trip.

## 2. The current package ID: two deployments live, and `/config` has no registry ID
- **Seen:**
  - The docs name an older package.
  - `GET /config` returns the current `packageId` but no registry ID.
  - Two deployments are live on mainnet. The registry has to be found and pinned by hand.
- **Ask.** Add `registryId` to `/config`, and point the docs at `/config` as the source of truth.

## 3. `recall` sometimes returns `results: []` with `dropped_count > 0`
- **Seen** (hippo, SDK 0.1.8, Sep–Oct 2026): a recall that found matches and then dropped them all.
  Retrying with backoff usually returns them.
- **Ask.** Say in the response why results were dropped (budget, decrypt, timeout), so a client knows
  whether to retry.

## 4. `restore()` reports `total: 0` for namespaces that hold memories
- **Seen** (hippo): `restore()` gave `total: 0` while the read API listed memories in the same
  namespace.
- **Ask.** Fix the count, or document what `restore()` counts.

## 5. There's no way to delete or supersede one current memory
- **Seen:**
  - `POST /api/forget` removes a whole namespace's index.
  - The Security Delete API covers legacy V1 blobs only.
  - Remora hides a memory locally and writes a `[correction]` that supersedes it.
- **Ask.** Either a per-memory "forget" that removes it from the index, or a supported "supersedes:
  <blob>" field that recall respects. Playbook asked for the same.

## 6. `remember` returns before the memory is searchable
- **Seen:** a write is accepted in about 2 s, but recall finds it only after about 25–32 s. A fact saved
  in one turn often can't be recalled in the next.
- **Ask.** A `searchable` status or a webhook on the job, or document the expected delay next to
  `remember`.
