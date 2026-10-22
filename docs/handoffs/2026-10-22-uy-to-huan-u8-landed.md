# Landed: the public playground, health + diagnose, the threat model and the README (goal U8)

- **Date:** 2026-10-22
- **From:** Uy's agent (goal [U8](../goals/uy-08-launch-readiness.md); the claim is [u8-claim](2026-10-22-uy-to-huan-u8-claim.md))
- **To:** Huấn
- **Status:** landed on `main`

## What you can use now

**Contract (PR #10).** Each shape has a fixture in `packages/schema`:
- `PlaygroundLimits`, `PlaygroundAnswer`, `PlaygroundSession` (`src/playground.ts`, [ADR-0051](../adr/0051-playground.md));
- `HealthItem`, `RecentError`, `HealthReport`, `DiagnoseReport` (`src/ops.ts`, [ADR-0052](../adr/0052-health-diagnose-observability.md)).

**API.**

| Route | What it does |
|---|---|
| `GET /api/playground` | Whether a session can start now (and why not), the limits, the network. **Public** |
| `POST /api/playground/session` | Starts a session: a Scout of the visitor's own with a $1 Disc, signed by the playground wallet. Sets the `remora_playground` cookie and returns `{session, token}` |
| `GET /api/playground/session` | The session (cookie, or the `x-remora-playground` header) |
| `DELETE /api/playground/session` | Forgets the session in this browser (clears the cookie). The session itself ends on its own at `expiresAt`, when its Disc is revoked |
| `POST /api/playground/ask {question}` | One question. Answers `409 playground.no_questions` past the limit, and `409 playground.ended` after the end |
| `GET /api/health/deep` | The `HealthReport`: every dependency with its value, threshold and fix, plus the recent errors. `memory writes` turns degraded when the relayer fails behind its healthy `/health` ([ADR-0055](../adr/0055-memory-failures-in-health.md)) |

Every response carries `x-request-id`, and the server logs carry the same id (and `jobId` for jobs).

**Web (the items I claimed).**

| Where | Items |
|---|---|
| `/playground` | `features/playground/playground-page.tsx`: the intro, "Start my Scout", the $1 budget meter, questions left, the Disc and its issue/revoke transactions, answers with what they paid and "Why? Check its receipt", the last-question and resting alerts |
| `/lab/health` | `features/lab/health-board.tsx`: every item with its status, value, threshold and fix, the recent errors, "Check again" |
| Sidebar | "Try Scout, no wallet" for signed-out visitors (`features/threads/sidebar-team.tsx`) |

**CLI.** `bun run diagnose` is the deploy gate: every `DEPLOYMENTS` id onchain with its Move type, Tatum, the relayer, Walrus and the facilitator. It prints the fix and exits 1 when anything is down.

**Docs.** [Threat model](../threat-model.md), [Move security](../../packages/move/SECURITY.md), the [README](../../README.md), the [deploy runbook](../deploy.md), the [blog draft](../launch/blog-draft.md). CI checks every relative link and the README's Tatum call list ([ADR-0054](../adr/0054-docs-checked-in-ci.md)).

## The U8 exit (Phase D)
It passed on testnet, signed out the whole way, in 3.6 min. [docs/spikes/2026-10-22-u8-exit.md](../spikes/2026-10-22-u8-exit.md) has the timings and digests:
- a live Scout with a $1 Disc in 5.4 s;
- a paid answer in 9.9 s whose receipt verifies;
- the limit, the pool and the onchain revoke at the end;
- 9/9 health items;
- `diagnose`, both ways.

The same page has the **demo script dry run**: every beat against its testnet evidence, and the gaps to close before recording.

## Still yours (not claimed)
- **Visual design and copy** of `/playground` and `/lab/health`. They use your kit (`Alert`, `Badge`, `Progress`) with first-draft sentences.
- **The signed-out Home** and its links.
- **H6:** Walrus Sites.

## Notes for when you touch these pages
- **Test ids the e2e relies on:**
  - `playground-intro`, `playground-spent`, `playground-answer`;
  - `health-item` (with `data-status`), `health-status`;
  - `verify-verdict` on `/verify`.
- **Labels the e2e relies on:** "Start my Scout", "Ask Scout", the "Your question" field, "That was your last question", "Every playground Scout is taken", "its Disc is revoked onchain".
- **E2E.** `e2e/tests/u8.spec.ts` is the U8 exit (`--project=u8`). The playground wallet there is the burner, with a 3-minute session, 2 questions and a pool of 2. Each visitor is a browser context with its own `x-forwarded-for`.
