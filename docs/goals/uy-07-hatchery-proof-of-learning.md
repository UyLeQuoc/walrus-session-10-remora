# Goal U7: the Hatchery on Walrus, Proof of Learning, and memory you control

- **Owner:** Uy's agent
- **Runs in:** the main checkout, on `main` (ADR-0022)
- **Depends on:** U6 (team files, one-signature apply, export)
- **Network:**
  - money and the Move module on testnet ([ADR-0024](../adr/0024-testnet-first.md));
  - memory on the mainnet relayer ([ADR-0026](../adr/0026-network-switch.md));
  - template blobs on Walrus testnet (publisher + aggregator). Mainnet comes in the mainnet pass.
- **Features (all in the MVP ship set, `docs/remora-features.md` §0):**
  - Hatchery core: M1 share, M3 publish to Walrus, M4 gallery, M5 one-click hatch, M6 onchain provenance, M7 template safety;
  - Wake: G5 Proof of Learning;
  - Launch: L1 learning charts;
  - Memory: F4 hide/correct/forget, F5 expiry, F8 export, F9 Claude Code portability.

**Goal:** this is the "Total Recall" story. A remora remembers, proves what it learned, and lets its owner see, correct and take its memory away. It can also be shared as a Walrus blob that anyone can hatch into their own account, with authorship and forks recorded onchain.

> **U7 exit (testnet, Playwright, the burner plus a fresh second test account):**
> 1. **Share and publish.** The burner shares a Scout.
>    - The review screen lists exactly what is shared: no memories, keys, ids, Wakes or raw addresses.
>    - The scrubber and the safety scan pass.
>    - Publishing stores the template on Walrus (blob id) and records `remora::hatchery` `Published` with **one signature**.
> 2. **Gallery.** The template shows its author, tools, triggers, Reef payees, suggested budget and fork count.
> 3. **Hatch.** A fresh test account opens the share link.
>    - It sees a consent screen: permissions, Reef payees and *its own* budget.
>    - It hatches with **one signature**: a remora in shadow mode plus a `Forked` event that names the parent. The fork count goes to 1.
>    - A poisoned template (an injected persona, or a raw payee address) is refused at publish and again at hatch.
> 4. **Proof of Learning.** Sentinel pings on an incoming transfer. The owner marks it 👎 noise, and Sentinel learns a rule. A transfer of the same shape is then ignored.
>    - The Proof view shows both decisions side by side, with the memory delta that changed the outcome: the rule's blob, from the Wakes' `memories`.
>    - Both Wakes verify.
> 5. **Learning charts** come from this run's real Wakes and feedback: noise rate, cost per useful answer, and answers from memory against answers that bought data. No made-up data.
> 6. **Memory controls:**
>    - hiding a memory takes it out of recall;
>    - a correction supersedes the old fact;
>    - expiry shows (about 210 days, with an alert under 30);
>    - the Markdown + JSON export holds the remora's memories;
>    - Claude Code, through `packages/mcp`, recalls a remora memory with the namespace mapping.

## Before you start
- Read:
  - `docs/remora-features.md` §2 M, G, F, L;
  - `docs/remora-spec.md` (Hatchery, Wake, memory);
  - `docs/tech-reference.md` §1.11 (MemWal differs from its docs; there's no per-memory delete);
  - ADR-0012 (templates never carry memories, keys or raw payees), ADR-0025 (the Disc design and its `UpgradeCap`), ADR-0042 (team files);
  - `apps/server/src/hatchery/README.md`, `packages/schema/src/template.ts` (stub) and `packages/schema/src/team.ts`.
- Check Huấn's state: his branches, open PRs, `docs/handoffs/` and recent commits on his paths. The UI items below follow the U6 pattern:
  - claim only what he hasn't started, with a note in `docs/handoffs/` (ADR-0027);
  - for anything else, hand him the APIs.

## Contract PR (one, first)
Each shape comes with a fixture:
- **The template format, decided in ADR-0046.** The proposal is that `remora.team/v1` (U6) *is* the Hatchery template: one remora is a team of one, and the `Template` stub retires. One format then covers export, import, share and hatch. If you keep `remora.template/v1` instead, the ADR says why.
- `HatcheryListing`: blob id, template object id, author, version, parent, forks, safety verdict, `publishedAt`.
- `ShareReview` (what is shared and what was removed), `SafetyReport` (findings, verdict), `HatchConsent` (permissions, payees, budget).
- `ProofOfLearning`: two decisions, the memory delta, the outcome change, and verify links.
- `LearningSeries`: a metric, its points and its source.
- Memory items gain `hiddenAt`, `supersededBy` and `expiresAt` where the inspector shapes lack them. Add the export format.

## Move PR: `remora::hatchery` (M6)
- `Template { author, blob_id, version, parent }`, plus `Published`, `Forked` and `Deprecated` events.
- Versions are immutable. Only the author can deprecate. Every entry point checks `version` (I6, like the Disc).
- Decide in an ADR whether this is a new package or an upgrade of the Disc package (the spike key holds the testnet `UpgradeCap`, ADR-0025).
- Publish it on testnet, and put the address in `DEPLOYMENTS`.
- `sui move test` covers publish, fork lineage, deprecate by a non-author (aborts) and version checks.

## Phase A: backend (each with tests)
1. **Share (M1).**
   - It exports one remora through U6's `exportTeam` path, then runs the scrubber.
   - It returns a `ShareReview` that lists every field shared and everything removed.
2. **Safety (M7).** The same check runs before publish and before hatch:
   - Sonar scans the persona and prompts for injection and exfiltration patterns;
   - every payee must resolve to a Reef entry, and an unknown address blocks it.
3. **Publish (M3).**
   - The template goes to the Walrus testnet publisher, which returns a blob id.
   - An owner transaction calls `hatchery::publish`; the owner signs once, and the server confirms by digest.
   - The share link is `/hatchery/<id>`, plus the Telegram deep link `t.me/<bot>?start=tpl_<id>`.
4. **Gallery (M4).**
   - Listings are indexed from `Published`, `Forked` and `Deprecated`, read from `SubscribeCheckpoints` (gRPC only; there's no event query API).
   - Search and category filters work.
   - Each template page shows the fork count and, opt-in, outcome stats from Wakes.
5. **Hatch (M5).**
   - Fetch the blob from the aggregator and run the safety check again.
   - Return `HatchConsent`.
   - Apply through U6's `applyTeam`: one owner PTB that issues the Disc *and* calls `hatchery::fork` (the parent is recorded).
   - The hatched remora starts in shadow mode.
6. **Proof of Learning (G5).**
   - Find decision pairs: same remora, same trigger kind, a different outcome, and a later Wake whose `memories` hold blobs the earlier one lacked.
   - Routes: `GET /api/remoras/:id/proofs` and `GET /api/proofs/:a/:b`, both linking to `/verify`.
7. **Learning metrics (L1).**
   - From Wakes and feedback: Sentinel's noise rate per day, Scout's cost per useful answer, and the memory-hit rate.
   - An API for the charts, and a script that writes the series to JSON for the blog post.
8. **Memory controls (F4, F5, F8, F9),** for remora namespaces:
   - **Hide:** a local `hidden_at`, honored by recall and dedupe.
   - **Correct:** a `[correction]` that supersedes the old fact.
   - **Forget all:** it clears the index only, and the UI says plainly that blobs persist until they expire.
   - **Expiry:** `expires_at`, with an alert under 30 days.
   - **Export:** Markdown + JSON.
   - **MCP mapping:** `packages/mcp` reads `remora:<id>:<ns>` namespaces.

## Phase B: UI (claim per "Before you start")
- **Share flow:** the review screen, then the safety report, then Publish (one signature).
- **`/hatchery`:** the gallery.
- **`/hatchery/:id`:**
  - the template page, with Hatch → the consent screen → one signature;
  - Deprecate, for the author.
- **Proof of Learning:**
  - "What changed?" from Why? on a decision that has a pair;
  - a proofs list on the remora page.
- **Learning charts** on the remora page.
- **Memory inspector:** hide, correct and forget all; expiry badges and the under-30-days alert; an export button.

## Phase C: the U7 exit e2e (testnet)
- `e2e/tests/u7.spec.ts` covers the exit list above. The second account is a fresh test keypair made in the test and funded with a little testnet SUI for gas from the burner. Hatched remoras start in shadow mode, so it needs no USDC.
- Record timings, blob ids and digests in `docs/spikes/2026-10-xx-u7-exit.md`.
- Write a handoff to Huấn (what landed).

## Done when
- [ ] The contract PR and the Move PR are merged; `remora::hatchery` is published on testnet.
- [ ] A + B are done with tests.
- [ ] `typecheck`, `lint`, `test`, `sui move test` and `bun run e2e` are green; CI is green.
- [ ] The U7 exit passes on testnet, with timings, blob ids and digests.
- [ ] The ADRs, docs and a handoff to Huấn are written; everything is pushed to `main`.

## Never
- Mainnet money, or a mainnet publish (that's the mainnet pass, which Uy calls).
- Real owner accounts in tests: the burner, test keys and fresh test keypairs only.
- Committing `.env` or keys, or printing key values.
- Deploying, force-pushing, or killing processes on ports 8787/5173.
- Editing `reference/`, or rewriting an accepted ADR.
- Editing anything Huấn has started.
