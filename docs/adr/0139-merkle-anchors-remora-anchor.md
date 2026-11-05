# ADR-0139: Merkle anchors for Wakes that didn't pay, in a new testnet package `remora_anchor`

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
U19 B2 ([spec](../goals/uy-19-it-gets-better.md#b2-merkle-anchors-for-wakes-that-didnt-pay-g4)):
a paid Wake is onchain as `Paid.intent` (G2), but most of what a remora does doesn't pay: answers
without a purchase, refused or failed payments, config changes, memory writes. `remora verify` said
"not saved onchain yet" for all of them, so a reader had to trust our database.

Facts that shaped the design:
- The deployed `remora` package can't take a new entry without an upgrade, and ADR-0134 keeps it
  unchanged.
- The gas station (D8) sponsors only `remora`, `0x1` and `0x2` calls, and only executes payments
  (`settle`). Its pool takes sponsor coins of at least `min(SPONSOR_MAX_GAS_BUDGET, 0.02 SUI)`.
  An owned coin signed in two transactions at once can stay locked until the epoch ends.
- The facilitator runs in the same Railway container as the API (ADR-0099), so the API process has
  the sponsor key too.
- `@noble/hashes` is already a dependency of `@remora/schema` (the intent hash), and it runs in Node
  and in the browser.

## Decision
- **A new Move package, `remora_anchor`** (`packages/move/anchor`), published on testnet only
  (ADR-0024) with the spike key, like the capsule:
  - package `0x609c64732682851eed18f064c59e9e21967f2b10be483d2c37410047bf74d84b`;
  - publish `8e7xNd69jvuY42tYAnQW4ZenJZYYbRjtWtJqtiLe5a7T`, UpgradeCap
    `0xd25aa3e8f7094abf42ec88bb975f1055864254c2de56dad982cbe086908a6817` with the spike key;
  - in `DEPLOYMENTS.testnet.anchorPackageId` (mainnet null);
  - `anchor(root, count, from_ms, to_ms, clock)` checks a 32-byte root, `count > 0` and
    `from_ms <= to_ms`, and emits `Anchored { anchorer, root, count, from_ms, to_ms, at_ms }`. It
    stores nothing; the event is the record;
  - 6 Move tests (the event, a one-record batch, short and long roots, empty, backwards range);
  - `spikes/disc/anchor-publish.ts` publishes it, with a throwaway `SUI_CONFIG_DIR`.
- **The tree** (`packages/schema/src/merkle.ts`, shared by the server, the CLI and the web):
  - a leaf is `sha256(canonicalJson(x))`. A Wake's leaf hashes the Wake as `Wake` parses it, so the
    browser hashes the same JSON the server did;
  - a parent is `sha256(min(a, b) || max(a, b))` over the raw bytes, so a proof is just the
    siblings. An odd node at the end of a level moves up unchanged;
  - `merkleRoot`, `merkleProof`, `verifyMerkleProof`, `wakeLeaf`, and the `WakesAnchored` and
    `AnchorProof` shapes. No new dependency.
- **What's anchored** (`apps/server/src/runtime/anchors.ts`):
  - every Wake that isn't a settled payment (a payment with its digest is anchored by `Paid`);
  - `config_changed` events, hashed as `{kind, id, remora, at, payload}`;
  - memory writes that landed (`stored`, with a blob id), hashed as their ids and `text_sha256`,
    never their text;
  - oldest first, at most 256 per batch (a proof of at most 8 steps).
- **The batch:**
  - the remora's own key is the sender, so `Anchored.anchorer` is the address that signs its Wakes;
  - the gas station's sponsor key co-signs as gas owner (`Sponsor`, allowed package
    `remora_anchor` only, 0.005 SUI budget);
  - the gas comes only from sponsor coins under the pool's floor, so the facilitator and the
    anchors never sign the same coin. When there are none, the sponsor splits three coins of
    3/4 of the floor off its last big coin, to itself. Anchors run one at a time per process;
  - a `wakes.anchored` event keeps `{network, packageId, anchorer, root, digest, count, fromMs,
    toMs, leaves: [{kind, ref, leaf}]}`, and the Wakes in it get `receipts.anchored = true` (the
    meaning `WakeView.anchored` already gave it). No schema change.
- **When:**
  - an hourly jobs-queue run (`wakes.anchor_hourly`, queued idempotently per hour at start and by
    each run) anchors every live, non-playground remora with something new, at most 20 a run;
  - `POST /api/remoras/:id/anchor`, owner only, runs one batch now, at most once in 5 minutes;
  - the feed hides `wakes.anchored` rows: they are records for verify, not activity.
- **Verify** (`verify.ts`, `remora verify`, `/verify/:ref`):
  - "anchored in <digest>, proof of N steps";
  - the checks: the Wake's recomputed leaf reaches the root through the proof; the transaction,
    read over gRPC, has an `Anchored` event of our package with that root and count; its
    `anchorer` is the Wake's key (or the remora's current key after a rotation);
  - the web page repeats the proof and the event checks in the browser, over gRPC-web, against the
    package id in `DEPLOYMENTS`, not the API's word;
  - a Wake whose batch hasn't run says "not anchored yet".

## Consequences
- **Easier:** every Wake has an onchain anchor anyone can check. The auditor page (B1) can show a
  Wake's proof from `AnchorProof`.
- **Harder:**
  - the sponsor now pays for anchors as well as payments: about 0.001 SUI each, at most 20 an hour,
    plus a refill of 0.045 SUI now and then;
  - a refill takes one of the pool's coins as gas; it picks the last big coin, so a clash with a
    payment needs every other coin held at once;
  - two processes with the same sponsor key (a local server and production) can still pick the same
    small coin. Anchors are testnet only, and a clash fails one transaction;
  - any server with the worker on and the sponsor key set anchors its own database's records,
    local ones included.
- **Mainnet:** needs a mainnet publish, `anchorPackageId` and `SPONSOR_PRIVATE_KEY` (Uy's pass).
- **First live batch** (local database, testnet, Nov 5): 4 records of a Morning brief, refill
  `9DSWEjBudZTPNyLKo4kYxJ2DNb2PXttLbUtv1UTamaCr`, anchor
  `4ivsnZ7xbwnvhAqXtq89ufyAabCgV6Dr8FrUJhehu8ih`; `remora verify` passed all four checks.
- **Docs:** `remora-features.md` (G4), the README's "what's real", the U19 exit note.

## Links
- [Goal U19](../goals/uy-19-it-gets-better.md), [ADR-0134](0134-u19-it-gets-better-and-anyone-can-check.md).
- [ADR-0130](0130-memory-capsules-seal.md) (the capsule, published the same way),
  [ADR-0099](0099-first-deploy-one-railway-service.md), [ADR-0024](0024-testnet-first.md),
  [ADR-0021](0021-sui-grpc-only.md).
