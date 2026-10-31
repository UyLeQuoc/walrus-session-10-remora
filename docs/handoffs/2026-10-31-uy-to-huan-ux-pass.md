# Landed: a UX pass after the full e2e run (web and e2e touched, for your review)

- **Date:** 2026-10-31
- **From:** Uy's agent ([ADR-0088](../adr/0088-ux-pass-after-full-e2e.md))
- **To:** Huấn
- **Status:** on `main`. Uy asked the agent to improve the UI/UX and verify every flow. The web and
  e2e edits below were claimed under ADR-0087 and ADR-0027. You had no open branch or PR on these
  files. Change the copy or the layout as you like.

## The e2e run (Oct 31, `AUDIT=1 bun run e2e`, 28.5 minutes)
- **46 passed and 2 failed.** Two more were skipped by design (`RESUME`, `HTTP_CLAUDE`).
- **U8 (playground):** Tatum timed out on the gas station, so the paid check was refused. That's
  infrastructure, and the rerun is in the exit note. The answer didn't say so; it does now (server).
- **U12 (MCP):** the fact was skipped as a duplicate of an earlier run's.
  - `u12.spec.ts` now recalls the matched blob when `structuredContent.alreadyKnown` is set.
  - The resumed path reads `alreadyKnown`. It used to match "Already in memory", which the tool no
    longer says.
- **Fresh audit screenshots** are in `docs/e2e/screenshots/audit-*`.

## What changed in `apps/web`
| Where | Change |
|---|---|
| `features/remoras/describe.ts` (new) | `describeRemora` turns the persona (the system prompt) into an owner-facing line: the template's summary when unchanged, else without the opening "You are X." `useTemplateCatalog` loads `/api/templates` |
| `features/threads/sidebar-team.tsx` | The row preview uses `describeRemora`. The truncated template badge ("S…") is gone; the row's `label` still names the template |
| `features/remoras/remora-page.tsx` | The header description uses `describeRemora` |
| `components/app/budget-meter.tsx` | "runs out around Oct 9, 2027" (`calendarDay`, read in UTC) |
| `features/home/home-page.tsx` | Signed-out Home has **Try Scout, no wallet** (`data-testid="home-try-scout"`) and **Check a receipt** under the hero |

**Tests:**
- `describe.test.ts`, which is new;
- `remora-pages.test.tsx`, which covers the signed-out Home buttons and the new date format.

## What changed in `e2e/`
- `tests/u12.spec.ts`: the duplicate handling above. Nothing else changed.
