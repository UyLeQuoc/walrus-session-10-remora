# Round 3 review, G1: getting started and money (desktop)

Persona: a hackathon judge with three minutes who knows a little crypto and has never heard of the product. I judged only the pictures in `r3/desktop/`. Stills can't show motion. `public-receipt` was again captured signed in, so a stranger's view of a shared proof isn't in the set.

## Previous findings
Findings the round 2 triage lists as fixed:
- R2G1-home-1: fixed. Cards now carry a grey "can't spend" chip and "No limit onchain", with no green "active" chip. Leftover: the empty track is still drawn as a meter of a limit that doesn't exist (R3G1-home-2).
- R2G1-x-1: not fixed. The cards are fixed, but Funds still titles the one limit "e2e-burner" with a green "live" chip, no face and nothing that says it's a remora. That name isn't among Home's six cards or the first 22 rows of the list. The roster says "Researcher · active" with a green dot beside cards that say "can't spend" (R3G1-funds-2, R3G1-x-1).
- R2G1-vreceipt-1: fixed. "The payee got the amount: 0.01 of 0.01 USDC".
- R2G1-vreceipt-2: not fixed. The ISO stamps are gone, but the line still reads "decided 15:54:48 · paid 15:54:47 · stored 15:54:48". The decision is listed first and timed a second after the payment (R3G1-vreceipt-2).
- R2G1-vreceipt-3: fixed for the titles. The four checks promised on Verify now turn green under the same names, plus two more. Leftover: full 64-character hashes still sit under three of them with no copy (R3G1-vreceipt-3).
- R2G1-vreceipt-4: not fixed. A receipt card now leads, with 0.01 USDC as the biggest thing and the payee and time. But the "who" is the raw id "6283e52d-1e39-4c2f-8bab-9a51500fa67d" rather than the remora's name, and the face and id float outside the card (R3G1-vreceipt-1, R3G1-vreceipt-5).
- R2G1-proof-1: not fixed. The receipt card leads, with the face, "Researcher · demo" and 0.01 USDC as the biggest thing. A stranger still gets no next step: no "Check it yourself" and no "What's Remora?" (R3G1-proof-1).

Declined, rechecked against the pictures:
- G1 x-1, the roster's "live": the reason (31 Disc reads every 30 s would exceed the rate limit) can't be checked from pictures and I accept it. But the roster now says "active" in green next to cards that say "can't spend" for the same remoras. A neutral run-state word needs no Disc reads, so I raise that narrower fix as R3G1-x-1.
- G2 rov-1, "Set a new limit": not raised again. The cards no longer offer an edit.

Fixed in the pictures though the triage doesn't list them: R2G1-home-2 (feed titles read "0xcc05...5d6d" and the time and actions keep their column). R2G1-funds-2 is fixed in part: the track is drawn, but at about 1.2:1 against the card (R3G1-funds-3).

## Shell: rail, top bar, remora list (`home`, `loading-home`)
**Five seconds:** For: moving between Home, Chat, Approvals, Funds and my remoras, with what waits on me at the top. First click: a "Needs you" row.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G1-shell-1 | filled · desktop | Minor | Both "Needs you" rows read "Researcher m..." to make room for the "0.02 USDC" chip, so the two waiting payments look identical. Approvals names them "Researcher mvi9nqpw" and "Researcher mvee216v". | Give the name the whole first line, and move the amount to the second: "0.02 USDC · wants your yes". |
| R3G1-shell-2 | loading, error · desktop | Minor | While loading and on error, the "Needs you" section and the rail's Approvals "2" badge vanish (`loading-home`, `error-home`, `loading-approvals`, `error-approvals`, `loading-funds`, `error-funds`). The one "something waits on you" signal blinks off whenever the API is slow. | Keep the badge: a grey dot while loading, the last count greyed on error. |
| R3G1-shell-3 | filled · desktop | Minor | The status dots have no legend. Green means "active" and orange means "practice" (every Wallet watcher, and "Checker mvjnb3km"). Orange also marks "Needs you" two rows above. "practice" is never explained. | Give "practice" a neutral grey dot or a small "practice" chip, and keep orange for "needs you" only. A `?` on "Remoras" can give the legend. |
| R3G1-shell-4 | filled, empty · desktop | Minor | The red "Pause all" pill is the loudest thing in the top bar on every page, even for a brand-new account with no remoras (`empty-home`, `empty-funds`). A judge reads it as an alarm. | A grey pause icon with a "Pause all" tooltip. Hide it when no remora is running. |
| R3G1-shell-5 | filled · desktop | Nit | Each "Needs you" row has three orange marks on a 60 px row: an "!" badge at the face's top right, a small orange face at its bottom right, and the orange amount chip. | One badge, the "!", and let the chip carry the amount. |
| R3G1-shell-6 | loading · desktop | Nit | The skeleton rows are rounded squares, but the faces they stand for are circles, triangles and drops. | A circle placeholder at the face's size. |

**Words that could go:** "Researcher" in "Researcher · active" (every name already starts with "Researcher"), "wants your yes" (the section title says "Needs you")

## Home (`home`)
**Five seconds:** For: my remoras, what's waiting on me, my balance and what they did. First click: "2 Review →".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G1-home-1 | filled · desktop | Minor | A payment row ends in "tx ↗", a jargon link to the explorer. Nothing on Home opens the payment's receipt or Verify, which is the product's proof. | Swap "tx ↗" for a "Receipt ›" chip that opens the verify result. Keep the explorer as an icon. |
| R3G1-home-2 | filled · desktop | Minor | All six cards say "can't spend" and "No limit onchain" over an empty track, which is a meter for a limit that doesn't exist. The one remora with a live limit (Funds' "e2e-burner", 0.10 USDC) isn't among them. Home's first picture of "a budget it can't break" is six remoras with no budget. | No track when there's no limit: a dashed outline, or nothing. Sort the cards so remoras that can spend come first. |

**Words that could go:** "Your remoras at a glance.", "Researcher" (the kind line under six names that start with "Researcher · demo")

## Home, new account and signed out (`empty-home`, `out-home`)
**Five seconds:** For: learning what a remora is and setting one up. First click: "Add funds" (new account) or "Try a Researcher, no wallet" (signed out).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G1-start-1 | empty, out · desktop | Minor | The two kinds share one picture: the Researcher and Wallet watcher tiles have the identical cyan face. 150 px lower, "Start from a template" draws them as a cube and a shield. | One kind badge per kind (a shape and a colour), used in the explainer, the templates and the list. |
| R3G1-start-2 | empty, out · desktop | Minor | Setup progress is drawn twice. The checklist has a white underline under "Set up Remora" that reads as a selected tab (with "1 of 3 done" at the far right), and the sidebar card has a thin bar with "1/3". Signed out, one screen asks for the wallet three times: the checklist's "Sign in", the card's "Next: Connect your wallet" and the sidebar's "Sign in". | A 3-segment bar with "1 of 3" beside it. Hide the sidebar card while the checklist is on screen. |
| R3G1-start-3 | empty, out · desktop | Nit | The face legend is six faces about 18 px tall that differ only in their eyes. "watching" and "thinking" look the same. | Move it behind the `?` on "What's a remora?", or draw the faces at 28 px. |
| R3G1-start-4 | empty, out · desktop | Nit | The Flow's nodes have uneven widths: Remora is about 88 px, Your wallet and Receipt about 128 px. Only the Remora → Paid service edge is visible. Three node styles (blue, green, grey) in one row of five. | Equal widths, every edge visible, and one accent: the spending limit. |
| R3G1-start-5 | empty · desktop | Nit | The sidebar's "Team / No members yet" row has no icon, and its text is indented to where a face would be. | A room icon, or a dashed empty-face placeholder. |

**Words that could go:** "Already at home here? Open the chat.", "An AI agent with a budget it can't break." (the subtitle says "a budget Sui enforces"), the two template descriptions (they repeat the kind tiles)

## Home, loading and error (`loading-home`, `error-home`)
**Five seconds:** For: Home while its data loads, or while it can't reach the server. First click: nothing (loading), "Retry" (error).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G1-home-4 | error · desktop | Minor | Under "Can't reach Remora right now.", the "Remoras" and "Waiting for you" tiles keep their loading bars, and "Ready to spend" shows "—". The footer shows "19.78 USDC" for the same balance. | "—" in every tile under an error. Show the footer's value in the tile, or grey the footer with "as of 2m ago". |
| R3G1-home-5 | loading · desktop | Nit | Two skeleton cards stand for six, and they are plain blocks with no face, chip or track. | Six skeletons in the card's shape. |

**Words that could go:** "Your remoras show once Remora is back.", "The activity shows once Remora is back." (the banner already says it), the list's second "Retry" (the banner has one)

## Try a Researcher (`out-playground`, `playground`)
**Five seconds:** For: trying a Researcher with a 1 USDC limit and no wallet. First click: "Start my Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G1-playground-1 | out, filled · desktop | Minor | The steps row ("1 Start, 2 Ask, 3 It pays, 4 Check the receipt") and the Flow under it tell the same sequence twice, on two grids. "4 Check the receipt" starts at about 1028 px and "Receipt" at 1019 px. "1 Start" sits over "Spending limit", which isn't a step. | Put the step number on each node ("1 · Spending limit 1.00 USDC") and drop the steps row. |
| R3G1-playground-2 | out, filled · desktop | Nit | The subtitle says "a 1 USDC limit", while the node and the tile say "1.00 USDC". The limit is drawn twice: in the node and in the "Limit" tile. | "1.00 USDC" everywhere, and drop the amount from the node or from the tile. |
| R3G1-playground-3 | filled · desktop | Nit | Signed in with 31 remoras, the page still says "No wallet needed." and offers "Get your own". Nothing in the rail or the list is highlighted. | Signed in: drop "No wallet needed.", rename "Get your own" to "New remora", and highlight Home. |

**Words that could go:** "answers" (under "Your Researcher"), "Not kept in memory." (as a `?` hint)

## Set up (`onboarding`, `empty-onboarding`)
**Five seconds:** For: a setup checklist. First click: "Add funds" (new account); when it's complete, only the optional "Link Telegram".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G1-onboarding-1 | filled · desktop | Minor | "3 of 3 done" is a dead end: three ticks, the optional "Link Telegram", and 500 px of empty page. | When it's complete: the happy face, "You're set", and a primary "Ask your first question". |
| R3G1-onboarding-2 | filled, empty · desktop | Minor | One page has four names: the breadcrumb "Get started", the title "Set up Remora", the section "Set up Remora" and the sidebar card "Set up". Signed in, the subtitle still says "Sign in with your wallet…" above a ticked "Connect your wallet". No rail item is highlighted. | "Set up" everywhere. Drop the subtitle when signed in, and highlight Home. |

**Words that could go:** "Sign in with your wallet to keep your remoras, memory and budget in one place." (signed in), the second "Set up Remora"

## Sign in (`out-sign-in`)
**Five seconds:** For: connecting a Sui wallet when none is installed. First click: "Get Slush ↗" or "Try without a wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G1-sign-in-1 | out · desktop | Minor | "Slush, or any other Sui wallet in this browser." is followed straight away by "No Sui wallet in this browser.", and a desktop shows "On a phone, open this page in the Slush app." | With no wallet: the title "No Sui wallet found", one line "Get Slush, or try Remora without one.", then the two buttons. Show the phone line only on a phone. |

**Words that could go:** "Slush, or any other Sui wallet in this browser.", "On a phone, open this page in the Slush app." (on desktop)

## Approvals (`approvals`, `empty-approvals`, `loading-approvals`, `error-approvals`)
**Five seconds:** For: saying yes or no to a payment over a remora's cap. First click: "Pay once (0.02 USDC)".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G1-approvals-1 | filled · desktop | Minor | The meter is a full red bar with "its cap: 0.015 a payment" and "over the cap" under it. Nothing marks where the cap sits, so it reads as 100% of something, and "0.015" has no unit. | Scale the track to 0.02, put a tick at 0.015 labelled "cap 0.015 USDC", and colour only the part past it: "+0.005 USDC over". |
| R3G1-approvals-2 | filled · desktop | Minor | Both requests are 13 and 16 days old and still offer a white "Pay once". Their age is small grey text at the far top right, 600 px from the amount, because the card is 1,020 px wide and its content uses the left 400 px. | An amber chip "asked 13 days ago" next to the amount when a request is older than a day, or expire old requests into Decided. Narrow the card to its content. |
| R3G1-approvals-3 | loading, error · desktop | Minor | The tab reads "Waiting (...)" while loading and still under "Couldn't load approvals.", so the error looks like it's still loading. The loading cards are plain blocks split down the middle, not the card's shape. | "Waiting (—)" on error. Loading cards with a name bar, an amount bar, a meter bar and two button blocks. |

The empty state (face, "You're all caught up.", "See decided") and the error ("Couldn't load approvals. Nothing pays without you." with Retry) work.

**Words that could go:** "its" (in "its cap:"), "You pay it once," (the button says "Pay once")

## Funds (`funds`, `empty-funds`, `loading-funds`, `error-funds`)
**Five seconds:** For: my USDC and each remora's spending limit. First click: "Add USDC".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G1-funds-1 | filled · desktop | Blocker | The subtitle says "What your remoras can spend.", and the biggest number under it is "Ready to spend 19.78 USDC". The only live limit lets one remora spend 0.10 USDC, 0.01 a payment, and Home shows the same "Ready to spend 19.78 USDC" tile above six cards that each say "can't spend". The page's key number overstates what the remoras can spend by about 200 times, which goes against the product's main promise. | Rename the tile "In your wallet 19.78 USDC" on Funds and Home. Lead Funds with "Remoras can spend 0.10 USDC · 1 limit live", or change the subtitle to "Your USDC, and the limits on it". |
| R3G1-funds-2 | filled, loading, error · desktop | Minor | The one spending limit is titled "e2e-burner" with a green "live" chip, and has no face and no "remora" anywhere. On an account of 31 remoras whose Home cards all say "can't spend", a judge can't tell which remora this limit lets spend. | The face and remora name on the row, linking to the remora. Above the list: "1 of 31 remoras can spend". |
| R3G1-funds-3 | filled · desktop | Minor | "0.00 / 0.10 USDC spent" is body-size, smaller than the "e2e-burner" title. At zero, the track is about 1.2:1 against the card, below the 3:1 a meaningful graphic needs. | Set the amount at 20 px, bold, and give the track 3:1. |
| R3G1-funds-4 | filled, empty · desktop | Minor | "In coins 0.00 USDC ✓ Nothing to move" takes half the top row, as big as the balance. "In coins" is jargon a judge can't tell apart from "Ready to spend". It belongs with "Advanced: withdraw to a coin". | Hide the tile at 0.00 and move it into the Advanced disclosure, with a `?` saying what a coin is. |
| R3G1-funds-5 | error · desktop | Minor | Under "Couldn't read your balance from Sui.", both tiles keep their loading bars. On the same screen, the footer shows "19.78 USDC" and the onchain limit "0.00 / 0.10 USDC" reads fine, so blaming Sui looks wrong. | "—" in both tiles. Grey the footer with "as of …". Name the right source: "Couldn't load your balance. Retry." |
| R3G1-funds-6 | empty · desktop | Minor | On a 0.00 USDC account, the empty state's white "Create a remora" is as loud as "Add USDC", while the sidebar says the next step is "Add USDC". | Make "Create a remora" secondary until there's money. |

**Words that could go:** "Advanced:", "Nothing to move" (0.00 says it), "Each new remora gets one." (as a `?` hint)

## Verify (`verify`, `out-verify`)
**Five seconds:** For: checking that a payment receipt is real on Sui. First click: a row's "Verify" (signed in) or "Try a Researcher" (signed out).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G1-verify-1 | filled · desktop | Minor | "Your recent receipts" is five identical rows, "Sui risk check 0.01 USDC 11h ago Verify", with no remora, no face and no id. The amount shifts by 2 px on the "3d ago" row. | Each row: the face, the remora's name, the payee, the amount in a fixed right-aligned column, the time and "0x8f3a…c21b". |
| R3G1-verify-2 | filled, out · desktop | Minor | One page has four right edges: the input row ends at about 1052 px, the lists at 1147 px, the receipt card at 1117 px and the verify result at 1403 px (`verify-receipt`). | One column width for the input, the lists, the card and the result. |
| R3G1-verify-3 | out · desktop | Minor | Signed out, the checks never light up unless you first spend a minute on a Researcher. A sample needs one receipt, and the Shared proof page shows a public one exists. | A "See a sample" chip under the input that fills in one shared proof's id and runs it. |
| R3G1-verify-4 | out, filled · desktop | Minor | Two white primary buttons: "Verify" next to an empty input, and "Try a Researcher" (signed out) or the five row buttons (signed in). | Disable "Verify" until something is typed. |

**Words that could go:** "No sign-in needed." (when signed in), "In the transaction you pasted." (wrong when you verify from the list)

## Verify result (`verify-receipt`)
**Five seconds:** For: proof that one 0.01 USDC payment to Sui risk check is real. First click: "Share proof", but only after scrolling past six checks.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G1-vreceipt-1 | filled · desktop | Major | The receipt card names who paid as "6283e52d-1e39-4c2f-8bab-9a51500fa67d", a raw id, right under the input's other raw id "0bcfea69-…". Shared proof shows the same receipt (same transaction, signer and intent hash) as "Researcher · demo". The one fact a judge looks for, who paid, is unreadable here. | The remora's name, as on Shared proof, with the id under a "Details" disclosure. |
| R3G1-vreceipt-2 | filled · desktop | Blocker | "It decided as it paid" shows "decided 15:54:48 · paid 15:54:47 · stored 15:54:48". The labels read in order, but the decision is timed a second after the payment, so the evidence still reads as "it paid, then decided". That's the opposite of the promise in "The payment carries its decision" one row up. It has no date either. | Don't compare the clocks to the second. Show "Decided and paid within 1 s · Nov 3, 15:54" with a `?`: "Two machines' clocks; they agree within 5 s." Or order the times as they happened and say why that's fine. |
| R3G1-vreceipt-3 | filled · desktop | Minor | The full intent hash, transaction and signer (64 characters each) sit under "It did what it said", "The payment is onchain" and "Its own key signed", with no copy. One transaction appears in three forms on one page: "EWnMQxNb85F...3GpK5VCccma" (card), the full string (check), and "EWnMQxNb85..." (Receipt table). | "858b…1b94" with copy everywhere, and an explorer link on the transaction and the signer. |
| R3G1-vreceipt-4 | filled · desktop | Minor | The "Receipt" table is raw and full of jargon: "0 object(s) via Tatum", "Memories me (Yb9ZNt1rzqM0Av_NbwZ6Cno-5YUCwhSOPNNrN7ymWZw)", a two-line "Check" sentence that repeats itself ("payee allowed and listed; under per-payment cap; check model: Payee is authorized and amount is within limits"), "Model google/gemini-2.5-flash", and "Verify: Check it against the chain" on the page where you just verified. | "Check" as three ticks: "payee allowed ✓ · under cap ✓ · on list ✓". "Memories" as "1 memory · on Walrus ↗". Fold Trigger, Read, Model and Intent hash into "Details", and drop the Verify row. |
| R3G1-vreceipt-5 | filled · desktop | Minor | The face and the payer float left of a 384 px ticket card that sits mid-column (733 to 1117 px), aligned with nothing above or below. Under it, a full-width green banner says "Verified", then "verified", then "The receipt matches the chain.", while the card already says "✓ Checks out on Sui". That's two verdicts. | One full-width receipt card: face, name and "paid 0.01 USDC to Sui risk check" on the left, the time, and the green "✓ Verified on Sui" as the card's footer. Drop the separate banner. |
| R3G1-vreceipt-6 | filled · desktop | Minor | "Share proof", the page's next step, sits at about y = 988, below the fold, under six checks. | Put "Share proof" on the receipt card, next to its copy icon. |
| R3G1-vreceipt-7 | filled · desktop | Nit | Before you verify, the page lists four checks. After, it shows six: "The payment carries its decision" and "It decided as it paid" appear for the first time. | List the same six before and after, or fold the two decision checks into one. |

**Words that could go:** "verified" (the chip next to "Verified"), "The receipt matches the chain." (the card says "Checks out on Sui"), "saved onchain", "Verify: Check it against the chain"

## Shared proof (`public-receipt`)
**Five seconds:** For: a public proof that Researcher · demo paid 0.01 USDC to Sui risk check. First click: can't tell. There's nothing to click but copy icons.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G1-proof-1 | filled · desktop | Major | This page is for strangers, but it gives them no next step: no "Check it yourself on Sui" and no "What's Remora?". It fails the five-second test for the person it's sent to. | Under the receipt card, one action, "Check it yourself" (re-runs the checks on Verify), plus a quiet "What's Remora? ›". |
| R3G1-proof-2 | filled · desktop | Minor | Every hash is printed three times. The transaction appears in the card (short), in "What happened" (full) and under "The payment is onchain" (full). The signer appears in "Signed by" and under "Its own key signed", the intent hash in the table and under "It did what it said". "Intent hash" has no copy icon, while its neighbours do. | Short forms with copy and explorer links in the table. The checks refer to them ("✓ signed by 0x8aee…2ce3") without reprinting them. |
| R3G1-proof-3 | filled · desktop | Minor | "Paid to" is a full 64-character address, while the card and "Action" name the payee "Sui risk check". | "Sui risk check · 0x9964…f4a8 ↗". |

The receipt card here has the same floating layout and the same double verdict as R3G1-vreceipt-5. The checks carry R3G1-vreceipt-2 and -3 unchanged.

**Words that could go:** "verified" (the chip), "The receipt matches the chain.", "checked against Sui" (the card says "Checks out on Sui")

## Across pages
| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G1-x-1 | filled · desktop | Minor | "Can this remora spend?" gets three words in three styles. The roster shows "Researcher · active" with a green dot. A Home card shows "can't spend" in a grey chip for the same remora. Funds shows "live" in a green chip on a row with no remora. The roster decline covers reading Discs, not the green "active". | In the roster, show the kind only and keep the dot for exceptions (paused, needs you), which needs no Disc reads. Use one spend chip ("can spend", "can't spend") on cards and Funds rows. |
| R3G1-x-2 | filled · desktop | Minor | Hashes and addresses come in five forms. The footer shows "0xd9703e08d...917f634757" (11 + 10, three dots), feed titles "0xcc05...5d6d" (6 + 4, an ellipsis), the receipt card "EWnMQxNb85F...3GpK5VCccma", the Receipt table "EWnMQxNb85..." (head only), and the checks and Shared proof the full 64 characters. | One short form, "0xd970…4757", with copy, and an explorer link where there's a page. |
| R3G1-x-3 | filled, empty · desktop | Minor | The face changes from page to page. In "Needs you" it's coloured with two badges, on Approval cards grey and monochrome at 20 px for the same remoras, and in the explainer one cyan face serves both kinds. The templates use a cube and a shield. The Funds limit row and the Verify rows have no face. The receipt cards now have one. | The same coloured face beside every remora name, and one kind badge. |
| R3G1-x-4 | loading, error · desktop | Minor | "Not known" is drawn three ways: loading bars kept under an error (`error-home` and `error-funds` tiles), "—" (`error-home` Ready to spend), and "(...)" (Approvals' tab while loading and on error). | A skeleton while loading and "—" on error, everywhere. |
| R3G1-x-5 | all · desktop | Minor | The same generic Flow appears three times with different nodes and spacing. Home's explainer and Funds' "Where it goes" use five nodes, with Funds spread to the full width. Try a Researcher uses four, and "Your Researcher answers" stands where the others say "Remora its own key". On Funds it carries none of the account's numbers, so its dot shows a payment that isn't happening. | Drop it from Funds, or put live amounts on its nodes. Keep one node set and one spacing. |
| R3G1-x-6 | filled · desktop | Minor | Dates come in four forms. The list shows "Nov 3" for what Home's feed calls "Yesterday", Approvals "13d ago", the feed and proofs "11h ago", and the checks bare clock times ("15:54:47") with no date. The Shared proof, a page meant to be kept, has no absolute date at all. | Relative everywhere, with the full date on hover. On the proof, "Nov 3, 15:54 · 11h ago". |
| R3G1-x-7 | empty, out, filled · desktop | Minor | One thing, several names. Adding money is "Add funds" (the checklist button) and "Add USDC" (the step, the sidebar card, the Funds button). Setup is "Set up Remora", "Set up" and "Get started". A limit that works is "live" on Funds and a remora that runs is "active" in the list. | "Add USDC" and "Set up" everywhere, and one word per status. |
| R3G1-x-8 | filled · desktop | Nit | Amounts are typeset two ways. Approvals sets "0.02 USDC" with the unit as large as the number. Home's tile, the feed, Funds, Verify and the receipt card set the unit small and grey ("0.01 USDC"). | Small grey unit everywhere. |

Also across pages: the same receipt's payer is "6283e52d-…" on Verify and "Researcher · demo" on Shared proof (R3G1-vreceipt-1). "Ready to spend 19.78 USDC" sits above six "can't spend" cards on Home and over a 0.10 USDC limit on Funds (R3G1-funds-1).

**Counts:** Blocker 2 · Major 2 · Minor 38 · Nit 10
