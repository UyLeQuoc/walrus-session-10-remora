# Landed: the visual-first pass over `apps/web` (goal U14)

- **Date:** 2026-11-04
- **From:** Uy's agent (goal [U14](../goals/uy-14-visual-ui-pass.md), [ADR-0103](../adr/0103-visual-first-ui-pass.md),
  [ADR-0104](../adr/0104-visual-first-result.md))
- **To:** Huấn
- **Status:** landed on the branch `u14-visual-ui`, merged through a PR you can review.
  The claim ([note](2026-11-04-uy-to-huan-u14-claim.md)) is released.

**What changed, in one line:** each page says what it's for in one line, shows its numbers as
pictures, and keeps its explanations behind a `?`. Four fresh reviewers judged every page in four
rounds. Their notes and the triage are in [`docs/ux/review/`](../ux/review/README.md).

**The kit you can build on:** `apps/web/src/components/visual/`. It's our own code, MIT, outside the
PolyForm folder.
- **The pieces:** `Stat`/`StatRow`, `Meter`/`Ring`, `Flow`, `Steps`, `Timeline`, `Receipt`,
  `Checks`, `ExpiryBar`, `Spark`, `StatusDot`, `Empty`, `Problem` and `Hint`, plus `Amount`,
  `Address` and `Digest`.
- **Where to look:** `/lab/visual` shows every piece, and [docs/ux/README.md](../ux/README.md) has
  the rules.
- **`hint`:** `PageHeader` and `Section` take one, a `?` beside the heading.

**Selectors that moved, each in the same commit with its reason:**
- **`testnet.spec`:** the balance is "19.78 USDC" now, so `ready` is read as a number and checked for
  "USDC", not "$".
- **`demo.spec`:** the `paid` box is `getByTestId("playground-paid")`, the receipt card. The mark keeps
  its name.
- **`u6.spec`:** a room's route reads "you named it" and "best fit", not "named" and "matched".
- **Unit tests:** they now assert behaviour where the copy moved into hints. The "What's a remora?"
  sentence is checked by opening its hint.

**The capture you can rerun** before a review:
- `UX=1 UX_ROUND=N bun run --filter @remora/e2e e2e -- --project=ux-desktop --project=ux-phone`.
- It shoots every route and state into `docs/ux/review/r<N>/`, which is gitignored.
- It counts the interface words, and `docs/ux/review/sheet.py N` makes contact sheets.

**Yours to judge:** the vocabulary (ADR-0094, ADR-0101 are unchanged), i18n, and anything in the
review notes marked as moved or declined that you'd rather do differently.
