# Goal U18: a learning loop you can see, everyday money, a remora anyone can use, then the deploy

- **Owner:** Uy's agent, for every part, Huấn's lane and `packages/schema` included, the way U16 and
  U17 ran ([ADR-0107](../adr/0107-u16-without-handoffs.md)).
- **Decision:** [ADR-0119](../adr/0119-u18-learning-loop-everyday-money.md).
- **Runs in:** a git worktree of `/Users/uydev/orca/projects/walrus-session-10` (see "Before you
  start"), on the branch `u18-loop`. It's merged through a PR, then deployed.
- **Time box** (Vietnam time; the deadline is Nov 10, 17:00 UTC, and the target submission is Nov 9):

  | When | What |
  |---|---|
  | Nov 5 | A1 (budget proposals), A2 (Reef reputation), B1 (Errand), B4 (the public page) |
  | Nov 6 | B5 (MPP), A3 (weekly review), B2 (Keeper), C4 (price and webhook triggers), A4 (capsules) |
  | Nov 7, until 18:00 | B6, C1, C2, C5, C3, A5, B3. **The code freeze is at 18:00** |
  | Nov 7 evening–Nov 8 | Part D: the landing page, docs, PR, merge, deploy, smoke; the video by Nov 8, 12:00 |

  **If time runs short, keep this order** (cut from the bottom; whatever is cut goes on the list for
  Uy):
  1. A1, budget proposals;
  2. B4, the public page;
  3. B1, Errand;
  4. A2, Reef reputation;
  5. B5, MPP;
  6. A3, the weekly review;
  7. B2, Subscriptions Keeper;
  8. C4, price and webhook triggers;
  9. A4, memory capsules;
  10. B6, statements;
  11. C1, describe the job;
  12. C2, chat commands;
  13. C5, outbound webhooks;
  14. C3, config history;
  15. A5, starter packs;
  16. B3, Splitter;
  17. the video.

**Goal:** a judge sees, in one story, a remora that learns from what it paid for and handles the
money of an ordinary week:
- **It learns, and shows it** (Best Walrus Memory rewards "the deepest learning loop"):
  - it proposes its own budget, citing the memories behind the proposal;
  - the Reef scores services from real outcomes;
  - every week it writes what it learned;
  - an owner can lend a remora's memories to another owner's remora and take them back, enforced by
    Seal.
- **Everyday money** (Best Use of Agent Payments): it pays a friend, keeps subscriptions honest (it
  stops on a price it doesn't remember agreeing to) and splits a bill.
- **Anyone can use one:** a public page where anyone pays for one answer from their own wallet, and
  every paid door speaks both x402 and MPP.
- **Easier to steer:** describe a job in plain words, change settings from chat, and see every config
  change as a version you can restore.

**The story to lead with** (the landing page, the video, the submission): one owner's week.
- On Monday her Researcher proposes lowering its own limit, and cites three memories.
- On Wednesday a subscription raises its price, and the Keeper stops and asks.
- On Friday she lends her Researcher's source notes to a friend's remora for a week, then takes them
  back.

Each beat has a dated testnet receipt or digest.

## Before you start
- **Read:**
  - [ADR-0119](../adr/0119-u18-learning-loop-everyday-money.md);
  - ADR-0111, ADR-0112, ADR-0114 (crews), ADR-0109 (pay only at the listed address), ADR-0110 (the
    live attack), ADR-0074 (memory facts), ADR-0097 (the public fullnode fallback), ADR-0099 (deploys)
    and ADR-0024 (testnet publishes);
  - `docs/deploy.md`, `docs/spikes/2026-11-05-u17-exit.md` and `docs/tech-reference.md` §1.11
    (MemWal gotchas);
  - **runtime:** `apps/server/src/runtime/{learning,facts,feedback,approvals,sales,scout,schedules,wake,rules,notify}.ts`;
  - **money:** `apps/server/src/money/{reef,listings,community}.ts` and
    `apps/server/src/tools/pay.ts`;
  - **payment libraries:** `packages/merchant/src/{x402,safe-fetch}.ts` and
    `packages/disc-sdk/src/{builders,x402,fetch}.ts`;
  - **Move:** `packages/move/remora/sources/disc.move`;
  - **Seal:** `packages/memory` (it already depends on `@mysten/seal`) and `apps/web/src/lib/seal.ts`;
  - **schema:** `packages/schema/src/remora.ts`. `Trigger` already has the `price` and `webhook`
    kinds, but the runtime handles neither;
  - **price source:** `apps/merchants/src/price.ts` (`pricesOf`, CoinGecko's free API);
  - **web:** `apps/web/src/features/{remoras,reef,funds,learning,memory-inspector,hatchery,chat,approvals,tg}`;
  - **e2e:** `e2e/tests/{economy,demo}.spec.ts` and `e2e/support/test-wallet.ts`
    (`connectAndSignIn`).
- **Where to work:** `git fetch origin`, then `git worktree add <scratch>/u18 -b u18-loop
  origin/main`, and work only there.
  - Uy keeps uncommitted edits in `docs/README.md` and `docs/ideas/track-1-hunch-prd.md` in the main
    tree. Never touch those two files.
  - Run `bun install` in the worktree, and copy the root `.env` into it. Don't commit it.
- **The local stack:**
  - e2e ports 8797/8798/8799/5183, with Docker Postgres;
  - **never kill 8787/5173**.
- **Check the money first, and write the numbers in the exit note:**
  - the burner's USDC (at least 10) and the gas station sponsor's testnet SUI (at least 5);
  - **burner2 was emptied on Nov 5:**
    - fund `E2E_BURNER2_KEY` from the burner with 2 USDC and 0.5 SUI;
    - it plays the friend in B1, the visitor in B4 and the grantee's owner in A4;
    - real owner accounts are never used.
  - Tatum: if it answers 402, the fallback applies (ADR-0097), and every number says which node
    served it.
- **No schema push.** New data goes in columns that already exist. Suggested homes:

  | Data | Where |
  |---|---|
  | proposals | `approvals` rows with `payload.kind = "proposal"` |
  | reputation opt-in, contacts, outbound hooks, accepted capsules | the remora's `config` (optional fields in `RemoraConfig`) |
  | config versions | `remora_events` (`config.changed`, before and after) |
  | webhook secrets | not stored: HMAC of a server secret and `remoraId:id` |
  | Keeper's normal prices | memory facts, as the durable record |
  | capsules | onchain objects plus Walrus blobs |

  If a part truly needs a new column, write the additive migration and an ADR, but don't push it.
  Ship the part so it still works without the column, and put the push on Uy's list.

## Part A: a learning loop you can see
### A1. Budget proposals (E5)
- **When it proposes** (rules in code, checked after each settle and once a day):
  - the window is at least 80% used with more than 30% of it left;
  - the window is under 20% used after 7 days;
  - at least 2 approvals were asked in 7 days for the same kind of payment;
  - at least 5 paid turns all hit the per-payment cap.
- **What it proposes:**
  - one open proposal per remora at a time, e.g. "Lower Researcher's monthly limit 0.50 → 0.20
    USDC: it spent 0.07 in 14 days";
  - the change (window cap, per-payment cap or payees);
  - the numbers behind it, from receipts and the Disc read over gRPC;
  - 2–5 **cited memories** (blob ids that open in the Memory Inspector).
  - The model writes only the one-line reason, from the numbers and the memories it's given. A
    proposal with no cited memory isn't shown.
- **Accept** with one signature:
  - `buildSetPerPaymentCap`, or `buildRevokeAndReissue` for the window cap, built on the server and
    signed in the web;
  - from Telegram, through a sign link.
- **Decline** with one click and an optional reason.
- **The loop closes in memory:**
  - the outcome becomes a `[proposal]` fact (accepted or declined, plus the reason);
  - the next proposal reads it ("you declined lowering it on Nov 6 because …");
  - after a decline, it waits at least 7 days before proposing the same change.
- **UI:** a proposal card on the remora page and on Home, counted with Approvals.
- **Exit:**
  - on testnet the burner's Researcher proposes a change citing memories;
  - it's accepted with one signature, and the Disc is read back over gRPC;
  - the decline path and the 7-day wait are covered by unit tests.

### A2. Reef reputation (E10)
- **A score per Reef service, from real outcomes:**
  - paid calls;
  - answered after settling;
  - useful and noise counts (`source_stats`);
  - thumbs up and down on answers that cited it;
  - median latency;
  - the number of owners.
- **How it shows:** "92% useful · 214 paid calls · 6 owners · last 7 days" on Reef cards, `/stats`
  and `/api/reef/services` (`score`).
- **Opt-in per remora:**
  - `config.share.stats`, off by default;
  - the Settings switch says what's shared: counts only, never questions or answers;
  - test owners turn it on.
  - Below 3 owners or 20 calls, the card says "new" instead of a score.
- **The planner uses it:**
  - when two listed services cover the same need, it prefers the higher score;
  - it skips one below 40% useful after 20 or more calls, and Why? says so;
  - a score never overrides the owner's payees or the ADR-0109 guard.
- **Exit:**
  - the Reef shows scores computed from dated testnet rows;
  - a unit test skips a low-score service, and Why? explains it.

### A3. Weekly review (F10)
- **When:** Mondays at 09:00 in the owner's timezone (`owner_settings.timezone`), or "Write it now"
  on the remora page.
- **"What I learned this week":**
  - what it paid for, and what was useful;
  - the sources it trusts more or less;
  - what it was taught;
  - the proposals and how they ended;
  - its spend against its limit;
  - a small chart: spend per day, useful against noise.
- **It's written back to Walrus Memory** as a `[review]` memory. Next week's review reads last week's
  ("last week I said …; this week …").
- **Posted to Telegram** when the owner is linked, respecting quiet hours and the notify level.
- **Exit:**
  - one review written on testnet, citing its blob and visible in the Memory Inspector;
  - a second "Write it now" refers to the first.

### A4. Memory capsules (F13): lend memories, take them back
- **Granting:** in the Memory Inspector the owner picks:
  - memories (e.g. the Researcher's source notes);
  - a grantee: another owner's remora, from a Reef `@slug` or a pasted address;
  - an expiry of 1 to 30 days.
- **Move:** a new `capsule` module in `packages/move/remora`:
  - `Capsule { owner, grantee, blob_id, expires_ms, revoked }`, with `create` and `revoke` (owner
    only);
  - `seal_approve(id, capsule, clock, ctx)` aborts unless the sender is the grantee, it isn't revoked
    or expired, and `id` starts with the capsule's id;
  - Move tests;
  - publish or upgrade on **testnet** only (ADR-0024), and record the new ids in `DEPLOYMENTS`.
- **Encryption and storage:**
  - encrypt on the server with `@mysten/seal` through `packages/memory`, against verified open-mode
    testnet key servers (take their ids from the Seal docs and check them on testnet), threshold 2;
  - the ciphertext goes to Walrus testnet (the public publisher); reads go through an aggregator.
- **Accepting:**
  - the grantee's owner sees "Offered: 12 memories from @uy-researcher until Nov 14" and accepts with
    one click;
  - nothing enters a remora's turns before that.
- **Using:**
  - the grantee remora decrypts at answer time with a `SessionKey` signed by its own key. It never
    copies the plaintext into its own memory, so a revoke or an expiry takes effect on the next turn;
  - answers cite "capsule from @uy-researcher";
  - capsule lines are data, never instructions (ADR-0110).
- **Revoke:** one owner signature. The next turn shows "capsule revoked" in Why?.
- **Gotchas:**
  - Seal takes a `ClientWithCoreApi`, so pass the gRPC client; no JSON-RPC;
  - watch the `SessionKey` TTL and the key servers' rate limits;
  - cache decrypted lines in-process for one turn only.
- **Exit, on testnet:**
  1. grant;
  2. the grantee's answer cites a capsule memory;
  3. revoke (digest);
  4. the next answer can't use it, and says why.
- **Cut rule:** if Seal key servers or Walrus testnet block this for 3 hours, cut it with an ADR.
  Keep the Move module if its tests pass.

### A5. Starter memory packs (M2)
- **Attaching:** a template's author attaches up to 20 non-private memories (e.g. source scores,
  Sentinel's generic rules):
  - they're **public plaintext** in the template's Walrus blob, with a warning;
  - each line is scrubbed: no addresses except listed payees, no names, no amounts tied to a person;
  - each line is approved one by one.
- **On hatch:**
  - the owner ticks which lines to import;
  - imported lines carry `SOURCE: pack <template digest>` (facts skip dedupe for SOURCE lines,
    ADR-0074).
- **Exit:**
  - one curated template gets a pack and is confirmed to the live API in Part D;
  - an import shows in the Memory Inspector with its source.

## Part B: everyday money
### B1. Errand: pay people (C3)
- **A new kind,** "Errand", with a template. The pay tool gets a "pay a contact" path.
- **Contacts:**
  - a contact is a name and an address, kept in `config.contacts`;
  - adding one is `buildSetPayees`, with one signature;
  - the ADR-0109 guard extends to contacts: an Errand pays only listed contacts, at their listed
    addresses.
- **"Pay Linh 2 USDC for lunch"** (web chat or Telegram):
  - within the per-payment cap and the window, it pays. The memo is hashed into the 32-byte intent
    and kept with the receipt;
  - above the cap, it raises an approval card (the owner pays from their own wallet, `approvalPay`);
  - an unknown or ambiguous name makes it ask.
- **Memory:**
  - it remembers "Linh: lunch, usually 2 USDC" as facts in `me`;
  - an amount at least 3× a contact's usual makes it ask first.
- **Exit, on testnet:**
  - the burner's Errand pays burner2 (as "Linh") 0.10 USDC within its limits, and the receipt
    verifies;
  - an over-cap request raises an approval;
  - a 3× amount asks first.

### B2. Subscriptions Keeper (C4)
- **A kind that pays recurring x402 charges on a cron,** e.g. a daily paid feed from a Reef service
  or a community API.
- **It remembers each merchant's normal price** as `[price]` facts. When a 402 asks at least 20% more
  than that:
  - it doesn't pay;
  - it notifies "price hike: <merchant> 0.010 → 0.015" with **Pay once**, **Accept new price** and
    **Cancel**.
- **It also flags** a merchant's `payTo` changing (the ADR-0109 guard) and a charge failing 3 times
  in a row.
- **For an honest demo,** `examples/sell-an-api` gets a `PRICE` env, so its price can rise in a dated
  run.
- **Exit, on testnet:**
  1. two normal charges;
  2. the example raises its price, and the Keeper stops and asks;
  3. "Accept new price" updates memory;
  4. the next charge pays the new price.

### B3. Splitter (C9)
- **In a room or a Telegram group:** "I paid 12 for dinner for Linh, Huy and me" keeps a running
  balance per person.
- **"Settle up":**
  - the owner's Errand pays what the owner owes;
  - for what others owe the owner, it makes a pay link (B4's page with an amount and a memo) to
    share.
- **Exit:** unit tests for the split math (uneven splits, rounding to 6 decimals), plus one testnet
  settle payment.

### B4. A remora anyone can use: the public page (M9)
- **`/r/:slug` on the web,** for every remora on sale (U17 A1), with no sign-in. It shows:
  - what the remora does and its price;
  - its recent public receipts;
  - its reputation (A2).
- **The visitor:**
  1. connects a testnet wallet (dapp-kit, already a dependency);
  2. asks one question;
  3. pays from their own wallet: a plain x402 `exact` USDC transfer to the owner's address, gas
     sponsored by the facilitator's `/gas`, signed in the wallet.
  - The answer comes back with its receipt link. It settles after the answer, so a failed answer
    costs nothing.
- **The sale rules hold:**
  - depth 1;
  - the seller reads only `sources` and `feedback`;
  - the visitor's question isn't written to the seller's memory;
  - one question per 30 s per wallet;
  - the price shows before signing.
- **Pay links:** `/pay/:token` takes an amount and a memo and pays a person's address (for B3).
- **E2E:** burner2's key drives the page through the test wallet that `connectAndSignIn` uses.
- **Exit:**
  - burner2 buys one answer on the page, on testnet;
  - the receipt verifies;
  - the seller's feed shows the sale.

### B5. MPP on every door (E12)
- **Every x402 door also speaks the Payment HTTP auth scheme**
  ([draft-httpauth-payment-01](https://paymentauth.org/draft-httpauth-payment-01.txt)). The doors are
  the house merchants, the remora sale door and `examples/sell-an-api`.
- **The 402** also carries:
  - `WWW-Authenticate: Payment id="…", realm="…", method="sui", intent="charge", request="…",
    expires="…"`, where `request` is base64url, unpadded, of the JCS-serialized JSON (amount,
    currency, recipient);
  - `Cache-Control: no-store`.
- **The client retries** with `Authorization: Payment <base64url {challenge, source, payload}>`. The
  `payload` is the same signed, sponsored transaction that x402 uses.
- **On success,** the response carries `Payment-Receipt: <base64url {status: "success", method:
  "sui", timestamp, reference: <digest>}>`. Errors are Problem Details.
- **Challenges are bound and single-use:** `id` is an HMAC over the request, and a replay gets a 402.
- **The method's shape:**
  - match `@suimpp/mpp`'s `sui` charge method (github.com/mission69b/suimpp, MIT; 0.9.0 depends on
    `mppx` and `@mysten/sui` ^2.17), so its clients can pay us;
  - prefer writing the adapter in `@remora/merchant` without the dependency;
  - if you add it, even as a dev dependency for an interop test, write an ADR and check that it never
    calls JSON-RPC.
- **The client side:** `disc.fetch` pays an MPP-only 402 too, through the same `remora::disc::pay`,
  so remoras can buy from MPP merchants.
- **Exit:**
  - on testnet, one MPP-paid call to a house merchant and one to a remora's sale door;
  - an interop test with `@suimpp/mpp`'s client, or a documented reason it isn't wire-compatible.

### B6. Statements and spend analytics (E6)
- **Per remora, per payee and per day:**
  - a CSV download, one row per payment: time, remora, payee label, amount, digest, memo or intent,
    and the verify link;
  - a monthly statement page that prints.
- **Anomaly flags:**
  - a day over 3× the 14-day median;
  - a new payee;
  - a price change (from B2);
  - a run of failed payments.
- **Data:** from the existing `receipts` and `disc_events` only.
- **Exit:** the burner's CSV matches onchain reads for a sample of 10 digests.

## Part C: easier to start and to steer
### C1. Describe the job (B2)
- **On New remora,** one box asks "What should it do?".
- **The model drafts a full `RemoraConfig`:** kind, persona, tools, triggers, namespaces, budget and
  Reef services.
  - The draft is validated by the zod schema and the tool and Reef registries.
  - An invalid draft is repaired once; after that, the form shows what's left to fill.
- **The owner reviews every field** and hatches with the usual one signature.
- **Golden tests:** 12 job descriptions with the model mocked, including:
  - Vietnamese ones;
  - ones that must be refused, such as "trade my coins".
- **Live:** one run per kind on testnet.
- **Exit:** "Every weekday at 8, tell me if any of my wallets moved more than 50 USDC" hatches a
  working remora.

### C2. Chat commands (N9)
- **In chat and Telegram,** for example:
  - "raise Researcher's monthly limit to 1 USDC";
  - "pause Sentinel at night";
  - "add Linh 0x… as a contact";
  - "sell Researcher's answers for 0.02".
- **Parsing:** the model parses each into a typed command (zod), and the reply shows a diff.
- **The reply is a change card:**
  - settings that don't touch money apply after a tap;
  - limits and payees come back as a prepared transaction with a one-tap sign link.
  - **Nothing that moves money or changes a limit runs without the owner's signature.**
- **Exit:** three commands from Telegram on testnet, one of them signed.

### C3. Config history (N11)
- **Every config change** writes a `config.changed` remora event, with the config before and after.
- **The Settings tab** lists versions, each with a diff and **Restore**.
- **Restoring money fields** needs a signature, through the same builders.
- **Exit:** a change, its diff and a restore, round-tripped in e2e.

### C4. The two triggers the schema already has (D1)
- **`price`** fires when an asset crosses a threshold:
  - the server polls `pricesOf` every 5 minutes, unpaid, from the same free source;
  - hysteresis: it doesn't fire again until the price crosses back;
  - one wake per crossing.
- **`webhook`** is `POST /api/hooks/:remoraId/:id`:
  - signed with `X-Remora-Signature: sha256=<HMAC(body)>`;
  - the secret is derived, shown once, and rotated by changing `id`;
  - a bad signature gets a 401;
  - 30 per minute per hook;
  - a body of at most 64 KB, passed to the turn as untrusted data (ADR-0110).
- **Templates:** Repo Reviewer gets a GitHub webhook option, and Token Desk gets a price trigger.
- **Exit:**
  - a signed POST wakes a remora, and an unsigned one doesn't;
  - a unit test drives a price crossing.

### C5. Outbound webhooks (J3)
- **Per remora,** the owner adds a URL (`config.hooks.out`).
- **Events:** `payment.settled`, `approval.asked`, `answer.ready`, `proposal.made` and `price.hike`.
- **Each delivery:**
  - is signed with `Remora-Signature` (HMAC plus a timestamp, with a 5-minute tolerance);
  - retries with backoff on the existing jobs queue.
- **The UI** has a **Send test** button and shows the last 20 deliveries.
- **SSRF:** use `safe-fetch`'s private-address block.
- **Exit:** a local receiver gets a signed `payment.settled` carrying the real digest.

## Part D: show it and ship it
- **The landing page:**
  - **"It learns":** a proposal with cited memories, the reputation, the weekly review, and a capsule
    lent and taken back;
  - **"Everyday money":** Errand, the Keeper's price hike, the split;
  - **"Anyone can buy":** a live link to a public page, with x402 and MPP;
  - each with a dated testnet receipt, and led by the story above;
  - a new reviewer that sees only screenshots checks the changed sections at 1440 and on a Pixel 7.
    Fix its blockers and majors.
- **Docs:**
  - the README's "what's real";
  - `docs/economy.md` (MPP, the public page, Errand);
  - the submission draft:
    - Best Walrus Memory, as the loop: act, outcome, memory, then reputation and proposals, the owner
      signs, and the outcome is remembered;
    - Agent Payments: x402 and MPP on Sui, browser buyers, paying people;
  - `docs/remora-features.md` (the status of each ID done);
  - the goals README;
  - the demo README, if the video changes.
- **Merge:** a PR, CI green, then merge.
- **The deploy** (approved in ADR-0119, for U18's merge to main), following `docs/deploy.md` as U17
  did:
  - **No schema push by the agent.** If the PR needs one, stop before deploying and put it on Uy's
    list.
  - If A4 shipped, publish or upgrade the Move package on testnet first, and set the new ids.
  - Run `bun run diagnose` with the production env.
  - Deploy from a clean checkout of `main`: `railway up --service api --ci`, then, in `apps/web`,
    `vercel build --prod && vercel deploy --prebuilt --prod`.
  - Set new env vars with the Railway CLI, never printing them. `DEMO_ATTACK` stays unset.
  - Check `/api/health/deep`, then run `E2E_BASE_URL=https://getremora.vercel.app bun run e2e:main`.
  - Confirm the pack template's digest to the live API.
  - Open one public page (B4) on production, and buy one answer with burner2.
  - If a check fails, roll back (`docs/deploy.md`) and list it.
- **The video** (optional, only if it's done by Nov 8, 12:00):
  - it's 179.6 s now, so a new scene must replace the weakest one, and only if it's stronger. Good
    candidates are "It learns" (a proposal citing memories) and a capsule revoked;
  - stay at 180 s or under;
  - render with `--workers 8`, then check frames from the final MP4;
  - capture only the new shots (`DEMO_SHOTS=…`). The other shots' captures are in the main tree's
    `docs/launch/demo/capture/`; link them into the worktree.

## Hard rules
- **Money:**
  - every change to money or limits needs the owner's signature;
  - proposals, chat commands and config restores only prepare transactions;
  - remoras pay only listed payees and contacts at their listed addresses (ADR-0109).
- **Untrusted input:** memories from another owner (capsules, packs), webhook bodies, public-page
  questions and 402 bodies are data, never instructions. They're labeled with their source.
- **Honesty:**
  - no fake numbers, scores or receipts: everything shown comes from a dated run;
  - a score with too little data says "new";
  - the attack service never ships.
- **Sui and Walrus:**
  - Sui over gRPC only;
  - testnet only, with no mainnet publish or payment;
  - the agent never pushes the DB schema.
- **Contracts:** `packages/schema` changes go in the same PR and are listed in the exit note.
  `lib/api.ts` changes only with the server's `AppType`.
- **Dependencies:** no new dependency without an ADR.
- **E2E specs keep what they assert.** A moved selector moves in the same commit. demo.spec keeps
  its mark and box names.
- **Git and secrets:**
  - no force-push;
  - no `.env` or keys in commits;
  - no edits to `reference/`;
  - never print a secret.
- **ADRs:** never rewrite an accepted ADR. Every decision gets an ADR in the same commit. Check
  main's newest ADR number before you pick one.
- **Before each push:** rebase on `origin/main`, then `bun run typecheck && bun run lint && bun run
  test`, plus `bun run docs:links && bun run docs:tatum --check`.

## Finish
- **The exit note:** `docs/spikes/<date>-u18-exit.md`, covering:
  - A: the proposal and its cited memories, the scores, the review, the capsule's grant and revoke
    digests, and the pack;
  - B: the Errand, Keeper, public-page and MPP receipts, and the CSV check;
  - C: each item, with how it was checked;
  - D: the review, the deploy (URLs, health, smoke) and the video;
  - what was cut;
  - the list for Uy.
- **One e2e for the whole goal:** `U18=1` runs the exits that can run against a local stack, as
  `ECONOMY=1` does.
- **Stop every server** the goal started, and remove the worktree.
- **Finish with a short Vietnamese summary for Uy.**
