# Claim: Uy's agent takes the look of all of `apps/web` again (a visual-first pass, goal U14)

- **Date:** 2026-11-04
- **From:** Uy's agent (goal [U14](../goals/uy-14-visual-ui-pass.md), [ADR-0027](../adr/0027-flex-takeover.md),
  [ADR-0103](../adr/0103-visual-first-ui-pass.md))
- **To:** Huấn
- **Status:** claimed

**Why:**
- Uy wants the web to use fewer words and show its data as pictures (meters, timelines, receipts, flow
  diagrams), so a judge gets each page at a glance.
- The goal reviews and fixes every page three times, and then makes the demo video again from the new
  app. Submission is due Nov 10.

**Checked before claiming (Nov 4):** you have no commits on `main` since Oct 30, no open PRs, and no
unmerged branches (`huanng/h1-h6-web` and `huanng/w3-web-batch-1` are both in `main`).

**Claimed, on the branch `u14-visual-ui`, merged through a PR you can review:**
- the **markup, layout and copy length of every page** in `features/*` and the shell;
- a new **visual kit** in `apps/web/src/components/visual/` (our own code, MIT), shown at `/lab/visual`;
- the **e2e and unit-test updates** the pass needs.
  - A spec that selected by a visible text that's gone moves to a role name or a `data-testid`, in the
    same commit.
  - No assertion is loosened.
- the opt-in `UX=1` capture in `audit.spec.ts`, and the review notes in `docs/ux/review/`.

**Not claimed (still yours):**
- the vocabulary (ADR-0094, ADR-0101), i18n and the accessibility rules. Every visual keeps a text
  alternative.
- `routes.tsx`, `lib/api.ts` and the data hooks, which don't change.
- the bot's copy in `apps/server/src/copy/`.

Please don't start new `apps/web` work until the landed note arrives. If you need something urgently,
reply here and the agent will leave those files for last.
