# ADR-0019: Structure decisions made during the bootstrap

- **Status:** Accepted
- **Date:** 2026-10-18
- **Deciders:** Uy Le

## Context
Porting hippo into the Remora layout (goal U0) required a few small structural choices that the docs
didn't pin down.

## Decision
- **Dropped from hippo:** team memory (namespaces, tables, `/team`, pages) and private documents
  (Seal-encrypted uploads, attachments).
  - Shared remoras (N17) will be designed fresh if they're built.
  - A search hit that isn't in the person's own index is now badged **"shared"**.
- **Copy lives in `apps/server/src/copy/`** (was `copy.ts`), so bot wording is Huấn's directory.
- **`CHANNELS=on|off`** server flag: `off` runs only the web API (one Telegram poller per token).
- **Local dev side by side:**
  - `PORT`, `WEB_PORT` and `REMORA_API_URL` pass through turbo;
  - local Postgres is `remora` on **:5434**, so it doesn't collide with hippo's `:5433` or other local
    stacks.
- **The Slack manifest** moved from hippo's `docs/` to `apps/server/slack-manifest.yaml`.
- **DB schema split** into `packages/db/src/schema/{identity, memory, runtime, money, hatchery}.ts`.
  Chat transcripts and the turn log live in `runtime`.
- **Contracts use camelCase JSON** (Wake, template, events). `intentHash` = sha256 of key-sorted JSON,
  computed with `@noble/hashes` so the browser can verify it too.
- **`.env.example` no longer ships hippo's `MEMWAL_ACCOUNT_ID`.** Each operator sets their own.

## Consequences
- The hippo-derived code still carries hippo names in UI text, namespace prefixes (`hippo`,
  `hippo-guest:`) and comments. Rebranding UI text is Huấn's (H0). Moving namespaces to the Remora
  scheme happens with F1/F2.
- `bun run db:push` under turbo can fail without a TTY. Run `npx drizzle-kit push` in `packages/db` if
  needed.

## Links
- Commits `cd9acfd`, `70ebd6b`, `ae9b13f`, `2831fd3`
