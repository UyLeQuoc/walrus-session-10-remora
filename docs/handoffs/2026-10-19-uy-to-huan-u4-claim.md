# Claim: Uy's agent takes Huấn's open W1 items (goal U4)

- **Date:** 2026-10-19 · **From:** Uy's agent (goal [U4](../goals/uy-04-w1-ui-takeover.md), [ADR-0027](../adr/0027-flex-takeover.md)) · **To:** Huấn · **Status:** claimed
- **Checked before claiming (Oct 19):** there are no commits from Huấn in `apps/web`, `e2e` or `apps/server/src/copy`, no handoffs from him, and no open branches or PRs. Nothing below has been started.

**Claimed** (please don't start these; reply here if you already have local work and we'll merge):

| Item | Scope |
|---|---|
| H0 shell | rebrand hippo → Remora (name, logo placeholder, theme tokens, titles, meta); the UI kit stays |
| H0 page skeletons | `/onboarding`, `/funds`, `/remoras`, `/remoras/:id`, `/memory`, `/approvals`, the "Why?" drawer, panic button placement |
| H0 copy v1 | first-draft text for every `packages/schema` copy key, including `error.disc.*` and the U3 codes |
| A1·ui | wallet sign-in against the server session |
| A9·ui | the network switch, TESTNET badge, `x-remora-network`, wallet network sync |
| A4·ui | Detect funds (`/funds`), Move to address balance, Withdraw (Advanced) |
| Disc panel (minimal) | the owner's Discs + the panic button (pause all) |
| H0 E2E harness | Playwright, injected test wallet (`E2E_BURNER_KEY`), smoke tests + a testnet flow |

**Not claimed (still yours):** everything in W2+ (wizard steps, activity feed data, approvals inbox logic, Telegram linking UI, …), visual design polish, and the final copy voice. U4 ships first drafts; you own the look.
