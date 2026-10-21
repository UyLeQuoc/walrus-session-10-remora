# ADR-0046: The Hatchery shares team files; shapes for safety, Proof of Learning and memory controls

- **Status:** Accepted
- **Date:** 2026-10-21
- **Deciders:** Uy (agent, goal U7)

## Context
ADR-0012 planned templates as `remora.yaml` (`remora.template/v1`) stored on Walrus. Since then, U6 (ADR-0042) shipped `remora.team/v1` files. They hold one or more remoras with persona, model, budget, rules and schedules, and already have export, preview and one-signature import, without keys, memories, ids or watched addresses.

`Template` (`remora.template/v1`) is also used today, but for something else: it's the catalog of built-in kinds (Scout, Sentinel) that the wizard and team files pick by slug.

Goal U7 also needs contract shapes for:
- the safety review (M7) and the share and hatch screens (M1, M5);
- gallery listings (M4);
- Proof of Learning (G5) and learning charts (L1);
- memory controls (F4, F5, F8);
- the Hatchery's own Move package (M6, ADR-0047).

## Decision
- **The Hatchery shares `remora.team/v1` files.** A single remora is a team of one. Export, import, share and hatch use one format and one parser. The file is stored as a Walrus blob, and its `remora_hatchery` `Template` object records the blob id.
- **`Template` stays as the catalog of built-in kinds** (C1/C2) and is never shared. Its doc comment now says so.
- **The safety review (`SafetyReport`)** has a verdict of `pass`, `warn` or `block`, with findings by code:
  - codes: `injection`, `exfiltration`, `raw_address`, `unknown_payee`, `unknown_template`, `secret`, `model_flag`;
  - deterministic checks (scrubber, patterns, Reef) can block;
  - a model check can only add a warning (models only tighten);
  - the same review runs before publishing and again before hatching.
- **`ShareReview`** carries:
  - the exact Markdown that will be stored;
  - each remora's `TemplatePermissions` (tools, triggers, Reef payees, suggested budget, model);
  - what was removed and why;
  - the safety report.
- **`HatcheryListing`** is built from the hatchery events and the blob:
  - template object id, blob id, author, parent, forks, deprecated, verdict, publish digest;
  - opt-in `stats` from hatched remoras' Wakes.
- **`HatchConsent`** carries the permissions, the payees resolved against the network's Reef, the safety report, `startsInShadow: true` (a literal) and at most one signature.
- **`ProofOfLearning`** holds two `DecisionRef`s from Wakes, the memory delta (blobs the later Wake used that the earlier one lacked, with text when this server knows it), and the outcome change.
- **`LearningSeries`** is one metric per chart, with a point per UTC day, its `n`, and the source in words. The metrics are `noise_rate`, `cost_per_useful` and `memory_hit_rate`.
- **Memory controls:**
  - inspector rows gain `type`, `hiddenAt`, `supersededBy` and `expiresSoon` (under 30 days), each defaulted so older payloads still parse;
  - `MemoryRow` gains `supersededBy`;
  - `RemoraMemoryExport` (`remora.memory-export/v1`) is the F8 file. It holds metadata always, text when recall returns it, `verified` when the text hashes to what was written, and plain notes on what the file can't do.
- **`Deployment` gains `hatcheryPackageId`**, beside the existing `hatcheryRegistryId`.

## Consequences
- U7 Phase A builds share, publish and hatch on U6's `exportTeam`, `previewTeam` and `applyTeam`.
- ADR-0012's invariants still hold: no memories, keys or raw payee addresses; a consent screen; a scan before publish and hatch; shadow mode on hatch; Disc limits.
- `remora-spec.md` §12.11 now points here for the format.

## Links
- ADR-0012 (Hatchery safety), ADR-0042 (team files), ADR-0047 (the hatchery Move package)
- `packages/schema/src/{hatchery,learning,memory,api,deployments}.ts`; fixtures `hatchery.*`, `proof-of-learning.json`, `learning-series.json`, `memory-export.remora.json`
