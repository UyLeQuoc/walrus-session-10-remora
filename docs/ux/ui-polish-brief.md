# Brief: implement the Remora UI/UX polish plan

You are implementing `docs/ux/ui-polish-plan.md` in this repo (`/Users/huanngdev/Documents/dev/walrus-session-10-remora`).
The plan is the source of truth. Read it fully first, then `AGENTS.md`, `docs/code-rules.md`, `docs/ux/README.md`.

## Decisions already made by the owner (Huấn), use these, do not ask
- Q1: YES. `/` becomes Home (setup checklist when no remora, dashboard when there are remoras); chat moves to `/chat`.
- Q2: keep teal, softened (tokens in plan §2.1).
- Q3: keep Pause all in the header as a small ghost icon + ConfirmAction.
- Q4: hide Guide from nav in Phase 2; rewrite it for Remora at the end of Phase 3.
- Q5: YES. Merge `/memory` + `/me` into Memory with tabs "Remoras" / "Chat"; `/me` redirects to `/memory?tab=chat`.
- Q6: drop the serif font everywhere (all sans).
- Q7: YES. Remora-specific chat examples.
- Q8: one panic mechanism. FIRST read the server route behind `api.panic` / `api.panicConfirm` (read-only, `apps/server/src/...`) and check whether it pauses Discs that are not attached to a remora. If it does not, `usePanic()` must do both: server panic for remoras AND client `buildPause` for any remaining live Discs, in a way that needs the fewest signatures. Write what you found in the progress log.
- Q9: no "before" screenshots committed.

## Hard rules (breaking any of these is a failure)
1. Edit ONLY: `apps/web/**` (NOT `apps/web/src/features/lab/**`), `e2e/**`, `docs/ux/**`, `docs/e2e/**`, `docs/adr/**` (new ADRs + README row only), `docs/handoffs/**` (new notes only).
   NEVER edit `apps/server/**`, `packages/**`, `reference/**`, Move, `.env`, CI.
2. `apps/web/src/app/routes.tsx` and `apps/web/src/lib/api.ts` are shared contract files. You MAY edit `routes.tsx` for Q1/Q5 (append/adjust routes) but keep the change minimal and list it in the progress log under "Needs contract PR". Do not change `lib/api.ts` signatures.
3. Do NOT run `git commit`, `git push`, `git stash`, `git reset`, `git checkout -- …`, or any destructive git command. Leave all changes in the working tree.
4. Do not change behaviour (API calls, signing flows, polling) except where the plan says so (ConfirmAction steps, panic unification).
5. Follow plan §2 design rules exactly: tokens only (no palette classes like amber-500, no hex), button size matrix, Page/PageHeader on every page, no raw `<button>` outside `components/ui`, no `text-[Npx]`.
6. Keep E2E selectors working. Where a selector must change (plan §7.2), update the test in the same step.
7. Match the surrounding code style: Biome formatting, TypeScript strict, short JSDoc at the top of each component file like existing files, no new dependencies unless already in `apps/web/package.json` (check before using any Radix/Base UI primitive; the kit in `components/ui` already has dropdown-menu, select, tabs, radio-group, alert-dialog, tooltip, progress, combobox, empty, skeleton, spinner).

## How to work
Work phase by phase as in plan §6 (Phase 0 → 1 → 2 → 3 items 1–12 → 4). After EACH phase:
1. Run from repo root: `bun run typecheck && bun run lint && bun run test`. Fix everything until green (use `bun run format` for formatting).
2. Run E2E smoke + mobile: `bun run --filter @remora/e2e e2e -- --project=smoke --project=mobile`. Docker Postgres is already up. Fix until green.
3. Append a section to `docs/ux/ui-polish-progress.md`: phase, files changed, plan IDs done (A1, B2, …), test results (pass counts), anything skipped and why, "Needs contract PR" items, open issues.
Then continue to the next phase without waiting.

At the very end (after Phase 4) also run `bun run --filter @remora/e2e e2e -- --project=testnet --project=w2` (testnet burner only; it spends a little testnet USDC, that's allowed). If w2 fails for reasons unrelated to UI (chain/relayer flakiness), note it and retry once.

Then check the plan §7.4 "Done khi" list: run each grep and paste the output in the progress log. Tick the checkboxes in the plan file (§6, §7.4) for what is really done.

## ADRs
Write `docs/adr/0036-ui-foundation.md` and `docs/adr/0037-network-dropdown.md` (and `0038-home-dashboard-chat-route.md` for Q1/Q5) from `docs/adr/0000-template.md`, add rows to `docs/adr/README.md`, and update `docs/ux/README.md` to match the new UI. Status: Accepted, Deciders: Huấn.

## Handoff notes
Write `docs/handoffs/2026-10-19-huan-to-uy-hippo-auth-strings.md` (server sign-in message "Sign in to hippo" and cookie names in `apps/server/src/routes/auth.ts` need rebranding by Uy) and, at the end, `docs/handoffs/2026-10-19-huan-to-uy-ui-polish-landed.md` (routes changed, contract PR needed for routes.tsx, button/confirm changes that affect the demo video).

Be thorough. Do not stop until every phase is done and all checks are green, or until something is truly blocked (then write exactly why in the progress log).
