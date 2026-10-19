# Brief: UI refresh (Phase 6): new primary, full-width pages, model picker, wallet fixes

Owner requests from Huấn (2026-10-19). Read first: `AGENTS.md`, `docs/code-rules.md`,
`docs/ux/ui-polish-plan.md` §2 and §4, and the "Hard rules" in `docs/ux/ui-polish-brief.md`, which
all still apply: edit only `apps/web/**` (not `features/lab/**`), `e2e/**`, `docs/ux/**`,
`docs/e2e/**`, `docs/adr/**` (new ADR + README row), `docs/handoffs/**` (new notes); no git commit,
push, stash, reset or checkout; no new dependencies; tokens only; no raw `<button>`; keep E2E green.

## 1. New primary colour: electric indigo (decided, do not ask)

The softened teal reads dated. Replace it with a fresh, saturated **electric indigo** on the existing
warm neutrals (cool accent on warm paper is the current look). In `apps/web/src/index.css`:

| Token | Light | Dark |
|---|---|---|
| `--primary` | `oklch(0.55 0.22 280)` | `oklch(0.72 0.16 280)` |
| `--primary-foreground` | `oklch(0.99 0 0)` | `oklch(0.18 0.04 280)` |
| `--ring` | same as `--primary` | same as `--primary` |
| `--sidebar-primary` / `--sidebar-ring` | same as `--primary` | same as `--primary` |
| `--accent` (hover/selected tint) | `oklch(0.95 0.03 280)` | `oklch(0.30 0.05 280)` |

- Every place that used the teal tint (selected template card, active "How loud" card, setup
  checklist current step, progress bars, `secondary` badges such as "Spends USDC") must follow the
  token, so grep for leftover teal hues (`oklch(… 1[6-9]\d)`, `teal`, `cyan`) and fix them.
- The fish mark's fin/accent (`components/brand*` or wherever the inline SVG lives) uses
  `currentColor`/`--primary`, not a fixed teal.
- Keep `--success`, `--warning` and `--destructive` as they are, and check that the new primary is not
  confused with them. Check text contrast: white on light primary and dark text on dark primary must be
  ≥ 4.5:1 (use a quick script or the browser's contrast checker, and write the numbers in the log).
- `chart-*` tokens: chart-1 = primary; keep the others distinct.
- Write **ADR-0039 "Primary colour: electric indigo"**. It supersedes the teal part of ADR-0036 (Q2).
  Do not edit ADR-0036; add the row to `docs/adr/README.md` and update the "Brand" line in
  `docs/ux/README.md`.

## 2. Full-width pages, one left edge

The owner sees Home, Approvals and Funds sitting left-shifted in a narrower column, while others are
wider. `Page`/`PageColumn` (`components/app/page.tsx`) and `RequireOwner` (`features/remoras/hooks.tsx`)
must give **every page the same full-width column**:

- `Page` is `w-full` with one gutter (`px-4 sm:px-6 lg:px-10`), no `max-w-*` on the column, no
  `mx-auto` centring. Remove the `width` prop's effect on the page column (keep the prop accepted so
  callers compile, or remove it from every caller; prefer removing).
- Content inside expands: card grids go `sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4` (Home, Remoras),
  stat tiles span the full row, tables/lists are full width.
- Forms that become unreadable when stretched (Settings fields, New remora fields, Verify input,
  Connect) keep their **fields** at `max-w-2xl`, left-aligned inside the full-width page. The page
  header and section headings stay on the page's left edge.
- **Home** gets the same treatment, in both its signed-out hero/checklist state and its dashboard
  state (no `narrow` page).
- Chat (`/chat`) keeps its centred conversation column; it is not a `Page`.
- Acceptance: at 1440px, the `h1` on Home, Remoras, Approvals, Funds, Memory, Settings, Verify,
  New remora and the remora page starts at exactly the same x, and the right edge of the content is
  the same gutter from the shell's right edge. Add a Playwright check in `e2e/tests/smoke.spec.ts`
  that compares the `h1` bounding box `x` across these routes (signed-out routes are fine where the
  page renders a sign-in state with its `h1`).

## 3. Sidebar alignment (Recents)

In `app/app-sidebar.tsx` the right edges don't line up (dark theme screenshot): the nav item highlight
("Memory") reaches further right than the "Search chats" input, and the highlighted Recents item
("Teach Sentinel: ignor…") is narrower than both and ends earlier. Make the nav items, the search
input and the Recents items share **one inset on both sides** and be **full width** of that inset:
the same `SidebarGroup`/`SidebarMenu` padding, the input `w-full`, and each chat item a
`SidebarMenuButton` that fills the row (truncate the title with `min-w-0 flex-1 truncate`). The
highlight of a Recents item and of a nav item must have identical left and right edges. Check light,
dark and the collapsed/mobile sheet.

## 4. Model picker in the composer

Add a model picker to the chat composer toolbar (`features/chat/composer-shell.tsx`), next to the
Memory toggle.

- **Catalog**: new `features/chat/models.ts`, a static list (snapshot of OpenRouter, 2026-10-19,
  prices in USD per 1M tokens, every one supports tool calling):

  | OpenRouter id | Label | Vendor | In | Out | Inputs |
  |---|---|---|---|---|---|
  | (none) | Remora default | Remora | — | — | text |
  | `deepseek/deepseek-v4.1-flash` | DeepSeek V4.1 Flash | DeepSeek | 0.04 | 0.08 | text, image |
  | `z-ai/glm-5.3-flash` | GLM-5.3 Flash | Zhipu | 0.05 | 0.16 | text, image, video |
  | `anthropic/claude-haiku-5.5` | Claude Haiku 5.5 | Anthropic | 0.10 | 0.50 | text, image, file |
  | `openai/gpt-6-luna` | GPT-6 Luna | OpenAI | 0.10 | 0.50 | text, image, file |
  | `qwen/qwen3.8-omni-flash` | Qwen3.8 Omni Flash | Alibaba | 0.15 | 0.47 | text, image, audio, video |
  | `google/gemini-3.1-flash-lite` | Gemini 3.1 Flash-Lite | Google | 0.25 | 1.50 | text, image, audio, video, file |
  | `mistralai/mistral-large-4-0` | Mistral Large 4 | Mistral | 0.68 | 2.09 | text, image |
  | `google/gemini-3.8-flash` | Gemini 3.8 Flash | Google | 0.83 | 4.13 | text, image, audio, video, file |
  | `x-ai/grok-4.3` | Grok 4.3 | xAI | 1.25 | 2.50 | text, image, file |

- **Trigger**: a ghost `sm` button with the vendor icon or initial and the short label
  ("Haiku 5.5"), plus a chevron, with `aria-label="Model: …"`.
- **Menu** (`DropdownMenu` with `DropdownMenuRadioGroup`, or the kit's `Command`/`Combobox` if it
  reads better): grouped by vendor. Each row shows the label, `$in / $out` per 1M in muted text, and
  a small capability badge with the **count** of input kinds (e.g. `3`, with an icon). Hovering or
  focusing the badge (or the row) shows a `Tooltip`/`HoverCard` listing them with icons: Text
  (`Type`), Images (`Image`), Audio/voice (`AudioLines`), Video (`Video`), Files/PDF (`FileText`), plus
  "Tool calling ✓". It must be keyboard-reachable (focus shows the same list).
- **State**: selection in `localStorage` key `remora.chat-model` via `lib/storage.ts` (wrap in
  try/catch like the other keys); default "Remora default".
- **Sending**: pass the selected id as an optional `model` field in the chat request body. This needs
  a minimal **additive** change in `lib/api.ts` (an optional parameter, nothing else changes); list it
  under "Needs contract PR" in the log. The server currently ignores unknown fields (`zod` strips
  them), so nothing breaks. Write the handoff
  `docs/handoffs/2026-10-19-huan-to-uy-chat-model-choice.md`: accept `model` in `chatBody`
  (`apps/server/src/routes/chat.ts`), validate it against the same allowlist (export the ids from
  `packages/schema` in a contract PR, or copy the list), build `openrouter.chat(id)` per request with
  the existing fallback, log `model.id` per turn as today.
- Unit test: the catalog renders the count and the tooltip list; the selection persists.

## 5. Wallet after a page refresh

Bug: after a refresh, the account menu still shows the wallet (the session cookie knows the owner)
but pages that need the wallet show "Reconnect your wallet to sign", because
`WalletProvider autoConnect={false}` (`app/providers.tsx`, deliberate: auto-connect pops Slush) leaves
dapp-kit with no account. `features/connect/use-resume-wallet.ts` already does a **silent**
reconnect of the last approved wallet but is only used on `/connect`.

- Run the silent resume once at the app level whenever there is a signed-in owner and no current
  account (for example in the shell or a small `<WalletResume />` inside `Providers`). Do not turn
  `autoConnect` on.
- While the resume is pending, pages show nothing extra (no warning flash); the "Reconnect" alert only
  appears if the resume failed or the saved wallet doesn't match the owner.
- Read-only pages must never ask to reconnect: only pages/actions that **sign** pass `needsWallet`.
  Audit every `RequireOwner` caller and every `useCurrentAccount()` reader (Funds, Memory/Chat,
  remora page, panic) and make reads use the session owner address, not the wallet account.
- The account menu shows the truth: if the wallet is not connected, the avatar has a small warning dot
  and the menu has a "Reconnect wallet" item.
- Add a unit test for the decision (owner + no account + saved wallet → resume; resume failed →
  alert) and keep `e2e/tests/w2.spec.ts`'s "Reconnect" path working.

## 6. Wallet balance on the selected network

In the account menu (and optionally as a compact line under the address in the sidebar footer), show
the balances of the signed-in address **on the network selected in the header**: SUI and USDC, e.g.
`12.40 SUI · 1.62 USDC`, with a skeleton while loading and "—" on error. Read through the existing
browser Sui client (gRPC-web, ADR-0021: **never JSON-RPC**); reuse whatever Funds already uses to read
the address balance and the USDC coin type for the network. Add a toggle in the account menu,
"Show balance", stored as `remora.show-balance` (default on), so it can be hidden for screenshots.
Refetch on network change and every 30 s.

## Checks

After each numbered section: `bun run typecheck && bun run lint && bun run test`, then
`bun run --filter @remora/e2e e2e -- --project=smoke --project=mobile`. Fix until green. At the end:
`--project=testnet` once, then `AUDIT=1 bun run --filter @remora/e2e e2e -- --project=audit`, and copy
the fresh screenshots into `docs/e2e/screenshots/`. Do not run `w2` (burner is low on SUI gas).

Log everything in a "Phase 6" section of `docs/ux/ui-polish-progress.md`: per section, the files
changed, pass counts, contrast numbers, "Needs contract PR" (`lib/api.ts` optional `model`), handoffs,
and open issues. Stop when all six sections are done and green, or something is truly blocked
(write exactly why).
