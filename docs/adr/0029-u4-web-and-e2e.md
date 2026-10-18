# ADR-0029: W1 web (U4) and the E2E harness

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Uy Le (taken from Huấn's lane under ADR-0027, claim in `docs/handoffs/2026-10-19-uy-to-huan-u4-claim.md`)

## Context
U4 built Huấn's open W1 items: the H0 shell and skeletons, copy v1, A1·ui, A9·ui, A4·ui, a minimal Disc panel with the panic button, and the E2E harness. A few choices go beyond the H0 spec.

## Decision
- **Session network on the client** (A9·ui).
  - It lives in `localStorage` (`remora.network`) behind a tiny store.
  - `apiFetch` adds `x-remora-network` to every call.
  - `NetworkSync` keeps dApp Kit's client on the same network.
  - An unavailable network falls back to `/api/networks`' default.
- **Wallet-signed transactions execute over gRPC** (`useCoreExecutor` passed to `useSignAndExecuteTransaction({ execute })`). dApp Kit's default executor is JSON-RPC. The hook waits for finality and throws on an aborted transaction.
- **Discs are read in the browser** with `@remora/disc-sdk` over gRPC-web; the server isn't involved. The panic button pauses every live Disc in one PTB.
- **Skeleton pages parse the `packages/schema` fixtures,** so a contract change that breaks a page fails the build.
- **Contract shapes from PR #4** are mirrored in `apps/web/src/lib/contracts.ts` until it merges.
- **Copy v1:**
  - `apps/server/src/copy/keys.ts` has a `CopyKey → text` map and `render()` with checked `{placeholders}`;
  - drafts for the PR #4 codes sit in `PENDING_COPY`;
  - a test fails if any key lacks text.
- **E2E harness:**
  - **Playwright is pinned to 1.62.0**, which uses the locally cached Chromium 1234, so nothing is downloaded.
  - **The test wallet signs in Node** through `page.exposeFunction`, so the burner key never enters the page, and it only signs on `sui:testnet`.
  - The harness boots the real server with a placeholder `MEMWAL_ACCOUNT_ID` when none is set, since memory isn't under test.
  - `e2e` is a root workspace with `bun run e2e` / `bun run e2e:main`. Ports are 8797/5183.
- **`disc-sdk`'s `encodeHeader` is browser-safe** (no `Buffer`).

## Consequences
- Huấn reviews U4 through the handoff. Visual polish, the final voice, and the W2 pages are still his.
- Once PR #4 merges, swap `apps/web/src/lib/contracts.ts` and `PENDING_COPY` to the schema exports.
- The server's sign-in message still says "Sign in to hippo" (`apps/server/src/routes/auth.ts`, outside U4's paths), so Uy should rebrand it.

## Links
- [ADR-0026](0026-network-switch.md) · [ADR-0027](0027-flex-takeover.md) · [ADR-0028](0028-w1-rails-design.md) · [docs/e2e/README.md](../e2e/README.md) · [docs/ux/README.md](../ux/README.md)
