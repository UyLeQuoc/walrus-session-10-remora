# Handoff: Huấn → Uy, the UI/UX polish has landed

- **Date:** 2026-10-19 · **From:** Huấn · **To:** Uy · **Status:** for review (working tree, not pushed)
- **Context:** `docs/ux/ui-polish-plan.md` is implemented end to end. This note lists what changes for
  the demo video, the routes, and the one contract change.

## Contract PR needed

`apps/web/src/app/routes.tsx` (shared file, AGENTS.md) changed minimally:

- `/` now renders `HomePage` (was `ChatPage`).
- `/chat` renders `ChatPage`.
- `/me` renders `<Navigate to="/memory?tab=chat" replace />`.

`apps/web/src/lib/api.ts` is untouched: same API calls, same headers, same session keys.

## Demo video: what moved

| Before | After |
|---|---|
| `/` = chat | `/` = Home (setup checklist, then dashboard); chat is `/chat` |
| Header: TESTNET badge + two network toggles + theme button + red “Pause all” | Header: ☰ · network dropdown (`Testnet ▾`) · pause icon. Theme lives in the account menu |
| Pause all = one click | Pause all = icon → confirm dialog → signature |
| Sidebar: 11 items + channel card | Sidebar: New chat · Home · Approvals (count) · Funds · Memory · Recents · account menu |
| “My memory” at `/me` | Memory → Chat tab; `/me` redirects |
| Retire / Rotate / Change budget = one click | Each opens `ConfirmAction` (Cancel / confirm with spinner) |
| Create template = `<button>` cards | Template cards are a `RadioGroup` (`getByRole("radio")`) |
| Chat memory panel opens by default | Closed; the composer has a memory panel button, a labelled Memory toggle and one ⓘ |
| Serif greeting | Sans everywhere |

For the video: the “pause everything” beat is now **two clicks plus the wallet**, and “retire Scout”
is **Settings tab → Danger zone → Retire → confirm → sign**.

## What is where

- New shared kit: `apps/web/src/components/app/` — `Page`, `PageHeader`, `Section`, `EmptyState`,
  `StatTile`, `StatusBadge`, `ConfirmAction`, `Time`, `BudgetMeter`, `NetworkSelect`, `AccountMenu`,
  `ThemeChoice`, `SetupChecklist`.
- Home / setup: `apps/web/src/features/home/home-page.tsx`, `components/app/setup-checklist.tsx`.
- Memory tabs: `apps/web/src/features/memory-inspector/memory-page.tsx` (Remoras) and
  `features/me/me-page.tsx` (Chat).
- Guide rewritten: `apps/web/src/features/guide/guide-page.tsx` (hidden from nav per Q4).
- Tokens/kits: `apps/web/src/index.css`, `ui/card.tsx`, `ui/badge.tsx`, `ui/alert.tsx`,
  `ui/button.tsx` (ADR-0036).

## Still yours

- `docs/handoffs/2026-10-19-huan-to-uy-hippo-auth-strings.md`: sign-in message, cookie/header names,
  CORS list.
- The guide’s Claude Code recipe still links the upstream `hippo-memory` skill file (the URL contains
  “hippo”); rename it when the skill is republished.
- i18n is out of scope (plan §9).
