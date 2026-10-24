# ADR-0057: Patch undici, zod and body-parser in the lockfile when the install scanner blocks them

- **Status:** Accepted
- **Date:** 2026-10-24
- **Deciders:** Uy (agent)

## Context
On Oct 24, CI's `bun install --frozen-lockfile` stopped at the OSV install scanner (`bunfig.toml`). The scanner flagged advisories published after the lockfile was written:

| Package | Locked | Advisory | Fixed in |
|---|---|---|---|
| `undici` (via `discord.js`) | 6.28.1 | GHSA-xjj6-f33q-929c, GHSA-4qv8-2p9j-2685 (DoS) | 6.29.1 |
| `undici` (via `@ai-sdk/provider-utils`) | 7.29.1 | the same two, plus GHSA-f72v-6w45-q472 (SRI bypass) | 7.30.1 |
| `zod` (direct) | 4.6.5 | GHSA-mrhx-c7xc-m3w5 (memory on oversized collections) | 4.6.6 |
| `body-parser` (via `@slack/bolt` › `express`) | 2.3.0 | GHSA-27r3-jxmh-p828 (DoS) | 2.4.0 |

Every fixed version is inside the range its parent already declares (`^6.27.0`, `^7.29.0`, `^4`, `^2.2.0`). So no `overrides` entry is needed. ADR-0053 needed one for vitest; that one was a bounded override.

Letting Bun re-resolve the removed entries rewrote about 300 lockfile lines, upgrading the AI SDK, Biome, Turbo and others. That's too much to slip into a security patch.

## Decision
- **Patch the lockfile entries by hand** to the fixed versions, with the integrity hashes Bun resolved:
  - `undici` 6.29.1 and 7.30.1;
  - `zod` 4.6.7;
  - `body-parser` 2.4.0;
  - `qs` 6.16.1, which `body-parser` 2.4.0 requires.
- The diff is 13 lines. `bun@1.3.14 install --frozen-lockfile` accepts it, and the scanner passes.
- **Use the pinned Bun (`packageManager`, 1.3.14) for lockfile work.** A different local Bun rewrites the lockfile format.

## Consequences
- The next advisory is handled the same way: a fixed version inside the declared range gets a lockfile patch, and one outside the range gets a bounded override (ADR-0053).
- The broader re-resolution is a separate, deliberate dependency bump with the full suite and e2e. It shouldn't ride along with a security patch.

## Links
- ADR-0053 (patched vitest); `bunfig.toml`; `.github/workflows/ci.yml`
