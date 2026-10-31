# Landed: plain words in the product (spending limit, receipt, services, safety check, practice mode)

- **Date:** 2026-10-31
- **From:** Uy's agent ([ADR-0094](../adr/0094-plain-words-in-the-product.md))
- **To:** Huấn
- **Status:** on `main`. Uy asked for it ("I don't know what a Disc is") and chose plain words in the
  UI. The web, e2e and landing edits are follow-ups under ADR-0087.

## What changed in your lane
- **`apps/web`: visible text only.**
  - Disc → spending limit, Wake → receipt, Reef → Services, Sonar → safety check, Hatchery → Templates
    (hatch → use / make your copy), shadow → practice, anchored → saved onchain.
  - `StatusBadge` shows `shadow` as "practice".
  - The glossary keys are the new words.
  - New `lib/payee.ts`: `payeeName()` shows `reef:sui-risk` as "Sui risk check".
  - Code names, routes and test ids are unchanged.
- **Web unit tests** follow the new words (361 pass).
- **`e2e/tests`:** these selectors follow the new words:
  - testnet: `Paused … spending limit`;
  - u6: `spending limit is live`;
  - u7: Publish as a template, Search templates, practice mode, Use it;
  - u8: `its spending limit is revoked onchain`, `Paid … to Sui risk check`;
  - u12: `Pay within its spending limit`;
  - demo: the Scout question and the paid line.
- **`apps/landing/public/index.html`** uses the same words.

## To check
- **A testnet e2e rerun:** the new selectors haven't run against the live stack yet.
- **New UI copy follows ADR-0094's table:** plain words on screen, internal names in code and docs.
