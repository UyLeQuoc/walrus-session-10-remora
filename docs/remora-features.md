# Remora — Full Product Scope & Feature Catalog

> **Scope** ([ADR-0011](adr/0011-scope-mvp-ship-set.md)): an **MVP with enough features to feel complete.**
>
> - **The ship set (§0, 69 features) is what we commit to.**
> - The other 64 features are the **backlog**: build them in wave order if time allows; otherwise they
>   go into the README roadmap.
>
> [remora-spec.md](remora-spec.md) describes the design, and [remora-plan.md](remora-plan.md) sequences
> the work into waves.

---

## 0. MVP ship set (69 features)

The ship set covers the demo path, every hackathon requirement and the strongest judging angles.

| Area | Features |
|---|---|
| Onboarding & accounts | A1 sign-in · A3 memory account · A4 address-balance funds + Detect funds · A5 Telegram linking · A6 wizard · A9 network switch |
| Remora lifecycle | B1 create from template · B3 creation flow · B4 key custody · B7 budget change · B8 pause/retire · B9 rotate key |
| Templates | C1 Scout · C2 Sentinel |
| Runtime | D1 triggers · D2 durable jobs · D3 turn engine · D4 tools · D5 handoffs · D8 gas sponsor · D9 model routing and caps |
| Money | E1 Disc Move module · E2 disc-sdk · E3 x402 facilitator · E4 over-limit approval · E7 Reef (minimal) · E9 demo merchants |
| Memory | F1 namespaces · F2 learning loops · F3 inspector · F4 hide/correct/forget · F5 expiry display · F8 export · F9 Claude Code portability |
| Wake | G1 schema · G2 intent anchoring · G3 `remora verify` · G5 Proof of Learning |
| Channels & UI | H1 Telegram · H4 dashboard · H5 notification policy · H6 Walrus Sites mirror · H7 playground |
| Safety | I1 content isolation · I2 Sonar · I4 rate limits · I5 scrubber · I6 Move security · I7 threat model |
| Ops & launch | K1 observability · K2 health + `diagnose` · K6 tests + E2E · L1 learning charts · L2 README · L3 launch |
| Hatchery (core) | M1 share · M3 publish to Walrus · M4 gallery · M5 one-click hatch · M6 onchain provenance · M7 template safety |
| UX | N1 activity feed · N2 approval inbox · N3 shadow mode · N4 "Why?" everywhere · N6 human errors and pending states · N10 panic button · N13 first-run win · N19 feedback everywhere |

**The load:** about 65 parts for Uy and 36 for Huấn
(see [team-split.md §3](team-split.md#3-feature-split-by-wave)).

**Order:** ship set first, inside each wave; backlog only after the wave's ship-set items pass E2E.

---

## 1. Review of the previous plan: what was missing

| # | Gap | Why it matters | Fix (feature ID) |
|---|---|---|---|
| 1 | **Funding the owner's address balance** | Allowances pull from the funder's **address balance**. A normal USDC transfer creates `Coin` objects, not address balance, so funds must be deposited with `coin::send_funds`. Address balances also settle periodically, not in real time | A4. Spike it on Oct 21 |
| 2 | **Telegram ↔ owner authentication** | Anyone who finds the bot could otherwise command remoras | A5 |
| 3 | **Remora key custody** | The runtime holds remora private keys, so storage, encryption and rotation have to be designed | B4, B9 |
| 4 | **Memory expiry** | Walrus Memory blobs live for the epochs paid for. hippo measured about **210 days** for new memories, and an expired memory disappears | F5 (display + alerts) |
| 5 | **There's no way to delete a memory** | hippo measured this: the Security Delete API only covers legacy V1 blobs, and `POST /api/forget` removes a namespace's index only. "Forget" UX must be honest | F4 (hide / correct / forget all) |
| 6 | **Multi-user onboarding** | Walrus Memory allows exactly one account per address (permanent registry). Users need "detect or create" plus a delegate setup | A3, A6 |
| 7 | **Sponsor abuse and gas economics** | The runtime pays gas for every remora tx, so a loop or an attacker could drain it | D8, I4 |
| 8 | **LLM cost control** | Always-on agents burn tokens | D9, K4 |
| 9 | **Only one guard before payments** | The plan relied on Move limits alone. Products like Dots add a second-model review | I1, I2 (Sonar) |
| 10 | **No evals or red-team suite** | "Prompt injection can't exceed the contract" should be *measured* | I3, K6 |
| 11 | **No observability** | Always-on systems fail silently: gRPC stream lag, relayer outages, sponsor balance | K1–K3 |
| 12 | **No rebuild from the source of truth** | Postgres is a cache, so we should prove we can rebuild from Sui + Walrus | K5 |
| 13 | **MCP namespace mapping** | MCP clients recall from their session namespace (`default`) unless told otherwise, so the cross-tool demo needs explicit mapping | F9 |
| 14 | **Judges can't try it** | A Disc makes a public playground safe | H7 |
| 15 | **No Walrus-native frontend or onchain identity** | Easy wins with Walrus judges: Walrus Sites + SuiNS | H6, B5 |
| 16 | **Wrong assumptions about MemWal** (found by hippo) | No per-memory delete, unreliable `restore()`, about 24 s writes, silent empty recalls, two mainnet deployments, at most 20 delegate keys per account (so about 18 remoras per owner) | F4–F6, K2, K5, B3; see [tech-reference §1.11](tech-reference.md#111-field-notes-measured-on-mainnet-by-hippo) |
| 17 | **Sharing and UX** | No way to share a remora as a template or publish one; no approval inbox, shadow mode, activity feed, panic button… | Epics **M** and **N** |

---

## 2. Feature catalog

**Waves:**

| Wave | Dates | Focus |
|---|---|---|
| **W1** | Oct 20–25 | Rails |
| **W2** | Oct 26 – Nov 1 | Core product |
| **W3** | Nov 2–6 | Full product |
| **W4** | Nov 7–9 | Expansion, built alongside the launch |

**Definition of done for every feature:**

- the code is merged with tests;
- it's reachable from the product (Telegram, dashboard or CLI);
- it's documented;
- it shows up in the demo or the README.

### 2.1 Funds model: address balance everywhere

**Decision (Oct 18):** every USDC flow in Remora uses **Sui address balances**, never `Coin` objects:

- **Owners** fund their address balance, and the allowances behind every Disc draw from it.
- **Payments** (`disc::pay`) deliver to the payee's address balance with `balance::send_funds`.
- **Merchants and the facilitator** verify the `payTo` balance change and keep funds in the address
  balance.
- **Coins only appear at the edges,** when funds arrive from outside (exchange withdrawals and normal
  wallet transfers create `Coin` objects). The **Detect funds** button (A4) finds them and moves them in
  with one tap.

**UI requirements:**

- Every balance shows a split, e.g. *"$18.40 ready (address balance) · $5.00 in coins → Move"*.
- The **Detect funds** button is on the dashboard home, the funding step of onboarding, each remora page
  and the merchant view.
- A low-balance warning appears when the address balance can't cover the remaining budget windows.
- Withdraw to coin sits behind an "Advanced" toggle.

**To verify in the Oct 21 spike:**

- Which Tatum gRPC call returns the **address-balance component** separately from coin objects
  (`StateService.GetBalance` fields vs `ListOwnedObjects` coins). gRPC only, per ADR-0021.
- How long accumulator settlement takes after a deposit before an allowance can spend it.

### A. Onboarding & accounts
| ID | Feature | Details | Wave |
|---|---|---|---|
| A1 | Wallet sign-in | dapp-kit, any Sui wallet (Slush). Sign a personal message to get a session | W1 |
| A2 | zkLogin sign-in | Google/Apple via Enoki, registered as a wallet-standard wallet (port from hippo). Note: a zkLogin address differs from the one on memory.walrus.xyz, so the portability demo uses Slush | W2 |
| A3 | Walrus Memory account | Detect the owner's existing account (registry) or `createAccount`, then register the runtime delegate | W2 |
| A4 | **Address-balance funds + "Detect funds" button** | **Address balance is the only funds model** (see §2.1). A **Detect funds** button scans the owner, each remora and each merchant address, and shows how much USDC sits in `Coin` objects vs the address balance, plus a "settling" state while accumulator settlement catches up. One-tap **Move to address balance** (`coin::send_funds`) and, only when an outside app needs a `Coin`, **Withdraw to coin** (`tx.withdrawal` + `coin::redeem_funds`) | W1 |
| A5 | **Telegram linking** | `/start <nonce>` deep link + an owner signature in the dashboard binds the Telegram user to the owner address. Every command is authorized against this binding | W2 |
| A6 | Onboarding wizard | Sign in → memory account → fund → link Telegram → first remora from a template | W2 |
| A7 | Settings | Timezone, quiet hours, language (EN/VI), default channel, notification levels | W2 |
| A8 | Account export & exit | Export all memories and Wakes; retire all remoras in one flow | W3 |
| A9 | **Network switch** | One deployment serves testnet and mainnet. A header switch (with a TESTNET badge) picks the session's network, sent as `x-remora-network`. Mainnet is disabled until it's published. Remoras, Discs and funds are per network; memory stays on mainnet ([ADR-0026](adr/0026-network-switch.md)) | W1 |

### B. Remora lifecycle & identity
| ID | Feature | Details | Wave |
|---|---|---|---|
| B1 | Create from a template | Pick a template, set name, budget and payees | W2 |
| B2 | Create from a plain-language job | An LLM drafts persona, tools, triggers and a budget proposal; the owner reviews | W3 |
| B3 | **Remora creation** | (1) `add_delegate_key`, **relayer-sponsored** (the relayer's allowlist takes exactly one account call per tx, so the user needs no SUI); (2) `propose_for_app` + `disc::issue`, sponsored by Remora. **Stretch:** both in one PTB sponsored by Remora's own gas station. Verify the delegate onchain before activating | W2 |
| B4 | **Key custody** | Remora keys are envelope-encrypted at rest (master key in a KMS/secret store), never logged, and decrypted only in the signer module | W1 |
| B5 | SuiNS identity | A subname per remora (e.g. `scout-uy.remora.sui`), via the Enoki subname API or our own parent name | W3 |
| B6 | Edit remora | Persona, tools and triggers, versioned | W2 |
| B7 | Change budget | Revoke + reissue in one owner PTB, showing the memories that motivated it | W2 |
| B8 | Pause / resume / retire | Disc pause + runtime pause. Retiring revokes the allowance, removes the delegate and archives | W2 |
| B9 | Rotate key | `disc::rotate` + delegate swap, with the budget intact | W2 |
| B10 | `remora.yaml` | Export or import a remora definition (persona, tools, triggers, budget template) | W3 |
| B11 | Community templates | Superseded by **M. Hatchery** below | — |

### C. Templates (real-life jobs)
| ID | Template | Job | Wave |
|---|---|---|---|
| C1 | **Scout** | Answers questions by buying data from x402 sources, and learns value per dollar | W2 |
| C2 | **Sentinel** | Watches wallets, a treasury and protocol `UpgradeCap`s through the Tatum gRPC stream, and learns escalation rules | W2 |
| C3 | Errand | Pays people or merchants on request within its Disc, and asks above it | W3 |
| C4 | Subscriptions Keeper | Pays recurring x402 or merchant charges, learns normal amounts, flags price hikes | W3 |
| C5 | Treasurer | Team treasury watch, weekly report, spend proposals for the owner to sign | W3 |
| C6 | Daily Brief | Morning digest: wallet changes, prices (Tatum Data API), purchased news | W3 |
| C7 | Portfolio Guard | Sui lending and LP position health from object reads; alerts; optional top-up within its Disc | W4 |
| C8 | Inbox | An email-forwarding address: parses bills and receipts, sets reminders, hands off to Errand | W4 |
| C9 | Splitter | Group expenses, settled in USDC through Errand | W4 |

### D. Runtime
| ID | Feature | Details | Wave |
|---|---|---|---|
| D1 | Trigger engine | Message, cron and chain events (Tatum gRPC filters on address, object or event type) in W2; price thresholds (Tatum Data API) and inbound webhooks in W3 | W2/W3 |
| D2 | **Durable jobs** | Queue, retries with backoff, idempotency keys, dead-letter queue, dedupe | W1 |
| D3 | Turn engine | AI SDK 7 tool loop, structured output, per-remora tool allowlist, step limit | W2 |
| D4 | Tools | `memory.*`, `tatum.*` (balances, txs, objects, events, coin metadata, SuiNS), `web.fetch` (untrusted), `pay` (`disc.fetch`), `notify`, `handoff`, `schedule` | W2 |
| D5 | Handoffs | Remoras delegate subtasks to each other through `handoffs` | W3 |
| D6 | Group chat | Several remoras in one Telegram group, addressed by name | W3 |
| D7 | Proactive heartbeat | Periodic self-review of goals and memory, then proposals (rate-limited) | W3 |
| D8 | **Gas sponsor** | Sponsor wallet, per-remora gas budget, low-balance alerts, abuse limits | W1 |
| D9 | Model routing & cost caps | Sonnet for turns, Haiku for triage and extraction; daily token cap per remora | W2 |
| D10 | MCP connections | Plug any MCP server in as read-only tools | W4 |

### E. Money: Disc, payments, Reef
| ID | Feature | Details | Wave |
|---|---|---|---|
| E1 | **Disc Move module** | issue, pay, rotate, pause, set_payees, `Paid` event; permit guards; tests | W1 |
| E2 | **disc-sdk** | PTB builders, `disc.fetch` (x402 client), revoke + reissue | W1 |
| E3 | **x402 facilitator** | `sui:mainnet` verify (Tatum dry-run), settle (Tatum execute), gas station | W1 |
| E4 | Over-limit approval | The owner signs a one-off payment in one tap (web or Mini App) | W2 |
| E5 | Budget proposals | Memory-driven "raise or lower the budget" proposals, with cited memories | W3 |
| E6 | Spend analytics | Per remora, merchant and day; CSV statements; anomaly flags | W3 |
| E7 | **Reef** (service directory) | An x402 service registry (name, category, price, `payTo`, docs). Payee allowlists can reference Reef entries | W3 |
| E8 | `@remora/merchant` | Middleware that turns any API into an x402 service and lists it on Reef | W3 |
| E9 | Demo merchants | `sui-risk`, `odds`, `brief` | W2 |
| E10 | Reef reputation | Service scores from opt-in, aggregated Wake stats | W4 |
| E11 | Remora-as-merchant | A remora sells its output (e.g. Scout's research) to other remoras via x402 | W4 |
| E12 | MPP adapter | Sui Agent Payments advertises MPP, so speak both MPP and x402 | W4 |
| E13 | Public facilitator | Documented, rate-limited facilitator endpoint any Sui x402 merchant can use | W3 |
| E14 | Tunnels | Pay-per-call over tunnels for high-frequency calls | Roadmap |

### F. Memory (Walrus Memory)
| ID | Feature | Details | Wave |
|---|---|---|---|
| F1 | Namespace schema | Namespaces + writer policy (who writes where) | W1 |
| F2 | Learning loops | Rules, episodes, sources, feedback and budget per template | W2 |
| F3 | **Inspector** | Browse by namespace, search (`recall`), metadata (`created_at`, expiry, importance, size), "used in N decisions" | W2 |
| F4 | Hide / correct / forget | **There's no way to delete a current memory** (measured by hippo; the Security Delete API only covers legacy V1 blobs). **Hide** one memory with a local `hidden_at` filter, honored by recall and dedupe. **Correct** by writing a `[correction]` that supersedes the old fact. **Forget all** per namespace (`POST /api/forget`, index only). The UI says plainly that blobs stay on Walrus until they expire | W3 |
| F5 | Expiry display | Show `expires_at` from the read API (about **210 days** for new memories, measured). Renewal is a later concern. Alert under 30 days | W3 |
| F6 | Index check | Compare what we wrote (`memory_index`) against what the relayer reports, and warn on a mismatch. **`restore()` is not a recovery path** (it reported 0 for namespaces with memories) | W2 |
| F7 | Import | From Claude Code, Codex, Cursor, a ChatGPT export or Markdown (`analyze` ≤ 64 KiB chunks, `remember_bulk` ≤ 20) | W3 |
| F8 | Export | All memories as Markdown/JSON, so there's no lock-in | W3 |
| F9 | MCP portability | `packages/mcp` + MemWal MCP namespace mapping, so Claude Code and Codex see remora memories | W3 |
| F10 | Weekly review | "What I learned" per remora: a memory + charts + a Telegram post | W3 |
| F11 | Memory hygiene | Secret scrubber before every write (W2); rule-conflict detection, dedupe, recency weighting (W3) | W2/W3 |
| F12 | Private namespaces | `MemWalManual` client-side Seal encryption (needs an Enoki Seal key) | W4 |
| F13 | Memory capsules | Share a subset of memories through a Seal grant (expiring, revocable) | W4 |
| F14 | **MCP v2: agents act** | Scoped, revocable MCP tokens made in the web (Connections page); tools that write memory, pay through the Disc and request over-limit approvals; Streamable HTTP at `/mcp` as well as stdio; every action a Wake with `via` (ADR-0066). **Built in U12** ([ADR-0067](adr/0067-mcp-v2-details.md)): 10 MCP attacks in CI, 0 paid | W3 |
| F15 | **Facts & admission** | A facts ledger beside Walrus Memory: each memory's facts with when they hold, who asserted them (owner > runtime > agent > extractor) and the blobs they rest on; deterministic reconcile (supersede, dispute, history, `asOf`); admission drops what no longer holds, repeats and overflow before the model reads recall, and the Wake cites only what was admitted ([ADR-0074](adr/0074-memory-facts-and-admission.md), after Dewee). **Built Oct 31** | W3 |

### G. Wake (receipts & verification)
| ID | Feature | Details | Wave |
|---|---|---|---|
| G1 | Wake schema v1 | `intent` + `result`, stored in `receipts` | W1 |
| G2 | Intent anchoring | `sha256(intent)` → `Paid.intent` | W1 |
| G3 | `remora verify` | CLI + web verify page (intent hash, balance change, memory timestamps) | W2 |
| G4 | Merkle anchoring | Batch non-payment Wakes into an `Anchored` event | W3 |
| G5 | Proof of Learning | A diff of two decisions shows the memory delta that changed the outcome | W3 |
| G6 | Public proof links | Opt-in, redacted Wake pages that can be shared | W3 |
| G7 | Auditor access | Seal grant to read Wakes | W4 |

### H. Channels & UI
| ID | Feature | Details | Wave |
|---|---|---|---|
| H1 | Telegram bot | Address remoras by name, inline buttons, commands (`/remoras`, `/budget`, `/pause`, `/teach`) | W2 |
| H2 | Voice & images | Voice-note transcription; screenshot and receipt understanding | W3 |
| H3 | **Telegram Mini App** | Dashboard inside Telegram, with one-tap approvals | W3 |
| H4 | **Web dashboard** | Home, remora page (feed, memory, budget, Wakes), create wizard, settings | W2 |
| H5 | Notification policy | Priorities, quiet hours, digests | W2 |
| H6 | **Landing + docs on Walrus Sites** | Hosted on Walrus with a SuiNS domain, served at `*.wal.app` | W3 |
| H7 | **Public playground** | Judges try Scout with a **$1 Disc**, which is safe by construction | W3 |
| H8 | More channels | **Discord + Slack** ported from hippo (W3); WhatsApp (W4) | W3/W4 |
| H9 | i18n | English + Vietnamese | W3 |

### I. Safety & security
| ID | Feature | Details | Wave |
|---|---|---|---|
| I1 | Content isolation | Tool and web outputs are tagged untrusted; payments need intents built from trusted context only | W2 |
| I2 | **Sonar** | An independent check model + a deterministic policy engine before every pay or send | W2 |
| I3 | Red-team suite | A prompt-injection eval set, with published results ("N attacks, 0 overspends") | W3 |
| I4 | Rate limits | Per user, remora and tool; sponsor-abuse protection | W2 |
| I5 | Secret scrubber | Strip credentials before `remember` | W2 |
| I6 | Move security | Invariant tests, permit guards, versioned objects, upgrade policy (cap held by a multisig) | W1 |
| I7 | Threat model | A published doc | W3 |

### J. Developer platform
| ID | Feature | Details | Wave |
|---|---|---|---|
| J1 | npm packages | `@remora/disc-sdk`, `@remora/merchant` | W3 |
| J2 | `create-remora` CLI | Scaffold a template plus `remora.yaml` | W4 |
| J3 | Outbound API | Webhooks and REST for remora events | W4 |
| J4 | Docs site | Move module, SDKs, facilitator, Reef | W3 |

### K. Ops & quality
| ID | Feature | Details | Wave |
|---|---|---|---|
| K1 | Observability | Structured logs, traces, error tracking | W1 |
| K2 | Health dashboard + `diagnose` | Runtime, gRPC checkpoint lag, Tatum usage, MemWal `health()`, sponsor balance. `diagnose` (port from hippo) checks the package against `/config`, the registry against the chain, and the delegates; it gates deploys | W3 |
| K3 | Admin alerts | Sent to an admin Telegram | W3 |
| K4 | Cost tracking | Tokens, Tatum credits and gas per remora | W3 |
| K5 | Rebuild from truth | Rebuild Postgres from Sui (Disc objects, allowances, `Paid` events) + `GET /v1/owners/:owner/memories` metadata. Not `restore()` | W3 |
| K6 | Test suite | Move tests, SDK unit tests, mainnet integration (tiny amounts), Playwright e2e, LLM evals, CI | Continuous |

### L. Launch
| ID | Feature | Details | Wave |
|---|---|---|---|
| L1 | Learning-metrics pipeline | Charts for the blog and demo, built from real memories and Wakes | W3 |
| L2 | README & roadmap | Pitch, diagram, Tatum call list, threat model, roadmap of unbuilt features | W3/W4 |
| L3 | Launch | Video (Nov 7), blog + X + LinkedIn (Nov 8), submission (Nov 9) | W4 |

### M. Hatchery: share, duplicate and publish remoras
*Remoras are born in a hatchery.* The owner shares a remora as a **template** that anyone can
**duplicate** ("hatch") into their own account, or publishes a remora as a **public service** that others
can use directly.

| ID | Feature | Details | Wave |
|---|---|---|---|
| M1 | **Share as template** | Export a remora's persona, tools, triggers, schedule, budget *template* (suggested ranges, not amounts), **Reef service references** (never raw payee addresses) and example prompts. **Never included:** memories, keys, owner data, Wakes. A review screen shows exactly what will be shared, and the secret scrubber runs first | W3 |
| M2 | Starter memory pack (opt-in) | Hand-picked, non-private memories (e.g. Scout's source scores, Sentinel's generic rules) attached to the template in **public plaintext**, with a warning. Every entry is scrubbed and approved by the owner | W4 |
| M3 | **Publish to Walrus** | The template JSON goes into a Walrus blob, an immutable, content-addressed version. Share it as a link, a QR code or a Telegram deep link `t.me/<bot>?start=tpl_<id>` | W3 |
| M4 | **Hatchery gallery** | Browse, search and filter by category. Each template page shows its description, author (SuiNS), required tools, triggers and Reef services, suggested budget, fork count, and opt-in outcome stats from Wakes ("remoras hatched from this averaged $0.41 per useful answer") | W3 |
| M5 | **One-click hatch** | Duplicate into your account through an **install-style consent screen**: the permissions it needs (tools, triggers, payees, budget), a review of Reef payees, and *your own* budget. Then it runs the normal creation flow (B3) | W3 |
| M6 | Onchain provenance | A small Move package `remora_hatchery::hatchery` (ADR-0047): `Template { author, blob_id, version, parent }` + `Published`, `Forked` and `Deprecated` events. Authorship and fork lineage are verifiable, and versions are immutable | W3 |
| M7 | **Template safety review** | Before publishing *and* before hatching, Sonar scans the persona and prompts for injection and exfiltration patterns. Payees must resolve to Reef entries; unknown addresses are blocked. Permission diff, a report button, and a "verified" badge for templates we've reviewed | W3 |
| M8 | Template updates | Hatched remoras can follow the template. New versions arrive as a diff the owner accepts or declines; nothing auto-applies | W4 |
| M9 | **Public remora** (use without duplicating) | Publish a remora as a service. Visitors either (a) **chat in public mode**, with a separate guest namespace per visitor (hippo's guest pattern), so they never touch the owner's private namespaces, with rate limits and a free quota paid by a **dedicated, capped Disc**; or (b) **call it over x402** (Remora-as-merchant, E11), paying from their own Disc | W4 |
| M10 | Author analytics | Hatches, active remoras, public-mode usage, x402 revenue | W4 |
| M11 | Ratings & reviews | Wallet-signed, one per address, weighted by real usage | W4 |
| M12 | "Hatch this remora" badge | Embeddable button or card for READMEs, blogs and X posts, which feeds the sharing bonus | W3 |

**Is it worth building?** Yes:

- **Presentation:** judges can hatch a remora from the playground in one click.
- **Creativity:** agent templates with onchain provenance and safety review.
- **Walrus integration:** templates are Walrus blobs.
- **A growth loop:** a shared link becomes a new user.

**The main risk is a malicious template** (a poisoned persona, or a payee pointing at an attacker). M5
and M7 handle it: payees come only from Reef, there's a consent screen, a Sonar scan, and the Disc
limits always apply.

### N. UX completeness
| ID | Feature | Details | Wave |
|---|---|---|---|
| N1 | **Activity feed** | One timeline per remora and across all of them: actions, payments, pings, learned rules, handoffs. Filters; each item links to its Wake | W2 |
| N2 | **Approval inbox** | One queue of everything waiting on the owner: over-limit payments, budget proposals, rule conflicts, template updates. Works in the web app, Mini App and Telegram | W2 |
| N3 | **Shadow mode** | A new or edited remora runs on live triggers but **doesn't pay or send**. It shows "would have done X" for 24 hours, then the owner promotes it. Trust before autonomy | W3 |
| N4 | **"Why?" on every message** | Every remora message carries Why? (Wake + cited memories), Teach, Mute and 👍/👎, in Telegram and on the web | W2 |
| N5 | Budget meter & forecast | Remaining amount per window, plus a burn-rate forecast ("at this pace, Scout's budget runs out on Nov 3") | W2 |
| N6 | **Human errors & pending states** | Move abort codes become sentences ("this payee isn't on Scout's list"). Visible states for "saving to Walrus (~30 s)", "settling", "sponsored" and "relayer slow, retrying" | W2 |
| N7 | Global search / ⌘K | Across memories, Wakes, activity, remoras, templates | W3 |
| N8 | Remora health badges | Green/yellow/red for budget low, delegate revoked, stream lag, key rotated, shadow mode | W3 |
| N9 | **Chat-first management** | "Raise Scout's budget to $30" or "pause Sentinel at night" in chat returns a prepared transaction or settings change plus a one-tap sign link | W3 |
| N10 | **Panic button** | Pause every remora and Disc with one signature, from anywhere | W2 |
| N11 | Config history & rollback | Versioned remora configs with a diff and one-tap restore | W3 |
| N12 | Human schedules | "Weekdays at 8am", "every Sunday evening" → cron, with a preview of the next runs | W2 |
| N13 | **First-run instant win** | Right after creation, Sentinel explains your last 5 transactions and Scout answers a sample question, so the user sees value within 60 seconds | W2 |
| N14 | Guide & glossary | An in-app guide (diagrams, ported from hippo's guide) and tooltips for the product's plain words: spending limit, receipt, address balance, services, safety check, practice mode, and the kinds Researcher and Wallet watcher ([ADR-0101](adr/0101-researcher-and-wallet-watcher.md)) ([ADR-0094](adr/0094-plain-words-in-the-product.md): Disc, Wake, Reef and Sonar stay the names in code and docs) | W3 |
| N15 | Cost card | Per remora: LLM + gas + purchases this month (the UI for K4) | W3 |
| N16 | Personalization | Avatar or emoji, tone and language per remora. The avatar is a face whose eyes show its state ([ADR-0098](adr/0098-remora-faces-with-moods.md)) | W3 |
| N17 | Shared remoras | Invite teammates as viewers or approvers (hippo's team model) | W4 |
| N18 | Accessibility pass | Keyboard navigation, contrast, ARIA labels, reduced motion | W3 |
| N19 | **Feedback everywhere** | "Was this purchase worth it?" and 👍/👎 on answers feed `sources` and rules: the learning loop's raw input | W2 |
| N20 | Public status page | Runtime, facilitator, Reef, relayer and Tatum health | W3 |

**Totals:** 134 active features (135 rows, minus B11, which M superseded).

| Wave | Count |
|---|---|
| W1 | 13 |
| W2 | 38 |
| W3 | 57 |
| W4 | 19 |
| Split W2/W3 (D1, F11) | 2 |
| Split W3/W4 (L2, H8) | 2 |
| Roadmap only (E14) | 1 |
| Continuous (K6) | 1 |

---|---|
| W1 | 13 |
| W2 | 28 |
| W3 | 40 |
| W4 | 15 |
| Split W2/W3 (D1, F11) | 2 |
| Split W3/W4 (L2) | 1 |
| Roadmap only (E14) | 1 |
| Continuous (K6) | 1 |

---

## 3. Workstreams (one goal at a time per person, in their own checkout)

> **People:** **Uy Le** owns Sui, Walrus Memory, Move and the backend (WS1, WS2, WS3, WS5, and the
> backend half of WS4), plus deploy, video and submission. **Huấn** owns UI/UX and E2E (every `·ui` part).
> Infra and UI items are a **flex pool** either person can claim. The exact split, ownership and agent rules are in [team-split.md](team-split.md).

| Workstream | Owns | Interfaces it publishes |
|---|---|---|
| **WS1 Chain** | E1–E3, E13, A4, B3, B9, G2, I6, D8, **M6** | `disc-sdk`, facilitator URL, mainnet package IDs (disc + hatchery) |
| **WS2 Runtime** | D1–D7, D9–D10, C1–C9, I1–I5, **M7, M9, N3, N9** | Remora turn API, tool registry, guest/public mode |
| **WS3 Memory & Wake** | F1–F13, G1, G3–G7, **M2, N19** | `packages/memory`, Wake schema, verify CLI |
| **WS4 Surfaces** | A1–A3, A5–A8, B1–B2, B4–B8, B10, H1–H9, **M1, M3–M5, M8, M10–M12, N1–N2, N4–N8, N10–N18, N20** | Dashboard, Telegram bot, Mini App, playground, Hatchery gallery |
| **WS5 Platform & Ops** | E4–E12, J1–J4, K1–K5, L1–L3 | Reef, merchant kit, docs, observability |

**Contracts first.** On Oct 20, freeze these shared interfaces:

- the Disc Move ABI;
- the Wake JSON schema;
- the `remora.yaml` / template schema;
- the hatchery Move ABI;
- the tool registry interface;
- the DB schema.

The workstreams can then run in parallel without blocking each other.

---

## 4. Scope rules

- **Full product, built in order.** Every wave ends with the whole product working end to end on mainnet.
  A later wave never starts on top of a broken earlier one.
- **What doesn't land still ships as design.** Any feature not finished by Nov 6 goes into the README
  roadmap with its design, and the demo shows only what works.
- **The demo path is sacred.** These must keep working at every merge, because the video is recorded from
  them:
  - create remora → Scout buys → Sentinel pings → handoff;
  - injected payment aborts;
  - rotate the key;
  - inspector + Proof of Learning;
  - Claude Code recall.
