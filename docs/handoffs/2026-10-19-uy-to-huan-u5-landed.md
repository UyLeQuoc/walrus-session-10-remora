# Landed: the W2 core product (goal U5), backend and the claimed UI

- **Date:** 2026-10-19
- **From:** Uy's agent (goal [U5](../goals/uy-05-w2-core-product.md); the claim is [u5-claim](2026-10-19-uy-to-huan-u5-claim.md))
- **To:** Huấn
- **Status:** landed on `main`

## What you can use now

**API.** Every route in [ADR-0032](../adr/0032-w2-runtime-api-and-channels.md) is live. The shapes are the contract in `packages/schema/src/api.ts` ([ADR-0033](../adr/0033-w2-api-contract.md), PR #5). The server tests parse their live responses with that contract, so a shape change fails CI.

**Web (`apps/web`).** These pages now run on live data ([ADR-0034](../adr/0034-w2-web-live-pages.md)):

| Page | Items |
|---|---|
| `/remoras` | H4 dashboard: your remoras, what's waiting (N2), one feed across all (N1) |
| `/remoras/new` | A6/B1 wizard: template → name → budget or watched addresses → one signature |
| `/remoras/:id` | Status and controls (N3 go live, B8 pause/retire, B9 rotate, B6 edit), budget + forecast (N5, B7), Ask (C1) or Teach + rules (C2), schedules (N12), sources (F2), feed with Why? (N4) and 👍/👎 (N19), first-run polling (N13) |
| `/approvals` | N2 inbox. E4 "Pay once" is signed by your wallet and settled by the merchant (ADR-0031). Proposed schedules take a plain Approve |
| `/memory` | F3 live inspector per remora: namespaces, blobs, expiry, recall search, F6 index-check warning |
| `/verify/:ref` | G3: public, checks a digest or Wake id against the chain |
| `/settings` | A7/H5 policy (timezone, quiet hours, language, notify level), A5 Telegram deep link, N10 panic |
| `/onboarding` | A6 steps ticked from live state |

**Shared code.**
- `features/remoras/api.ts`: a typed client for every route.
- `features/remoras/hooks.tsx`: `useOwner`, `useLoad` (with polling), and `RequireOwner`, the wallet-session gate.
- `features/remoras/feed-list.tsx`: the feed, Why? and feedback.

**Telegram (H1, A5).**
- Commands: `/remoras`, `/scout`, `/teach`, `/budget`, `/approvals`, `/pause`, `/panic`.
- "Scout, …" addresses a remora by name.
- 👍/👎 and Why? buttons.
- Linking is `/start link_<code>` from the settings page.
- It isn't verified live yet: no `TELEGRAM_BOT_TOKEN` was set.

## The W2 exit (Phase C)
It passed on testnet: [docs/spikes/2026-10-19-w2-exit.md](../spikes/2026-10-19-w2-exit.md) has the timings and digests.

Four UI-relevant fixes came out of it ([ADR-0035](../adr/0035-w2-exit-fixes.md)):
- the "Connect wallet to sign" bar (the session outlives the wallet connection);
- exact USDC amounts (`usdc()`);
- the inbox keeps a paid answer visible after the card leaves the pending list;
- the W2 reads no longer count against the per-IP ceiling.

## Still yours (not claimed)
- **Visual design and the final copy voice.** Every page uses the existing shadcn components and first-draft sentences. Copy keys are in `apps/server/src/copy/keys.ts`; web strings are inline in the pages.
- **SSE for the feed.** It polls for now. `RemoraEvent` in `packages/schema` is kept for the stream.
- **W3 UI:** price/webhook triggers, the Mini App, digests.

## Notes for when you touch these pages
- **Wallet session, not wallet connection.** A W2 page needs the server session (`/api/me` → `signedIn` + `walletAddress`), not just a connected wallet. `RequireOwner` handles this.
- **Signing.** Owner transactions go through `useSignAndRun` (gRPC execute), then the route's `/confirm`. The E4 payment uses `useSignTransaction` only: the merchant executes it.
- **E2E.**
  - `smoke` checks that every W2 page asks for a wallet when signed out.
  - `e2e/tests/w2.spec.ts` is the signed-in W2 exit on testnet. It starts the facilitator (8798) and merchants (8799) as well.
