# Round 5 review: the freeze check (desktop and phone, dark)

Persona: a hackathon judge with three minutes who knows a little crypto and has never heard of the product. I judged only the screenshots in `r5/desktop/` and `r5/phone/`, against the rubric in `docs/ux/review/README.md`. As the brief asked, I report only Blockers and Majors. I saw minors and nits, but they are not listed here.

## Previous findings
- **R4G1-x-1: fixed.** The roster's second line is now the kind ("Researcher", "Wallet watcher · practice"). No row says "active", and there's no green dot. The orange dot appears only on "practice" rows, and this holds on every page in the set.
- **R4G2-x-1: fixed.** In `thread-researcher` the header pill reads "retired · Researcher", and no roster row says "active". In `remoras` the roster rows show only the kind, beside cards that say "can't spend". The word "active" for a remora that can't spend now appears in one place only, Connections' remora picker (R5-x-2, below).
- **R4G3-memory-1: fixed** on desktop, where it was raised. The column is now "Expires". Blobs stored 8m ago show "Jun 2, 2027 · 210d" and the one stored 10d ago shows "Jun 1, 2027 · 209d", with no "of 210". The dates match today (Nov 4) plus the term. The phone shows the end date only ("expires 6/2/2027"), which doesn't contradict anything.
- **R4P-landing-1:** skipped, as the brief says. The landing screenshots are re-shot after this check.

## Shell: rail, top bar, roster (every signed-in page)
**Five seconds:** For: moving between pages and picking a remora. First click: a remora row, or "Needs you".

No blockers or majors. The roster now agrees with the cards (see Previous findings).

**Words that could go:** none at this bar.

## Activity feed, shared (`home`, `remora-researcher-overview`, `remora-researcher-activity`, `thread-researcher`, desktop and phone)
**Five seconds:** For: what each remora did, with receipts. First click: "Why?" or "tx ↗" on a payment.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R5-x-1 | filled · desktop + phone | Blocker | See Across pages: the refused payment reads "Didn't pay 20000 to Odds". | See R5-x-1. |

**Words that could go:** "the agent can ask you" (the approval row right under it says so)

## Home (`home`, `empty-home`, `loading-home`, `error-home`, `out-home`)
**Five seconds:** For: your remoras at a glance: count, what waits for you, your balance, what they did. First click: "2 Review →", or "New remora". Empty: "Add funds" (step 2 of the checklist). Signed out: "Try a Researcher, no wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R5-x-1 | filled · desktop + phone | Blocker | The Activity card's sixth row (desktop, whole page; phone, about 1,500 px down) reads "Didn't pay 20000 to Odds". | See Across pages. |

The 33 count, the "2 Review" count, the 19.59 USDC balance and the six cards all agree with Remoras, Approvals, Funds and the wallet chip. Loading draws skeletons of the final shape. The error state says what happened and offers Retry.

**Words that could go:** "Your remoras show once Remora is back.", "The activity shows once Remora is back." (error; the banner already says it)

## Remoras (`remoras`, `empty-remoras`, `out-remoras`)
**Five seconds:** For: every remora with its spend status. First click: "New remora" (filled), "Researcher / Wallet watcher" kind card (empty), "Sign in with your wallet" (signed out).

No blockers or majors. "All 33 = Researcher 16 + Wallet watcher 17" agrees with Home's 33.

**Words that could go:** "Reading limit" (a shimmer would say it)

## New remora, Import a team (`remoras-new`, `remoras-import`)
**Five seconds:** For: creating one remora with its limits, or a whole team from a file. First click: "Create Researcher" / "Use the example".

No blockers or majors. The summary card restates the form as a receipt, and "20 payments a month" at the cap is the right sum for 1 USDC ÷ 0.05.

**Words that could go:** "Sui won't let it spend more than this a month." (the "Enforced on Sui" chip says it)

## A remora: Researcher (`remora-researcher-overview`, `-activity`, `-learning`, `-settings`; `loading-remora`, `error-remora`)
**Five seconds:** For: one remora's record: budget, cost, activity, what it learned. This one is retired, so there's nothing to start. First click: "Activity" or "See all".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R5-x-1 | filled · desktop + phone | Blocker | Recent activity (overview) and the Activity tab both show "Didn't pay 20000 to Odds", directly under "mcp:http-script asked you to approve 0.02 USDC to reef:odds". | See Across pages. |

**Words that could go:** "Retired: its spending limit was revoked, so it never pays again." (the Retired banner above says the same), "What this remora spent, from its recorded turns, gas and payments."

## A remora: Wallet watcher (`remora-watcher-overview`, `-activity`, `-learning`, `-settings`)
**Five seconds:** For: what one watcher watches, how often it pinged you, the rules it learned. First click: the watched address, or "See all".

No blockers or majors.

**Words that could go:** "No spend this month" box (a watcher never pays; the "never pays" chip says it)

## Chat and threads (`chat`, `empty-chat`, `loading-chat`, `error-chat`, `thread-researcher`, `thread-watcher`)
**Five seconds:** For: talking to your remoras. First click: the message box, or a suggestion chip. Empty: "Create a remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R5-x-1 | filled · desktop + phone | Blocker | In `thread-researcher`, the event line "Didn't pay 20000 to Odds: over the limit, the agent can ask you" sits right above the "0.02 USDC to Odds · Approved" card. | See Across pages. |

**Words that could go:** none at this bar.

## Room (`room`)
**Five seconds:** For: one chat with several remoras, where each message goes to the best fit. First click: the "Message #Team…" box.

No blockers or majors. The text is chat content, so it's exempt from the word count.

**Words that could go:** none at this bar.

## Approvals (`approvals`, `empty-approvals`, `loading-approvals`, `error-approvals`)
**Five seconds:** For: payments over a remora's cap that wait for your yes. First click: "Pay once (0.02 USDC)" or "Decline".

No blockers or majors. The red meter against "its cap: 0.015 a payment · over the cap" says why each payment waits, without a sentence.

**Words that could go:** none at this bar.

## Funds (`funds`, `empty-funds`, `loading-funds`, `error-funds`)
**Five seconds:** For: your USDC and the spending limits on it. First click: "Add USDC".

No blockers or majors. The balance of 19.59 USDC matches Home and the wallet chip, and the limit is drawn as a meter.

**Words that could go:** none at this bar.

## Memory (`memory`, `empty-memory`, `loading-memory`, `error-memory`, `memory-chat`)
**Five seconds:** For: what your remoras remember, as blobs on Walrus. First click: the remora picker or "Search what it remembers". Chat tab: "Own this memory".

No blockers or majors. R4G3-memory-1 is fixed (see above).

**Words that could go:** "These writes were close enough to a memory already stored that nothing new was written. If one was really new, correct the memory it matched." (a `?` on "Skipped as already known")

## Own your memory (`connect`)
**Five seconds:** For: moving the chat's memory to a Walrus account you own. This link expired. First click: "Open chat".

No blockers or majors.

## Connections (`connections`, `empty-connections`)
**Five seconds:** For: letting an agent like Claude Code use one of your remoras. First click: "New connection".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R5-x-2 | filled · desktop + phone | Blocker | The remora picker says "Researcher u12 mw16d7ai (Researcher, active)", and its tokens wear green "active" pills, while Home and Remoras say this remora "can't spend". | See Across pages. |

**Words that could go:** none at this bar.

## Templates (`hatchery`, `out-hatchery`)
**Five seconds:** For: copying a remora someone shared. First click: a template card.

No blockers or majors.

## Template page (`hatchery-template`)
**Five seconds:** For: checking a shared remora before copying it. This one is blocked by the safety review. First click: "All templates" (back), which is the right answer for a blocked one.

No blockers or majors. The reasons are a red checklist, and "Use it" is disabled.

**Words that could go:** "Tells the model to ignore its instructions." (repeats the bold line before it)

## Share as a template (`share`)
**Five seconds:** For: publishing a remora so others can copy it. First click: **can't tell.** There's nothing to click.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R5-share-1 | filled · desktop + phone | Major | The page is a dead end. Under the title and "Anyone can copy it into their own account." there's only a red bar, "Researcher u12 mw16xdwk can't be shared while it's retired." The page has no button, no way back and no face. Every other error in the app pairs the face with an action (Retry, Open chat). It fails the five-second test: you can't see what to click next. | Don't offer "Share as a template" for a retired remora at all. If someone lands here anyway, use the empty-state pattern: a face, "Retired remoras can't be shared.", and one button, "Back to Researcher u12 mw16xdwk" (or a picker: "Share another remora"). |

**Words that could go:** "Anyone can copy it into their own account." (in this state)

## Try a Researcher (`playground`, `out-playground`)
**Five seconds:** For: trying a Researcher with a 1 USDC limit and no wallet. First click: "Start my Researcher".

No blockers or majors. The four-step strip and the "Limit 1.00 USDC · Questions 2 · Lasts 3 minutes" tiles carry it.

## Services (`reef`, `out-reef`)
**Five seconds:** For: what a remora may buy, and the price. First click: a category tab or "Docs ↗".

No blockers or majors.

**Words that could go:** "This directory lists the paid services a remora may pay: what each one does, what a call costs and which address gets paid."

## Verify a receipt (`verify`, `out-verify`, `verify-receipt`)
**Five seconds:** For: checking a receipt against Sui. First click: "Verify" (or a recent receipt's "Verify").

No blockers or majors. The receipt card, the green "Verified" box and the six green checks read as one picture.

## Shared proof (`public-receipt`)
**Five seconds:** For: public proof that Researcher u12 mw16xdwk paid 0.01 USDC to Sui risk check. First click: "Check it yourself".

No blockers or majors. The amount, payee, transaction and time match `verify-receipt`.

## Status (`status`, `out-status`)
**Five seconds:** For: whether Remora is up right now. First click: nothing needed. The "Some systems are degraded" banner answers it.

No blockers or majors.

## How Remora works (`guide`, `out-guide`)
**Five seconds:** For: what a remora is, how to start, and every page. First click: "Try a Researcher, no wallet" (signed out), or "Open chat".

No blockers or majors. The guide is exempt from the prose rule, and it leads with the flow diagram.

## Get started (`onboarding`, `empty-onboarding`)
**Five seconds:** For: the setup checklist. First click: the next step's button ("Add funds").

No blockers or majors.

## Settings (`settings`, `empty-settings`)
**Five seconds:** For: when and how remoras reach you, plus the panic switch. First click: "How loud" or "Link Telegram".

No blockers or majors.

## Sign in (`out-sign-in`)
**Five seconds:** For: picking a Sui wallet. First click: "Get Slush ↗" or "Try without a wallet".

No blockers or majors.

## Not found (`not-found`)
**Five seconds:** For: this address isn't a page. First click: "Go home".

No blockers or majors.

**Words that could go:** "If you followed a /connect or /disconnect link, those expire after ten minutes and are single use: run the command again in the chat for a fresh one."

## Lab (`lab`)
**Five seconds:** For: internal ops tools. First click: "Health".

No blockers or majors.

## Landing, desktop (`landing`, `landing-00` … `landing-06`)
**Five seconds:** For: what Remora is, in one line: "Always-on agents you actually own." First click: "Try a Researcher · $1 limit · no wallet".

No blockers or majors. The frames in "Built to be read." are older captures, and they're being re-shot with the phone ones.

## Across pages
| # | Pages | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R5-x-1 | `home`, `remora-researcher-overview`, `remora-researcher-activity`, `thread-researcher` (desktop and phone) vs the approval card, payment lines and receipts | Blocker | One amount is drawn two ways, and one of them is wrong. The refused payment reads **"Didn't pay 20000 to Odds: over the limit, the agent can ask you"**, a bare number with no unit. Every other place shows the same payment as **0.02 USDC**: the "0.02 USDC to Odds · Approved" card right below it in the thread, "asked you to approve 0.02 USDC to reef:odds" in the feed, and "Paid 0.02 USDC to Odds". A judge reads "20000" as twenty thousand of something, which is the scariest number in the app, on Home, in the first activity screen, and on a phone. It looks like the raw on-chain amount (6 decimals) leaking into the sentence. | Format it like every other amount: "Didn't pay 0.02 USDC to Odds: over its cap · you can approve it" (with the cap's own amount, if the event has it). Better still, draw it as the approval card's red over-the-cap meter, in miniature. |
| R5-x-2 | `connections` (New connection's "Remora" picker, and the token pills) vs `home` and `remoras` cards | Blocker | This is the R4 "active" against "can't spend" contradiction, in its last place. The picker's default reads **"Researcher u12 mw16d7ai (Researcher, active)"**. Its two tokens above, "Read only" and "HTTP script · Pays", wear a green **"active"** pill in the same slot where retired remoras' tokens say "remora retired", so the pill reads as the remora's status. Home and Remoras show the same remora as **"can't spend · No limit onchain"**. A judge who creates a token that "Pays within its spending limit" for an "active" remora is told elsewhere that it can't spend. | In the picker, show the kind and the spend chip, the way the cards do: "Researcher u12 mw16d7ai · Researcher · can't spend". Label the token pill as the token's own state ("token live" or "expires in 30 d"), and add a "can't spend" pill beside "Pays" when the remora has no limit. |

**Counts:** Blocker 2 · Major 1 · Minor 0 · Nit 0
