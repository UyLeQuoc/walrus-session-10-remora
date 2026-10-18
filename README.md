# Remora

**Always-on agents you actually own.** Remora is our entry to the Walrus x Tatum *Total Recall*
hackathon (Track 2, Smart Agents for Real Life). Each agent (a *remora*):

- **remembers** in Walrus Memory that you can read, hide and take to Claude Code or Codex;
- **spends** only inside an onchain budget, the **Disc**, built on Sui's native app-bound Allowances;
- **leaves a receipt** for every action, its **Wake**.

All chain I/O goes through Tatum.

> *It goes wherever you go. It cleans up after you. It never takes the wheel.*

- Docs: [docs/README.md](docs/README.md)
- Spec: [docs/remora-spec.md](docs/remora-spec.md)
- Scope: [docs/remora-features.md](docs/remora-features.md)
- Decisions: [docs/adr/](docs/adr/README.md)

## Quick start (local)

```bash
bun install
cp .env.example .env            # fill in MEMWAL_ACCOUNT_ID, MEMWAL_PRIVATE_KEY, OPENROUTER_API_KEY, SESSION_SECRET, KEY_ENCRYPTION_KEY
docker compose up -d --wait     # local Postgres on :5434
CHANNELS=off bun run dev        # API + web; PORT / WEB_PORT override the defaults (8787 / 5173)
bun run lint && bun run typecheck && bun run test
```

## Repo layout

See [docs/remora-spec.md §5](docs/remora-spec.md#5-architecture). Every directory has a README naming its
owner (see [docs/team-split.md](docs/team-split.md)). Interfaces between the backend and the UI live in
[`packages/schema`](packages/schema).

## Built on prior work

Remora starts from **hippo**, the team's earlier Walrus Memory chatbot built for Walrus Sessions 8
([repo](https://github.com/UyLeQuoc/walrus-session-8-chatbots), commit `66fb33a`).

- **Imported** (commit `cd9acfd`, verbatim apart from renaming `@hippo/*` → `@remora/*`):
  - the toolchain;
  - `packages/memory` (Walrus Memory client, sponsored onboarding, delegate keys, recall policy);
  - `packages/db`, `packages/core` (agent loop);
  - `apps/server` (Hono API and the Telegram, Discord and Slack adapters);
  - `apps/web` (Vite + React shell, wallet/zkLogin sign-in, memory viewer).

  See [docs/reuse-from-hippo.md](docs/reuse-from-hippo.md).
- **Removed** (commit `70ebd6b`): hippo's team memory and private-document features.
- **New in Remora** (everything after the import):
  - the money rails: the Disc Move module, address-balance funds, the x402 facilitator, Reef;
  - autonomy: triggers, templates, Scout and Sentinel, handoffs;
  - safety and proof: Sonar, Wake receipts with intent anchoring;
  - Tatum integration;
  - the Hatchery;
  - every Remora UI and UX feature.
- **Timing, stated openly:** the bootstrap (the import, removals, scaffold and contracts) was done on
  **Oct 18, 2026**, before the build window opened on Oct 20
  ([ADR-0018](docs/adr/0018-bootstrap-before-window.md)). No Remora feature was built before the
  window.

## License

To be added before the repo goes public ([ADR-0017](docs/adr/0017-github-repo-private-until-submission.md)).
