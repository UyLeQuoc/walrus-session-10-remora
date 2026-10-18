# @remora/server

Hono server in one always-on process (Railway): HTTP API, channel adapters (Telegram, Discord, Slack), and the remora runtime. `CHANNELS=off` runs only the web API. Routes register through `src/routes/registry.ts` (append-only). Bot wording lives in `src/copy/` (Huấn).

- **Owner:** Uy Le (`@UyLeQuoc`) (except `src/copy/`: Huấn (`@huanngdev`)) (see `docs/team-split.md` §2)
- **Features:** Backend halves of most features
