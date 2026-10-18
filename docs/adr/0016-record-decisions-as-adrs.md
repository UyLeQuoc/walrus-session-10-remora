# ADR-0016: Record every decision as an ADR

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le, Huấn

## Context
Decisions change quickly (deploy target, environments, roles, scope). Two people and several agents need
one place to see what was decided and why.

## Decision
- Every decision or change of direction gets a numbered ADR in `docs/adr/`, written by whoever makes the
  change, agents included.
- That covers architecture, scope, dependencies or vendors, workflow, naming and security.
- A superseded ADR keeps its file and is marked `Superseded by ADR-NNNN`.

## Consequences
- `AGENTS.md` / `CLAUDE.md` tell every agent to do this.
- The daily sync skims new ADRs.

## Links
- [README.md](README.md)
