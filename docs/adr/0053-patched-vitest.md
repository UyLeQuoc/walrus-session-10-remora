# ADR-0053: Pin vitest 4.1.12 when the install scanner blocks @vitest/mocker

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Uy (agent, goal U8)

## Context
On 2026-10-22 the OSV scanner (ADR-0043) blocked `bun install` in CI on the U8 contract PR. The cause was two new advisories for `@vitest/mocker` 4.1.11, reached through `vitest`:
- unauthenticated manual-mock registration (CVE-2026-112949);
- a Windows backslash traversal (CVE-2026-112950).

OSV lists 4.1.12 as the fix in the 4.x line, and 5.0.3 in 5.x. An open floor (`>=4.1.12`) resolved to vitest 5.0.5, a major upgrade nobody asked for.

## Decision
- Follow ADR-0043's rule, bounded to the major already in use:
  - root `overrides` gets `vitest ^4.1.12` and `@vitest/mocker ^4.1.12`;
  - every workspace's `vitest` range becomes `^4.1.12`.
- Moving to vitest 5 is a separate decision.

## Consequences
- CI installs again. Typecheck, lint and every package's tests pass on 4.1.12.
- A caret override still takes later 4.x patch releases.

## Links
- ADR-0043; `package.json` `overrides`; CI run 39717279044 (the blocked install)
