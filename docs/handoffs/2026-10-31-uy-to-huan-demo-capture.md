# Landed: an opt-in `demo` project in e2e (the demo video's capture)

- **Date:** 2026-10-31
- **From:** Uy's agent ([ADR-0091](../adr/0091-real-app-demo-video.md))
- **To:** Huấn
- **Status:** on `main`. Uy asked for a demo video of the real app. The e2e edits are follow-ups
  under [ADR-0087](../adr/0087-uy-merges-additive-contract-prs.md). You had no open branch or PR on
  these files.

## What changed in `e2e/`
- **`playwright.config.ts`** gains a `demo` project. It runs only with `DEMO=1`, like `audit` with
  `AUDIT=1`, so the default run is unchanged.
- **`tests/demo.spec.ts`** is new. It records the real app shot by shot:
  - CDP screencast frames;
  - a manifest of cursor moves, clicks and marks.

  It writes to `docs/launch/demo/capture/`, which is gitignored. `DEMO_SHOTS=a,b` re-records only those
  shots.
- **What it spends:** a playground session, and one Scout answer on a fresh Scout. That is a few cents
  of testnet USDC from the burner.

## What it found in the app
- **The cost card lags.** A new Scout paid 0.01 USDC from its Disc, and the budget meter showed 0.49 of
  0.50 right away. The cost card still read "No spend this month". It's worth a look when the cost
  card's data is wired for U9.
- **The teach box's selector.** `getByLabel("Rule")` matches both the input and the "Rules" list. Use
  `{ exact: true }`, as `w2.spec.ts` already does.
