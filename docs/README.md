# Remora — Walrus x Tatum: Total Recall

We're entering the **Total Recall** hackathon (Walrus Memory × Tatum, Oct 20 – Nov 10, 2026) in **one
track only: Smart Agents for Real Life**.

**Remora** is a set of always-on agents in the style of Grok Bot, Dots and Muse, with three differences:

- **memory you can read, edit and take with you** (Walrus Memory);
- **a budget enforced on Sui that no prompt can break** (native app-bound Allowances + the remora's
  **Disc**);
- **a receipt for every action** (its **Wake**).

> *It goes wherever you go. It cleans up after you. It never takes the wheel.*

## Docs

| Doc | What's inside |
|---|---|
| [remora-spec.md](remora-spec.md) | **Product & technical design:** the gap, positioning against Grok Bot/Dots/Muse, what a remora is, architecture, the Disc Move module, x402 facilitator, memory design, Wake receipts, safety model, Tatum usage |
| [goals/](goals/README.md) | **Paste-ready agent goals:** U0 bootstrap (Mon Oct 20, from 07:00 VN), U1 allowance spike (Oct 21), H0 web shell + E2E harness (Huấn) |
| [adr/](adr/README.md) | **Architecture Decision Records:** every decision and change of direction (81 so far). New decisions must add one here, agents included |
| [remora-features.md](remora-features.md) | **Scope:** the **MVP ship set (69)** + backlog (134 total), review of gaps, the **address-balance funds model**, 134 features in 14 epics (including **Hatchery**: share, duplicate, publish, and **UX**) with waves, workstreams, scope rules |
| [remora-plan.md](remora-plan.md) | **Build plan:** week 0 prep, waves W1–W4 by workstream with exit criteria, demo script, blog outline, scoring map, risks, submission checklist |
| [team-split.md](team-split.md) | **Two-person split.** Uy Le: Sui, Walrus Memory, Move, backend, deploy, video, submission. Huấn: UI/UX, E2E. Infra and UI are a flex pool. Covers lanes, CODEOWNERS, `·be`/`·ui` split by wave, frozen contracts, dependency dates, git workflow, **rules for long-running agent goals**, dev env isolation, hotspots, setup checklist |
| [reuse-from-hippo.md](reuse-from-hippo.md) | **Reuse map** of the owner's earlier mainnet chatbot *hippo* (reference clone in `reference/hippo`, gitignored): what to port per feature, compliance rules for prior work |
| [tech-reference.md](tech-reference.md) | **API cheat sheet:** Walrus Memory SDK (+ field notes measured by hippo), Tatum Sui RPC/gRPC/Data API, `sui::allowance`, x402 on Sui, gas, Seal |
| [threat-model.md](threat-model.md) | **Threat model (I7):** assets, actors, every threat with what stops it and its proof (tests, testnet digests, ADRs), and the honest boundaries |
| [deploy.md](deploy.md) | **Deploy runbook:** services, env per service, the `bun run diagnose` gate, steps, rollback, the mainnet pass |
| [launch/blog-draft.md](launch/blog-draft.md) | **Blog draft (L3):** "Rails Before Robots, Part 2", with real testnet numbers |
| [spikes/](spikes/) | **Exit records:** timings, digests and findings for each goal's testnet exit |
| [event-rules.md](event-rules.md) | The full event rules in English: dates, eligibility, submission form, requirements, judging, prizes |
| [ideas/tracks-1-and-3.md](ideas/tracks-1-and-3.md) | Receipts (Track 1) and Kitty (Track 3) on Remora's rails, what an extra entry costs. Being built in this repo (U11, [ADR-0060](adr/0060-build-receipts-and-kitty.md)); entering them is not decided |
| [archive/](archive/) | Parked ideas for the other tracks (Called It, Tuesday, Tab, Oath, Mandate). Reference only |

## Key facts

- **Deadline:** Nov 10, 2026, 17:00 UTC (midnight Vietnam time). **Target submission: Nov 9.** Results
  are announced Nov 17.
- **Must have:**
  - Walrus Memory writing on **mainnet**, with at least 10 memories;
  - Tatum RPC for onchain data;
  - a public repo and a working demo (2–3 minute video);
  - a published blog post covering **how it learned over time**.
- **Judging:** integration 30% · technical quality 30% (including **Tatum Sui RPC**) · creativity 20% ·
  presentation 20%. Sharing on X or LinkedIn earns bonus points.
- **Prizes we target:** Track 2 1st place ($500) + **Best Walrus Memory** ($500). Watch Discord for the
  Mystery Bounty.
- **One submission per person.** Remora is the submission. Its parts (Disc, facilitator, merchants,
  runtime) are components, not separate entries.

## Status

| Date | Milestone |
|---|---|
| Oct 18–19 | Week 0 prep: accounts, keys, funds, reading (no product code yet) |
| Oct 20–25 | **W1 Rails:** Disc on mainnet, facilitator, address-balance funds + Detect funds. ≥10 mainnet memories on day 1 |
| Oct 21 | **Go/no-go spike:** address-balance deposit → app-bound allowance spend via Tatum |
| Oct 26 – Nov 1 | **W2 Core product:** onboarding, Telegram, Scout + Sentinel, Sonar, inspector, dashboard |
| Nov 2–6 | **W3 Full product:** **Hatchery** (share, hatch, onchain provenance), shadow mode, Reef, Mini App, playground, Walrus Sites, SuiNS, Discord/Slack, import/export, Proof of Learning, more templates |
| Nov 7–9 | **W4:** record (Nov 7), publish (Nov 8), submit (Nov 9), expansion features in parallel |

**Funds model:** all USDC lives in **Sui address balances**. A **Detect funds** button shows any money
still sitting in `Coin` objects and moves it in with one tap (see
[remora-features.md §2.1](remora-features.md#21-funds-model-address-balance-everywhere)).
