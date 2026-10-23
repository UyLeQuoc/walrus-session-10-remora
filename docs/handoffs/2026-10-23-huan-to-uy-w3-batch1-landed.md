# Landed: W3 web batch 1 (Huấn → Uy)

- **Date:** 2026-10-23 · **From:** Huấn (with agents) · **To:** Uy · **Status:** PR open, not merged
- **Branch:** `huanng/w3-web-batch-1` (PR link in the PR description)

## What landed (web only, `apps/web`)

| ID | What | Where |
|---|---|---|
| U8 leftover | `/playground` copy and layout pass. Test ids and labels unchanged; `u8.spec.ts` strings checked | `features/playground/playground-page.tsx` |
| M12 | "Hatch this remora" badge on the template page: preview, Markdown and HTML snippets, copy buttons | `features/hatchery/hatch-badge.tsx`, `template-page.tsx` |
| N20 | Public status page component. Reads `GET /api/health/deep`, refreshes every 60 s. No `fix` or `value` shown | `features/status/status-page.tsx` (**no route yet**, see below) |
| N7 | ⌘K / Ctrl+K command palette: pages from the sidebar and the signed-in user's remoras | `components/app/command-palette.tsx`, mounted in `app/app-layout.tsx` |
| N14 | Glossary tooltips: Disc, Wake, address balance, Sonar. Reef and shadow mode not wrapped (no static JSX hits) | `components/app/glossary.tsx`, wraps in `remora-page.tsx`, `funds-page.tsx`, `why-drawer.tsx` |
| N18 | Five a11y fixes: one unlabelled textarea, three icon-only combobox controls, one icon-only home link | `chat/composer-shell.tsx`, `ui/combobox.tsx`, `app/app-sidebar.tsx` |

Audit of the rest of N18 (reduced motion list, kit input primitives) is in the scratch audit, and the open decisions are in the plan.

## Checks (on this branch)
- `bun run typecheck`: pass
- `bun run lint`: pass
- `bun run test`: pass (web 59 files, server 42 files, and the other packages)
- `e2e --project=smoke --project=mobile`: **not run**. The testnet RPC returns HTTP 402 for every call, so Playwright's global setup stops before any test. See below.

## Not changed (no contract PR made)
- `packages/schema`, `apps/web/src/app/routes.tsx`, `apps/web/src/lib/api.ts`: untouched.
- `features/lab`: untouched.

## What I need from you

1. **Route for `/status`.** Please approve one line in `routes.tsx` (`{ path: "status", element: <StatusPage /> }`) so the N20 page is reachable. Details: `2026-10-23-huan-to-uy-n20-status-route.md`. Note: the `detail` text of each health item is public on this page. If the backend ever puts internal detail there, tell me and I will hide it.
2. **Tatum testnet key.** Every testnet call returns HTTP 402 (`Received HTTP status code 402`), including a plain balance read. This stops all e2e runs, including smoke. Please check the plan or quota on the testnet key (`TATUM_API_KEY_TESTNET`).
3. **Burner USDC.** The burner `0xd9703e08…4757` has 0 USDC. The playground needs at least 0.1 USDC, so u8 stays red. u6 also fails and may be related; its root cause is still open (merchant `sui-risk` returned 500 right after a successful settle).
4. **`MERCHANT_PAYTO_TESTNET`.** Still empty in my `.env`. Give me the address to use, or confirm the value for the dev stack.
5. **Backend requests.** The 15 items in `2026-10-23-huan-to-uy-w3-backend-requests.md` need a reply each: yes (with a date), no, or change.

## Corrections to earlier notes
- An earlier audit said F8 (export) and F9 (Claude Code card) only mounted on `MePage`. That was wrong: both are rendered on `/memory`. They are done.

## Notes for when you touch these
- Test ids and labels the e2e uses on `/playground` are unchanged. Copy text changed: "Try Scout with a $1 budget", "Questions here are not kept in memory", and the resting alert now adds "Try again later, or get your own Scout."
- The composer textarea now has `aria-label="Ask your remora"`. It does not use the word "Message", so `getByLabel("Message")` in the thread e2e is unaffected.
