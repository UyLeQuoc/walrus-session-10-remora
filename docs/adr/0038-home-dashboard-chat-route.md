# ADR-0038: Home is the dashboard, chat moves to `/chat`, Memory gets two tabs

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Huấn

## Context
The index route `/` was hippo's chat: a serif greeting, hippo's examples, and a memory panel — none
of which describes Remora. A first-time visitor saw no remora, no Disc and no Funds, and had no idea
what to do first (plan C1). There were also two memory screens: `/memory` (a remora's namespaces) and
`/me` ("My memory", the owner's own memory in hippo's words), which a reader had to understand as two
different ideas.

The owner decided (brief Q1, Q5): `/` becomes Home, chat moves to `/chat`, and `/memory` + `/me`
merge into one Memory page with tabs.

## Decision
- **`/` is Home.** With no remora it shows the hero line and the setup checklist (§5.3); with one or
  more it shows the dashboard (plan D1). It has exactly one primary button: the next step.
- **Chat lives at `/chat`.** `New chat` and every Recents entry point at `/chat`. The shell requests
  (`requestNewChat`, `requestOpenChat`) navigate to `/chat`.
- **`/me` redirects to `/memory?tab=chat`.** Memory is one nav item with two tabs: **Remoras** (the
  old `/memory`) and **Chat** (the old `/me`). `/memory?remora=<id>` still deep-links a remora.
- **Routes are a shared contract.** `apps/web/src/app/routes.tsx` changes here:
  add `/chat` (ChatPage), make `/` render HomePage, and add `/me` → `<Navigate to="/memory?tab=chat">`.
  This is a **contract PR** (AGENTS.md; plan §1.2) and is listed as such in the progress log.

## Consequences
- The smoke test's `/` expectation moves from the chat how-strip to Home's copy; `/chat` gets its own
  smoke entry if needed (plan §7.2).
- `apps/web/src/lib/api.ts` is untouched; no request shape changes.
- The sidebar loses `Get started`, `My memory` and `How it works` as separate items; onboarding
  becomes the sidebar checklist and Memory absorbs "My memory" (plan B4, D6).
- Any external link to `/` that expected chat should point at `/chat`.

## Links
- [ADR-0036](0036-ui-foundation.md) · `docs/ux/ui-polish-plan.md` C1, C2, D6, §7.2 ·
  `apps/web/src/app/routes.tsx`
