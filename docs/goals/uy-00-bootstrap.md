# Goal U0: Bootstrap the Remora monorepo (W1, Mon Oct 20)

**Owner:** Uy Le · **Branch:** `uy/U0-bootstrap` (local only, pushed straight to `main`) · **Worktree:** the main
checkout. It's the first goal, so there's nothing to conflict with.

**Do NOT start before Mon Oct 20, 07:00 Vietnam time** (Oct 20 00:00 UTC, when the build window opens).
Every product commit must be dated inside the window.

## Read first (context, read-only)
- `AGENTS.md`, `docs/README.md`
- `docs/reuse-from-hippo.md`: what to port, and the **compliance rules for prior work**
- `docs/team-split.md` §2 (ownership), §4 (contracts), §6 (git workflow), §10 (setup checklist)
- `docs/remora-spec.md` §5 (repo layout, stack, deployment)
- `docs/adr/0006`, `0009`, `0010`, `0016`
- Source to port: `reference/hippo/` at commit `66fb33a`. It's read-only, so copy from it and never edit
  it.

## Steps

1. **Labeled import commit.** Verbatim copy + rename only, no logic changes.
   - **Copy from `reference/hippo/`:**
     - root: `package.json`, `turbo.json`, `biome.json`, `tsconfig.base.json`, `bunfig.toml`, `.nvmrc`,
       `.dockerignore`, `Dockerfile`, `docker-compose.yml`, `railway.toml`, `.github/workflows/ci.yml`,
       `.env.example`;
     - `packages/memory`, `packages/db`, `packages/core`, `apps/server`, `apps/web`;
     - `.claude/skills/hippo-memory` → `.claude/skills/remora-memory`.
   - **Skip:** `node_modules`, `.turbo`, `.vercel`, every `.env` except `.env.example`, `memwal/`,
     `.local/`, hippo's `docs/`, `sites-config.yaml` (it comes back with H6), and `bun.lock`
     (regenerate it).
   - **Rename:** `@hippo/*` → `@remora/*`; root package `hippo` → `remora`. Leave UI brand strings to
     Huấn.
   - **Merge, don't overwrite,** our existing `.gitignore`, `AGENTS.md`, `CLAUDE.md` and `docs/`.
     Move hippo's `AGENTS.md` and `CODE_RULES.md` content to `docs/code-rules.md` and link it from
     `AGENTS.md`.
   - Commit message, exactly:
     `chore: import shared libraries from hippo (prior work, Walrus Sessions 8, 66fb33a)`, with a body
     listing every copied path.
2. **Remove hippo-only features** (a separate commit): teams (server identity/teams, team routes, team
   memory, `features/team`, the `teams` / `team_members` / `team_invites` tables), documents (server
   `documents/`, document routes, `features/documents`, the `documents` / `message_attachments` tables),
   and any commands that reference them. Keep chat, the connect flow, `/me`, the guide and the channels;
   Remora adapts them.
3. **Make it green:** run `bun install`, then make `bun run typecheck`, `bun run lint` and
   `bun run test` pass at the root. Fix only what the rename or removal broke.
4. **Scaffold the Remora layout** (spec §5), giving every new directory a `README.md` that states its
   purpose and **owner** (team-split §2):
   - packages: `packages/{move/remora, disc-sdk, chain, signer, sonar, merchant, schema, mcp}`;
   - apps: `apps/{facilitator, reef, merchants}`;
   - server: `apps/server/src/{runtime, triggers, tools, templates, money, hatchery, ops, copy}`;
   - web: `apps/web/src/features/lab`;
   - other: `evals/`, `e2e/`, `docs/handoffs/`.

   Add minimal `package.json` and `tsconfig.json` files so the workspaces resolve.
5. **Contracts v1 in `packages/schema`** (team-split §4): TypeScript types + zod schemas + JSON fixtures
   for `remora.ts`, `funds.ts`, `memory.ts`, `wake.ts`, `channel.ts`, `events.ts`, `errors.ts`,
   `copy-keys.ts`, `deployments.ts` (placeholder IDs) and `template.ts` (a v0 stub). Add a test that
   parses every fixture with its schema. Base the shapes on remora-spec §3, §8, §9, §12 and the
   features doc.
6. **Hotspot structure** (team-split §9):
   - split the DB schema into `packages/db/src/schema/{identity, memory, money, runtime, hatchery}.ts`
     with an append-only `index.ts`;
   - an append-only `apps/server/src/routes/registry.ts` and `apps/web/src/app/routes.tsx` (with a
     `/lab/*` slot).
7. **Repo hygiene:**
   - `.github/CODEOWNERS`, copied from the team-split §2 block (the lab override stays last);
   - CI on push to `main`: typecheck, lint, test, the fixture test, and a `sui move test` job that
     skips while `packages/move` is empty;
   - root `.env.example` extended with the variables in tech-reference §4.
8. **Root `README.md`:** a one-paragraph pitch, a link to `docs/README.md`, and a **"Built on prior
   work"** section (hippo, `66fb33a`, what was ported, what was removed, and what is new in Remora).
9. **ADRs:** add an ADR for any decision made during the bootstrap (e.g. which hippo pieces were dropped
   and why).
10. **Push** using the team-split §6 workflow: `git pull --rebase origin main`, run the checks, then
    `git push origin HEAD:main`. Keep it to 4–6 clear commits; the first one is the labeled import.

## Done when
- [ ] `bun install && bun run typecheck && bun run lint && bun run test` is green at the root
- [ ] `CHANNELS=off bun run dev` boots the server and the web shell locally (Docker Postgres from
      `docker-compose.yml`)
- [ ] The first commit on `main` after the docs is the labeled import; the removals are a separate
      commit
- [ ] `packages/schema` exports the v1 contracts with fixtures, and the fixture test passes
- [ ] Every directory from spec §5 exists with an owner README
- [ ] CODEOWNERS + CI are committed, and CI is green on GitHub
- [ ] A summary is posted: what was ported, what was removed, and anything Huấn should know (as a
      `docs/handoffs/` note if action is needed)

## Never
- Edit `reference/hippo/`.
- Commit secrets or `.env` values.
- Deploy, or publish a Move package.
- Push the DB schema anywhere but local Docker.
- Force-push.
- Change docs scope or decisions without an ADR.
