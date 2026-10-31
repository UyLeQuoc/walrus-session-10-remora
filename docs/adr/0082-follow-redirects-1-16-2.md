# ADR-0082: Raise the follow-redirects override to 1.16.2

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (written by Uy's agent)

## Context
- **CI went red from `389548a` on.** Its `bun install --frozen-lockfile` stopped at the OSV install
  scanner. Nothing in those commits changed dependencies.
- **The cause is an advisory published after the lockfile was written.**
  - Advisory: GHSA-mrwp-f3q8-3g9p (CVE-2026-116689). Cross-realm `sensitiveHeaders` arrays are dropped,
    so custom credentials can follow redirects.
  - Affected: `follow-redirects` 1.16.0 up to 1.16.2.
  - Path: `@remora/server` › `@slack/bolt` › `axios` › `follow-redirects`. `axios` 1.20.0 pins 1.16.0.
- **The existing override wasn't enough.** It was `>=1.16.1` and resolved to 1.16.1, still
  inside the affected range. 1.16.2, released Oct 25, has the fix.

## Decision
- **Raise the override to `"follow-redirects": ">=1.16.2"`.** The lockfile now resolves 1.16.2.
- **Locally:** the scanner reports 0 advisories across 749 packages, and typecheck, lint and test pass.

## Consequences
- **CI's install step passes again.** The deploy installs 1.16.2.
- **The override can go** once `axios` depends on 1.16.2 or later itself.
- **The next advisory follows ADR-0057 first:** a lockfile patch inside the declared range. An override
  or a bump comes after that.

## Links
- [ADR-0073](0073-node-server-v2-and-vanilla-extract-override.md) ·
  [ADR-0057](0057-patched-undici-zod-body-parser.md) · GHSA-mrwp-f3q8-3g9p
