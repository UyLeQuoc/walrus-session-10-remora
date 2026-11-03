# Round 4 review, G1: getting started and money (desktop)

Persona: a hackathon judge with three minutes who knows a little crypto and has never heard of the product. I judged only the pictures in `r4/desktop/`. Stills can't show motion. `public-receipt` was captured signed in again, so a stranger's view (the "A remora" wording the triage mentions) isn't in the set.

## Previous findings
These are the findings that round 3's triage lists as fixed on these pages:
- R3G1-funds-1: fixed. The tile reads "Your balance 19.78 USDC" on Home and on Funds, and Funds' subtitle is "Your USDC, and the limits on it."
- R3G1-vreceipt-1: fixed. The receipt card names "Researcher · demo" with its face, and the raw id is gone from the card.
- R3G1-vreceipt-2: fixed. The check reads "decided and paid within 2 s · Nov 3, 15:54", with no clocks to the second and a date.
- R3G1-proof-1: fixed. "Check it yourself" (white) and "What's Remora?" sit under the receipt card.
- G2 remoras-1, as Home's cards show it: fixed on the cards. All six say "can't spend" and none says "active". The "checking" state isn't in my set, because `loading-home` draws plain blocks. The roster wasn't changed (R4G1-x-1).

The other fixed items in the triage (G2 thr-1, room-1, tmpl-1, phone, light theme, G3 outguide-1) are on pages outside this set.

Declined findings, rechecked:
- G1 x-1, the "e2e-burner" limit: I accept the reason and don't raise it again. The row is the test wallet's own limit. The decline covers only that half of R3G1-x-1. The other half, the roster's green "active" beside cards that say "can't spend", gets no reason. The fix I suggested needs no Disc reads, so I raise it again as R4G1-x-1.

The triage neither fixes nor declines the rest of round 3's findings for these pages. They are still visible. I raise them again below under new IDs, with the round 3 ID in brackets.

## Shell: rail, top bar, remora list (`home`, `loading-home`)
**Five seconds:** For: moving between Home, Chat, Approvals, Funds and my remoras, with what waits on me at the top. First click: a "Needs you" row.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G1-shell-1 | filled · desktop | Minor | (R3G1-shell-1) Both "Needs you" rows read "Researcher m..." to make room for the "0.02 USDC" chip, so the two waiting payments look identical. Approvals names them "Researcher mvi9nqpw" and "Researcher mvee216v". | Give the name the whole first line, and put the amount on the second: "0.02 USDC · wants your yes". |
| R4G1-shell-2 | loading, error · desktop | Minor | (R3G1-shell-2) While loading and on error, the "Needs you" section and the rail's Approvals "2" badge disappear (`loading-home`, `error-home`, `loading-approvals`, `error-approvals`, `loading-funds`, `error-funds`). The one "something waits on you" signal blinks off whenever the API is slow. | Keep the badge: a grey dot while loading, and the last count greyed out on error. |
| R4G1-shell-3 | filled · desktop | Minor | (R3G1-shell-3) The status dots have no legend. Green is "active" and orange is "practice", and orange also marks "Needs you" two rows above. "practice" is never explained. | Give "practice" a grey dot and keep orange for "needs you" only. A `?` on "Remoras" can give the legend. |
| R4G1-shell-4 | empty · desktop | Minor | (R3G1-shell-4) The red "Pause all" pill is the loudest thing in the top bar, even for a new account with no remoras (`empty-home`, `empty-funds`, `empty-approvals`, `empty-onboarding`). It reads as an alarm. | Use a grey pause icon with a "Pause all" tooltip, and hide it while no remora runs. |
| R4G1-shell-5 | filled · desktop | Nit | (R3G1-shell-5) Each "Needs you" row carries three orange marks: the "!" badge, the small orange face at the face's corner, and the amount chip. | Keep one badge and let the chip carry the amount. |
| R4G1-shell-6 | loading · desktop | Nit | (R3G1-shell-6) The skeleton rows are rounded squares, but the faces they stand for are circles, triangles and drops. | Use a circle placeholder at the face's size. |

The roster's "active" is R4G1-x-1.

**Words that could go:** "Researcher" in "Researcher · active" (every name already starts with "Researcher"), "wants your yes" (the section title says "Needs you")

## Home (`home`)
**Five seconds:** For: my remoras, what waits on me, my balance and what they did. First click: "2 Review →".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G1-home-1 | filled · desktop | Minor | (R3G1-home-1) A payment row ends in "tx ↗", an explorer link in jargon. Nothing on Home opens the payment's receipt or Verify, which is the product's proof. | Replace "tx ↗" with a "Receipt ›" chip that opens the verify result. Keep the explorer as an icon. |
| R4G1-home-2 | filled · desktop | Minor | (R3G1-home-2) All six cards say "can't spend" and "No limit onchain" over an empty grey track: a meter for a limit that doesn't exist. Verify shows a "Researcher · demo" paying 12 h ago, so with no reason given, a judge reads the cards as broken. | Show no track when there's no limit. Say why: "Limit ended · Nov 3". |
| R4G1-home-3 | filled · desktop | Minor | Activity stops after eight items with no "See all". It shows two "Sui risk check 0.01 USDC 12h ago" payments, while Verify's "Your recent receipts" lists four from the same 12 hours. Without a "more" link, the two pages look like they disagree. | End the feed with "See all activity (N)", or a "+2 more payments" row. |

**Words that could go:** "Your remoras at a glance.", "Researcher" (the kind line under six names that start with "Researcher · demo")

## Home, new account and signed out (`empty-home`, `out-home`)
**Five seconds:** For: learning what a remora is and setting one up. First click: "Add funds" (new account) or "Try a Researcher, no wallet" (signed out).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G1-start-1 | empty, out · desktop | Minor | (R3G1-start-1) The Researcher and Wallet watcher tiles share one identical cyan face. 150 px lower, "Start from a template" draws them as a cube and a shield. | Give each kind one badge (a shape and a colour), and use it in the explainer, the templates and the list. |
| R4G1-start-2 | empty, out · desktop | Minor | (R3G1-start-2) Setup progress is drawn twice: the checklist's underline, which looks like a selected tab, with "1 of 3 done", and the sidebar card's bar with "1/3". Signed out, the screen asks for the wallet three times: the checklist's "Sign in", the card's "Next: Connect your wallet" and the sidebar's "Sign in". | A 3-segment bar with "1 of 3" beside it. Hide the sidebar card while the checklist is on screen. |
| R4G1-start-3 | empty, out · desktop | Nit | (R3G1-start-3) The face legend is six faces about 18 px tall that differ only in their eyes, and "watching" and "thinking" look the same. | Move the legend behind the `?` on "What's a remora?", or draw the faces at 28 px. |
| R4G1-start-4 | empty, out · desktop | Nit | (R3G1-start-4) The Flow's nodes have uneven widths, from Remora at about 88 px to Receipt at about 128 px. On `empty-home`, only the Remora → Paid service edge shows, so the highlighted "Spending limit" connects to nothing. | Use equal widths and draw every edge, with the limit sitting on the wallet → remora edge. |
| R4G1-start-5 | empty · desktop | Nit | (R3G1-start-5) The sidebar's "Team / No members yet" row has no icon, and its text is indented to where a face would be. | Add a room icon, or a dashed empty-face placeholder. |

**Words that could go:** "Already at home here? Open the chat." (it is shown signed out too), "An AI agent with a budget it can't break." (the subtitle says "a budget Sui enforces"), the two template descriptions (they repeat the kind tiles)

## Home, loading and error (`loading-home`, `error-home`)
**Five seconds:** For: Home while its data loads, or while the server is down. First click: nothing (loading), "Retry" (error).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G1-home-4 | error · desktop | Minor | (R3G1-home-4) Under "Can't reach Remora right now.", the "Remoras" and "Waiting for you" tiles keep their loading bars, and "Your balance" shows "—". On the same screen, the footer shows "19.78 USDC" for that balance. | Show "—" in every tile under an error. Show the footer's value in the tile, or grey out the footer with "as of 2m ago". |
| R4G1-home-5 | loading · desktop | Nit | (R3G1-home-5) Two skeleton cards stand for six, and they are plain blocks with no face, chip or track. | Six skeletons in the card's shape. |

**Words that could go:** "Your remoras show once Remora is back.", "The activity shows once Remora is back." (the banner already says it), the sidebar's second "Retry" (the banner has one)

## Try a Researcher (`out-playground`, `playground`)
**Five seconds:** For: trying a Researcher with a 1 USDC limit and no wallet. First click: "Start my Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G1-playground-1 | out, filled · desktop | Minor | (R3G1-playground-1) The steps row ("1 Start, 2 Ask, 3 It pays, 4 Check the receipt") and the Flow under it tell the same sequence twice, on two grids. "1 Start" sits over "Spending limit", which isn't a step. | Put the step number on each node ("1 · Spending limit 1.00 USDC") and drop the steps row. |
| R4G1-playground-2 | out, filled · desktop | Nit | (R3G1-playground-2) The subtitle says "a 1 USDC limit", where the node and the tile say "1.00 USDC". The limit is drawn twice, in the node and in the "Limit" tile. | Use "1.00 USDC" everywhere, and drop the amount from either the node or the tile. |
| R4G1-playground-3 | filled · desktop | Nit | (R3G1-playground-3) Signed in with 31 remoras, the page still says "No wallet needed." and offers "Get your own". Signed out, the sidebar row is highlighted; signed in, nothing is. | Signed in: drop "No wallet needed.", rename "Get your own" to "New remora", and highlight Home. |

**Words that could go:** "answers" (under "Your Researcher"), "Not kept in memory." (as a `?` hint), "No wallet needed." (signed in)

## Set up (`onboarding`, `empty-onboarding`)
**Five seconds:** For: a setup checklist. First click: "Add funds" (new account); once it's complete, only the optional "Link Telegram".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G1-onboarding-1 | filled · desktop | Minor | (R3G1-onboarding-1) "3 of 3 done" is a dead end: three ticks, the optional "Link Telegram", and 500 px of empty page. | When it's complete: the happy face, "You're set", and a primary "Ask your first question". |
| R4G1-onboarding-2 | filled, empty · desktop | Minor | (R3G1-onboarding-2) One page uses four names: the breadcrumb "Get started", the title "Set up Remora", the section "Set up Remora" and the sidebar card "Set up". Signed in, the subtitle still says "Sign in with your wallet…" above a ticked "Connect your wallet". No rail item is highlighted. | Use "Set up" everywhere. Drop the subtitle when signed in, and highlight Home. |

**Words that could go:** "Sign in with your wallet to keep your remoras, memory and budget in one place." (signed in), the second "Set up Remora"

## Sign in (`out-sign-in`)
**Five seconds:** For: connecting a Sui wallet when none is installed. First click: "Get Slush ↗" or "Try without a wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G1-sign-in-1 | out · desktop | Minor | (R3G1-sign-in-1) "Slush, or any other Sui wallet in this browser." is followed straight away by "No Sui wallet in this browser.", and a desktop shows "On a phone, open this page in the Slush app." | With no wallet: the title "No Sui wallet found", one line "Get Slush, or try Remora without one.", then the two buttons. Show the phone line only on a phone. |

**Words that could go:** "Slush, or any other Sui wallet in this browser.", "On a phone, open this page in the Slush app." (on desktop)

## Approvals (`approvals`, `empty-approvals`, `loading-approvals`, `error-approvals`)
**Five seconds:** For: saying yes or no to a payment over a remora's cap. First click: "Pay once (0.02 USDC)".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G1-approvals-1 | filled · desktop | Minor | (R3G1-approvals-1) The meter is a full red bar with "its cap: 0.015 a payment" and "over the cap" under it. Nothing marks where the cap sits, so it reads as 100% of something, and "0.015" has no unit. | Scale the track to 0.02 and put a tick at 0.015 labelled "cap 0.015 USDC". Colour only the part past the tick: "+0.005 USDC over". |
| R4G1-approvals-2 | filled · desktop | Minor | (R3G1-approvals-2, extended) Both requests are 13 and 16 days old and still offer a white "Pay once". Their age is small grey text at the far top right, about 600 px from the amount, because the card is 1,020 px wide and its content uses the left 400 px. They cite "its cap: 0.015 a payment", but Funds lists no limit with that cap (its only limit is "≤ 0.01 USDC a payment"). | Put an amber "asked 13 days ago" chip next to the amount, and word the cap in the past: "its cap was 0.015 USDC · that limit has ended". Narrow the card to its content. |
| R4G1-approvals-3 | loading, error · desktop | Minor | (R3G1-approvals-3) The tab reads "Waiting (...)" while loading and still reads it under "Couldn't load approvals.", so the error looks like it's still loading. The loading cards are two plain blocks, not the card's shape. | "Waiting (—)" on error. Loading cards with a name bar, an amount bar, a meter bar and two button blocks. |

The empty state (a face, "You're all caught up." and "See decided") works. So does the error ("Couldn't load approvals. Nothing pays without you." with Retry).

**Words that could go:** "its" (in "its cap:"), "You pay it once," (the button says "Pay once")

## Funds (`funds`, `empty-funds`, `loading-funds`, `error-funds`)
**Five seconds:** For: my USDC and the spending limits on it. First click: "Add USDC".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G1-funds-1 | filled · desktop | Minor | (R3G1-funds-3) "0.00 / 0.10 USDC spent" is body size, smaller than the "e2e-burner" title. At zero, the track barely shows against the card. | Set the amount at 20 px bold, and give the track 3:1 contrast with the card. |
| R4G1-funds-2 | filled, empty · desktop | Minor | (R3G1-funds-4) "In coins 0.00 USDC ✓ Nothing to move" takes half the top row, as big as the balance. "In coins" is jargon a judge can't tell apart from "Your balance", and it belongs with "Advanced: withdraw to a coin". | Hide the tile at 0.00 and move it into the Advanced disclosure, with a `?` that says what a coin is. |
| R4G1-funds-3 | error · desktop | Minor | (R3G1-funds-5) Under "Couldn't read your balance from Sui.", both tiles keep their loading bars. On the same screen, the footer shows "19.78 USDC" and the onchain limit "0.00 / 0.10 USDC" reads fine, so blaming Sui looks wrong. | Show "—" in both tiles and grey out the footer with "as of …". Name the right source: "Couldn't load your balance. Retry." |
| R4G1-funds-4 | empty · desktop | Minor | (R3G1-funds-6) On a 0.00 USDC account, the empty state's white "Create a remora" is as loud as "Add USDC", while the sidebar says the next step is "Add USDC". | Make "Create a remora" secondary until there's money. |

**Words that could go:** "Advanced:", "Nothing to move" (0.00 says it), "Each new remora gets one." (as a `?` hint)

## Verify (`verify`, `out-verify`)
**Five seconds:** For: checking that a payment receipt is real on Sui. First click: a row's "Verify" (signed in) or "Try a Researcher" (signed out).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G1-verify-1 | filled · desktop | Minor | (R3G1-verify-1) "Your recent receipts" is five identical rows, "Sui risk check 0.01 USDC 12h ago Verify", with no remora and no face, though the result card now names the remora. The amount shifts about 5 px right on the "3d ago" row. | Each row gets the face, the remora's name, the payee, the amount in a fixed right-aligned column, and the time. |
| R4G1-verify-2 | filled, out · desktop | Minor | (R3G1-verify-2) One page has four right edges: the input row ends at about 1052 px, the lists at 1147 px, the receipt card at 955 px and the verify result at 1403 px (`verify-receipt`). | Use one column width for the input, the lists, the card and the result. |
| R4G1-verify-3 | out · desktop | Minor | (R3G1-verify-3) Signed out, the checks never light up unless you first spend a minute on a Researcher, though the Shared proof page shows a public receipt exists. | Add a "See a sample" chip under the input that fills in one shared proof's id and runs it. |
| R4G1-verify-4 | out · desktop | Minor | (R3G1-verify-4) There are two white primary buttons: "Verify" next to an empty input, and "Try a Researcher". | Disable "Verify" until something is typed. |

**Words that could go:** "No sign-in needed." (when signed in), "In the transaction you pasted." (wrong when you verify from the list), "What it said it would do matches what it did." (it repeats "It did what it said")

## Verify result (`verify-receipt`)
**Five seconds:** For: proof that Researcher · demo's 0.01 USDC payment to Sui risk check is real. First click: "Share proof", but only after scrolling past six checks.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G1-vreceipt-1 | filled · desktop | Minor | (R3G1-vreceipt-3) The full intent hash, transaction and signer sit under "It did what it said", "The payment is onchain" and "Its own key signed", with no copy. One transaction appears in three forms: "EWnMQxNb85F...3GpK5VCccma" (card), the full string (check) and "EWnMQxNb85..." (Receipt table). | Show "858b…1b94" with copy everywhere, and an explorer link on the transaction and the signer. |
| R4G1-vreceipt-2 | filled · desktop | Minor | (R3G1-vreceipt-4) The "Receipt" table is raw: "0 object(s) via Tatum", "Memories me (Yb9ZNt1rzqM0Av_NbwZ6Cno-5YUCwhSOPNNrN7ymWZw)", a two-line "Check" sentence that repeats itself, "Model google/gemini-2.5-flash", and "Verify: Check it against the chain" on the page where you just verified. | Show "Check" as three ticks, and "Memories" as "1 memory · on Walrus ↗". Fold Trigger, Read, Model and Intent hash into "Details", and drop the Verify row. |
| R4G1-vreceipt-3 | filled · desktop | Minor | (R3G1-vreceipt-5) The face and "Researcher · demo paid" float left of a 384 px ticket card (572 to 955 px) that lines up with nothing. Under it, a full-width green banner gives the verdict a second time: "Verified", a "verified" chip and "The receipt matches the chain.", while the card already says "✓ Checks out on Sui". | One full-width receipt card: face, name and "paid 0.01 USDC to Sui risk check", the time, and "✓ Verified on Sui" as its footer. Drop the banner. |
| R4G1-vreceipt-4 | filled · desktop | Minor | (R3G1-vreceipt-6) "Share proof", the page's next step, sits at about y = 988, below the fold, under six checks. | Put "Share proof" on the receipt card, next to its copy icon. |
| R4G1-vreceipt-5 | filled · desktop | Nit | (R3G1-vreceipt-7) Before you verify, the page lists four checks. After, it shows six, and "The payment carries its decision" and "It decided as it paid" appear for the first time. | List the same six before and after. |

**Words that could go:** "verified" (the chip next to "Verified"), "The receipt matches the chain." (the card says "Checks out on Sui"), "saved onchain", "Verify: Check it against the chain", "paid" (under the name; the card says "Paid to")

## Shared proof (`public-receipt`)
**Five seconds:** For: a public proof that Researcher · demo paid 0.01 USDC to Sui risk check. First click: "Check it yourself".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G1-proof-1 | filled · desktop | Minor | (R3G1-proof-2) Every hash is printed two or three times. The transaction appears in the card (short), in "What happened" (full) and under "The payment is onchain" (full). The signer appears in "Signed by" and under "Its own key signed", and the intent hash in the table and under "It did what it said". "Intent hash" has no copy icon, while its neighbours do. | Short forms with copy and explorer links in the table. The checks refer to them ("✓ signed by 0x8aee…2ce3") without printing them again. |
| R4G1-proof-2 | filled · desktop | Minor | (R3G1-proof-3) "Paid to" is a full 64-character address, while the card and "Action" name the payee "Sui risk check". | "Sui risk check · 0x9964…f4a8 ↗". |
| R4G1-proof-3 | filled · desktop | Minor | (from R3G1-x-6) "When" says only "12h ago". This page is meant to be kept and shared, and in a week "12h ago" will be wrong in a screenshot. The date only shows deep in the checks ("Nov 3, 15:54"). | "Nov 3, 15:54 · 12h ago" in "When" and on the card. |
| R4G1-proof-4 | filled · desktop | Nit | "Check it yourself" sits above the green "Verified" banner, so the page asks the stranger to check before it shows that it already checked. | Put the verdict on the card (R4G1-vreceipt-3), then "Check it yourself" and "What's Remora?" under it. |

The receipt card has the same floating layout and the same double verdict as R4G1-vreceipt-3.

**Words that could go:** "verified" (the chip), "The receipt matches the chain.", "No sign-in needed." (the reader is already on the page)

## Across pages
| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G1-x-1 | filled · desktop | Blocker | (R3G1-x-1, the roster half, which the decline doesn't cover) The roster gives every "Researcher · demo" a green dot and "Researcher · active". Home's cards for the same six remoras (same faces, same order) say "can't spend · No limit onchain". Since round 3, the cards, a remora's header and a thread's header all use the spend chip, so the shell is the last place that still says "active". It does so on every page, for up to 31 rows. This is the same "active" against "can't spend" contradiction that G2's round 3 blockers named. | Show only the kind on the roster's second line, and keep the dot for exceptions (paused, needs you, practice). This needs no Disc reads. |
| R4G1-x-2 | filled · desktop | Minor | (R3G1-x-2) Hashes and addresses come in five forms. The footer shows "0xd9703e08d...917f634757" (11 + 10, three dots), feed titles "0xcc05...5d6d", the receipt card "EWnMQxNb85F...3GpK5VCccma", the Receipt table "EWnMQxNb85..." (the head only), and the checks and Shared proof the full 64 characters. | One short form, "0xd970…4757", with copy, and an explorer link where there's a page to link to. |
| R4G1-x-3 | filled, empty · desktop | Minor | (R3G1-x-3) The face changes from page to page. In "Needs you" it's coloured with two badges. On the Approval cards it's grey and monochrome at 20 px for the same remoras. The explainer uses one cyan face for both kinds, and the templates use a cube and a shield. The Verify rows have no face. | The same coloured face beside every remora name, and one badge per kind. |
| R4G1-x-4 | loading, error · desktop | Minor | (R3G1-x-4) "Not known" is drawn three ways: loading bars kept under an error (the `error-home` and `error-funds` tiles), "—" (`error-home`'s "Your balance"), and "(...)" (Approvals' tab while loading and on error). | A skeleton while loading and "—" on error, everywhere. |
| R4G1-x-5 | all · desktop | Minor | (R3G1-x-5) The same generic Flow appears three times with different nodes and spacing. Home's explainer and Funds' "Where it goes" use five nodes, with Funds' spread to the full width. Try a Researcher uses four, with "Your Researcher answers" where the others say "Remora its own key". On Funds it carries none of the account's numbers, so its moving dot shows a payment that isn't happening. | Drop it from Funds, or put live amounts on its nodes. Keep one node set and one spacing. |
| R4G1-x-6 | filled · desktop | Minor | (R3G1-x-6) Dates come in four forms. The roster says "Nov 3" for what Home's feed files under "Yesterday" as "12h ago". Approvals says "13d ago", the receipt cards "12h ago" and the checks "Nov 3, 15:54". | Relative everywhere, with the full date on hover, and both on the receipt (R4G1-proof-3). |
| R4G1-x-7 | empty, out, filled · desktop | Minor | (R3G1-x-7) One thing has several names. Adding money is "Add funds" (the checklist button) and "Add USDC" (the step, the sidebar card and the Funds button). Setup is "Set up Remora", "Set up" and "Get started". Whether money can move is "live" on Funds, "can't spend" on cards and "active" in the roster. | "Add USDC" and "Set up" everywhere, and one spend word ("can spend" or "can't spend"). |
| R4G1-x-8 | filled · desktop | Nit | (R3G1-x-8) Amounts are set two ways. Approvals sets "0.02 USDC" with the unit as large as the number. Home's tile, the feed, Funds, Verify and the receipt card set the unit small and grey. | Small grey unit everywhere. |

Also across pages: Home's feed shows two 0.01 USDC payments where Verify lists four from the same 12 hours (R4G1-home-3). Approvals cites a 0.015 cap that Funds doesn't list (R4G1-approvals-2). The balance, "Your balance 19.78 USDC", now agrees on Home, Funds and the footer.

**Counts:** Blocker 1 · Major 0 · Minor 38 · Nit 11
