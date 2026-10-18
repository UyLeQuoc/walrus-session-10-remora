# Agent instructions — Remora

Remora is our entry to the Walrus x Tatum "Total Recall" hackathon (Track 2). Read `docs/README.md` first.

## Before you change anything
- Scope: `docs/remora-features.md` (§0 is the MVP ship set). Design: `docs/remora-spec.md`. Schedule: `docs/remora-plan.md`.
- Ownership: `docs/team-split.md`. **Edit only the paths your goal owns.** Anything outside them goes in a note at `docs/handoffs/<YYYY-MM-DD>-<from>-to-<to>-<topic>.md`, and you stop that part.
- Shared interfaces live in `packages/schema`. Change them only through a contract PR approved by both people.
- `reference/hippo` is a read-only reference clone of prior work. Port from it; never edit it.
- **Sui access is gRPC only** (ADR-0021): never add JSON-RPC calls. Server side uses Tatum gRPC with a native transport; the browser uses gRPC-web.
- MemWal behaves differently from its docs in places: read `docs/tech-reference.md` §1.11 before touching memory code.
- Code conventions inherited from hippo: `docs/code-rules.md`.

## Decisions → ADRs (required)
Any decision or change of direction gets an ADR in `docs/adr/`, in the **same commit** as the change. That covers architecture, scope, dependencies or vendors, deploy, workflow, naming and security.
- Copy `docs/adr/0000-template.md` to the next number, add the row to `docs/adr/README.md`, and update the docs it affects.
- Never rewrite an accepted ADR. Supersede it with a new one.

## Workflow
- One `main`, few PRs. Before pushing: `git pull --rebase origin main && bun run typecheck && bun run lint && bun run test` (plus `sui move test` when Move changes). Then `git push origin HEAD:main`.
- Open a PR only for contract changes, the other person's lane, or Move changes.
- Commit messages start with the feature IDs, e.g. `[F3·ui] Memory inspector table`.
- Never:
  - commit secrets or `.env` values;
  - push the DB schema yourself;
  - deploy, or publish the Move package to mainnet (testnet publishes are fine in Uy's goals, ADR-0024);
  - force-push;
  - use real owner accounts for testing (use test accounts or the E2E burner).
