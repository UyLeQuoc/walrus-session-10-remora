# @remora/disc-sdk

PTB builders and readers for the Disc (`remora::disc`, ADR-0025). It's transport-agnostic: pass `client.core` from `@remora/chain` (Tatum gRPC, Node) or from a gRPC-web `SuiGrpcClient` (browser).

- **Owner:** Uy Le (`@UyLeQuoc`) (see `docs/team-split.md` §2)
- **Features:** E2 (builders), A4·be, B7·be, B9·be, N10·be; `disc.fetch` (the x402 client) comes with E3
- **Builders:**
  - owner: `buildIssue`, `buildRevokeAndReissue`, `buildRevoke`, `buildRotate`, `buildPause` (many Discs, i.e. the panic button), `buildSetPayees`, `buildSetPerPaymentCap`;
  - remora: `buildPay(cfg, args, { sender, gasOwner })`, sponsor-ready.
- **Readers:** `getDisc`, `getAllowance` (BCS of `sui::allowance` 1.82), `findDiscId` (registry table), `listOwnerDiscs`, `paidEvents`, `getFundsSplit`
- **Errors:** `toDiscError(err)` maps clever errors and validator rejections to `ERROR_CODES`.
- **Status:** v1, used by the testnet e2e (`spikes/disc/e2e.ts`, `docs/spikes/2026-10-19-disc-testnet.md`). Config IDs: `packages/schema` `DEPLOYMENTS` (contract PR #3).
