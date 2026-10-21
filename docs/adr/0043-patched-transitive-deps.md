# ADR-0043: Pin patched versions with root `overrides` when the install scanner blocks

- **Status:** Accepted
- **Date:** 2026-10-21
- **Deciders:** Uy (agent)

## Context
`bunfig.toml` runs `@bun-security-scanner/osv` on every `bun install`. A fatal advisory aborts the install. In CI, a warning also cancels it, because there is no terminal to confirm. On 2026-10-21 new advisories landed for three packages and CI failed at install on an unrelated PR:
- `vite` 8.3.0: the bundled launch-editor;
- `follow-redirects` 1.16.0: credential headers on redirects, reached through `@slack/bolt` and `axios`;
- `hono` 4.13.8: `serveStatic` double decoding.

The scanner has no ignore list.

## Decision
- Raise direct ranges to the first clean releases checked against OSV `querybatch`:
  - `vite` ^8.3.5;
  - `hono` ^4.13.13 in every workspace.
- Pin each one in the root `overrides` (`vite >=8.3.5`, `hono >=4.13.13`, `follow-redirects >=1.16.1`). Transitive and peer copies, such as `@tailwindcss/vite`'s `vite` and `axios`'s `follow-redirects`, then resolve to the patched version as well. An existing lockfile entry can't keep them back.
- When this happens again, use the same fix: find the first version OSV reports clean, add an override, and record it here or in a new ADR.

## Consequences
- CI installs again. Typecheck, lint, the full test suite and the web build pass on the new versions.
- Overrides are floors, not exact pins, so later patch releases still flow in.

## Links
- `package.json` `overrides`, `bunfig.toml`, CI run 39618183682 (the failed install)
