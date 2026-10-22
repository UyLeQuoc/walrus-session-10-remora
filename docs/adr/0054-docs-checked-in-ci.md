# ADR-0054: Docs are checked in CI: relative links resolve, and the README's Tatum calls are generated

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Uy (agent, goal U8)

## Context
The README, the threat model and the security notes make claims that judges will check: links to spikes, ADRs and tests, and a list of the Tatum calls Remora makes. Hand-kept lists drift, and a broken link reads as a broken claim.

## Decision
- **`bun scripts/check-links.ts`** fails on any relative link that doesn't resolve. It covers `README.md`, `docs/` and the package and app READMEs. External links and anchors aren't checked, and neither are fenced code blocks.
- **`bun scripts/tatum-calls.ts`**:
  - generates the README's table of server-side Sui gRPC calls from the code (API, runtime, facilitator, merchants, and the chain packages), between `<!-- tatum-calls -->` markers;
  - with `--check`, fails when the table is stale.
- The README names the two non-Tatum paths: the browser's gRPC-web to a public fullnode, and the memory package's registry lookups.
- Both run in CI's `check` job, after lint.

## Consequences
- Moving or renaming a doc means fixing its links in the same commit.
- Adding a Sui call means rerunning `bun run docs:tatum`.

## Links
- ADR-0021 (gRPC only); `scripts/`; `.github/workflows/ci.yml`
