# ADR-0033: The W2 API shapes are a contract in `packages/schema`

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Uy (agent, U5, contract PR)

## Context
The W1 page skeletons (U4) ran on fixtures of `RemoraConfig`, `RemoraEvent`, `ApprovalRequest`, `MemoryRow` and `WakeView`. The real W2 API (ADR-0032) returns database-backed rows. For example, a feed item has `remoraId`, `payload`, `receiptId` and `feedback`, where `RemoraEvent` has per-type fields meant for a later SSE stream. The UI (Phase B) needs typed responses that the server is tested against, so a mismatch fails CI instead of the demo.

## Decision
- Add `packages/schema/src/api.ts` with:
  - `RemoraView` and `CreateRemoraResponse`;
  - `FeedItem` with `FEED_TYPES`, and `WhyResponse`;
  - `BudgetMeter`, `OwnerSettings`, `SchedulePreview`;
  - `VerifyResult` and `VerifyCheck`;
  - `InspectorResponse`;
  - `ApprovalPayTx`.
- Each has a fixture in `packages/schema/fixtures/` that the fixture test parses.
- `ApprovalRequest.kind` gains `schedule`, for proposals from a remora (ADR-0032).
- The server's runtime test parses its live responses with these schemas: remoras, feed, Why?, settings and approvals.
- `RemoraEvent` stays as is, as the future SSE event shape. The web feed uses `FeedItem`.

## Consequences
- The web app replaces its U4 fixtures with these types and real calls.
- Any server change that breaks a shape fails the runtime test.
- Adding a feed type means a contract PR: `FEED_TYPES` plus a fixture.

## Links
- `packages/schema/src/api.ts`, `packages/schema/fixtures/*.json`, `apps/server/src/runtime/runtime.test.ts`
- ADR-0032 (W2 API), ADR-0029 (U4 web and fixtures)
