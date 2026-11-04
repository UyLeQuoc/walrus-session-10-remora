# ADR-0133: Local e2e runs revoke only their own remoras' Discs; a live public-page buy checks the deploy

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 D, [ADR-0119](0119-u18-learning-loop-everyday-money.md))

## Context
- **One burner, two databases:** the e2e burner owns remoras in the local database and on
  production. Each remora has its own Disc on Sui testnet, named `remora-<first 8 of its id>`. The
  chain can't tell a local remora's Disc from a production one.
- **The bug:** to keep the Disc panel small, the e2e global setup revoked every `remora-*` Disc the
  burner owned. Run logs since Nov 4 show six revokes of Discs whose remoras aren't in the local
  database:
  - five in the U17 video capture (Nov 5, 00:41 Vietnam time): `remora-6ded9ad0`, `c840e2ea`,
    `359b29a7`, `8fbdfa90` and `1292eae3`;
  - one in the U14 review capture (Nov 4): `remora-6e8933ca`.

  Five is the count of production's U17 network remoras: `@uy-researcher` and the four in the
  Research crew. Their spending limits were most likely revoked by a local run.
- **The deploy checks:** U18's deploy step asks for one answer bought on a live public page. That
  needs a remora on sale with a working Disc.

## Decision
- **The global setup:**
  - revokes a leftover `remora-*` Disc only when the local database (`DATABASE_URL`) has a remora
    with that Disc id;
  - any other Disc is left alone, and so is everything when `E2E_KEEP_DISCS=1`;
  - it reads the database through `@remora/db`, a workspace package that is new to `e2e`. No
    third-party dependency is added.
- **The live check** (`U18_LIVE=1`, project `u18live`, with `E2E_BASE_URL`):
  1. The burner signs in on the deployment.
  2. If `@uy-researcher`'s Disc is still on Sui, it is the seller. Otherwise a new Researcher goes
     on sale as `U18_LIVE_SLUG` (default `ask-researcher`).
  3. burner2, signed out, opens `/r/<slug>`, connects its wallet and pays for one answer.
  4. The payment is read back from Sui: the seller's owner got the price.
  5. The run writes `exit-results/u18-live.json`.

## Consequences
- Local runs can no longer break production remoras that belong to the same test wallet.
- The local database must be reachable for the global setup to revoke anything. Without
  `DATABASE_URL`, nothing is revoked and the Disc panel grows. That's harmless.
- **For Uy:** production remoras whose Discs were revoked still show as active, but they can't pay.
  Retire them and create new ones, or take a new seller from the live check.
