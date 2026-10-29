# ADR-0073: @hono/node-server 2.x and a bounded @vanilla-extract/css override, when the install scanner blocks them

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Huấn (agent); Uy reviews in PR #16

## Context
On Oct 29, CI's `bun install --frozen-lockfile` stopped at the OSV install scanner (`bunfig.toml`) on two
advisories published after the lockfile was written. ADR-0057's lockfile patch didn't apply, because
neither had a fix inside its declared range:

| Package | Locked | Advisory | Fix |
|---|---|---|---|
| `@hono/node-server` (server, facilitator, merchants, spikes w1/w2) | 1.19.17, the last 1.x | GHSA-rmxm-3fg6-px4f (`serveStatic` decodes the path twice) | 2.x |
| `deepmerge` (via `@mysten/dapp-kit` › `@vanilla-extract/css` 1.21.2, pinned exactly) | 4.3.1, the last release | CVE-2026-93753 (prototype poisoning) | none; `@vanilla-extract/css` 1.21.3 replaces it with `deepmerge-ts` |

Remora uses only `serve()` from the adapter, and v2's public API is unchanged (its release notes).

## Decision
- Bump `@hono/node-server` to `^2.1.5` in the five packages that use it. `hono` stays on 4.x (v2's peer
  range is `^4 || ^5`).
- Add a bounded override `"@vanilla-extract/css": "1.21.3"` (exact, as ADR-0053's are bounded), until
  `@mysten/dapp-kit` pins it or a later version itself.
- The lockfile diff is 21 lines; the scanner reports 0 advisories; lint, links, typecheck, test, build and
  `bun pm scan` pass locally.

## Consequences
- Drop the override when `@mysten/dapp-kit` depends on `@vanilla-extract/css` ≥ 1.21.3.
- The next advisory still follows ADR-0057 first (lockfile patch in range), then an override or a bump.
- The servers' start-up is unchanged; the deployed API, facilitator and merchants get the new adapter on
  their next deploy (Uy).

## Links
ADR-0053, ADR-0057; `bunfig.toml`; `.github/workflows/ci.yml`; PR #16
