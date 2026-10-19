# UI/UX polish — progress log

Plan: `docs/ux/ui-polish-plan.md`. Brief: `docs/ux/ui-polish-brief.md`. Working tree only — nothing
committed or pushed. Checks after each phase: `typecheck`, `lint`, `test`, then
`bun run --filter @remora/e2e e2e -- --project=smoke --project=mobile`.

## Phase 0 — decisions and preparation (no UI change)

**Owner decisions used (brief §"Decisions already made"):** Q1 Home at `/` + chat at `/chat`;
Q2 keep teal (softened); Q3 keep Pause all in the header as a small ghost icon + confirm; Q4 hide Guide
from nav in Phase 2, rewrite in Phase 3; Q5 merge `/memory` + `/me`, `/me` → `/memory?tab=chat`;
Q6 no serif; Q7 Remora chat examples; Q8 one panic mechanism; Q9 no "before" screenshots committed.

**Q8 finding (required to be written down):** read the server route behind `api.panic`
(`apps/server/src/runtime/routes.ts` → `service.panicTx` / `confirmPanic` in
`apps/server/src/runtime/remoras.ts`). `panicTx` selects the owner's **remora rows** and builds one
`buildPause` over `r.discId` for remoras that are not retired. `confirmPanic` walks the same remora
rows and marks them paused. **It does NOT pause a Disc that is not attached to a remora** — e.g. the
`e2e-burner` Disc the E2E global setup issues directly, and any Disc issued outside Remora. So per the
brief, `usePanic()` must do **both**: the server fan-out for remoras (`api.panic` + `api.panicConfirm`)
AND a client `buildPause` over any remaining live Discs from `useOwnerDiscs` that the remora set
doesn't cover. The two are the same pause PTB shape, so the sign flow is shared.

**Done:**
- ADR-0036 "UI foundation", ADR-0037 "Network dropdown", ADR-0038 "Home/dashboard/chat route" written;
  three rows added to `docs/adr/README.md`.
- `docs/ux/README.md` rewritten to the new UI (no loud TESTNET badge, no red header panic, Home/chat
  split, Memory tabs, single teal).
- Handoff `docs/handoffs/2026-10-19-huan-to-uy-hippo-auth-strings.md` written (sign-in message,
  cookie/header names, CORS list, download filename).
- `docs/ux/ui-polish-progress.md` (this file) created.
- Q9: no "before" screenshots captured or committed.

**Needs contract PR:** `apps/web/src/app/routes.tsx` — add `/chat`, make `/` HomePage, add
`/me` → `<Navigate to="/memory?tab=chat">`, and change the shell's `requestNewChat`/`requestOpenChat`
to navigate to `/chat`. `apps/web/src/lib/api.ts` is untouched.

**Checks:** baseline (pre-change) `typecheck` 20/20, `lint` clean (559 files), `test` 190 passed.

**Open issues:** none.

## Phase 1 — UI foundation (A1–A9, E3, E4)

**Files changed:**
- `apps/web/src/index.css` — the §2.1 warm-neutral token set for light and dark; new `--success`,
  `--warning` (+ foregrounds); `--brand` deleted (folded into `--primary`); sidebar tokens moved to
  the same warm family; `--radius` kept; `font-greeting` removed.
- `apps/web/index.html` — `theme-color` `#FAF9F6` / `#262624`; the anti-flash script understands
  `remora.theme = "system"`.
- `apps/web/src/components/ui/card.tsx` — no `shadow-sm`, `gap-4 py-5`.
- `apps/web/src/components/ui/badge.tsx`, `alert.tsx` — `success` / `warning` variants.
- `apps/web/src/components/ui/button.tsx` — dark `destructive` no longer dims itself (`dark:bg-destructive/60`).
- **New `apps/web/src/components/app/`**: `page.tsx` (`Page`, `PageHeader`, `Section`), `empty-state.tsx`,
  `stat-tile.tsx`, `status-badge.tsx`, `time.tsx`, `confirm-action.tsx`, `budget-meter.tsx`,
  `app.test.tsx`.
- A2/E3 sweep: `memory-page`, `verify-page`, `network-switch`, `funds-page`, `copy-button`, `chat-turn`,
  `composer-shell`, `slash-menu-panel`, `guide-visuals`, `how-strip`, `remembered-list`, `stat-strip`,
  `memories-table`, `me-page`, `channel-links` now use tokens.
- Tests touched: `copy-button.test.tsx` (green → success), `pages.test.tsx` (hex → `text-primary`).

**Plan IDs done:** A1, A2 (source clean; pages are re-laid-out per page in Phase 3), A8 (component only
in this phase), E3, E4 (component only), plus the shared `Page`/`PageHeader`/`Section`/`EmptyState`/
`StatTile`/`StatusBadge`/`ConfirmAction`/`Time`/`BudgetMeter` kit from §4.

**Checks:** `typecheck` 20/20; `lint` clean (569 files); `test` 198 passed (38 files, +8 from Phase 0);
E2E smoke + mobile **20 passed** (24.6 s).

**Skipped / deferred:** A3–A9 are layout/typography changes and land on each page in Phase 3; the
component kit and colour cleanup are in place now. `index.css` no longer defines `font-greeting`; the
chat greeting stops using it in Phase 3.

**Needs contract PR:** none in this phase.

**Open issues:** none.

## Phase 2 — Compact shell (B1–B9, E1, D10)

**Files changed:**
- `components/app/network-select.tsx` (new) and `features/network/network-switch.tsx` — one 32px
  `NetworkSelect` (dot + name + chevron; Mainnet disabled with “Not published yet” under it); the
  warning is an `Alert variant="warning"` rendered inside the signed-in page shell.
- `features/funds/use-panic.ts` (new) + `panic-button.tsx` — one panic mechanism: `api.panic` +
  `api.panicConfirm` for remoras, then `buildPause` for live Discs the server did not cover; quiet
  ghost icon, tooltip, always visible when signed in, confirm dialog with counts.
- `components/app/account-menu.tsx`, `components/app/theme-choice.tsx` (new) — account menu with
  address, Settings, Theme (Light/Dark/System), Verify, guide, channels, Sign out; signed-out form
  is a `Sign in` button plus a `⋯` menu; `ThemeSync` applies the stored/system theme on load.
- `components/app/setup-checklist.tsx` (new) — `full` and `compact` variants; required steps tick
  from live state; compact has ✕ and `remora.setup-dismissed`.
- `app/app-sidebar.tsx` — Home · Approvals (count) · Funds · Memory, Recents, compact checklist,
  `AccountMenu`; Get started/Verify/Settings/Guide/channel card removed from the nav.
- `app/app-layout.tsx` — header is ☰ · (mobile page name) · network · pause; New chat/Recents go to
  `/chat`; `ThemeToggle` and the full-width warning removed.
- `features/remoras/hooks.tsx` — `RequireOwner` gains `needsWallet` and `width`; quiet reconnect
  banner with `Reconnect`; skeleton instead of “Loading…”.
- `lib/storage.ts` (new) + `lib/storage.test.ts`; `active-chat.ts`, `use-memory-panel.ts`,
  `features/chat/pending-ask.ts` (new) — `hippo.*` keys migrate to `remora.*`.
- `features/chat/examples.tsx` — Remora examples and `Button` rows (Q7).
- Display strings: chat, connect flow, connect page, streaming label, remembered list.
- E2E: `smoke.spec.ts` (network menu, /verify locator), `support/test-wallet.ts` (Sign in/Connect),
  `w2.spec.ts` (Reconnect), `testnet.spec.ts` (confirm step + new toast).

**Plan IDs done:** B1, B2, B3, B4, B5, B6, B8, B9, E1, D10 (display + storage; guide copy is
rewritten in Phase 3 per Q4), plus Q3/Q8 decisions.

**Checks:** `typecheck` 20/20; `lint` clean (581 files); `test` 219 passed (43 files);
E2E smoke + mobile **20 passed**; E2E **testnet 1 passed** (25.4 s, including the new confirm and
the client pause of the burner's non-remora Disc).

**Skipped / deferred:** B7 (document titles) and the remaining old page wrappers land with each page
in Phase 3; `/` is still ChatPage until Phase 3.1 and `/chat` already works.

**Needs contract PR:** `apps/web/src/app/routes.tsx` — `/chat` added in this phase; `/` → Home and
`/me` → `/memory?tab=chat` land in Phase 3.1/3.7.

**Open issues:** none. Note for the demo: Pause all now needs a confirm click.

## Phase 3 — Every page (items 1–12)

**Files added/changed (all under `apps/web/**`, `e2e/**`, `docs/ux/**`):**
- **Home / onboarding** — `features/home/home-page.tsx` (new), `components/app/setup-checklist.tsx`,
  `features/onboarding/onboarding-page.tsx`; `features/remoras/remora-card.tsx`, `template-card.tsx`,
  `budget.ts` (new). C1/C2.
- **Remoras** — `features/remoras/remoras-page.tsx` (PageHeader, approvals Alert, one empty block,
  card grid, Activity section). D1.
- **Create wizard** — `features/remoras/new-remora-page.tsx` (template `RadioGroup`, `Field`s, payee
  chips, signature summary, right-aligned primary). D2.
- **Remora page** — `features/remoras/remora-page.tsx` (header + ⋯ menu, `?tab=` Overview/Activity/
  Settings, `BudgetMeter`, Keys with `Hash`, Danger zone with `ConfirmAction`). D3.
- **Funds** — `features/funds/funds-page.tsx`, `disc-panel.tsx` (StatTiles, no disabled primary,
  Disc rows with Progress + StatusBadge, Advanced collapsible, shared `RequireOwner`). D4.
- **Approvals** — `features/approvals/approvals-page.tsx` (Waiting/Decided Tabs, big amount,
  PaidCard with Hash, EmptyState). D5.
- **Memory** — `features/memory-inspector/memory-page.tsx` (Remoras/Chat Tabs, chips, warning Alert,
  desktop table + phone cards), `features/me/me-page.tsx` (`ChatMemory`, Remora copy, sections). D6.
- **Settings** — `features/settings/settings-page.tsx` (Sections, timezone `Combobox`, quiet hours,
  language `Select`, “How loud” `RadioGroup`, Danger zone with the shared panic). D7.
- **Verify** — `features/verify/verify-page.tsx` (verdict card, check icons as tokens, Receipt
  Section, “What we check” empty state). D8.
- **Chat** — `features/chat/composer-shell.tsx` (labelled Memory `Toggle`, one ⓘ popover, panel
  button, no “+”), `chat-page.tsx` (panel closed, no `HowStrip`/`MemoryStrip`, dynamic thread title),
  `examples.tsx`, `recalled.tsx`, `follow-up-row.tsx` (no raw `<button>`), `memory-panel-state.ts`.
  C3.
- **Guide** — `features/guide/guide-page.tsx`, `guide-content.ts`, `guide-visuals.tsx` (four blocks,
  Remora copy, Claude Code recipe, indexable). D9.
- **Not found / connect** — `app/not-found.tsx`, `features/connect/connect-page.tsx`. D12.
- **Routes** — `app/routes.tsx`: `/` = Home, `/chat`, `/me` → `/memory?tab=chat`.
- **E2E** — `smoke.spec.ts` (Home copy, `/chat`, funds sign-in text, Verify locator), `w2.spec.ts`
  (radio template, heading locator, Reconnect, Retire via Settings → confirm), `testnet.spec.ts`
  (Funds heading). Artifact names for the guide canonical renamed to `remora.vercel.app`.

**Plan IDs done:** C1, C2, C3, D1–D12, B7 (titles), plus E4 in pages.

**Checks (after the phase):** `typecheck` 20/20; `lint` clean (585 files); `test` 219 web
(+ server/other packages green); E2E smoke + mobile **22 passed**; testnet **1 passed**; w2 **1
passed** (2.0 min: Scout pays + Wake anchored, approval paid once, Sentinel learns, Scout retired
with the new confirm).

**Skipped / deferred:** none. `/remoras` shows “Budget not readable just now.” when the per-owner
rate limit answers 429 during a burst (the audit pass trips it); the page degrades instead of
showing a wrong number.

**Needs contract PR:** `apps/web/src/app/routes.tsx` (`/chat`, `/` = Home, `/me` redirect).
`lib/api.ts` untouched.

**Open issues:** none.

## Phase 4 — Final pass (D11, F1–F5)

**Files changed:**
- `e2e/playwright.config.ts` — new opt-in `audit` project (`AUDIT=1`) so the default run stays fast.
- `e2e/tests/audit.spec.ts` (new) — signs in with the burner, writes every page in light and dark to
  `docs/e2e/screenshots/audit-{light,dark}-*.png` (12 pages × 2), reconnects after each navigation.
- `features/funds/use-panic.ts` — **finding:** the server `api.panic` builds one PTB over every remora
  Disc; if one of those Disc objects no longer exists (a Disc global setup revoked after an earlier
  stopped W2 run), the whole call fails with `Object … not found`. The hook now falls back to a
  client `buildPause` over the live Discs when the server call throws, so pause-all still works and
  the E2E burner is not blocked by stale rows.
- Mobile/dark polish: `components/app/account-menu.tsx` (address was accidentally always hidden),
  `features/remoras/remora-card.tsx` (distinguish “no budget”, “reading” and “not readable”, never a
  wrong number), `features/remoras/feed-list.tsx` (relative `Time`), `features/settings/settings-page.tsx`
  (disabled Save is `outline`, not a faded primary).
- `docs/e2e/README.md` — project table (audit), screenshot table, run command.

**Plan IDs done:** D11 (Memory table → phone cards, tabs scroll, dialogs full-width via the kit),
F1–F5 (icon buttons have `aria-label` + tooltip, 👍/👎 have `aria-pressed`, kit primitives for
Tabs/RadioGroup/DropdownMenu, one `--ring`, `prefers-reduced-motion` respected by the greeting,
primary-on-text checked in both themes).

**Checks:**
- `typecheck` 20/20; `lint` clean (585 files); `test` all packages green (web 219, server 220, plus
  schema/memory/core/chain/signer/db/disc-sdk/merchant/merchants/facilitator).
- E2E: `smoke` **22 passed**, `mobile` **22 passed**, `testnet` **1 passed**, `w2` **1 passed**
  (2.3 min), `audit` **1 passed** (light + dark screenshots).
- Screenshot set copied to `docs/e2e/screenshots/` (46 files: audit light/dark, smoke, mobile,
  testnet paused/live).

**§7.4 "Done khi" greps (run from repo root):**

```
=== <button ===
(0)
=== (bg|text|border)-(amber|green|emerald|red|yellow|blue|sky|orange|rose)-<n> ===
(0)
=== #[0-9A-Fa-f]{6} ===
(0)
=== text-[\d+px] ===
(0)
=== brand ===
(0)
=== hippo (non-test, non-storage) ===
use-memory-panel.ts:11  const OLD_KEY = "hippo.memory-panel";     // migration
active-chat.ts:4        const OLD_KEY = "hippo.activeChat";      // migration
pending-ask.ts:5        const OLD_KEY = "hippo.pendingAsk";      // migration
examples.tsx:2          /* comment lịch sử */
claude-code-panel.tsx:5 upstream skill URL (…/hippo-memory/SKILL.md) — handoff cho Uy
use-account.ts:10       isHippo: boolean;                        // field từ server
memory-list.tsx:2       /* comment lịch sử */
wallet-read.ts:9        /* comment lịch sử */
chain-panel.tsx:83      {d.isHippo && …}   // hiển thị đã là "Remora"
connect/memwal.ts:22    /* comment lịch sử */
lib/api.ts              hippo.guest / hippo.session / x-hippo-* // protocol, file hợp đồng, không đổi
```

No displayed “hippo” remains; the exceptions are migration keys, one upstream URL, a server field
name, the session protocol keys, and historical comments.

**Skipped / deferred:** the “screenshot set approved by Huấn” checkbox (that is the owner’s review).
`apps/web/src/lib/api.ts` session keys and the server-side auth strings are a handoff, not a UI edit.

**Needs contract PR:** `apps/web/src/app/routes.tsx` only.

**Open issues:** during the audit burst the per-owner rate limit can answer 429, so `/remoras` shows
“Budget not readable just now.” and Home shows `$0.00`; both recover on the next poll. Not a defect,
noted for the demo (open the page, the numbers fill in).

## Independent verification (re-run from a clean tree state)

Re-ran the acceptance on the settled working tree (no commit, no push):

- `bun run typecheck -- --force` → **20/20 successful**.
- `bun run lint` → **clean, 585 files**.
- `bun run test -- --force` → **15/15 tasks successful**, `@remora/web` **219 passed (43 files)**.
- `bun run --filter @remora/e2e e2e -- --project=smoke --project=mobile` → **22 passed (27.2 s)**.
- `bun run --filter @remora/e2e e2e -- --project=testnet --project=w2` → `testnet` **1 passed**;
  `w2` **failed at step 4** with `Transaction resolution failed: InsufficientCoinBalance in command 0`
  on its own `sendSui(watched, 0.02 SUI)` at `w2.spec.ts:206`. This is the **E2E burner's SUI gas**
  running out (it also pays for the self-sent transfers in step 4), **not a UI defect** — the run had
  already reached the approval screenshot. Retried the `w2` project once as the brief allows; it
  failed the same way, so it is left noted here. The tree's own unit + smoke + mobile + testnet
  suites are green; `w2` passes when the burner is funded.
- §7.4 greps re-run by hand: `<button` (0), palette classes (0), `#rrggbb` (0), `text-[Npx]` (0),
  `brand` (0). `hippo` only survives as storage-migration `OLD_KEY`s, historical comments, one
  upstream skill URL, the server's `isHippo` field and the session protocol keys in
  `lib/api.ts` (a contract file, handed off), never as displayed copy.

**Env note:** a second agent/session was writing this same tree during the run (its Phase 0–4 log is
above). The verification above is against the tree once it settled.

## Follow-up: two consistency fixes

- **SetupChecklist CTAs** (`components/app/setup-checklist.tsx`): every step CTA is now the same
  button — the current step is `default` (primary) `size="sm"`, and every other step (including the
  optional Telegram step) is `variant="outline" size="sm"`. Dropped the trailing `ChevronRight` from
  "Link Telegram". The connect step passes `size="sm"` to `WalletPicker` so its CTA is the same
  height.
- **Sidebar active state** (`app/nav-active.ts` new, used by `app/app-sidebar.tsx`): extracted a pure
  `navActive(to, pathname)`. Home is the dashboard, so it is lit on `/` and on `/remoras` /
  `/remoras/*` and nowhere else; Funds, Approvals and Memory match their own path and subpaths.
  Exactly one nav item is active per route (`/chat` lights none, since chat is not a nav item).
  Covered by `app/nav-active.test.ts`.

Checks after the fixes: `typecheck` 20/20; `lint` clean (587 files); `test` web **222 passed**
(44 files); E2E `smoke` + `mobile` **22 passed**. Nothing committed.

## Phase 5 — follow-up pass (items 1–12)

Brief: `docs/ux/ui-polish-followup-brief.md` (P1 → P2 → P3). Working tree only.

### P1 — what a demo viewer notices (items 1–5)

**Files changed:**
- `features/remoras/new-remora-page.tsx` — item 1: the template radio card is a padded card again
  (`rounded-xl border p-5`, radio to the left of the title, `items-stretch gap-3`); dropped the inner
  borderless `Card`.
- `features/remoras/remora-card.tsx` — item 2: the subtitle is the template once, capitalised
  ("Scout"/"Sentinel"); the body renders the shared `BudgetMeter` when the Disc reads, and one quiet
  line otherwise ("Read-only: no budget to spend." / "Reading the Disc…" / the error). The whole card
  is the link with a hover background (`hover:bg-muted/40`), a `focus-visible` ring and a trailing
  `ChevronRight`.
- `features/remoras/use-budget.ts` (**new**) — item 3: one React Query key
  `["remora-budget", network, remoraId]`, `staleTime` 30 s, 30 s poll, `refetchOnWindowFocus: false`,
  `retry: false` (no 429 retry storm). Used by `remora-card.tsx` (Home and `/remoras`) and by
  `remora-page.tsx`'s BudgetSection, so Home → `/remoras` → a remora reuses the same answer.
- `features/remoras/feed-list.tsx` — item 4: one `rounded-xl border` list with `divide-y` rows;
  `ping` uses the `warning` badge and only `blocked` stays `destructive`; labels are capitalised
  ("Action", "Ping", "Ignored", "Needs you", …).
- `components/app/section.tsx` — item 5: the heading row is `items-start` with a `min-h-8` heading and
  a `shrink-0 items-center` action slot so heading and action share a baseline.
- `features/home/home-page.tsx`, `features/remoras/remora-page.tsx` — item 5: "See all" is a ghost
  `size="sm"` with `-mr-3` so its text edge lines up with the cards' right edge.
- Tests: `features/remora-pages.test.tsx` wraps renders in a `QueryClientProvider`, and the dashboard
  test now checks the template shows **once** and the budget shows as the meter.

**Checks (after P1):** `typecheck` 20/20; `lint` clean (588 files); `test` all packages green
(web **222 passed**, 44 files); E2E `smoke` + `mobile` **22 passed** (27.3 s).

**Skipped:** none. `lib/api.ts` untouched.

**Open issues:** none.

### P2 — consistency (items 6–10)

**Files changed:**
- `features/funds/funds-page.tsx` — item 6: the "last transaction" row renders only when there is
  something to show (it used to reserve `min-h-6` and add ~48 px before "Budgets"); the grid→Budgets
  gap is now the page's regular `gap-6`. The "In coins" tile is neutral when the coin balance is 0,
  and only the "✓ Nothing to move" line is `text-success`.
- `components/hash.tsx` — item 7: the shared `Hash` copy button is now `variant="ghost" size="icon-sm"`
  (was a 36 px outlined square on every row), which matches §2.4's "icon in a row = ghost icon-sm".
- `features/memory-inspector/memory-page.tsx` — item 7: the blob cell is width-constrained
  (`w-64 max-w-64`) so `Hash`'s middle cut shows; the namespace chips are real filters (`Toggle
  variant="outline" size="sm"`, `aria-pressed`, rounded-full) that filter the client-side `rows`
  and search results; the empty line says "Nothing in {ns} yet." while a filter is on.
- `components/app/page.tsx` — item 8: **chosen smaller change = shared left edge.** New exported
  `PageColumn` (a centered `max-w-5xl` track containing the width-limited column, `px-4 md:px-8`).
  `Page` scrolls the outer container and renders everything inside `PageColumn`, so `narrow`,
  `default` and `wide` pages all start at the same x and the `h1` no longer jumps. Widths are kept.
- `features/remoras/hooks.tsx` — item 8: `RequireOwner`'s reconnect banner, loading skeleton and
  signed-out card render in the same `PageColumn`, so their left edge matches the page body.
- `features/settings/settings-page.tsx` — item 9: an explicit "Quiet hours" `Switch`; off shows
  "Off: remoras can reach you at any hour." and saves `quietStart`/`quietEnd` as `null` exactly as
  before; on shows the two time inputs defaulting to 22:00–07:00. Payload shape unchanged.
- `features/chat/composer-shell.tsx` — item 10: the ⓘ popover trigger is wrapped in a span inside
  its `TooltipTrigger` so the tooltip actually shows; the panel button keeps `aria-label` +
  `Tooltip` and now has a pressed state (`aria-pressed`, `bg-accent text-accent-foreground`).
- Tests: `components/app/page.test.tsx` updated for the `PageColumn` structure.

**Checks (after P2):** `typecheck` 20/20; `lint` clean (588 files); `test` all packages green
(web **222 passed**, 44 files); E2E `smoke` + `mobile` **22 passed** (27.2 s).

**Skipped:** none.

**Open issues:** none.

### P3 — coverage and evidence (items 11–12)

**Files changed:**
- `e2e/tests/audit.spec.ts` — item 11: the light/dark pass now also captures a remora's
  `remora-overview`, `remora-activity` and `remora-settings` tabs (the id is read from
  `/api/remoras` through the page's own signed-in session), `/connect`, the 404 page, and a second
  test captures the signed-out Home in a fresh context (both themes).
- `docs/e2e/README.md` — the audit row and the screenshot table now name the remora tabs, `/connect`,
  the 404 page and `audit-{light,dark}-home-signed-out.png`.

**Checks (after P3):** `typecheck` 20/20; `lint` clean (588 files); `test` all packages green
(web **222 passed**, 44 files); E2E `smoke` + `mobile` **22 passed** (26.5 s).

**Item 12 evidence:**
- `AUDIT=1 bun run --filter @remora/e2e e2e -- --project=audit` → **2 passed** (5.5 min);
  new files include `audit-{light,dark}-remora-{overview,activity,settings}.png`,
  `audit-{light,dark}-connect.png`, `audit-{light,dark}-not-found.png`,
  `audit-{light,dark}-home-signed-out.png`.
- Re-ran `smoke` + `mobile`, copied the fresh `smoke-*.png` / `mobile-*.png` into
  `docs/e2e/screenshots/`.
- Final `--project=testnet` → **1 passed** (27.7 s); copied the fresh
  `testnet-funds-{live,paused}.png` into `docs/e2e/screenshots/`.

**Skipped:** none.

**Open issues:** the audit's burner owns remora rows whose Discs the global setup revoked (leftovers
from stopped `w2` runs), so their cards read "Budget not readable just now." — that is the server
answering `{ meter: null }` for a Disc that no longer exists, not a 429 and not a UI defect. A fresh
Scout shows the `BudgetMeter`.

### Phase 5 — all items done

Items 1–12 are done in the working tree (no commit, no push). Every check group was green:
`typecheck` 20/20, `lint` clean, `test` all packages, and E2E `smoke` + `mobile` on each of P1, P2 and
P3; `audit` 2 passed; `testnet` 1 passed. Hard-rule greps re-run by hand: `<button` (0 outside
`components/ui`/tests), palette classes (0), `#rrggbb` (0).

### Phase 5 review fix

- `features/memory-inspector/memory-page.tsx`: the desktop table's Expires column rendered a future
  expiry with `Time` (relative "ago"), so every row read "just now". It now shows the date, the same
  as the phone cards. Checks: `typecheck` 20/20, `lint` clean (588 files), web 222 passed.

## Phase 6 — UI refresh (brief: `docs/ux/ui-refresh-brief.md`)

Working tree only (no commit, no push). Six sections, in order, each followed by
`typecheck && lint && test` and E2E `smoke` + `mobile`.

### §1 — electric indigo primary

**Files changed:** `apps/web/src/index.css` (the token block and its comment; `--chart-1`–`--chart-5`
added and registered in `@theme inline`), `docs/adr/0039-electric-indigo-primary.md` (new),
`docs/adr/README.md` (row), `docs/ux/README.md` (Brand line).

- `--primary` / `--ring` / `--sidebar-primary` / `--sidebar-ring` are `oklch(0.55 0.22 280)` light and
  `oklch(0.72 0.16 280)` dark; `--primary-foreground` `oklch(0.99 0 0)` / `oklch(0.18 0.04 280)`;
  `--accent` `oklch(0.95 0.03 280)` / `oklch(0.30 0.05 280)`. `--success` (155), `--warning` (75) and
  `--destructive` (28) unchanged; hue 280 is far from all three.
- `chart-1` is the primary; `chart-2`–`chart-5` are green / amber / red / pink. The fish fin already
  uses `fill-primary`, so the mark follows the token.
- **Contrast numbers (OKLCH → sRGB script):** white on light primary **5.13:1**; dark primary text on
  dark primary **7.26:1**; light primary on the warm background 5.05:1; dark primary on the dark
  background 5.79:1. All ≥ 4.5:1.
- Grep for leftover teal (`oklch(… 1[6-9]\d)`, `teal`, `cyan`) matches only the new comment word
  "teal" in ADR history; no call site left.
- ADR-0039 supersedes the "keep teal, softened" answer (Q2) of ADR-0036; ADR-0036 itself untouched.

**Checks:** `typecheck` 20/20; `lint` clean; `test` all packages green; E2E `smoke` + `mobile`
**22 passed** (27.8 s) at this point.

### §2 — full-width pages, one left edge

**Files changed:** `components/app/page.tsx` (full-width `PageColumn` with
`px-4 sm:px-6 lg:px-10`, `data-slot="page-column"`; `width` prop removed from `Page`/`PageColumn`),
`components/app/page.test.tsx`, `features/remoras/hooks.tsx` (`RequireOwner` loses `width`, and its
signed-out state now has an `h1`), every former `width=` caller (`home-page`, `remoras-page`,
`memory-page`, `settings-page`, `verify-page`, `new-remora-page`, `connect-page`, `onboarding-page`,
`not-found`, `guide-page`), card grids (`home-page`, `remoras-page` → `sm:grid-cols-2
xl:grid-cols-3 2xl:grid-cols-4`), form fields kept at `max-w-2xl` left-aligned (Settings Policy +
Telegram, New remora body, Verify form, Connect body), `e2e/tests/smoke.spec.ts`.

- Chat (`/chat`) still has its centered conversation column; it is not a `Page`.
- **New Playwright check** `e2e/tests/smoke.spec.ts`: at 1440px it walks `/`, `/remoras`,
  `/approvals`, `/funds`, `/memory`, `/settings`, `/verify`, `/remoras/new` and
  `/remoras/<uuid>` and asserts the first `h1` `x` and the page column's right gutter agree within
  1px (gated routes use the sign-in state's `h1`).

**Checks:** `typecheck` 20/20; `lint` clean; `test` all packages green; E2E `smoke` + `mobile`
**24 passed** (36.9 s), including the new edge test.

### §3 — sidebar alignment

**Files changed:** `app/app-sidebar.tsx`, `app/pages.test.tsx`.

- The "Search chats" wrapper lost its extra `px-2`, the Recents `SidebarMenu` lost its extra `pe-3`,
  and each chat row's title is `min-w-0 flex-1 truncate`. Nav items, the search input and Recents now
  share one inset on both sides (the `SidebarGroup` `p-2`) and fill it; the highlight edges are
  identical. Collapsed and the mobile sheet reuse the same markup.

**Checks:** `typecheck` 20/20; `lint` clean; `test` all packages green; E2E `smoke` + `mobile`
**24 passed** (36.3 s).

### §4 — model picker in the composer

**Files changed:** new `features/chat/models.ts` (the 10-entry catalog: 9 OpenRouter ids + the
`""` Remora default, USD per 1M, input kinds, tool calling on every entry),
`features/chat/use-chat-model.ts` (`remora.chat-model` through `lib/storage`, default `""`),
`features/chat/model-picker.tsx` (ghost `sm` trigger with the vendor mark + short label + chevron and
`aria-label="Model: …"`; `DropdownMenu` + `RadioGroup` grouped by vendor; each row shows the label,
`$in / $out` per 1M and a badge with the count of input kinds; hovering **or focusing** the row opens
a `Tooltip` listing Text / Images / Audio-voice / Video / Files-PDF with icons plus "Tool calling ✓"),
`features/chat/composer-shell.tsx` (picker next to the Memory toggle), `features/chat/chat-page.tsx`,
`features/chat/use-chat-thread.ts` (the optional `model` field in the send body; omitted for the
default), tests `models.test.ts`, `use-chat-model.test.ts`, `model-picker.test.tsx`.
`docs/handoffs/2026-10-19-huan-to-uy-chat-model-choice.md` written for Uy.

- **Needs contract PR:** the chat request body is built in
  `apps/web/src/features/chat/use-chat-thread.ts` (`prepareSendMessagesRequest`), not in `lib/api.ts`
  — `lib/api.ts` has no chat body and was left untouched, so the only change is the optional `model`
  field described in the handoff. The server strips unknown fields today, so nothing breaks; Uy
  accepts/validates/builds `openrouter.chat(id)` per request.

**Checks:** `typecheck` 20/20; `lint` clean; `test` all packages green (web 250 passed, 51 files,
+28 tests); E2E `smoke` + `mobile` **24 passed** (36.1 s).

### §5 — wallet after a page refresh

**Files changed:** new `features/connect/wallet-resume.tsx` (one `WalletResumeProvider` inside
`WalletProvider`, still `autoConnect={false}`) and `features/connect/wallet-resume-state.ts` (pure
`resumeDecision`) + `wallet-resume-state.test.ts`; `features/connect/use-resume-wallet.ts` now also
returns the saved record; `app/providers.tsx`; `features/remoras/hooks.tsx` (hides the reconnect
banner while the resume is in flight); `components/app/account-menu.tsx` (warning dot on the avatar
and a "Reconnect wallet" item); `components/wallet-picker.tsx` (controlled `open`/`onOpenChange` +
`hideTrigger` so the menu can open the dialog); reads audited to use the session owner:
`features/funds/funds-page.tsx` (drops the wallet-account fallback), `features/me/me-page.tsx`
(`linked` is the session wallet only). Settings keeps `needsWallet` because its panic action signs;
Memory/Remoras/Home never ask. `e2e/tests/w2.spec.ts` `goto` now tolerates the silent resume (clicks
Reconnect only if the banner still appears).

- The decision: signed-in session + no account + saved wallet matching → **resume** (nothing extra
  shown); resume failed, no saved wallet, or a different account → **reconnect** (banner + dot).

**Checks:** `typecheck` 20/20; `lint` clean; `test` all packages green; E2E `smoke` + `mobile`
**24 passed** (40.2 s). `w2` not run: the brief says the E2E burner is low on SUI gas.

### §6 — wallet balance on the selected network

**Files changed:** new `lib/balance.ts` (`balanceMist`, `formatSui`, `SUI_COIN_TYPE`),
`features/funds/use-wallet-balance.ts` (`readBalances` via the browser `useSuiClient`, gRPC-web only;
refetches on network change and every 30 s), `components/app/show-balance.ts`
(`remora.show-balance`, default on), `components/app/account-menu.tsx` (SUI + USDC line under the
address in the menu — skeleton while loading, "—" on error — a compact line in the sidebar footer,
and a "Show balance" checkbox item). `features/connect/sponsor.ts` now shares `balanceMist` instead of
its own copy. Tests: `lib/balance.test.ts`, `components/app/show-balance.test.ts`,
`features/funds/use-wallet-balance.test.ts`.

**Checks:** `typecheck` 20/20; `lint` clean (603 files); `test` all packages green (web **250
passed**, 51 files; server 220 passed); E2E `smoke` + `mobile` **24 passed** (36.9 s).

### Phase 6 — end-of-pass checks

- `bun run --filter @remora/e2e e2e -- --project=testnet` → **1 passed** (25.9 s).
- `AUDIT=1 bun run --filter @remora/e2e e2e -- --project=audit` → **2 passed** (7.1 min; signed-in
  light/dark set + the signed-out Home). `w2` deliberately not run (burner SUI, per the brief).
- Fresh `smoke-*.png`, `mobile-*.png`, `testnet-*.png` and `audit-*.png` copied from
  `e2e/screenshots/` into `docs/e2e/screenshots/` (10 tracked files refreshed; two files tracked in
  git, `mobile-remoras-scout.png` and `smoke-remoras-scout.png`, are absent from the fresh set — that
  deletion pre-dates this pass and was left untouched).
- Nothing committed, pushed, stashed, reset or checked out.

**Open issues:** none blocking. `w2` is green when the burner is funded (not run here by request);
`lib/api.ts` untouched, the model field is the one contract item (handoff written).


### Phase 6 review fixes

- **Screenshots:** the Phase 6 copy step pulled the git-ignored `e2e/screenshots/` set (taken 09:35,
  before the polish) over the fresh audit set, so `audit-light-*` showed the old UI. Re-ran
  `AUDIT=1 … --project=audit` (2 passed, 7.1 min), copied only fresh `smoke-*`, `mobile-*` and
  `testnet-*`, and removed the stale `audit-*-me.png` and `w2-*.png` copies (w2 was not re-run).
- `features/remoras/hooks.tsx`: the `RequireOwner` banner column is `empty:hidden`, so gated pages no
  longer start 16px lower than Home when there is no banner.
- `components/app/account-menu.tsx`: the sidebar footer shows a compact `1.54 USDC · 0.00 SUI` in
  sans/tabular figures (it was truncated to "1.54 US…"); the menu keeps the full line.
- Checks: `typecheck` 20/20, `lint` clean (603 files), web 250 passed (one flaky failure on the first
  turbo run, 3/3 clean re-runs), E2E smoke + mobile 24 passed.

## Phase 7 — owner feedback (Huấn, 2026-10-19)

- **Account menu** (`components/app/account-menu.tsx`): the address is one truncated line
  (`Web3Address`, full value on hover) with the shared `CopyButton` (ghost, icon-sm), which flips to
  a check and resets after 1 s; the old button always showed a check. "Show balance" is a `Switch`
  row that keeps the menu open. The sidebar footer shows only `1.54 USDC` (SUI is in the menu).
- **Model picker** (`features/chat/model-picker.tsx`, `models.ts`): one flat list, no vendor headings or
  vendor mark; only models at most $1 per 1M in and out (Gemini 3.1 Flash-Lite, Mistral Large 4,
  Gemini 3.8 Flash and Grok 4.3 removed; a stored removed id falls back to the default).
- **Memory** (`features/chat/composer-shell.tsx`): a small `Switch` with a "Memory" label and the
  same tooltip, replacing the `Toggle` (`pages.test.tsx` now finds `role="switch"`).
- **Pause all** (`features/funds/panic-button.tsx`): a soft destructive pill (outline, tinted, rounded,
  32px) with the icon and "Pause all" (icon only on a phone); same aria-label, confirm and signing.
- Checks: `typecheck` 20/20, `lint` clean, web 250 passed, E2E smoke + mobile 24 passed, audit
  2 passed (fresh screenshots).

## Phase 8 — new logo, Trace in chat, every page full width (Huấn, 2026-10-19)

- **Logo** (ADR-0040): `components/logo.tsx` + `logo-path.ts`. Props `size`, `tone`
  (auto/primary/black/white), `background` (tile), `withText`, `label`, `decorative`. The six blocks
  are one clockwise path (no seams). Sidebar uses the indigo tile + word. `scripts/logo-assets.ts`
  (`bun run --filter @remora/web logo:assets`) writes `logo-black.svg`, `logo-white.svg`,
  `favicon.svg`, `favicon-32.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png` and a new
  `og.png` (the old one still said hippo).
- **Trace**: `components/ui/trace.tsx` vendored from shadcn `radix-nova` (Oct 2026), adapted to the
  kit; `shimmer` utility in `index.css`. `features/chat/turn-trace.tsx` shows recalled memories
  (collapsible, blob links), the file read, and memory tool calls (running → past tense);
  `Thinking` is a running Trace line. `recalled.tsx` now only holds the type. Tests:
  `turn-trace.test.tsx` (3).
- **Full width**: New remora is two columns with a sticky Summary + Create; Settings uses
  `Section layout="split"`; Verify's form spans the page and "What we check" is a 4-up grid; Connect
  has no column cap; the signed-out Home's template grid and the Memory → Chat tiles fill their row;
  the `RequireOwner` banner column now hides when empty, so every `h1` sits at the same y.
- Checks: typecheck 20/20, lint clean, all package tests green, E2E smoke + mobile 24 passed, audit
  2 passed (screenshots refreshed).
