# Team Split: two people, many agents, no conflicts

> **Team:**
> - **Uy Le:** **Sui + Walrus Memory + smart contracts (Move)**, plus the core backend. Repo owner and
>   integrator, GitHub `@UyLeQuoc`.
> - **Huấn** (written "Huanng" earlier): frontend + UX + **E2E quality**. GitHub `@huanngdev` (invited
>   Oct 18; branches and labels use the slug `huanng`).
> - **Ownership:** **Uy owns every deploy, the demo video and the submission.** Huấn owns the E2E suite
>   and the "demo-ready" call.
> - **Infra and UI are a flex pool:** both people can code them. Huấn is the UI specialist and does most
>   of it; Uy picks up flex items when the Sui and memory work allows (§3.1).
>
> **Scope:** [remora-features.md](remora-features.md) · **Schedule:** [remora-plan.md](remora-plan.md)
>
> **Principle:** split by **directories**, not by tickets. Each path has one owner, cross-lane interfaces
> change only through **contract PRs**, and every long-running agent goal stays inside its owner's paths.

---

## 1. The two lanes

| | **Uy Le: Sui + Walrus Memory + Move + backend (+ deploy, launch, flex infra/UI)** | **Huấn: UI/UX + E2E (+ flex infra/UI)** |
|---|---|---|
| Owns | Move, Disc SDK, Tatum client, signer, gas sponsor, facilitator, Reef API, merchants, `apps/server` (runtime, triggers, tools, templates, channels, identity, memory, Hatchery backend, ops), `packages/memory`, `packages/db`, MCP, evals, CI/CD, **all deploys** (backend on **Railway**, frontend on **Vercel**, the Walrus Sites mirror, Move publish), environments | Everything in `apps/web`: dashboard, onboarding, inspector, Mini App, playground, Hatchery gallery and hatch flow, guide, docs site, all UX features, design system, i18n, accessibility. Plus **bot UX copy** (`apps/server/src/copy/`: message text, button layouts, error sentences). Plus **E2E** (`e2e/`): the Playwright suite for the demo path, regression runs on the `main` deployment after every merge window, wave-exit E2E reports, bug triage |
| Light UI | `apps/web/src/features/lab/`: demo and ops consoles (Disc console, facilitator test, verify, health, cost, playground admin), built with Huấn's UI kit. The lab is a fallback for the video if a polished page isn't ready | — |
| Work parts | 121 (65 backend-only + the backend half of 55 shared features + K6 CI/evals) | 67 (11 UI-only + the UI half of 55 shared features + K6 E2E) |
| Ported from hippo | Toolchain, CI, Railway, `packages/memory`, `packages/db`, channels, identity/connect, key crypto, `diagnose` | Web shell, UI kit, wallet/zkLogin UI, connect pages, `/me` → inspector, guide diagrams, Claude Code panel |
| Launch role | **Deploys, the demo video** (script, capture, edit, narration), **submission form**, blog post ("Rails Before Robots, Part 2"), X thread | Final E2E pass on `main` (the demo-ready call), landing page, learning charts, UX polish, screenshots on request |

**On workload:**

- Uy's count is higher. Many backend halves are thin endpoints, much of the memory and channel code is
  ported from hippo, and Uy's W4 list is optional expansion.
- **The scope cut line falls on Uy's W4 first.**
- If Huấn runs ahead, the next things to take over are bot UX (copy, keyboard layouts, Telegram
  message design), the docs site and the charts.
- **E2E is a first-class job, not an afterthought.** Huấn writes the demo-path suite in W1–W2 against
  fixtures and the `main` deployment, and from then on it gates every wave exit.

## 2. Directory ownership

Commit this as `.github/CODEOWNERS` on Oct 20. **The last matching line wins**, so the override block
stays at the end.

```
# default: Uy (infra + backend + everything not listed)
*                                    @UyLeQuoc

# ---- Huấn: frontend + UX + E2E ----
/apps/web/                           @huanngdev
/apps/server/src/copy/               @huanngdev
/e2e/                                @huanngdev

# ---- shared: contract PRs need BOTH approvals ----
/packages/schema/                    @UyLeQuoc @huanngdev
/apps/web/src/app/routes.tsx         @UyLeQuoc @huanngdev
/apps/web/src/lib/api.ts             @UyLeQuoc @huanngdev
/docs/team-split.md                  @UyLeQuoc @huanngdev

# ---- overrides: MUST stay last ----
/apps/web/src/features/lab/          @UyLeQuoc
```

**Rules:**

- **Either person may build UI.** A web feature folder belongs to whoever **claims its issue** on the
  board, one claimant at a time. Huấn reviews every PR under `apps/web/` (CODEOWNERS), so the UI stays
  consistent.
- Uy's default UI home is `features/lab/`. Uy may also claim flex UI folders (§3.1), and always uses
  `components/ui` (Huấn's UI kit) **read-only**. If a polished page lands, the matching lab page goes
  behind a flag.
- **Sui, Move, Walrus Memory and the core backend** (runtime, Disc, facilitator, memory, channels) stay
  Uy's. Huấn sends requests there through a handoff note (§9) or a contract PR (§4). Infra items from the
  flex pool (§3.1) are open to both.
- **Bot UX:** the backend (Uy) renders Telegram, Discord and Slack messages from **copy keys** that live
  in `apps/server/src/copy/` (Huấn). Huấn shapes the bot's words and buttons without touching backend
  logic.

## 3. Feature split by wave

Notation:

- **Backend-only** (65) and **UI-only** (11) features appear in one column.
- **Shared** features (55) appear in **both** columns: `·be` is Uy's backend half (endpoint, logic, tx),
  and `·ui` is Huấn's page or component, built against the contract fixtures first.
- **K6** is split differently: `·be` is CI, evals and backend tests (Uy); `·e2e` is the E2E suite
  (Huấn).

| Wave | Uy Le: infra + backend + deploy | Huấn: frontend + UX + E2E |
|---|---|---|
| **W1** Oct 20–25 | A1·be, A4·be, B4, D2, D8, E1, E2, E3, F1, G1, G2, I6, K1 (+ repo setup, Railway + Vercel deploys of `main`, spike) | A1·ui, A4·ui (+ port and verify the web shell, UI kit and design tokens; scaffold the copy keys; **set up Playwright + a burner test wallet + demo-path E2E skeleton on fixtures**) |
| **W2** Oct 26 – Nov 1 | A3·be, A5·be, A7·be, B1·be, B3, B6·be, B7·be, B8·be, B9·be, C1, C2, D3, D4, D9, E4·be, E9, F2, F3·be, F6, G3·be, H1, H5·be, I1, I2, I4, I5, N1·be, N2·be, N4·be, N5·be, N6·be, N10·be, N12·be, N13·be, N19·be | A2, A3·ui, A5·ui, A6, A7·ui, B1·ui, B6·ui, B7·ui, B8·ui, B9·ui, E4·ui, F3·ui, G3·ui, H4, H5·ui, N1·ui, N2·ui, N4·ui, N5·ui, N6·ui, N10·ui, N12·ui, N13·ui, N19·ui |
| **W2/W3** | D1, F11 | — |
| **W3** Nov 2–6 | A8·be, B2·be, B5·be, B10, C3, C4, C5, C6, D5, D6, D7, E5, E6·be, E7·be, E8, E13, F4·be, F5·be, F7·be, F8·be, F9·be, F10·be, G4, G5·be, G6·be, H2, H7·be, I3, I7, J1, K2, K3, K4, K5, L1·be, M1·be, M3, M4·be, M5·be, M6, M7, N3·be, N7·be, N8·be, N9, N11·be, N15·be, N20·be (ops dashboards render as **lab** pages) | A8·ui, B2·ui, B5·ui, E6·ui, E7·ui, F4·ui, F5·ui, F7·ui, F8·ui, F9·ui, F10·ui, G5·ui, G6·ui, H3, H6, H7·ui, H9, J4, L1·ui, M1·ui, M4·ui, M5·ui, M12, N3·ui, N7·ui, N8·ui, N11·ui, N14, N15·ui, N16, N18, N20·ui |
| **W3/W4** | H8, L2 | — |
| **W4** Nov 7–9 | C7, C8, C9, D10, E10, E11, E12, F12, F13·be, G7, J2, J3, L3·be, M2·be, M8·be, M9·be, M10·be, M11·be, N17·be | F13·ui, L3·ui, M2·ui, M8·ui, M9·ui, M10·ui, M11·ui, N17·ui |
| Continuous / roadmap | K6·be (CI, LLM evals, backend unit and integration tests), E14 | K6·e2e (**E2E**: Playwright demo path against the `main` deployment and Vercel previews, a regression run after each merge window, wave-exit reports) |

### 3.1 Flex pool (infra + UI either person can take)

These have a default owner in the table above, but whoever has capacity at the start of a wave can claim
them on the board:

| Area | Items | Default |
|---|---|---|
| Observability & ops UI | K1–K4 dashboards, N20 status page, N15·ui cost card | Uy (as lab pages) |
| Web delivery | H6 landing + docs on Walrus Sites, J4 docs site, M12 badge | Huấn |
| Data UI | L1·ui learning charts, E6·ui spend analytics, E7·ui Reef directory page | Huấn |
| CI/CD & previews | CI workflow, Vercel previews, the E2E status check in CI | Uy |

**Claiming rule:** set the board issue's assignee *before* starting a goal. One claimant per item and per
folder. Releasing an item means unassigning it and leaving a note.

**The demo-critical path is first in each wave.** Uy: E1–E3, A4·be, C1, C2, B3, I2, G3·be. Huấn:
A4·ui, A6, H4, F3·ui, N1·ui, N4·ui, G5·ui, H7·ui, M5·ui, plus the E2E test for each of them.

## 4. Contracts first (`packages/schema`, frozen Oct 20)

Every interface between the lanes is a TypeScript type + zod schema + **fixtures**
(`packages/schema/fixtures/*.json`). Huấn builds every `·ui` half against the fixtures, so nothing
waits on the backend.

| Contract | File | Producer | Consumer | v1 due |
|---|---|---|---|---|
| HTTP API types (Hono RPC `AppType`) + typed client | `apps/server` exports it; client in `apps/web/src/lib/api.ts` | Uy | Huấn | rolling, starting Oct 22 |
| Remora config (persona, tools, triggers, budget, Reef payees) | `remora.ts` | Uy | Huấn (forms) | Oct 20 |
| Funds (`FundsSplit`, `DetectFundsResult`) | `funds.ts` | Uy | Huấn (A4) | Oct 20 |
| Memory view models (`MemoryRow`, hidden flag, expiry, used-in count) | `memory.ts` | Uy | Huấn (inspector) | Oct 20 |
| Wake JSON v1 + `WakeView` | `wake.ts` | Uy | Huấn (Why?, verify, Proof of Learning) | Oct 20 |
| Activity events (`RemoraEvent`) + `ApprovalRequest` (SSE stream) | `events.ts` | Uy | Huấn (N1, N2, N4) | Oct 21 |
| Error codes → copy keys (Move aborts, relayer states) | `errors.ts` | Uy (codes) | Huấn (sentences in `copy/`) | Oct 21 |
| Bot copy keys + button layouts | `copy-keys.ts` (keys) → `apps/server/src/copy/` (text) | Huấn (text), Uy (keys) | Uy (bot rendering) | Oct 24 |
| Deployments (package IDs per network) | `deployments.ts` | Uy | both | Oct 23 |
| Template `remora.yaml` v1 + Hatchery views | `template.ts` | Uy | Huấn (gallery, hatch) | Oct 27 |

**Contract PR rules:**

1. Use the `contract` label, and get **both approvals**. *Until the Nov 9 submission:* Uy may merge an
   additive contract PR (new types, fields with defaults, new routes) once CI is green, and Huấn
   reviews it on `main` ([ADR-0087](adr/0087-uy-merges-additive-contract-prs.md)).
2. Merge it **before** the PRs that implement it.
3. Prefer additive changes. A breaking change bumps the version and updates the fixtures in the same PR.

## 5. Who unblocks whom

| Date | From → To | Deliverable | Unblocks |
|---|---|---|---|
| Mon Oct 20 | Uy → Huấn | Repo set up (§10), hippo import, contracts v1 + fixtures | All UI work, using fixtures |
| Tue Oct 21 | Uy → both | **Spike go/no-go:** address balance + app-bound allowance via Tatum | A4, B3 |
| Wed Oct 22 | Huấn → Uy | UI kit + app shell + lab route slot | Uy's lab pages |
| Wed Oct 22 | Uy → Huấn | **Main API live** (Railway, auto-deploys from `main`): sign-in, funds API, memory read endpoints | A1·ui, A4·ui, F3·ui against real data |
| Fri Oct 24 | Uy → Huấn | Remora create/rotate/pause/reissue endpoints + tx builders, `pauseAll`, deployments | Create flow, B7–B9·ui, N10·ui |
| Fri Oct 24 | Huấn → Uy | Bot copy v1 (Telegram messages, buttons, error sentences) | H1, N4·be, N6·be rendering |
| Sat Oct 25 | Uy → Huấn | Facilitator + `sui-risk` live on mainnet | Scout flows in the UI |
| Mon Oct 27 | Uy → Huấn | `RemoraEvent` SSE stream + approvals API + template schema | N1, N2, N4·ui, Hatchery UI prep |
| Wed Oct 29 | Uy → Huấn | Scout + Sentinel live on `main` | N13·ui, learning UI |
| Mon Nov 3 | Uy → Huấn | Hatchery + Reef APIs, playground sandbox API | M4·ui, M5·ui, H7·ui, E7·ui |
| Every merge window from Oct 26 | Huấn → Uy | E2E run on the `main` deployment: pass/fail + issues for regressions | Uy reverts or fixes forward |
| Thu Nov 6 | Huấn → Uy | **Demo-ready call:** the full E2E suite green on `main`; merge freeze starts at 21:00 | Uy records the video on Nov 7 |

**If a dependency slips,** the consumer keeps going on fixtures, and the producer posts a new date in a
handoff note (§9).

---

## 6. Git workflow: one `main`, few PRs

See [ADR-0010](adr/0010-team-split-and-git-workflow.md).

- **Work on `main` directly.** Commit small and often, inside your own paths (§2). Before every push:
  ```bash
  git pull --rebase origin main
  bun run typecheck && bun run lint && bun run test     # + sui move test if packages/move changed
  git push origin HEAD:main
  ```
  CI re-runs on `main`. Railway (backend, set to wait for CI) and Vercel (web) deploy automatically.
- **PRs only when they add value:**
  1. **contract changes** in `packages/schema` or the shared API client, which need both approvals (§4);
  2. **edits in the other person's lane**;
  3. **Move package changes** before Uy publishes to mainnet.

  Everything else goes straight to `main`.
- **Commit messages** start with the feature IDs: `[F3·ui] Memory inspector table`. Reference the board
  issue (`closes #12`) so the board stays current.
- **Agent goals** run in your one checkout on `main`, with no worktrees or branches
  ([ADR-0022](adr/0022-no-worktrees.md)). At the end they rebase and push to `main` the same way (§7).
- **One environment, `main`,** with no staging. So:
  - push backend changes at the merge windows (**12:00 and 21:00 Vietnam time**). Web-only changes can
    go anytime;
  - after each window, Huấn's **E2E suite runs against `main`**;
  - **if E2E goes red, Uy reverts the offending commit (`git revert`) or fixes forward within the same
    window**;
  - risky backend changes go **behind a feature flag** (`REMORA_FLAGS=hatchery,shadow,…`);
  - DB schema changes must be **additive only** (hippo's `additive` check in CI).
- **Demo freeze:** from Nov 6 at 21:00, only fixes go to `main`.
- **Every decision or change of direction gets an ADR** in `docs/adr/` (see
  [docs/adr/README.md](adr/README.md)).

## 7. Running long agent goals ("treo goal") without conflicts

**Rules for every goal:**

1. **One goal = one feature ID (or one half), run in your main checkout on `main`.** No worktrees and no
   branches ([ADR-0022](adr/0022-no-worktrees.md)).
2. **Allowed paths only** (§2). If a goal needs a change anywhere else, it writes a handoff note (§9)
   and stops that sub-task.
3. **Never:**
   - edit `packages/schema` (unless the goal *is* a contract PR);
   - push DB schema (only CI does that, on `main`);
   - deploy, or publish/upgrade the Move package;
   - touch secrets or `.env` values;
   - bump shared dependencies;
   - force-push.
4. **Before finishing:** rebase on `main`, run typecheck, lint, tests (+ `sui move test` for Move), then
   **push to `main`** (§6). Open a PR only for a contract, another lane, or a Move change. Post a
   one-line summary with the IDs and evidence in the team chat. **If the goal made or changed a
   decision, add an ADR** (`docs/adr/`).
5. **Concurrency:**
   - **one goal at a time per person**; parallelism comes from the two lanes;
   - goals that need a pending contract wait for it.
6. **Runtime isolation per person** (see §8):
   - **Huấn's web and E2E** point at the **`main` API** (`VITE_API_URL`), so they need no backend
     secrets. They sign in **only with the E2E burner or test owner accounts**, never real owner
     accounts.
   - **Uy's local server** runs `CHANNELS=off` unless it's the one running channels (two pollers on
     one Telegram token fail with `409 Conflict`). Chain-writing tests run one at a time, since a shared
     sponsor gas coin can't be used by two concurrent transactions.
7. **Check-ins:** a long goal writes a short progress note (`NOTES.md`, gitignored) about every
   2 hours. The human reviews before pushing.

**Starting a goal:**

```bash
git pull --rebase origin main && bun install
VITE_API_URL=https://<main-api> bun run dev:web        # Huấn: local web against the main API (test accounts only)
# Uy: CHANNELS=off bun run dev:server
```

**Goal prompt templates** (paste into the agent session):

```text
Goal: [F3·ui] Memory inspector UI — acceptance: docs/remora-features.md row F3, docs/remora-spec.md §8
Owner: Huấn · Runs in: the main checkout, on main (no worktree)
Allowed paths: apps/web/src/features/memory/**, apps/server/src/copy/** (strings only)
Read-only context: docs/remora-spec.md §8 and §12.12, reference/hippo/apps/web/src/features/me/**
Contracts (read-only): packages/schema/** — build against packages/schema/fixtures, then the main API (test accounts only)
Done when: acceptance met, component tests added, typecheck/lint/test green, rebased and pushed to main,
  summary with IDs and screenshots (desktop + mobile) posted. New or changed decisions → add docs/adr/NNNN-*.md.
Outside allowed paths? Write docs/handoffs/<YYYY-MM-DD>-huanng-to-uy-<topic>.md and stop that part.
Never: edit backend code, deploy, edit secrets, bump shared deps, force-push.
```

```text
Goal: [E1] Disc Move module — acceptance: docs/remora-features.md row E1, docs/remora-spec.md §6
Owner: Uy · Runs in: the main checkout, on main (Move changes get a PR branch)
Allowed paths: packages/move/**, packages/disc-sdk/** (types only), packages/schema/fixtures/disc*.json (via contract PR)
Read-only context: docs/tech-reference.md §3, docs/remora-spec.md §6 and §12.1
Done when: sui move test green (limits, payees, pause, rotate, permit guards), typecheck/lint green,
  PR opened (Move changes always get a PR). Do NOT publish to mainnet (Uy publishes manually after review).
  Record the module's design decisions in docs/adr/.
```

## 8. Environments

There is **one deployed environment: `main`.** Every merge to `main` deploys it. Everything else is a
local machine.

| Resource | Uy (local dev) | Huấn (local dev) | **`main`** (the only deployed environment, Uy owns) |
|---|---|---|---|
| Backend services (server, facilitator, Reef, merchants) | local, own ports | uses the `main` API | **Railway**, one environment, auto-deploys from `main` after CI. One server replica |
| Web | lab pages locally | local Vite, `VITE_API_URL` = the `main` API | **Vercel** from `main`. PR previews also call the `main` API. Walrus Sites mirror (**Uy deploys**) |
| E2E | — | Playwright locally + in CI | Runs on Vercel previews and after every merge window on `main`; final pass before the video |
| E2E test wallet | — | **burner wallet** (≤ $2 USDC + a little SUI, its own capped Disc), signing through an injected test wallet (hippo's throwaway-wallet pattern) | The same burner + test owner accounts, retired after launch |
| Telegram bot | `@remora_uy_dev_bot` | not needed | The official bot |
| Postgres | local Docker Postgres (hippo's `docker-compose.yml`) | not needed | **Neon** `main`. CI pushes the schema, additive only |
| Walrus Memory | own account + keys, prefix `dev-uy:` | not needed | Real owner accounts + test owner accounts (prefix `test:`) |
| Tatum | own key | not needed | Project key |
| Gas sponsor | own wallet (small SUI) | not needed | The `main` sponsor wallet |
| Move package | Uy publishes; IDs go in `packages/schema/src/deployments.ts` | read-only | The same IDs |
| Secrets | password manager | `VITE_*` values + the E2E burner key | Railway / Vercel env vars |

**Why the resources are separate:**

- the Walrus Memory write limit is **60 weighted requests/min per delegate key**;
- Telegram allows **one poller per token**;
- a Sui sponsor's gas coins **can't be shared** by concurrent transactions.

**Huấn needs no backend secrets.** Local web talks to the `main` API using test accounts. The only key
Huấn holds is the capped E2E burner.

## 9. Hotspots & how to avoid them

| Hotspot | Rule |
|---|---|
| Typed API client `apps/web/src/lib/api.ts` | Shared. It changes only when the server's `AppType` changes (contract PR) |
| Web routes `apps/web/src/app/routes.tsx` | Append-only. Uy adds only `/lab/*` lines |
| Bot copy | Keys in `packages/schema` (contract). The text in `apps/server/src/copy/` belongs to Huấn, and Uy never edits the strings |
| DB schema | All Uy's, split per domain. Only CI pushes, on `main`, additive changes only |
| `bun.lock` | Add dependencies only inside your own app or package. On conflict, take `main`'s lockfile and run `bun install`. Root devDependencies change only through Uy |
| UI kit `components/ui` | Huấn owns it. Uy's lab only imports it and requests new components through a handoff |
| Docs | `remora-*.md` (scope, spec, plan): Uy. `team-split.md`: both. Huấn may add `docs/ux/*.md` and `docs/e2e/*.md` (test plans and reports) |
| Cross-lane requests | `docs/handoffs/<YYYY-MM-DD>-<from>-to-<to>-<topic>.md`: what's needed, why, the proposed interface, the deadline. The receiver answers in the same file and closes it with a PR link |

## 10. Uy's repo setup checklist (Mon Oct 20, morning)

- [x] Docs + `.gitignore` committed (the planning written before the window).
- [x] GitHub repo created, **private until submission**: `UyLeQuoc/walrus-session-10-remora`
      ([ADR-0017](adr/0017-github-repo-private-until-submission.md)).
- [x] **Labeled import commit** from hippo (`66fb33a`), done as `cd9acfd` (Oct 18, [ADR-0018](adr/0018-bootstrap-before-window.md)):
  - the toolchain, `packages/memory`, `packages/db`, channels, identity/connect, and the web shell + UI
    kit;
  - rename `@hippo/*` → `@remora/*`;
  - drop or flag off hippo-only features (teams, documents, chat UX).
- [x] Scaffold every directory in the spec's repo layout with a `README.md` stub naming its owner. Add
      `apps/web/src/features/lab/` and `apps/server/src/copy/` (done as `ae9b13f`).
- [x] `packages/schema` with the v1 contracts + fixtures (§4, `2831fd3`); append-only web routes
      (`ae9b13f`). The typed API client stub comes with the first new route.
- [x] `.github/CODEOWNERS` (§2, an ownership map; reviews are only auto-requested on PRs). `main` needs
      CI to pass but **allows direct pushes** from both people. CI (§6), Vercel previews.
- [ ] **The `main` environment** (the only one):
  - Railway project with server, facilitator, Reef and merchants: one server replica, monorepo watch
    paths, wait for CI;
  - Vercel project for `apps/web`, with previews;
  - Neon `main`, the official bot, the sponsor wallet.

  Share the main API URL with Huấn by **Oct 22**.
- [ ] GitHub Project board + issues for every feature, **split into `·be` / `·ui` issues** for shared
      features, generated from `remora-features.md` with `gh issue create`. Labels: `owner:uy` /
      `owner:huanng`, `wave:W1..W4`, `contract`.
- [x] Invite Huấn: `@huanngdev` was invited with write access on Oct 18 (waiting for acceptance).
- [ ] Share secrets through the password manager; Huấn needs `VITE_*` values + the E2E burner key.
- [ ] Post-deploy E2E (Huấn's suite) wired into CI after each `main` deploy, posting results to the
      team chat.
- [ ] The Walrus Sites mirror through `site-builder` (WAL, SuiNS), deployed by Uy.
- [ ] **Team submission:** submit Remora **once as a team**. Ask the organizers on Discord how to list
      the second member (the form has per-person fields such as Tatum ID and SUI address).

## 11. Rituals

- **Daily sync at 9:00 Vietnam time** (15 minutes, or async in chat): done, next, blocked, and any
  contract changes.
- **Board:** move issues as you go. A commit with `closes #N` closes its issue.
- **ADRs:** at the daily sync, skim the ADRs added since yesterday (`ls docs/adr`).
- **Wave exits together:**
  - Oct 25 (W1), Nov 1 (W2), Nov 6 (W3): Huấn presents the **E2E report** (the demo path on the `main`
    deployment). Together, decide which lab pages stay in the video, and rebalance §3.
  - Nov 6: Huấn's demo-ready call. Nov 7: Uy records the video. Nov 8: Uy publishes the blog and posts.
    Nov 9: Uy submits.
