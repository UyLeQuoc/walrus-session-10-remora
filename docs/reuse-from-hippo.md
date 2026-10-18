# Reusing hippo in Remora

**hippo** is the owner's earlier Walrus Memory chatbot, built for Walrus Sessions 8 (deadline Oct 9,
2026). It's a working, mainnet-tested product: web + Telegram + Discord + Slack, owned memory through
generated delegate keys, sponsored onboarding, a memory viewer, import/export, and an evidence pipeline.

- **Source:** `~/orca/walrus-session-8-chatbots` (public: github.com/UyLeQuoc/walrus-session-8-chatbots)
- **Reference clone:** `reference/hippo` at commit `66fb33a` (gitignored, read-only). Uncommitted local
  changes in the original working tree are **not** in the clone.

---

## 1. Rules for reuse (hackathon compliance)

The event allows existing projects **only for new progress made during the build window** (Oct 20 –
Nov 10), and every submission must be original work or work you're authorized to submit. hippo is the
owner's own work, so reuse is allowed, but it has to be **disclosed and clearly separated**:

1. **One labeled import commit on Oct 20:**
   `chore: import shared libraries from hippo (prior work, Walrus Sessions 8, 66fb33a)`.
   Import libraries and infrastructure only, not hippo the chatbot product (its chat UX, teams and
   documents aren't Remora features).
2. **A README section, "Built on prior work".** It lists what came from hippo, and states that Disc,
   allowances, the facilitator, Reef, Sonar, Wake, Tatum integration, Scout/Sentinel and every new
   template were built during the window.
3. **Rename on import** (`@hippo/*` → `@remora/*`) and keep the original file history in the commit
   message. Never pass hippo's earlier evidence or memories off as Remora's.
4. **Same judges, probably.** Walrus judged hippo, so the pitch must make Remora's new substance obvious:
   money rails, autonomy, receipts, Tatum.

---

## 2. What to reuse, mapped to Remora features

**Modes:**

- **Port:** copy, rename and adjust lightly.
- **Adapt:** reuse the structure, but change the logic for Remora.
- **Reference:** read it for the pattern, don't copy the code.

### 2.1 Memory layer: `packages/memory` → `packages/memory` (port)

| hippo file | What it does | Remora feature |
|---|---|---|
| `src/client.ts` | Scopes (guest / owned / team) + `createClient` | F1. Remora uses the **owned** pattern: each remora is a delegate in the owner's account |
| `src/delegate.ts` | `generateDelegate()` | B3, B4 |
| `src/crypto.ts` | AES-256-GCM `encryptSecret` / `decryptSecret` under `KEY_ENCRYPTION_KEY` | **B4 key custody** (remora keys, and Disc spender keys too) |
| `src/sponsor.ts` | `createAccountTx`, `addDelegateKeyTx`, `removeDelegateKeyTx`, `executeAccountTx` via the relayer's `/sponsor`, so the user needs **no SUI** | A3, B3, B8 retire, B9 rotate |
| `src/registry.ts` | `findAccountIdForOwner`, `fetchRelayerConfig` (**package ID from `GET /config`**), `readAccount`, `isDelegateRegistered` | A3, B3 verification, K2 diagnose |
| `src/policy.ts` | `recallRelevant` (retries empty-with-`dropped_count`, `maxDistance` 0.8, newest first), `rememberWithDedupe` (async, resubmits failed jobs) | **F2 learning loops**, the Wake write path |
| `src/format.ts` | Memory text grammar `[type] [k:v] [date] fact`, `parseMemoryText`, correction links (`replacesBlobId`) | F1, F11. Add the types `rule`, `episode`, `source`, `budget`, `handoff`, `wake` |
| `src/limiter.ts` | Per-delegate pacing (50/min, concurrency 2), honors `retry_after_seconds` | D2, I4 |
| `src/redact.ts` | `redactCredentials` | **I5 / F11 scrubber** |
| `src/untrusted.ts` | `formatUntrustedMemories` + system instruction (nonce framing) | **I1 content isolation** |
| `src/relayer.ts` | `RelayerExtras`: `forget`, `stats`, `whoami`, `agents`, memories metadata (`expires_at`) | F3, F4, F5, K2. Drop whatever the current SDK now wraps (`listMemories`, `listNamespaces`) |
| `src/wallet.ts` | `signInMessage`, `addressFromSignature` (address recovered from the signature) | A1 |
| `src/port.ts` | `MemoryPort`: background writes, `flush()`, write events | Runtime memory port |
| `src/links.ts` | Suiscan / Walruscan links | UI everywhere |
| `scripts/doctor.ts` + `probe-*` | `diagnose`: config, relayer health, package vs `/config`, registry vs chain, delegates, expiry | **K2 health**, Week 0 checks |

### 2.2 Agent core: `packages/core` → `packages/core` (adapt)

| hippo file | Remora use |
|---|---|
| `src/agent.ts` (`gatherContext`, `runTurn`, `completeTurn`) | **D3 turn engine.** Keep the recall policy (every turn, session start, the correction recall, newest first, cited blob IDs); add per-remora tools and Sonar |
| `src/prompt.ts` | System prompt (the MemWal four-part template) → one per remora template |
| `src/tools.ts` | `remember` / `recall` tools → D4, extended with `tatum.*`, `pay`, `handoff`, `notify`, `schedule` |
| `src/model.ts` | `createModel` with a fallback model → D9 (point it at the chosen provider) |
| `src/command-catalog.ts`, `command-table.ts` | One command set for every channel → H1/H8 commands (`/remoras`, `/budget`, `/pause`, `/teach`, `/proof`, `/compare`) |
| `src/import-facts.ts` | F7 import |
| `src/demo.ts`, `measure-corrections.ts`, `bench-recall.ts` | **K6 LLM evals** and **L1 learning metrics** |
| `src/cli.ts` | CLI channel; also where `remora verify` lives |

### 2.3 Server: `apps/server` → `apps/server` (port channels and identity, adapt the rest)

| hippo area | Remora use |
|---|---|
| `channels/telegram.ts` (grammY), `discord.ts` (discord.js), `slack.ts` (Bolt), `handlers.ts`, `chunk.ts`, `polling.ts`, `chat/turn.ts` (`handleIncoming`) | **H1 Telegram + H8 Discord/Slack, almost free.** Every adapter funnels into one handler |
| `identity/link.ts`, `auth.ts`, `persons.ts`, `connect/tokens.ts`, `routes/connect.ts` | **A5 Telegram linking** and cross-channel identity (single-use 10-minute tokens, delegate verified onchain before switching) |
| `chat/ratelimit.ts`, `iplimit.ts` | I4 |
| `memory/export.ts`, `import.ts`, `usage.ts`, `changes.ts`, `write-status.ts` | F8, F7, F3 "used in N decisions", corrections view, write status |
| `chat/compare.ts` (`/compare`, the memory-off control), `/proof`, `resolve-citations.ts` | **G5 Proof of Learning** (the same input with and without memory) and Wake citations |
| `scripts/evidence.ts`, `capacity.ts`, `restore.ts`, `ops.ts`, `ops/report.ts` | K3, K4, L1 |
| `env/schema.ts` (zod) | Env validation |

### 2.4 Web: `apps/web` → `apps/web` (port the shell and flows)

| hippo area | Remora use |
|---|---|
| App shell, sidebar, providers, `components/ui` (shadcn), theme, `web3-address` (SuiNS reverse lookup), `wallet-picker` | **H4 dashboard shell**, B5 display |
| `app/enoki.ts`, `use-enoki-wallets.ts` | **A2 zkLogin**, registered as a wallet-standard wallet |
| `features/connect/*` (`connect-page`, `sponsor.ts`, `memwal.ts`, `use-connect-flow`) | **A3 / A6 onboarding.** Remora's "create remora" extends this flow with the allowance + Disc step |
| `features/me/*` (`memories-table`, `chain-panel`, `changes-panel`, `export-panel`, `import-panel`, `claude-code-panel`, `wallet-read` = **Seal decrypt in the browser with the owner's wallet**) | **F3 inspector**, F5 expiry, F7, F8, **F9 MCP portability**, owner-side Wake decryption |
| `features/chat/*` (memory panel, citations, recalled, compare) | The chat-with-a-remora page in the dashboard |
| `features/guide/*` | Landing and guide diagrams (H6) |
| `lib/seal.ts`, `lib/walrus.ts`, `features/documents/*` | Seal/Walrus reference for G7 and F12 |
| `ws-resources.json`, root `sites-config.yaml`, `docs/DEPLOY.md` | **H6 Walrus Sites deploy** (SPA fallback) |

### 2.5 Data & infra (port)

| hippo | Remora use |
|---|---|
| `packages/db` (Drizzle): `people`, `channel_identities`, `delegate_keys` (encrypted), `connect_tokens`, `web_sessions`, `turn_log`, `memory_index` (no text, `hidden_at`), `conversations`/`messages` (encrypted) | The base schema. Add `remoras`, `discs`, `allowances`, `wakes`, `triggers`, `jobs`, `reef_services`, `sponsor_ledger` |
| Bun workspaces + Turbo, biome, vitest, `.github/workflows/ci.yml`, `Dockerfile`, `railway.toml`, `docker-compose.yml` (Postgres) | The whole toolchain and deploy setup |
| `AGENTS.md`, `CODE_RULES.md`, `.claude/skills/hippo-memory` | Conventions + a `remora-memory` skill so Claude Code understands the memory format |

### 2.6 Knowledge (reference, already folded into these docs)

- `docs/MEMWAL-NOTES.md`, `docs/SPIKES.md`, `docs/issues/*`: measured MemWal behavior. It's summarized
  in [tech-reference.md §1.11](tech-reference.md#111-field-notes-measured-on-mainnet-by-hippo).
- `docs/ARCHITECTURE.md` §11: the threat model → I7.

---

## 3. What's new in Remora (not in hippo)

- **Money:** the Disc Move module, address-balance funds + Detect funds, app-bound Allowances, the x402
  facilitator, Reef, merchants, the gas sponsor for allowance transactions.
- **Chain:** the Tatum client, the gRPC checkpoint stream, chain-event triggers, Sentinel enrichment.
- **Autonomy:** triggers, cron, heartbeat, handoffs, templates (Scout, Sentinel, Errand, Keeper,
  Treasurer, Brief…).
- **Safety and proof:** Sonar, Wake + intent anchoring, `remora verify`, Merkle anchoring, the red-team
  suite.
- **Surfaces:** the Telegram Mini App, the playground, SuiNS **subnames** (hippo only does reverse
  lookup).

---

## 4. Effect on the plan

- **About 40 of the 132 features get a head start** from ported code: A1–A3, A5, A6, A8, B3, B4, B8, B9,
  D3, D4, D9, F1–F5, F7–F9, F11, G5, H1, H4, H6, H8, I1, I4, I5, I7, K2, K3, K6, L1. From the new
  epics: **M9** public remora (hippo's guest namespaces), **N1** activity feed (`turn_log`, the changes
  panel), **N4** "Why?" (`/proof`, citations), **N14** guide (hippo's guide diagrams), **N17** shared
  remoras (hippo's teams). The time saved moves
  **A2 zkLogin to W2** and **H8 Discord/Slack to W3**.
- **The stack follows hippo:** Bun + Turbo, a **Hono** server on Railway (API + channels + runtime in one
  always-on process), a **Vite + React** SPA on Walrus Sites (Vercel as backup), Drizzle + Neon. See
  [remora-spec.md §5](remora-spec.md#5-architecture).
- **Corrections hippo measured** (now applied to the spec and feature list):
  - no per-memory delete (F4 becomes hide + namespace forget);
  - `restore()` is unreliable (K5 rebuilds from `memory_index` + the read API);
  - storage lasts about 210 days (F5 is about display, not urgency);
  - writes take about 24 s (never block, resubmit);
  - 60 weighted requests/min per delegate key;
  - **max 20 delegate keys per account,** which caps each owner at about 18 remoras.
