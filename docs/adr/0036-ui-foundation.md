# ADR-0036: UI foundation — warm theme, page components, a quieter kit

- **Status:** Accepted; the visual design is superseded by ADR-0069 (openbot's UI)
- **Date:** 2026-10-19
- **Deciders:** Huấn

## Context
The web UI inherited hippo's tokens: a pure-white light theme, a near-black dark theme, two different
teals (`--primary` and `--brand`), palette colours written by hand (`amber-500`, `emerald-600`,
`#156BC1`), no semantic success/warning token, and up to six page widths chosen ad hoc by each page.
Cards carried a default shadow and a large vertical padding, so ordinary form groups looked like
objects. Buttons had three heights in the header alone. Nothing named the page in a single place, so
nine routes never set `document.title`.

`docs/ux/ui-polish-plan.md` §2 specifies the target: a warm neutral palette (Claude.ai-like), one
softened teal, a fixed type scale, a 4px spacing ladder, and one component per page concern. It also
specifies small kit edits (§4). This ADR records the decisions behind that work so future PRs can
point at it instead of re-deciding.

## Decision
- **Warm neutral tokens** in `apps/web/src/index.css`, exactly the values in plan §2.1, for `:root`
  and `.dark`. `--brand` is **removed**; its seven call sites move to `--primary`. `--success` and
  `--warning` (and their `-foreground`) are added and registered in `@theme inline`. The sidebar
  tokens join the same warm family (no more cold `hsl(240 …)` and no blue `--sidebar-ring`).
- **Type, spacing and radius** follow plan §2.2–§2.3. No `text-[Npx]`, no `text-xs` for a full
  sentence, no `shadow-sm` on `Card`. `--radius` stays `0.625rem`.
- **Kit edits (this is the "why" the plan asks to record):**
  - `ui/card.tsx`: drop `shadow-sm`, change `gap-6 py-6` to `gap-4 py-5`.
  - `ui/badge.tsx` and `ui/alert.tsx`: add `success` and `warning` variants.
  - `ui/button.tsx`: the API and sizes are unchanged; only the `destructive` variant is softened in
    dark mode. New sizes are not added — `icon-sm` already exists.
- **Page components** live in `components/app/`: `Page`, `PageHeader`, `Section`, `EmptyState`,
  `StatTile`, `StatusBadge`, `ConfirmAction`, `Time`, `BudgetMeter`. `Page` is the only place that
  decides a page's max width and padding (plan §2.5) and the only place that sets the tab title.
- **`StatusBadge`** is the single map from a status string to a badge variant; the string shown stays
  the raw status so the E2E checks ("active", "retired") keep passing.
- **Colours are tokens only.** No palette class and no hex outside `components/ui`.

## Consequences
- Every page migrates to `Page` + `PageHeader`; the old per-page wrapper `div` and its `max-w-*` go.
- `components/ui` carries two new badge/alert variants that the rest of the app composes.
- A future screen reuses these components rather than re-inventing a tile, a badge or a confirm.
- The `docs/ux/README.md` notes that described the old colours and the red header panic are stale and
  are updated in the same commit.

## Links
- `docs/ux/ui-polish-plan.md` §2, §4 · [ADR-0037](0037-network-dropdown.md) · `apps/web/src/index.css`,
  `apps/web/src/components/app/`
