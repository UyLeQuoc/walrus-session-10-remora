# Goal U4: Take Huấn's open W1 items (web shell, funds UI, network switch, E2E)

**Owner:** Uy's agent, under [ADR-0027](../adr/0027-flex-takeover.md) · **Runs in:** the main checkout, on
`main` · **Depends on:** U3 done (`/api/networks`, `/api/funds`, disc-sdk, W1 exit) · **Network:**
testnet only (ADR-0024, ADR-0026)

**Goal:** the web app shows the W1 rails on testnet, with an E2E harness that proves it. Only items
Huấn hasn't started.

## Step 0: claim (required)
- `git pull --rebase origin main`. Read `git log --since=2026-10-19 -- apps/web e2e apps/server/src/copy`
  and `docs/handoffs/`. **Skip any item Huấn has started or claimed.**
- Push `docs/handoffs/<date>-uy-to-huan-u4-claim.md` listing the items taken, **before editing any web
  file**.

## Read first
- `docs/goals/huan-00-web-shell-e2e.md` (H0 is the detailed spec for steps 1–3 below)
- `docs/handoffs/2026-10-19-uy-to-huan-*.md` (network switch, error codes, PR #3)
- `docs/remora-spec.md` §12.1 (Detect funds UI), §12.12 (UX); ADR-0026; `packages/schema` fixtures;
  `packages/disc-sdk`

## Allowed paths
`apps/web/**`, `e2e/**`, `apps/server/src/copy/**`, `docs/ux/**`, `docs/e2e/**`, `docs/handoffs/**`,
`docs/adr/**`. Limit edits to the claimed items. `packages/schema` changes go through a contract PR.

## Steps
1. **H0 shell:** rebrand hippo → Remora (name, logo placeholder, theme tokens, titles, meta). Keep the
   UI kit.
2. **H0 page skeletons, driven by fixtures:** `/onboarding`, `/funds`, `/remoras`, `/remoras/:id`,
   `/memory`, `/approvals`, a "Why?" drawer and the panic button placement. Register them in
   `routes.tsx` (append-only, and keep the `/lab/*` slot).
3. **H0 copy v1 + error copy:** first-draft text for every key in `packages/schema/copy-keys.ts`,
   including the new `error.disc.*` sentences from the handoff.
4. **A1·ui wallet sign-in:** the ported dapp-kit connect flow works against the server session.
5. **A9·ui network switch** (ADR-0026, handoff):
   - a header switch and a TESTNET badge;
   - a disabled state from `GET /api/networks`;
   - `x-remora-network` on every request through the shared fetch wrapper;
   - a dapp-kit network sync and a wallet-mismatch warning;
   - a gRPC-web client per network.
6. **A4·ui funds:** `/funds` reads `/api/funds` for the owner and each remora. It shows:
   - the "ready (address balance) · in coins → Move" split and a settling state;
   - **Move to address balance**: the server builds the unsigned tx, and the wallet signs and executes
     it;
   - **Withdraw to coin** under Advanced;
   - all of it per network.
7. **Disc panel (minimal, for the W1 demo):** list the owner's Discs (`listOwnerDiscs` over gRPC-web).
   The panic button pauses every Disc in one PTB (`buildPause`), signed by the wallet.
8. **E2E harness (H0 step 4):**
   - Playwright, plus an injected wallet-standard **test wallet** reading `E2E_BURNER_KEY` from `.env`;
   - smoke tests (the app loads, onboarding renders, `/funds` shows the split);
   - a **testnet flow**: switch to testnet → Detect funds → move a coin to the address balance → see
     the Disc list → panic-pause → unpause;
   - `bun run e2e`. Web dev runs on `WEB_PORT=5183`, never 5173.
9. **Docs:** `docs/e2e/README.md`; `docs/ux/` notes for UX choices; an ADR for any decision; a
   **handoff to Huấn** summarizing what landed, what's left, and screenshots.

## Done when
- [ ] The claim handoff is pushed before any web edit
- [ ] Every claimed page renders on desktop and mobile; network switch and funds work on testnet with the
      burner wallet
- [ ] `bun run e2e` passes locally (smoke + testnet flow); typecheck, lint and test are green; CI is
      green
- [ ] The handoff to Huấn is written; pushed to `main`

## Never
- Edit an item Huấn has started or claimed. Use real owner accounts (only the burner or test keys).
- Commit `E2E_BURNER_KEY` or `.env`. Touch mainnet. Deploy.
- Use ports 8787/5173.
