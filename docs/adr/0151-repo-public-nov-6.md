# ADR-0151: The repo went public on Nov 6, with history as it is

- **Status:** Accepted
- **Date:** 2026-11-06
- **Deciders:** Uy ("chuyển repo public"; on the file name below: "Public luôn, không sửa"), Uy's agent

## Context
- **The form needs a public repo.** [ADR-0017](0017-github-repo-private-until-submission.md) kept
  it private until Nov 9 at the latest. [ADR-0085](0085-scan-history-before-public.md) asks for a
  clean `bun run secrets:history` right before the switch.
- **Uy asked for it on Nov 6.** That is three days before the planned date.
- **The scan, Nov 6, 06:40 UTC:** clean.
  - It ran on a fresh `git clone --mirror` of GitHub, so it read exactly what going public
    publishes: 16 branches, 2 tags and the 24 `refs/pull/*` heads.
  - It read 361 commits and 224,245 added lines.
  - Nothing was secret-shaped, and no `.env` file was ever committed.
  - `reference/` was never tracked. The largest blob is under 5 MB; videos stay gitignored.
- **One thing a reader can see.** The file name of an uncommitted Track 1 draft in Uy's main tree
  (under `docs/ideas/`) is in ten goal files (U14, U16–U19, spec and prompt). Their "never touch"
  lines name it, so it is in six commits. Taking it out of history needs a rewrite and
  a force-push. Uy was asked and chose to go public with it as it is.

## Decision
- **Public now:** `gh repo edit UyLeQuoc/walrus-session-10-remora --visibility public
  --accept-visibility-change-consequences`, Nov 6, about 06:45 UTC. An anonymous request answers
  200.
- **History is published as it is.** No rewrite, no force-push, and the ten goal files stay
  unchanged.
- **The checklists say it's done:**
  - the [submission draft](../launch/submission-draft.md)'s missing item 3, the requirements row
    and the GitHub field;
  - [remora-plan.md](../remora-plan.md)'s flip item.

## Consequences
- **Everything pushed from now on is public on push.** That covers branches, PRs and commit messages.
  The rules already keep keys and `.env` values out of commits; CI's secrets step still checks
  each tree.
- **A new secret in history can't be taken back by a delete.** On a finding: rotate the key first
  (ADR-0085).
- **Uy's uncommitted `docs/README.md` and that draft stay uncommitted.** They are in Uy's main
  tree on `u16-wow`, not on GitHub.
- **Left for the form:** the video link, the blog, the Tatum ID and the contact fields.

## Links
- [ADR-0017](0017-github-repo-private-until-submission.md) ·
  [ADR-0085](0085-scan-history-before-public.md) ·
  [submission draft](../launch/submission-draft.md) ·
  <https://github.com/UyLeQuoc/walrus-session-10-remora>
