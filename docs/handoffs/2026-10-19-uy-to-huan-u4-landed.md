# Handoff: Uy → Huấn, what U4 landed in your lane (please review)

- **Date:** 2026-10-19 · **From:** Uy's agent (goal U4, [ADR-0027](../adr/0027-flex-takeover.md), [ADR-0029](../adr/0029-u4-web-and-e2e.md)) · **To:** Huấn · **Status:** open for your review
- Claim: `2026-10-19-uy-to-huan-u4-claim.md`. Everything below is on `main`. The look and the voice are first drafts, so redo freely.

## Landed

| Item | Where | Notes |
|---|---|---|
| H0 rebrand | `index.html`, `public/favicon.svg`, `site.webmanifest`, `components/logo.tsx`, `index.css` tokens | inline-SVG fish placeholder, teal primary, `remora.theme`; chat placeholder "Message your remora…" |
| H0 skeletons | `features/{onboarding,remoras,memory-inspector,approvals}`, `features/remoras/why-drawer.tsx`, routes appended, sidebar nav | built on the `packages/schema` fixtures |
| Copy v1 | `apps/server/src/copy/keys.ts` | every copy key plus drafts for the PR #4 codes; `render()` checks placeholders |
| A1·ui | the existing hippo wallet sign-in, verified end to end | |
| A9·ui | `lib/network.ts`, `features/network/*`, `lib/api.ts` | header switch + TESTNET badge, disabled mainnet with a reason, `x-remora-network` on every call, dApp Kit sync, mismatch banner |
| A4·ui | `features/funds/*` | the ready vs coins split, Move (server-built tx, wallet signs, settling), Withdraw under Advanced |
| Disc panel + N10 | `features/funds/disc-panel.tsx`, `panic-button.tsx` | the owner's Discs over gRPC-web; Pause / Resume per Disc; **Pause all** in the header (one PTB) |
| E2E | `e2e/` (Playwright 1.62.0), `docs/e2e/README.md` | smoke (desktop + Pixel 7) + a testnet flow with the burner; `bun run e2e` passes 19/19 |
| UX notes | `docs/ux/README.md` | why each choice; change anything |

## Screenshots

See [`docs/e2e/screenshots/`](../e2e/screenshots/):

| Screenshot | Shows |
|---|---|
| `smoke-home.png`, `smoke-funds.png`, `smoke-remoras.png`, `smoke-remoras-scout.png`, `smoke-memory.png`, `smoke-approvals.png`, `smoke-onboarding.png` | desktop |
| `mobile-home.png`, `mobile-funds.png`, `mobile-remoras-scout.png` | phone |
| `testnet-funds-paused.png` | the funds page after Pause all |
| `testnet-funds-live.png` | the funds page after Resume |

## Left for you (not claimed)

- Visual design: the real logo/mark, spacing, empty states, dark-mode checks.
- The final copy voice: `keys.ts` is a first draft.
- W2 pages with real data: onboarding steps A3/A5/B1, the activity feed (N1) and approvals (N2/E4) from the server instead of fixtures, and the memory inspector (F3) on live memory.
- Once **contract PR #4** merges (it needs your approval): swap `apps/web/src/lib/contracts.ts` and `PENDING_COPY` to the `@remora/schema` exports.
- The server's sign-in message still says "Sign in to hippo". That's Uy's to rebrand (it's in `routes/auth.ts`).
