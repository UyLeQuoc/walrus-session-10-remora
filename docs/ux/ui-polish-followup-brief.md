# Brief: UI/UX polish, follow-up pass (Phase 5)

The plan in `docs/ux/ui-polish-plan.md` is implemented (see `docs/ux/ui-polish-progress.md`). A review
of the audit screenshots and the code found the gaps below. Fix them in the working tree.

Read first: `AGENTS.md`, `docs/code-rules.md`, `docs/ux/ui-polish-plan.md` §2 (design rules) and §4
(component spec), `docs/ux/ui-polish-brief.md` ("Hard rules"). **Those hard rules still apply in full:**
edit only `apps/web/**` (not `features/lab/**`), `e2e/**`, `docs/ux/**`, `docs/e2e/**`; no git commit,
push, stash, reset or checkout; no new dependencies; no behaviour or API changes; tokens only; no raw
`<button>`; keep E2E selectors working (update the test in the same step if one must change).

## Items (in this order)

### P1: what a demo viewer notices

1. **Template radio cards have no inner padding** (`/remoras/new`, `features/remoras/new-remora-page.tsx`
   and/or `features/remoras/template-card.tsx`). The text touches the card's left edge and the radio dot
   floats in the top-right corner. Give the card the same padding as `Card`, and put the radio on the
   left of the title (or keep it on the right but vertically aligned with the title). The selected state
   stays the softened primary border/background.
2. **Remora cards repeat the budget** (`features/remoras/remora-card.tsx`, Home and `/remoras`). The
   subtitle says "sentinel · Read-only: no budget" and the body says "Read-only: no budget to spend."
   Show the template once, capitalised ("Sentinel", "Scout"), and the budget once: a `BudgetMeter` when
   readable, one quiet line otherwise. The whole card must look clickable: hover background, a
   focus ring, and a trailing chevron, using the existing link/`Card` patterns.
3. **"Budget not readable just now" during normal use.** Home and `/remoras` each read every remora's
   budget and hit the per-owner 429. Find where the budget is fetched (`features/remoras/budget.ts`,
   hooks) and share one query per remora across the pages (same React Query key, sensible `staleTime`,
   no retry storm on 429), so that opening Home and then `/remoras` does not refetch everything. Do not
   change `lib/api.ts`.
4. **Activity feed is a stack of bordered cards** (`features/remoras/feed-list.tsx`). Render it as one
   bordered list with dividers (one container, rows inside), like the plan's §5.4 wireframe. A `ping` is
   not an error: use the `warning` badge for `ping` and keep `destructive` only for `blocked`. Badge
   labels are capitalised ("Ping", "Ignored", "Action").
5. **Home "Your remoras" header**: the "See all" ghost button sits lower than the heading and its text
   is not aligned with the cards' right edge. Use `Section`'s action slot (or add one in
   `components/app/page.tsx` if missing) so heading and action share a baseline, and use
   `variant="link"` or a ghost button with `-mr` to align the text edge.

### P2: consistency

6. **Funds spacing** (`features/funds/funds-page.tsx`): there is a large empty gap between the stat
   tiles and "Budgets". Use the same `Section` gap as every other page. The "In coins" tile shows a
   success-coloured border when there is nothing to move. Keep the tile neutral and leave only the
   "✓ Nothing to move" line in the success colour.
7. **Memory table** (`features/memory-inspector/memory-page.tsx`, `memories-table.tsx`): the copy
   button is a large outlined square on every row. Use the shared `Hash`/`CopyButton` in its ghost icon
   size inline after the blob id, truncate the id in the middle (`Hash`), and make the namespace chips
   (`me · 0`, `rules · 1`, …) real filters (toggle a namespace filter, `aria-pressed`) if the data is
   already on the client. If filtering needs an API change, show them as plain counts, not chip-buttons.
8. **Page title position jumps between pages.** `Page` centres three widths (narrow/default/wide), so
   the `h1` moves left and right as you navigate. Keep the widths, but left-align the content column to
   one shared left edge: `default` and `narrow` pages start where `wide` pages start, OR make every
   list/dashboard page `default` and use `wide` only for the Memory table. Pick the smaller change and
   write which one in the progress log.
9. **Settings quiet hours**: two empty `--:--` time inputs read as broken. Add an explicit "Quiet hours"
   `Switch` (off = inputs hidden or disabled with "Off"); on = the two times with defaults 22:00–07:00.
   Saving still sends the same payload as today (empty when off). Check how the current form serialises
   before changing it.
10. **Chat composer toolbar**: the ⓘ and the memory panel icon buttons need visible tooltips (they have
    `aria-label`; check they also have `Tooltip`) and the panel button needs a pressed state when the
    panel is open (`aria-pressed`, `bg-accent`).

### P3: coverage and evidence

11. **Audit misses pages**: `e2e/tests/audit.spec.ts` does not capture `/remoras/:id` (Overview,
    Activity, Settings tabs), `/connect`, the 404 page, or the signed-out Home. Add them (light +
    dark), using an existing remora id from the API the test already signs in to.
12. **Screenshots in `docs/e2e/screenshots/` are stale** (taken before the checklist and sidebar fixes).
    After the fixes above, re-run `smoke`, `mobile` and `AUDIT=1 … --project=audit` and copy the new set
    in; update the table in `docs/e2e/README.md` if new files appear.

## Checks

After P1, P2 and P3 each:
1. `bun run typecheck && bun run lint && bun run test` from the repo root (use `bun run format` for
   formatting). Fix until green.
2. `bun run --filter @remora/e2e e2e -- --project=smoke --project=mobile`. Fix until green.
3. Append a "Phase 5" section to `docs/ux/ui-polish-progress.md`: items done (by number), files
   changed, pass counts, anything skipped and why, open issues.

At the end, also run `--project=testnet` once. Do not run `w2` (the burner is low on SUI gas; see the
progress log).

Stop when all 12 items are done and checks are green, or when something is truly blocked (write exactly
why in the progress log).
