# Goal H1: review U13 (openbot's UI), decide ADR-0041, copy pass (Huấn)

**Owner:** Huấn · **Runs in:** your main checkout, on `main` (ADR-0022) · **Depends on:** U13 ✅ (PR #15)
· **No E2E in this goal** ([ADR-0071](../adr/0071-huan-goals-without-e2e.md)).

Uy's agent rebuilt all of `apps/web` in openbot's UI while you were away. `apps/web` is still your lane,
so this goal takes it back: review what changed, fix what reads or looks wrong, and close the open
decisions the U13 handoff left you.

## Read first
- [U13 landed handoff](../handoffs/2026-10-27-uy-to-huan-u13-landed.md), [U13 exit](../spikes/2026-10-27-u13-exit.md)
- [ADR-0069](../adr/0069-openbot-ui-ported-under-polyform.md), [ADR-0070](../adr/0070-u13-openbot-ui-implementation.md)
- [ADR-0041](../adr/0041-ascii-ocean-empty-chat.md) (still Proposed), [ADR-0068](../adr/0068-mit-license.md)
- `docs/ux/README.md` (shell slots: `ShellHeaderStart`, `ShellHeaderEnd`, `ShellSidePanel`)
- `apps/web/src/openbot/README.md` (file map and license frame)

## Allowed paths
`apps/web/**` (except `features/lab`), `apps/server/src/copy/**` (strings only), `docs/ux/**`, `docs/adr/`
(new ADRs only).

## Steps
1. **Walk every route** with `bun run dev` on fixtures, at 1280 px and 375 px, light and dark:
   `/chat`, a thread, a room, `/remoras`, `/remoras/:id`, `/remoras/new`, `/memory`, `/approvals`, `/funds`,
   `/onboarding`, `/hatchery`, a template, `/playground`, `/verify`, `/connections`, `/settings`, `/guide`.
   Note every broken layout, clipped text, wrong colour or missing focus ring in `docs/ux/u13-review.md`.
2. **Check the shell:** roster resize and snap to 88 px, Cmd/Ctrl+B, the side panel (Why?, Memory), the
   phone bottom nav, network and panic controls in both positions, Cmd/Ctrl+K.
3. **Fix what you found,** smallest change first. Keep test ids, labels and routes unchanged. Anything
   derived from openbot goes in `apps/web/src/openbot/` with the source header; the rest stays MIT.
4. **Copy pass.** Read every string in the new layout (buttons, empty states, errors, side-panel titles).
   Fix the ones that read wrong; bot strings live in `apps/server/src/copy/`.
5. **Decide ADR-0041** (the ASCII ocean behind the empty `/chat`): keep it, recolour it, or remove it.
   Don't rewrite 0041; write a new ADR that accepts or supersedes it, and update `docs/adr/README.md`.
6. **ADR-0036 / ADR-0039:** confirm in `docs/ux/README.md` which page-component rules still stand now
   that their look is superseded.

## Done when
- [ ] `bun run typecheck && bun run lint && bun run test` green (page and shell tests updated if needed)
- [ ] `docs/ux/u13-review.md` lists every issue found, each marked fixed or deferred with a reason
- [ ] ADR-0041 decided by a new ADR, row added to `docs/adr/README.md`
- [ ] Screenshots of the fixed routes (1280 + 375, light + dark) posted to the team chat
- [ ] Rebased and pushed to `main`

## Never
- Move openbot code out of `apps/web/src/openbot/` or drop its headers.
- Change `routes.tsx`, `lib/api.ts` or `packages/schema` (contract PR only).
- Edit `features/lab` or backend logic.
