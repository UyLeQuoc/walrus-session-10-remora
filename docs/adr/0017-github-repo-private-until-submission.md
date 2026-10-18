# ADR-0017: GitHub repo stays private until submission

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
The project needs a GitHub repo for collaboration with Huấn and for the submission. The rules require a
**public repo with a working demo** by the deadline (Nov 10, 2026, 17:00 UTC). The docs contain contest
strategy, competitor analysis and team planning.

## Decision
- Repo: **`UyLeQuoc/walrus-session-10-remora`**, named in the same style as `walrus-session-8-chatbots`
  (hippo).
- It stays **private** during the build.
- Uy makes it **public before submitting**, on Nov 9 at the latest, with
  `gh repo edit UyLeQuoc/walrus-session-10-remora --visibility public --accept-visibility-change-consequences`.
- Huấn is added as a collaborator once their GitHub handle is known.

## Consequences
- The submission checklist ([remora-plan.md](../remora-plan.md)) includes the visibility flip and a
  check that the public repo renders.
- Before going public, review the docs for anything that shouldn't be published (`docs/` is fine;
  `.env*` and `reference/` are gitignored).
- Public-only GitHub features (some Pages and Actions limits) aren't relied on during the build.

## Links
- https://github.com/UyLeQuoc/walrus-session-10-remora
