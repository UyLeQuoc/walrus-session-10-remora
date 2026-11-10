# Draft: the submission form, field by field (Uy fills and sends it)

> **Draft only.** Uy submits the form once (one submission per person) by **Nov 10, 17:00 UTC**. It was
> checked against the live form at [recall-tatum-walrus.vercel.app](https://recall-tatum-walrus.vercel.app)
> on Oct 31 and again on Nov 10 (same fields, no new rules). Nothing has been filled in or sent.
> - The form has no field for a track or a prize, so the description names them
>   ([ADR-0084](../adr/0084-enter-best-use-of-agent-payments.md)).
> - Personal fields are left blank here on purpose.

## What's still missing
| # | Item | Blocks | Who |
|---|---|---|---|
| 1 | ~~The deployed demo URL and the playground~~: live on Nov 3 at <https://getremora.vercel.app>, playground included ([ADR-0099](../adr/0099-first-deploy-one-railway-service.md)). **Fixed Nov 10** ([ADR-0154](../adr/0154-submission-day-publish-and-redeploy.md)): the landing's demo section had no video, because the U19 deploy was built from a clean worktree, and the video is gitignored, so `apps/landing/build.ts` skipped it. A web redeploy from a checkout that has `docs/launch/demo/out/remora-demo-web.mp4` fixes it, along with the forget fix (ADR-0153) and the Nov 10 numbers | \"Working demo\" | Done: Railway `ee2c857c`, Vercel `getremora-j9z39i7bo` (narrated video) |
| 2 | ~~Upload the demo video~~: **<https://youtu.be/_ioDZcXperI>**, public on Nov 10, narrated with ElevenLabs ([ADR-0155](../adr/0155-narrated-video-and-x-article.md)); the silent cut `6CgJ6HKZjDs` is unlisted | A required field | Done |
| 3 | ~~The repo made public~~: public on Nov 6, right after a clean `bun run secrets:history` over a mirror clone ([ADR-0151](../adr/0151-repo-public-nov-6.md)) | A required field and requirement 5 | Done |
| 4 | ~~The blog published~~: the X Article **<https://x.com/UyLeQuoc/status/2120049969600307237>** (Nov 10; Uy's Nov 7 draft, corrected, with a cover and seven frames, ADR-0155). The README links it; [blog-draft.md](blog-draft.md) is the longer version | Requirement 4 | Done |
| 5 | The X post is out: <https://x.com/UyLeQuoc/status/2120073312437215397>. LinkedIn ([draft](social-drafts.md)) is not posted | Optional bonus points | Uy (LinkedIn) |
| 6 | Tatum ID, read from the dashboard | A required field | Uy |
| 7 | The contact fields and the consent checkbox | Required fields | Uy |

## The requirements
| Requirement | Status | Evidence |
|---|---|---|
| Walrus Memory writing on mainnet | ✅ | `bun run diagnose:memory` on Nov 10: the mainnet relayer is healthy, and the account is active with the server's delegate key registered onchain. Production uses the same account and delegate |
| At least 10 memories on mainnet | ✅ | **1,008 memories** on the read API on Nov 10, soonest expiry 188 days away (360 on Oct 31) |
| Tatum RPC for onchain data | ✅ | All Sui I/O goes through Tatum's gRPC (12 kinds of call, README "How Remora uses Tatum"), plus the Data API for SUI/USD. The free plan ran out during development, so a public fullnode stands in while Tatum answers 402 (ADR-0097) |
| A published blog post (what it does, Tatum + Walrus, how it learned) | ✅ | <https://x.com/UyLeQuoc/status/2120049969600307237>, published Nov 10: what it does, the Tatum and Walrus stack, "How it learned over time" with the replay |
| A working demo and a public repo | ✅ | The demo is live at <https://getremora.vercel.app> (testnet money, mainnet memory). The repo is public since Nov 6 ([ADR-0151](../adr/0151-repo-public-nov-6.md)) |
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
> **One owner's week.**
> - **Monday:** their Researcher proposes lowering its own limit, and cites the memories behind it.
> - **Wednesday:** a paid feed raises its price; their Subscriptions keeper stops and asks instead of
>   paying.
> - **Friday:** they lend their Researcher's source notes to a friend's remora for a week, then take
>   them back with one signature.
>
> Every step has a receipt on Sui testnet.
>
> A remora runs errands for you. A Researcher answers questions and buys data when that helps. A Wallet watcher watches
> your Sui addresses and learns what matters to you. Each remora has three things most agents lack:
>
> 1. **A budget Sui enforces, and payments over x402.** One signature issues a *Disc* on Sui's native
>    app-bound allowances: a monthly limit, a per-payment cap, the only services it may pay, and an
>    expiry. A Researcher pays for data over **x402**, through our own `exact` facilitator for Sui, which
>    sponsors gas and settles on Sui. A prompt injection that fools the model still can't move money,
>    because the Disc aborts the payment onchain. CI runs 28 attacks with 0 overspends.
>
>    Remoras also pay **each other**. A Researcher can sell its answers over x402 at its owner's
>    address; another owner's remora buys one, and the seller pays its own sources: a chain of
>    receipts. Anyone can list their own x402 API in the Reef, and any Sui x402 merchant can settle
>    through our public testnet facilitator. One signature starts a crew, whose lead splits a question
>    across its members, each paying from its own limit. Under load on Nov 4, 50 remoras made 1,000 paid calls
>    on testnet (about 22 a minute, with the model out of the loop). 50 attempts over the cap or off
>    the list were all stopped onchain, and with every Disc read back, there were 0 overspends.
>
>    **Everyday money, and anyone can pay:**
>    - An **Errand** pays the people you list ("pay Linh 2 USDC for lunch"), with the memo anchored
>      onchain. It asks before 3x the usual, and splits bills with pay links.
>    - A **Subscriptions keeper** reads every 402 first and stops on a price hike it doesn't
>      remember.
>    - Anyone, with no account, can buy a remora's answer from its **public page** with their own
>      wallet.
>    - Every paid door speaks **x402 and MPP** (the Payment HTTP auth scheme, shaped like
>      `@suimpp/mpp`'s `sui` method).
>    - **Pay a `.sui` name**, resolved over Sui's gRPC NameService: you sign for the address, and a
>      name that moves stops the next payment.
>    - **A bill from a photo:** the model reads the total into a card (split it, or pay a contact);
>      only your tap acts, and text in the photo is never an instruction.
>    - **Found by any x402 agent:** the public facilitator lists the Reef in the x402 discovery
>      format, and our `disc.fetch` found a service there and paid it on testnet.
> 2. **Memory that learns, and that you can read,** on Walrus Memory (mainnet).
>
>    **The same ten questions, three times.** A Researcher answered ten questions on testnet and paid
>    for data each time; its owner rated the answers. A replay then planned the same ten questions with
>    no memory, with the memory it had before its first question, and with today's: **10, 10, then 4
>    planned services** (0.135, 0.135, then 0.060 USDC). Every skip cites the memory behind it: a rule
>    it proposed from the owner's ratings and the owner accepted with a tap ("Skip odds unless the
>    question names a team", citing five notes), or its own note on a service ("0 of 3 rated answers
>    were useful"). Replays are plans: they never pay, write memory or notify. The Memory Inspector
>    checks every write against Walrus Memory's own listing (`listMemories()`).
>
>    Mark a ping 👎 and
>    the Wallet watcher writes a rule, then stays quiet the next time. That decision's receipt cites the rule's
>    blob. A facts ledger tracks which facts still hold and who said them. You can inspect, correct and
>    export the memory, and use it from Claude Code over MCP.
>
>    **The loop closes** (act → outcome → memory → a better act → the owner signs → remembered):
>    - a remora **proposes its own budget**, citing the memories behind it; your yes or no is
>      remembered, and the next proposal reads it;
>    - the **Reef scores services** from shared outcomes, and the planner skips what owners rate as
>      noise;
>    - every Monday it writes **"What I learned"** back to memory, and the next week's review reads
>      it;
>    - an owner can **lend memories** to another owner's remora through a Seal policy on Sui, and
>      revoke them;
>    - **starter packs** let a template carry its author's scrubbed lessons.
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
> - Payments run on Sui testnet; memory runs on mainnet (1,008 memories on Nov 10).
> - Remora is built on our earlier project, hippo. The README says what came before the build window.
>
> We also enter **Best Walrus Memory** (the replay above: a decision that changes because of what
> it remembers, each change citing its blob) and **Best Use of Agent Payments** (x402 and MPP, settled
> on Sui: agents, people by `.sui` name or from a photo of a bill, visitors with a wallet, and any
> x402 agent that finds the Reef in the discovery catalog).

| Field | Required | Answer |
|---|---|---|
| Short demo video (2–3 min) | Yes | <https://youtu.be/_ioDZcXperI> (2:55, narrated) |
| GitHub repo | Yes | `https://github.com/UyLeQuoc/walrus-session-10-remora` (public since Nov 6) |
| Additional documentation | No | Blog: <https://x.com/UyLeQuoc/status/2120049969600307237> · Landing: <https://getremora.vercel.app/about> · For judges: <https://github.com/UyLeQuoc/walrus-session-10-remora#for-judges> |

## Feedback
**How was your experience building with Walrus?** (draft)

> **What worked.**
> - Walrus Memory gave each agent its own namespace, with blobs we could list, expire and export.
> - The delegate-key model fits agents well.
> - Mainnet worked from day one. The account holds 1,008 memories (Nov 10).
>
> **What cost us time,** with numbers:
> 1. **`/health` hid a broken memory.** On Oct 22, about 14:00–14:32 UTC, `/health` answered 200 while
>    every remember and recall failed behind it with an embedding 401.
> 2. **Writes aren't searchable right away.** A write is accepted in about 2 s, but recall finds it only
>    after 25–32 s, so a fact saved in one turn often isn't there in the next.
> 3. **Forget races pending writes.** `POST /api/forget` drops only what the relayer has indexed.
>    Measured on mainnet on Nov 6: it deleted 0 right after an analyze, and both facts were recalled
>    later. It deleted 2 once the jobs settled ([ADR-0153](../adr/0153-forget-after-writes-settle.md)).
> 4. **One memory can't be deleted or replaced.** Forget works per namespace, so we hide memories
>    locally and write a correction.
> 5. **The account budget is shared.** About 1,000 weighted requests an hour covers every agent on an
>    account, and our test suite spent it in an afternoon.
> 6. **The package ID was hard to pin down.** The docs name an older package, and `/config` has no
>    registry ID.
>
> **Requests:** a deep health check, a "searchable" status, forget that covers pending jobs, a
> supported way to supersede one memory, and per-delegate budgets.

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
| Social post links | No (extra points) | X: <https://x.com/UyLeQuoc/status/2120073312437215397> (Nov 10, quotes the blog, tags @WalrusProtocol and @tatum_io; @WalrusFoundation doesn't exist on X). LinkedIn: not posted |
| The 18+ and terms checkbox | Yes | Uy ticks it |
