# Draft: the submission form, field by field (Uy fills and sends it)

> **Draft only.** Uy submits the form once (one submission per person), target Nov 9. It was checked
> against the live form at [recall-tatum-walrus.vercel.app](https://recall-tatum-walrus.vercel.app) on
> Oct 31, 2026. Nothing has been filled in or sent.
> - The form has no field for a track or a prize, so the description names them
>   ([ADR-0084](../adr/0084-enter-best-use-of-agent-payments.md)).
> - Personal fields are left blank here on purpose.

## What's still missing
| # | Item | Blocks | Who |
|---|---|---|---|
| 1 | ~~The deployed demo URL and the playground~~: live on Nov 3 at <https://getremora.vercel.app>, playground included ([ADR-0099](../adr/0099-first-deploy-one-railway-service.md)). Left: the demo path twice on it (U9 exit) | "Working demo", the blog's `[deploy]` markers | Uy |
| 2 | **Upload the demo video** and paste its link. The [real-app demo](demo/README.md) is re-captured and re-rendered on Nov 4 from the visual-first app ([ADR-0103](../adr/0103-visual-first-ui-pass.md)), then re-cut around live proof ([ADR-0106](../adr/0106-wow-pass-more-uses.md)): one question buying three services, a free answer, a Briefer's morning brief, an attack blocked live, Claude Code paying over MCP, and more: 176 s, 1080p, every caption ten words or fewer, at `docs/launch/demo/out/remora-demo-web.mp4` (gitignored; the master is `remora-demo.mp4`); the landing page plays the same file after the next deploy. The [motion-graphics showreel](showreel/README.md) (180 s, ADR-0090) is the alternative | A required field | Uy |
| 3 | **The repo made public** ([ADR-0017](../adr/0017-github-repo-private-until-submission.md)), right after a clean `bun run secrets:history` (clean on Oct 31, [ADR-0085](../adr/0085-scan-history-before-public.md)) | A required field and requirement 5 | Uy, Nov 9 |
| 4 | **The blog published** ([draft](blog-draft.md)), with the `[deploy]` and `[dogfood]` markers replaced | Requirement 4 | Uy |
| 5 | The X and LinkedIn posts ([drafts](social-drafts.md)) | Optional bonus points | Uy |
| 6 | Tatum ID, read from the dashboard | A required field | Uy |
| 7 | The contact fields and the consent checkbox | Required fields | Uy |

## The requirements
| Requirement | Status | Evidence |
|---|---|---|
| Walrus Memory writing on mainnet | ✅ | `bun run diagnose:memory` on Oct 31: the mainnet relayer is healthy, and the account is active with the server's delegate key registered onchain |
| At least 10 memories on mainnet | ✅ | The same run: **360 memories** visible on the read API, soonest expiry 197 days away |
| Tatum RPC for onchain data | ✅ | All Sui I/O goes through Tatum's gRPC (12 kinds of call, README "How Remora uses Tatum"), plus the Data API for SUI/USD. The free plan ran out during development, so a public fullnode stands in while Tatum answers 402 (ADR-0097) |
| A published blog post (what it does, Tatum + Walrus, how it learned) | ❌ | The [draft](blog-draft.md) covers all three; it isn't published |
| A working demo and a public repo | Half | The demo is live at <https://getremora.vercel.app> (testnet money, mainnet memory). The repo goes public on Nov 9 |
| Optional: Tatum AI Builder | Not used | Remora is hand-written |

## Contact (Uy)
| Field | Required | Answer |
|---|---|---|
| Email | Yes | Uy's |
| Discord handle | Yes | Uy's |
| LinkedIn | Yes | Uy's |
| Telegram ID | No | Uy's, if wanted |
| How did you hear about this event? | Yes | Uy picks one: Walrus Socials, Tatum Socials, Ads, Hackathon Listings, Friends, Search or Others |
| Which community or account did you hear about us through? | No | Uy's, if wanted |
| Is this your first Web3 project? | Yes | Uy's answer. Remora is built on hippo, a Session 8 entry |

## Accounts
| Field | Required | Where it comes from |
|---|---|---|
| Tatum ID | Yes | [dashboard.tatum.io](https://dashboard.tatum.io/) → My Account → My Account Info. Use the account whose key the deploy uses |
| SUI address | Yes | Uy's wallet. Use the Memory account's owner so the identities match: `bun run diagnose:memory` prints it as "relayer resolves owner" |
| Account ID (SUI) | Yes | The Memory account object. `bun run diagnose:memory` prints it as "account … matches the registry" |
| MEMWAL_AGENT_ID | Yes | The delegate public key the server uses. `bun run diagnose:memory` prints it, labeled "this is MEMWAL_AGENT_ID on the submission form". The account has two delegates; use that one |

## Project
**Project description** (draft; check the numbers against the deployed run):

> **Remora: always-on agents you actually own.** Track 2, Smart Agents for Real Life.
>
> A remora runs errands for you. A Researcher answers questions and buys data when that helps. A Wallet watcher watches
> your Sui addresses and learns what matters to you. Each remora has three things most agents lack:
>
> 1. **A budget Sui enforces, and payments over x402.** One signature issues a *Disc* on Sui's native
>    app-bound allowances: a monthly limit, a per-payment cap, the only services it may pay, and an
>    expiry. A Researcher pays for data over **x402**, through our own `exact` facilitator for Sui, which
>    sponsors gas and settles on Sui. A prompt injection that fools the model still can't move money,
>    because the Disc aborts the payment onchain. CI runs 28 attacks with 0 overspends.
> 2. **Memory that learns, and that you can read,** on Walrus Memory (mainnet). Mark a ping 👎 and
>    The Wallet watcher writes a rule, then stays quiet the next time. That decision's receipt cites the rule's
>    blob. A facts ledger tracks which facts still hold and who said them. You can inspect, correct and
>    export the memory, and use it from Claude Code over MCP.
> 3. **A receipt for every action.** A payment's receipt (its Wake) anchors the payment's intent
>    onchain, and Tatum's Sui gRPC checks it. A payment from the Disc with no decision behind it alerts the owner within minutes, the
>    sign of a leaked key.
>
> **Tatum.** Every Sui call goes through Tatum's gRPC:
> - the checkpoint stream behind the Wallet watcher and our indexer;
> - a simulation before every execute;
> - the facilitator's settlement.
>
> The Data API prices gas in USD.
>
> Our Tatum free-plan credits ran out during development. While Tatum answers `402`, the server
> routes the same gRPC calls through the public Sui fullnode and prices gas with a public API. It
> tries Tatum again every 10 minutes, and health shows which one is serving.
>
> **What's real.**
> - Payments run on Sui testnet; memory runs on mainnet (360+ memories).
> - Remora is built on our earlier project, hippo. The README says what came before the build window.
>
> We also enter **Best Walrus Memory** and **Best Use of Agent Payments** (x402 on Sui).

| Field | Required | Answer |
|---|---|---|
| Short demo video (2–3 min) | Yes | ⏳ Rendered (176 s, Nov 4, `docs/launch/demo/out/remora-demo-web.mp4`), not uploaded yet. Paste the link once Uy uploads it |
| GitHub repo | Yes | `https://github.com/UyLeQuoc/walrus-session-10-remora`. It's private until Nov 9 |
| Additional documentation | No | The landing page, <https://getremora.vercel.app/about> ([ADR-0100](../adr/0100-landing-and-app-one-site.md)), and the blog URL once it's out |

## Feedback
**How was your experience building with Walrus?** (draft)

> **What worked.**
> - Walrus Memory gave each agent its own namespace, with blobs we could list, expire and export.
> - The delegate-key model fits agents well.
> - Mainnet worked from day one: we have 360+ memories there.
>
> **What cost us time,** with numbers:
> 1. **`/health` hid a broken memory.** On Oct 22, about 14:00–14:32 UTC, `/health` answered 200 while
>    every remember and recall failed behind it with an embedding 401.
> 2. **Writes aren't searchable right away.** A write is accepted in about 2 s, but recall finds it only
>    after 25–32 s, so a fact saved in one turn often isn't there in the next.
> 3. **One memory can't be deleted or replaced.** Forget works per namespace, so we hide memories
>    locally and write a correction.
> 4. **The account budget is shared.** About 1,000 weighted requests an hour covers every agent on an
>    account, and our test suite spent it in an afternoon.
> 5. **The package ID was hard to pin down.** The docs name an older package, and `/config` has no
>    registry ID.
>
> **Requests:** a deep health check, a "searchable" status, a supported way to supersede one memory,
> and per-delegate budgets.

**How was your experience building with the Tatum AI Builder?** (draft)

> We didn't use the AI Builder; Remora is hand-written. We used Tatum's Sui gRPC gateway for all chain
> I/O and the Data API for the SUI/USD rate.
> - **The filtered checkpoint stream is what made the Wallet watcher possible.**
> - **Two things surprised us:**
>   - a filter takes at most 10 addresses;
>   - an unfiltered stream spent a month of free-plan credits in a few days.
> - **A docs snippet would help.** Node needs a native gRPC transport: `SuiGrpcClient` defaults to
>   gRPC-web, and the API key goes in as `x-api-key` metadata.

**One bug or friction point with Walrus Memory** (optional; draft)

> `remember` returns before the memory is searchable. A write is accepted in about 2 s, but recall finds
> it only after 25–32 s, so an agent that learns something in one turn can't use it in the next. A
> `searchable` status, or a webhook on the job, would let clients wait for it properly. Other memory
> systems wait for this before they move on: Dewee marks a batch of summaries consolidated only once the
> new document is searchable. On Walrus Memory, a client can't tell when that is.

This is draft 6 in [memwal-issue-drafts.md](memwal-issue-drafts.md). Draft 1 (`/health`) is the other
strong candidate.

| Field | Required | Answer |
|---|---|---|
| Social post links | No (extra points) | The X and LinkedIn links, once posted |
| The 18+ and terms checkbox | Yes | Uy ticks it |
