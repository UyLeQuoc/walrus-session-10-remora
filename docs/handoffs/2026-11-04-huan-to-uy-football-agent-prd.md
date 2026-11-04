# Huấn → Uy: football-agent PRD and implementation gates

Date: 2026-11-04. Planning handoff only; no backend, contract, database or deploy changes made.

Huấn requested a detailed football PRD for Track 2 and a commit/push of the documentation. The
[PRD](../prd/football-agent-track-2.md) interprets Track 2 as Smart Agents for Real Life: a football
research agent on Remora with a personal prediction journal. Group pick'em remains P1; a separate
Track 1 entry is not decided. [ADR-0108](../adr/0108-football-agent-prd.md) records this boundary.

## Backend requests when an implementation goal is claimed

1. Run the provider coverage/entitlement/rights spike in PRD §7.4. Recommended full stack is
   API-Football Pro plus The Odds API Starter; a lighter football-data.org Free route is documented.
   These plans have not been purchased or authenticated in this task.
2. Audit existing Scout, schedule jobs, payment entitlement/delivery and the separate Receipts repo
   before reusing them. Current odds are a demo snapshot; current rooms are single-owner.
3. Propose additive football contracts through the existing contract workflow. Build adapters,
   server cutoff/append-only predictions, 90-minute result resolution and deterministic scoring.
4. Use real Walrus snapshot writes/recall and distinguish usefulness, forecast skill and source
   value. Preserve the operator-account reality; do not promise user-owned accounts that are absent.
5. Gate any paid report on upstream rights. Do not wrap a vendor's raw feed in an x402 endpoint.
   No autonomous vendor purchase, provider contact, schema push, deploy or mainnet publish is requested.
6. Preserve Tatum native gRPC and the visible fallback from ADR-0097; do not introduce JSON-RPC.

## Decisions needed before build

- Claim owner/time budget without disrupting the Nov 9 launch target.
- Confirm track/submission intent and primary league using real upcoming fixtures.
- Decide provider spend and lawful content/fulfillment for the first research merchant.
- Freeze P0 contracts so Huấn can build UI/copy/E2E inside his lane.

Huấn's prospective slice: follow/setup, fixture/brief view, journal, learning/Why states, copy and
burner E2E. The full test matrix, failure cases, cut order and date assumptions are in the PRD.
