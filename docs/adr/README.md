# Architecture Decision Records

**Rule:** any decision or change of direction gets an ADR here. That covers architecture, scope,
dependencies or vendors, deploy and environments, workflow, naming and security. Whoever makes the
change writes it, **agents included** (see `AGENTS.md` at the repo root).

## How to add one

1. Copy `0000-template.md` to `NNNN-short-slug.md`, using the next free number.
2. Fill in Context, Decision and Consequences, briefly. Link the docs it affects.
3. Update the docs it changes (spec, plan, features, team split) in the **same commit**.
4. Add a row to the index below.
5. **Never rewrite an accepted ADR to change the decision.** Write a new one, and set the old one's
   status to `Superseded by ADR-NNNN`.

## Index

| ADR | Decision | Status |
|---|---|---|
| [0001](0001-track-2-only-remora.md) | Compete in Track 2 only, with Remora | Accepted |
| [0002](0002-naming.md) | Product and component names | Accepted |
| [0003](0003-spending-limits-native-allowances.md) | Spending limits on native app-bound Allowances (the Disc) + an x402 facilitator | Accepted |
| [0004](0004-address-balance-everywhere.md) | Address balances for every USDC flow, plus a Detect funds UI | Accepted |
| [0005](0005-walrus-memory-usage-rules.md) | Walrus Memory usage rules (measured by hippo) | Accepted |
| [0006](0006-reuse-hippo-and-stack.md) | Reuse hippo as disclosed prior work; adopt its stack | Accepted |
| [0007](0007-wake-receipts.md) | Wake receipts stored in Walrus Memory, intent hash anchored onchain | Accepted |
| [0008](0008-remora-creation-two-step.md) | Create a remora in two sponsored steps | Accepted |
| [0009](0009-deploy-railway-vercel-single-env.md) | Backend on Railway, frontend on Vercel, one environment: main | Accepted; the service layout, Neon and auto-deploy superseded by 0099 |
| [0010](0010-team-split-and-git-workflow.md) | Two-person split and a lightweight git workflow | Accepted |
| [0011](0011-scope-mvp-ship-set.md) | Scope: an MVP ship set of 68 features, plus a backlog | Accepted |
| [0012](0012-hatchery-template-safety.md) | Hatchery: share and duplicate remoras, with safety invariants | Accepted |
| [0013](0013-telegram-primary-channel.md) | Telegram is the primary chat channel | Accepted |
| [0014](0014-sonar-pre-action-check.md) | Sonar: defense in depth before any payment or send | Accepted |
| [0015](0015-tatum-for-all-chain-io.md) | Route all chain I/O through Tatum | Accepted |
| [0016](0016-record-decisions-as-adrs.md) | Record every decision as an ADR | Accepted |
| [0017](0017-github-repo-private-until-submission.md) | GitHub repo stays private until submission | Accepted |
| [0018](0018-bootstrap-before-window.md) | Run the U0 bootstrap before the build window | Accepted; the claim that no feature came before the window is superseded by 0075 |
| [0019](0019-bootstrap-structure-decisions.md) | Structure decisions made during the bootstrap | Accepted |
| [0020](0020-allowance-spike-go.md) | Allowance spike: GO on native app-bound allowances | Accepted |
| [0021](0021-sui-grpc-only.md) | Sui chain access is gRPC only | Accepted |
| [0022](0022-no-worktrees.md) | No git worktrees: work in the main checkout on `main` | Accepted |
| [0023](0023-sui-cli-pin-and-spikes-workspace.md) | Pin Sui CLI 1.82.1 for Move, and a `spikes/*` workspace | Accepted |
| [0024](0024-testnet-first.md) | Testnet first; mainnet only when Uy says | Accepted |
| [0025](0025-disc-v1-design.md) | Disc v1 design choices | Accepted |
| [0026](0026-network-switch.md) | One deployment, both Sui networks, with a network switch in the UI | Accepted |
| [0027](0027-flex-takeover.md) | Uy's agent may take Huấn's open W1 items after finishing its own | Accepted |
| [0028](0028-w1-rails-design.md) | W1 rails design (facilitator as sponsor, queue, keys, indexer) | Accepted |
| [0029](0029-u4-web-and-e2e.md) | W1 web (U4) and the E2E harness | Accepted |
| [0030](0030-w2-memory-mode.md) | In W2, remoras' memory lives in the operator's account, by namespace | Accepted |
| [0031](0031-e4-owner-payment-and-merchants.md) | Over-limit approvals are a one-off owner payment; demo merchants accept any exact payment | Accepted |
| [0032](0032-w2-runtime-api-and-channels.md) | W2 runtime wiring, API and Telegram: who may act, and how | Accepted |
| [0033](0033-w2-api-contract.md) | The W2 API shapes are a contract in `packages/schema` | Accepted |
| [0034](0034-w2-web-live-pages.md) | W2 web pages run on the live API behind a wallet session | Accepted |
| [0035](0035-w2-exit-fixes.md) | What the W2 exit e2e changed: a gas coin pool, unmetered W2 reads, unsettled ≠ paid | Accepted |
| [0036](0036-ui-foundation.md) | UI foundation: warm theme, page components, a quieter kit | Accepted |
| [0037](0037-network-dropdown.md) | Network dropdown instead of a toggle plus a badge | Accepted |
| [0038](0038-home-dashboard-chat-route.md) | Home is the dashboard, chat moves to `/chat`, Memory gets two tabs | Accepted |
| [0039](0039-electric-indigo-primary.md) | Primary colour: electric indigo (supersedes the teal part of ADR-0036) | Accepted |
| [0040](0040-block-r-logo-and-trace.md) | Block "R" logo component, shadcn Trace for agent steps, full-width forms | Accepted |
| [0041](0041-ascii-ocean-empty-chat.md) | ASCII ocean behind the empty chat; liquid-glass composer and suggestions | Proposed |
| [0042](0042-grok-bots-shape.md) | Remora takes the Grok-bots shape: chat with remoras, rooms, a model each, teams from Markdown | Accepted |
| [0043](0043-patched-transitive-deps.md) | Pin patched versions with root `overrides` when the install scanner blocks | Accepted |
| [0044](0044-remora-identity-names.md) | Remora names for identity cookies, headers and the wallet sign-in text | Accepted |
| [0045](0045-u6-exit-fixes.md) | What the U6 exit changed: Sonar check model, hex addresses in YAML, reading owner transactions, room routing, the watcher filter, honest paid answers | Accepted |
| [0046](0046-hatchery-team-files-and-learning-shapes.md) | The Hatchery shares team files; shapes for safety, Proof of Learning and memory controls | Accepted |
| [0047](0047-hatchery-move-package.md) | `remora_hatchery` is its own Move package, with frozen templates | Accepted |
| [0048](0048-u7-hatchery-learning-memory-runtime.md) | How the Hatchery, Proof of Learning, learning charts and memory controls run | Accepted |
| [0049](0049-u7-exit-fixes.md) | What the U7 exit changed | Accepted |
| [0050](0050-memory-write-timeout.md) | A correction waits 60 s for the relayer, and a timeout is "try again" | Accepted |
| [0051](0051-playground.md) | The playground: a $1 Disc per visitor, no memory budget, and an onchain end | Accepted |
| [0052](0052-health-diagnose-observability.md) | One health report, `diagnose` as the deploy gate, request ids and an error ring | Accepted |
| [0053](0053-patched-vitest.md) | Pin vitest 4.1.12 when the install scanner blocks @vitest/mocker | Accepted |
| [0054](0054-docs-checked-in-ci.md) | Docs are checked in CI: relative links resolve, and the README's Tatum calls are generated | Accepted |
| [0055](0055-memory-failures-in-health.md) | Health and `diagnose` report memory failing behind a healthy relayer | Accepted |
| [0056](0056-node-24.md) | Node 24 everywhere, matching CI | Accepted |
| [0057](0057-patched-undici-zod-body-parser.md) | Patch undici, zod and body-parser in the lockfile when the install scanner blocks them | Accepted |
| [0058](0058-tatum-credit-budget.md) | Spend Tatum credits deliberately: filtered streams only, background streams off by default, one health report per 30 s | Accepted |
| [0059](0059-launch-on-testnet.md) | Launch on testnet first; the mainnet pass becomes U10 | Accepted |
| [0060](0060-build-receipts-and-kitty.md) | Build Receipts (Track 1) and Kitty (Track 3) in this monorepo on Remora's rails; entering them is decided later | Accepted |
| [0061](0061-receipts-sources-and-design.md) | Receipts: keyless sources (ESPN, Polymarket, Kalshi), binary markets, batch anchors on Sui, a server-rendered web | Accepted; the web superseded by ADR-0064 |
| [0062](0062-kitty-pot-design.md) | Kitty: a Move pot on app-bound allowances, a keeper that checks balances first, payday learning in memory | Accepted; the web superseded by ADR-0064 |
| [0063](0063-structured-records-skip-dedupe.md) | Receipts and Kitty write structured records without the semantic duplicate check | Accepted |
| [0064](0064-receipts-kitty-web-with-wallets.md) | Receipts and Kitty: a React web with wallets is the main surface (Kitty's sponsored, wallet-signed transactions; Receipts' signed picks); Telegram is optional | Accepted |
| [0065](0065-split-receipts-and-kitty-repos.md) | Split Receipts and Kitty into their own public repos (`total-recall-*`), fresh history; remove them from Remora after the U11 exit | Accepted |
| [0066](0066-agents-use-the-apps-through-mcp.md) | Agents use Remora, Receipts and Kitty through MCP: scoped tokens, tools that act, money only inside onchain limits (Remora MCP v2, Receipts delegations, Kitty delegates) | Accepted |
| [0067](0067-mcp-v2-details.md) | MCP v2 details: tools on the server behind `/mcp` (stdio proxies to it), tool lists by scope, over-limit refusals then `approval_request`, `via` in the hashed trigger | Accepted |
| [0068](0068-mit-license.md) | MIT license for Remora, Receipts and Kitty; third-party code (the vendored ASCII ocean) keeps its notice in `THIRD_PARTY_NOTICES.md` | Accepted |
| [0069](0069-openbot-ui-ported-under-polyform.md) | Remora's web takes openbot's UI, ported in React under PolyForm Noncommercial in `apps/web/src/openbot/` (its brand, avatars and copy not taken); supersedes 0036 and 0039 on the visual design; runs as U13 before U9 | Accepted |
| [0070](0070-u13-openbot-ui-implementation.md) | How U13 put openbot's UI on Remora: tokens over classes for the kit, shell slots (top row, docked side panel), Why? and Memory in the side panel, answers in bubbles, steps open, network follows the roster, phone mounts one pane | Accepted; the phone's bottom bar superseded by 0104 |
| [0071](0071-huan-goals-without-e2e.md) | Huấn's goals H1–H6 run without E2E while the burner wallet is empty; component tests + a manual pass instead, E2E returns for the demo-ready call | Accepted |
| [0072](0072-accept-ascii-ocean-and-lucide-icons.md) | Accepts ADR-0041 (ASCII ocean behind the empty `/chat`) as built under U13; icons come only from `lucide-react` (no emoji or text glyphs) | Accepted |
| [0073](0073-node-server-v2-and-vanilla-extract-override.md) | `@hono/node-server` 2.x and a bounded `@vanilla-extract/css` 1.21.3 override, so the install scanner passes (no in-range fix for either advisory) | Accepted |
| [0074](0074-memory-facts-and-admission.md) | Memory facts and admission (F15, after Dewee): a facts ledger with deterministic reconcile (owner > runtime > agent > extractor; supersede, dispute, history, `asOf`), admission before the model reads recall (stale, repeats, caps; optional judge, fails open), Wakes cite only what was admitted, track records skip semantic dedupe | Accepted |
| [0075](0075-pre-window-work-stated.md) | State what was built before the build window as it happened: W1 and W2 ran on Oct 19, the README names the cutoff commit `3f9a2a6` and when each proof was made, no history rewrite; supersedes ADR-0018's claim | Accepted |
| [0076](0076-u9-backend-for-huan-pages.md) | The backend for Huấn's H2–H6 pages: public `/api/status` (names and statuses only), the cost card (model at a blended price, gas at Tatum's Data API SUI price), the Reef directory, public proof links (allow-listed view, revocable token, no `reason`), account export and one-transaction retire-all (shadow, paused and Disc-less included) | Accepted |
| [0077](0077-reality-check-unexplained-payments.md) | The reality check: a `Paid` from a remora's Disc with no Wake behind it, checked again after 3 minutes, alerts the owner (feed event and urgent notice) to rotate the key or pause; detection for a leaked key | Accepted |
| [0078](0078-sentinel-hands-off-to-scout.md) | D5: Sentinel's `check` rule ("check airdrops with Scout", new `unknownCoin` condition) pings and hands the event to the owner's newest live Scout once, asking about the coin's package; the handoff trigger cites the ping's Wake | Accepted |
| [0079](0079-red-team-evals.md) | The red-team evals: `bun run evals` runs 28 attacks (10 MCP, 12 payments through Sonar's policy, 6 poisoned templates through the safety review) and prints "28 attacks, 0 overspends"; the deterministic suites run in CI, the model and onchain layers on demand | Accepted |
| [0080](0080-tatum-usage-in-health-and-no-resubscribe-backfill.md) | Tatum follow-ups from 0058: a `tatum.usage` health item (requests in the last hour, degraded past ~1,400/h), and no backfill when the watcher re-subscribes because the watched set changed; the e2e Sentinel cleanup stays with Huấn | Accepted |
| [0081](0081-launch-story.md) | The launch tells one story with built beats only (README "In one minute", the demo script, the blog's "What's real" and "What went wrong"); unbuilt beats go to the roadmap; social posts and MemWal issues are drafts Uy sends; U10 stays Uy's call, recommended only if time is left | Accepted |
| [0082](0082-follow-redirects-1-16-2.md) | Raise the `follow-redirects` override to `>=1.16.2` (GHSA-mrwp-f3q8-3g9p, via `@slack/bolt` › `axios`), so CI's install scanner passes again | Accepted |
| [0083](0083-contract-pr-17-merged-before-review.md) | Contract PR #17 (H2–H6 shapes, F15 facts, three routes) is merged on Uy's call before Huấn's review; he reviews on `main` and asks for changes through a new contract PR; the two-approval rule stays | Accepted; "one-off" superseded by 0087 |
| [0084](0084-enter-best-use-of-agent-payments.md) | Enter Best Use of Agent Payments (the revealed Mystery Bounty: x402 or MPP, settled on Sui) next to Track 2 and Best Walrus Memory; the README, blog and form description name x402 on Sui and say payments are on testnet; U10 stays Uy's call | Accepted |
| [0085](0085-scan-history-before-public.md) | `bun run secrets:history` scans every added line on every branch for secret-shaped strings and committed `.env` files, printing no values; run it right before the repo goes public (first run Oct 31: clean); not a CI step | Accepted |
| [0086](0086-owner-memory-first-and-visible-duplicates.md) | After Dewee's docs: admission ranks memories the owner stands behind as if 1.2× more similar (reorder only, fails open); a write skipped as a duplicate is logged and shown in the inspector (`duplicateWrites` per row, a `duplicates` list) instead of dropped silently; schema in a contract PR | Accepted |
| [0087](0087-uy-merges-additive-contract-prs.md) | Until the submission, Uy merges additive contract PRs (new types, defaulted fields, new routes) once CI is green and Huấn reviews on `main`; breaking ones still need both; Uy's agent may take web follow-ups it asked Huấn for, after an ADR-0027 claim. First use: PR #18 and the inspector's duplicate badge and list. Supersedes 0083's "one-off" | Accepted |
| [0088](0088-ux-pass-after-full-e2e.md) | A UX pass after the full e2e run (46 passed; U8 failed on a Tatum timeout, U12 on dedupe): Scout says when a planned purchase didn't go through, MCP remember names the blob a duplicate matched, U12 accepts a duplicate, readable remora descriptions instead of system prompts, readable forecast dates, and Try Scout / Check a receipt on signed-out Home | Accepted |
| [0089](0089-ux-pass-retired-remora-and-status-label.md) | UX pass, part 2: the U8 and U12 rerun passes (every flow green, two skipped by design); a retired remora's page says so instead of offering Ask or reading its revoked Disc; the health item becomes `tatum usage`; the audit also captures `/playground`, `/hatchery`, `/status` and `/reef` | Accepted |
| [0090](0090-motion-graphics-showreel.md) | A 180 s motion-graphics showreel drawn from code (`docs/launch/showreel`): every frame a pure function of time, captured by Playwright, a WebAudio soundtrack synthesised from the same cues, ffmpeg H.264/AAC at −14 LUFS; real ids and numbers only; the deployed-app capture stays the working demo | Accepted |
| [0091](0091-real-app-demo-video.md) | The demo video shows the real app on testnet, captured by an opt-in e2e `demo` project (CDP screencast + a manifest of clicks and marks), cut by those marks, told as problem → fix with SVG cursor, callouts and diagrams in the app's openbot design system; callouts say only what the screen shows | Accepted |
| [0092](0092-landing-page.md) | The landing page (H6): a static page in `apps/landing` in the app's design system, built into `dist/` for Walrus Sites (publishing is Uy's step); the cost card refetches every 30 s and after an Ask; `listOwnerDiscs` skips a cap whose allowance is gone | Accepted; the page's look superseded by 0102 |
| [0093](0093-demo-video-v2-walform-craft.md) | Demo video v2, told and rendered the way WalForm's videos are: hook, without vs with, footage chapters with a step tracker, one caption at a time and a spotlight, the money path, the attack, why, lockup; 1080p60 with sub-frame motion blur, a grain finalize, a 30 fps share copy, thumbnails and a contact sheet | Accepted |
| [0094](0094-plain-words-in-the-product.md) | Plain words in the product: spending limit, receipt, Services, safety check, Templates, practice mode, saved onchain; payees by name (`payeeName`); Disc, Wake, Reef, Sonar and Hatchery stay the names in code, API, routes and docs | Accepted |
| [0095](0095-explain-the-app-in-the-app.md) | The app explains itself: a "What's a remora?" block on Home and the guide, the guide leads with five steps to start and every page's purpose, the rail shows each page's name under its icon | Accepted; the block's form and Home's How it works button superseded by 0104 |
| [0096](0096-demo-video-dark-plain-words.md) | The demo video is re-shot in the app's dark theme with ADR-0094's plain words and ADR-0095's "What's a remora?"; the capture records element boxes and the spotlights follow them; optional elements are waited for, not glanced at | Accepted |
| [0097](0097-public-fullnode-fallback-when-tatum-is-out-of-credits.md) | When Tatum answers 402 (out of credits), Sui calls go to the public fullnode's gRPC for a 10-minute cool-down and the SUI price to a public API; Tatum stays the primary, health shows the switch, and the README and submission say so | Accepted |
| [0098](0098-remora-faces-with-moods.md) | A remora's avatar is a face in our own SVG code, in Dots Lab's style: a shape and tint from its id, and eyes that show its state (watching, thinking, paid, needs you, blocked, paused, retired); faces in the roster, cards, its page, the chat and "What's a remora?" | Accepted |
| [0099](0099-first-deploy-one-railway-service.md) | The first deploy: one Railway service runs the API, the facilitator and the demo merchants; Railway Postgres on the private network; the web at getremora.vercel.app, built locally and proxying `/api`; CLI deploys, not auto-deploy; the playground funded by the E2E burner | Accepted |
| [0100](0100-landing-and-app-one-site.md) | The landing page and the app are one site: getremora.vercel.app serves the landing at `/` to signed-out visitors (no `remora_session` cookie) and at `/about`, the app everywhere else; the web build adds the landing next to `app.html` | Accepted |
| [0101](0101-researcher-and-wallet-watcher.md) | The two kinds of remora read "Researcher" (Scout) and "Wallet watcher" (Sentinel) in the product: web, bot, playground, landing, video captions; slugs, API and docs keep `scout`/`sentinel`; `/ask` in the Telegram menu | Accepted |
| [0102](0102-landing-v2-live-shader.md) | Landing page v2: a dark page around a live WebGL sea (our own fragment shader, no library), the app's faces swimming through the hero, the real app in a glowing frame, dark cards with live illustrations; reduced motion and no-WebGL fallbacks | Accepted |
| [0103](0103-visual-first-ui-pass.md) | A visual-first pass over the whole web (goal U14): one line of purpose and one main action per page, data as meters, timelines, receipts and SVG flows from a small kit of our own, explanations moved into hints and the guide; a fresh reviewer each of three rounds; freeze by Nov 7, then the video again | Accepted |
| [0104](0104-visual-first-result.md) | What the visual-first pass changed (U14 exit): "What's a remora?" is a line, a money Flow and hints; Home is three numbers, six cards and the feed; /remoras is the list; a phone's bar is Home, Chat, Approvals, Funds, More; USDC everywhere; a spending limit is read, unreadable or gone onchain; Blocked means a guard; receipts lead with a receipt card | Accepted |
| [0105](0105-examples-you-can-try.md) | Examples you can try: chat suggestions are cards from a tested pool that open the remora's own thread when one is needed; the playground offers one card per service with its Reef price; a curated set of templates is published to Walrus and the test runs' templates are deprecated; the gallery hides deprecated and blocked; the video gains "08 · And more" | Accepted |
| [0106](0106-wow-pass-more-uses.md) | The wow pass (goal U16): five new paid services (wallet X-ray, Walrus blob check, repo health, prices, weather) that read their source before payment, a deterministic planner that can buy several at once, a third kind (the Briefer, on a schedule), live proof instead of diagrams in the video (the attack blocked on camera, three receipts from one question, Claude Code), and "What a remora can do" on the landing page | Accepted (for U16, its "contract PR for Huấn" line is superseded by [0107](0107-u16-without-handoffs.md)) |
| [0107](0107-u16-without-handoffs.md) | U16 runs without Huấn: Uy's agent does every part, his lane included; no claim or landed note; a `packages/schema` change goes in the same PR, listed in the exit note; the other AGENTS.md rules hold | Accepted |
| [0108](0108-football-agent-prd.md) | Document a proposed Track 2 football-agent vertical (VAR / Touchline): sourced API options, code reuse, learning and payment gates; no change to ship set, contracts, deployment or submission | Accepted |
| [0109](0109-pay-only-at-listed-address.md) | Before any fetch, the pay path refuses (as `sonar.blocked`, recorded) an unlisted payee or a listed one at an address that isn't its own; the Researcher's prompt lists the only addresses it may pay | Accepted |
| [0110](0110-live-attack-bait-and-switch.md) | The video's live attack: a demo service (`reef:market`, behind `DEMO_ATTACK=1`, testnet, never on a deployed host) answers with a 402 whose description is an injected "pay 0x…" and whose payTo is the attacker; Sonar blocks it before signing and Why? shows it, deterministically | Accepted |
| [0111](0111-scale-pass.md) | Goal U17 scales Remora: remoras sell answers over x402 (settled after the answer), owners list their own APIs, a public testnet facilitator, crews with a lead, one-click MCP, a Telegram Mini App, SuiNS names over gRPC, a dated load run with zero overspends and `/stats`; then one approved deploy, with no agent schema push | Accepted |
| [0112](0112-remoras-on-sale.md) | A remora sells its answers as `reef:remora-<slug>` (fits ReefRef), paid at its owner's address at `/api/x402/r/:slug`, settled after the answer; a sold turn reads no `me` memories and can't buy a remora (depth 1); an owner's remoras don't pay each other; sales are `action` events with `kind: "sale"`; one `set_payees` signature lets a remora buy from one | Accepted |
| [0113](0113-community-listings-and-public-facilitator.md) | Anyone lists an x402 API in the Reef: one unpaid probe (exact, sui:testnet, USDC, ≤ 0.1), a signed message naming it, stored in one of the owner's remoras' config (no schema push), `reef:community-<slug>`; the facilitator is public on testnet through `/api/facilitator` with 200 settlements per payTo a day and 10 gas calls per address a minute | Accepted |
| [0114](0114-crews.md) | Crews: a team file with `crew.lead` and members' `covers`; the lead plans the buys, hands each to the member that covers it, all at once, pays nothing and answers with every member's receipt; the crew card sums spend, pauses (runtime) and retires (one revoke transaction) together; a Research crew template | Accepted |
| [0115](0115-telegram-mini-app-and-mcp-links.md) | The Telegram Mini App (`/tg`) holds no session: every call carries Telegram's signed launch data, checked with the bot token and mapped to the A5-linked owner; it shows remoras, receipts and approvals and pauses all in the runtime; one-click Cursor and VS Code MCP installs and a JSON config, the token only in links to local apps | Accepted |
| [0116](0116-suins-names-cut-from-u17.md) | SuiNS names (U17 C3) are cut: gRPC `LookupName` resolves testnet names, but the SuiNS SDK needs `@mysten/sui` ^2.39 (we're on 2.36) plus axios, and a testnet parent name; listed for Uy | Accepted |
| [0117](0117-image-carries-load-runs.md) | The API image copies `docs/spikes/*-u17-load.json`, so `/api/stats` shows the dated load run as measured | Accepted |
| [0118](0118-video-network-scenes.md) | The video's "And more" gives way to "10 · Remoras pay remoras" and "11 · A crew of remoras", filmed on testnet Nov 5; 179.6 s; `render.ts` follows linked shot folders | Accepted |
| [0119](0119-u18-learning-loop-everyday-money.md) | Goal U18: a learning loop you can see (budget proposals citing memories, Reef reputation from opt-in outcomes, a weekly review, Seal memory capsules on a new testnet Move module, starter packs), everyday money (Errand pays contacts, Subscriptions Keeper flags remembered price hikes, Splitter, a public page where anyone buys one answer from their wallet, MPP on every x402 door, statements), easier steering (describe the job, chat commands, config history, price and webhook triggers, outbound webhooks); no schema push; running the goal approves one deploy | Accepted |
| [0120](0120-mpp-on-every-door.md) | Every x402 door also speaks MPP (the Payment HTTP auth scheme, `sui` method, `charge` intent), shaped like `@suimpp/mpp` (whole-unit amounts, digest credentials checked over gRPC) without the dependency; challenges HMAC-bound and single-use; `disc.fetch` pays an MPP-only 402 | Accepted |
| [0121](0121-price-and-webhook-triggers-outbound-hooks.md) | The schema's `price` and `webhook` triggers run: a 5-minute unpaid price poll with hysteresis, and a signed `POST /api/hooks/:remoraId/:id` (derived secrets, 401, 30/min, 64 KB, untrusted body); outbound webhooks for payments, answers, approvals, proposals and price hikes, signed and retried, SSRF-guarded; no new tables | Accepted |
| [0122](0122-statements-and-config-history.md) | Monthly statements with CSV and anomaly flags from existing rows; every config change is a `config_changed` version (`saveConfig`) with a diff, restored directly or, for money fields, through the owner's signature | Accepted |
| [0123](0123-describe-the-job-and-chat-commands.md) | Describe the job in plain words and the parse model drafts a validated remora (refusals by pattern first, one repair); chat and Telegram commands become change cards you tap (settings) or sign (limits, payees, contacts) | Accepted |
| [0124](0124-budget-proposals-cite-memories.md) | A remora proposes its own budget from rules in code, citing 2–5 stored memories; accept is one signature, a decline is remembered in `feedback` and the same change waits 7 days | Accepted |
| [0125](0125-errand-pays-contacts.md) | The Errand pays people: contacts are Disc payees (`reef:contact-<slug>`, one signature), paid through the ordinary x402 path against an in-process merchant with the memo in the Wake; over the cap the owner pays once, 3x the usual asks first | Accepted |
| [0126](0126-public-remora-page.md) | A remora on sale has a public page (`/r/:slug`) where anyone pays one answer from a testnet wallet, gas from the public facilitator, settled after the answer; one question per 30 s per payer | Accepted |
| [0127](0127-reef-reputation-from-shared-counts.md) | Reef reputation from opt-in shared counts over 7 days ("new" under 3 owners and 20 calls); the planner skips a service under 40% useful after 20 rated answers, and Why? says so | Accepted |
| [0128](0128-weekly-review-written-back-to-memory.md) | A weekly "What I learned" from the remora's own numbers, worded by the model, written back to Walrus Memory and read by next week's; Mondays 09:00 owner time, or now | Accepted |
