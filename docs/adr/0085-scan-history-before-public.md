# ADR-0085: Scan the whole git history for secrets before the repo goes public

- **Status:** Accepted
- **Date:** 2026-10-31
- **Deciders:** Uy (written by Uy's agent)

## Context
- **The repo goes public on Nov 9** ([ADR-0017](0017-github-repo-private-until-submission.md)). The
  form needs a public repo.
- **CI's secrets step checks only the current tree.** It fails on a tracked `.env` or a reference clone.
  A key committed and then deleted would still sit in history, and making the repo public publishes
  it.
- **No scanner is installed** (gitleaks, trufflehog), and the rules say no unvetted downloads.

## Decision
- **`bun run secrets:history`** (`scripts/scan-history.ts`) reads every added line on every branch.
  - It looks for secret-shaped strings: Sui private keys, PEM keys, Tatum, OpenRouter, Anthropic,
    OpenAI, Telegram, Slack, GitHub, Enoki, Google and AWS keys, Postgres URLs with a real password,
    and 64-hex values assigned to `*PRIVATE_KEY`, `*SECRET` or `*API_KEY`.
  - It also checks for any `.env` file that was ever committed.
  - It prints commit, path and pattern, never the value, and exits 1 on a finding.
- **Run it right before the repo goes public.** It isn't a CI step: CI checks out one commit, and a full
  fetch on every push costs more than it finds.
- **First run, Oct 31 (`dc15404`):** clean.
  - 176 commits and 139,803 added lines.
  - No `.env` file was ever committed.
  - Three `suiprivkey…` strings are 12–16 characters long: test placeholders, not keys.
- **On a finding:** rotate the key first. Rewriting history needs a force-push, and that is Uy's call.

## Consequences
- **The Nov 9 checklist gets one command** before the visibility switch.
- **Patterns miss what they don't know:** a secret with no known shape can slip through. The run is a
  check, not a guarantee. U9 Phase D rotates the keys before the deploy anyway.

## Links
- [ADR-0017](0017-github-repo-private-until-submission.md) ·
  [submission draft](../launch/submission-draft.md) · `.github/workflows/ci.yml` (the secrets step)
