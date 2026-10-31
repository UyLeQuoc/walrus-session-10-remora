# Walrus x Tatum: Total Recall — Event Rules

> Source: the Walrus Sessions "Event Rules" page, plus details from the official event page
> ([tatum.io/hackathon/total-recall](https://tatum.io/hackathon/total-recall)) and the submission site
> ([recall-tatum-walrus.vercel.app](https://recall-tatum-walrus.vercel.app)). Captured on 2026-10-18.
> The official event page is the source of truth for updates.
>
> **Rechecked on the live site on 2026-10-31:**
> - the form has optional fields not listed in the rules (§4);
> - the Mystery Bounty is now **Best Use of Agent Payments** (§8.2).

---

## 1. Overview

The Walrus x Tatum Total Recall Hackathon (the "Hackathon") is organized and sponsored by the
**Walrus Foundation** and **Tatum Technology LLC** (together, the "Sponsors").

Stated goals (verbatim intent from the rules):

- **Primary:** foster developer engagement with the Walrus protocol (the "Network"), resulting in the
  deployment and launch of a Network-native feedback and form platform that helps projects, teams and
  the Sponsor collect structured feedback directly from their communities (each, a "Submission").
- **Secondary:** grow the Network's global developer community while embodying the Walrus Foundation's
  values of openness, fairness and competition, through tangible action that involves participants from
  the entire ecosystem.

> **Note:** the "feedback and form platform" wording does not match the three tracks below and looks like
> text carried over from another event's rules. The tracks, requirements and judging criteria are what
> the event page and submission site actually describe. If in doubt, ask on Discord.

By participating you agree to:

- [Walrus General Terms of Service](https://docs.wal.app/docs/legal/walrus_general_tos)
- [Walrus Privacy Policy](https://docs.wal.app/docs/legal/privacy)
- [Terms of Total Recall](https://recall-tatum-walrus.vercel.app/)
- [Tatum Terms of Use](https://tatum.io/terms-of-use)
- These Walrus x Tatum: Total Recall Hackathon Rules (the "Event Rules")

---

## 2. Key dates

| Milestone | Date |
|---|---|
| Registration opens, build starts | **October 20, 2026** |
| Build window | October 20 – November 10, 2026 |
| **Submission deadline** | **November 10, 2026, 17:00 UTC** (repo, demo and blog post all due) |
| Judging | November 11 – 16, 2026 |
| **Results announced** | **November 17, 2026** |
| Prize claim window | 14 days after the official results announcement |

Format: fully online, open globally. Solo builders or teams, crypto-native or not.

---

## 3. Eligibility

- You must be at least 18, or the age of majority where you live.
- You must not reside in a sanctioned or restricted jurisdiction.
- Sponsor employees and contractors involved in running the Hackathon may be ineligible for prizes, at the
  Sponsors' sole discretion.
- **One submission per person.**
- Existing projects are allowed **only if the submitted work is new progress made during the build window**
  (per the event page).

---

## 4. How to enter: the submission form

Submit at [recall-tatum-walrus.vercel.app](https://recall-tatum-walrus.vercel.app). The application must
contain:

| Field | Where to get it |
|---|---|
| Email | — |
| Discord handle | — |
| LinkedIn | — |
| Telegram ID *(optional, form only)* | — |
| How did you hear about this event? | A list: Walrus Socials, Tatum Socials, Ads, Hackathon Listings, Friends, Search, Others |
| Which community or account did you hear about us through? *(optional, form only)* | — |
| Is this your first Web3 project? | Yes or No |
| **Tatum ID** | Your account ID in the [Tatum dashboard](https://dashboard.tatum.io/): My Account → My Account Info |
| **SUI address** | Your Sui wallet address |
| **Account ID (SUI)** | Your Walrus Memory account ID (a Sui object ID). The form says you get it after you create your first delegate key in the [Memory dashboard](https://memory.walrus.xyz/dashboard) |
| **MEMWAL_AGENT_ID** | Per the event page: the **public key under "Delegate keys"** of the Walrus Memory agent you create in the Memory dashboard |
| Project description | — |
| Short demo video | 2 to 3 minutes |
| GitHub repo | Must be public |
| How was your experience building with Walrus? | — |
| How was your experience building with the Tatum AI Builder? | If you didn't use it, say so briefly |
| Additional documentation *(optional, form only)* | Docs, blog or deck URL |
| One bug or friction point with Walrus Memory *(optional, form only)* | — |
| Social post links *(optional, form only)* | X, LinkedIn: "extra points" |
| A checkbox *(form only)* | You are 18+ and agree to the Event Rules, the Tatum Terms of Use, the Walrus General Terms of Service and the Walrus Privacy Policy |

The form has no field for a track or a prize. Our field-by-field draft is
[launch/submission-draft.md](launch/submission-draft.md).

---

## 5. Submissions

Your Submission must:

- be your original work (or work you are authorized to submit);
- be completed or materially advanced during the Hackathon Duration;
- meet the published requirements, including Walrus Memory and Tatum usage where stated.

**IP:** you keep ownership of your IP. You grant the Sponsors a worldwide, royalty-free license to review,
demo and publicly showcase your Submission for Hackathon and marketing purposes.

### 5.1 Submission requirements (checklist)

1. **Walrus Memory integrated and writing on Mainnet.**
2. **Tatum RPC used for onchain data** where relevant.
3. **At least 10 memories stored on Mainnet.**
4. **Published blog post** covering: what it does, how it uses Tatum + Walrus, and **how it learned over time**.
5. **Working demo and public repo.**
6. *Optional:* build with Tatum AI Builder ([ai.tatum.io](https://ai.tatum.io)) to compete for the dedicated
   $500 bonus (see Prizes).

---

## 6. Tracks

Three tracks award prizes. Per the FAQ, tracks are suggestions and **execution matters more than novelty**.

### Track 1 — Markets & Sports Prediction

- **Task:** build a prediction app for sports, elections, culture or markets. Compare bookmaker odds with
  onchain sources. Track which voices were right. Users log picks before events. Memory stores credibility
  scores so the app learns who to trust.
- **Best fit for:** fantasy leagues, sports fans, forecasters, and teams building consumer apps first.
- **Example directions:**
  - A sports companion that learns your leagues and trusted analysts
  - Odds dashboards that flag when sources disagree
  - Pick journals with post-game scorecards

### Track 2 — Smart Agents for Real Life

- **Task:** agents that monitor inboxes, expenses, habits or workflows. Portable memory means they pick up
  where they left off across tools and sessions.
- **Best fit for:** AI builders, and anyone who wished their assistant remembered last Tuesday.
- **Example directions:**
  - A research agent with source trust scores
  - An expense watchdog with long-term memory
  - Workflow bots that learn your escalation rules

### Track 3 — Consumer Finance Apps

- **Task:** money products people actually open. Shared budgets, spend tracking, savings goals, and payment
  flows that feel normal. Blockchain stays invisible. Walrus Memory makes balances, habits and preferences
  stick across sessions.
- **Example directions:**
  - Group spending that remembers who owes what
  - Subscription managers with learned spend limits
  - Savings goals that adapt to real cash-flow patterns

---

## 7. Judging

Submissions are scored by a panel appointed by the Sponsors (the "Panel"). Panel decisions are final and
binding.

| # | Criterion | Weight | What it means |
|---|---|---|---|
| 1 | **Walrus and Tatum integration** | **30%** | Meaningful and creative use of Walrus Memory, plus building with Tatum RPCs or Data APIs |
| 2 | **Technical quality** | **30%** | Clean code and **successful Tatum Sui RPC integration** |
| 3 | **Creativity** | 20% | Original ideas and distinctive product direction |
| 4 | **Presentation** | 20% | Clear documentation and a working demo |

**Bonus:** sharing your project on X or LinkedIn. Tagging **@Tatum_io** and **@WalrusFoundation** is
optional and may earn extra points.

The Sponsors may disqualify Submissions that are incomplete, fraudulent or abusive, that do not comply with
these rules, or that violate these Event Rules or applicable law.

---

## 8. Prizes

### 8.1 Track prizes — $1,000 per track

| Track | 1st | 2nd | 3rd | Total |
|---|---|---|---|---|
| Markets & Sports Prediction | $500 | $300 | $200 | $1,000 |
| Smart Agents for Real Life | $500 | $300 | $200 | $1,000 |
| Consumer Finance Apps | $500 | $300 | $200 | $1,000 |

### 8.2 Special prizes

| Prize | Amount | Criteria |
|---|---|---|
| **Best Walrus Memory** | $500 | Selected by the Walrus team. Awarded for the **deepest learning loop**: memories that visibly change the product |
| **Best Tatum AI Builder App** | $500 | Best shippable product built **primarily** with [ai.tatum.io](https://ai.tatum.io) |
| **Best Use of Agent Payments** | $500 | The best app across the three tracks that integrates agent payments using **x402 or MPP**, with payments settled on Sui. Announced as the Mystery Bounty; named in the rules on the site by Oct 31 |

**Total prize pool: $4,500.**

The rules do not say whether one Submission can win both a track prize and a special prize.

### 8.3 Payment terms

- Listed amounts are estimates and may be paid in USD, stablecoins, or other forms the Sponsors choose. For
  this Hackathon, prizes are denominated in a stablecoin of the Sponsors' choosing, such as **USDC** (issued
  by Circle).
- Prizes go to a wallet owned by the Prize Recipient that can accept USDC (the "Recipient Wallet").
- To receive a prize, **one member of the winning Team must confirm acceptance by email and send the
  Recipient Wallet address within 14 days** of the official results announcement. The Sponsors decide what
  counts as an official announcement.
- Prizes are awarded only if and when the Sponsors confirm winners.
- Winners must confirm, with a de minimis test transaction, that the Recipient Wallet is USDC-compatible.
- The recipient bears all risk of loss from transfers to an incompatible wallet or a wrong address.
- Taxes and reporting obligations are the winner's sole responsibility.
- No cash alternative except as the Sponsors allow. Prizes are not transferable without written consent.
- Prizes go to the Teams with the highest total score(s) in each category, as determined by the Panel.
- If a winning Team cannot be reached by email, is ineligible, or fails to claim within 14 days of the
  official announcement, the prize may be forfeited and the Panel may pick an alternate winner from the
  remaining eligible Submissions.

---

## 9. No guarantee; changes

Participation does not guarantee a prize, placement, publicity or future opportunity. The Sponsors may
modify, suspend or cancel the Hackathon, prize pool, timeline or rules for any reason (technical, legal,
operational or other) without liability. This is a **skill-based event**, not a lottery or game of chance.

---

## 10. Liability

To the maximum extent permitted by law, the Sponsors and their affiliates are not liable for any indirect,
incidental, special, consequential or punitive damages arising from the Hackathon or your Submission.
Platforms and third-party services (including Discord, GitHub and blockchain networks) are used at your own
risk.

---

## 11. Getting started (from the event page)

1. **Tatum:** create a free account and an API key in the [Tatum dashboard](https://dashboard.tatum.io/).
   Note your **dashboard account ID** for the form.
2. **Tatum docs:** use the [RPC and Data API docs](https://docs.tatum.io/reference) when your app reads
   onchain data.
3. **Walrus Memory:** open the [Memory dashboard](https://memory.walrus.xyz/dashboard) and create a Walrus
   Memory agent. The public key under **Delegate keys** is your **MEMWAL_AGENT_ID**.
4. **Write at least 10 memories on Mainnet** before submitting.
5. *Optional:* add portable memory to Claude Code or Codex with the
   [Walrus guide](https://walrus.xyz/blog/how-to-add-portable-memory-to-claude-code-and-codex-with-walrus-memory/).
6. *Optional:* use [Tatum AI Builder](https://ai.tatum.io/) to generate a first version, then add Walrus
   Memory and your Tatum key.

---

## 12. Links

| Topic | Link |
|---|---|
| Official event page | https://tatum.io/hackathon/total-recall |
| Submission site and terms | https://recall-tatum-walrus.vercel.app |
| Tatum dashboard | https://dashboard.tatum.io/ |
| Tatum docs / API reference | https://docs.tatum.io/ · https://docs.tatum.io/reference |
| Tatum AI Builder | https://ai.tatum.io/ |
| Walrus docs | https://docs.wal.app/ |
| Walrus Memory docs | https://docs.wal.app/walrus-memory |
| Walrus Memory dashboard | https://memory.walrus.xyz/dashboard |
| Walrus Memory source (MemWal) | https://github.com/MystenLabs/MemWal |
| Tatum Discord | https://discord.gg/hR6NG7sNXE |
| Walrus Discord | https://discord.gg/walrusprotocol |
| Walrus Sessions | https://thewalrussessions.wal.app/index.html |
| Tatum on X / LinkedIn | https://x.com/tatum_io · https://www.linkedin.com/company/tatumio |
| Walrus on X / LinkedIn | https://x.com/WalrusProtocol · https://www.linkedin.com/company/walrus-foundation |
