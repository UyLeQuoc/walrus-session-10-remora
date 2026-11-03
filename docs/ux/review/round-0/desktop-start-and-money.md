# Round 0 review, G1: getting started and money (desktop)

Reviewer persona: hackathon judge, three minutes, a little crypto, never heard of the product. Pictures only.

## Shell: rail, top bar, remora list (`home`)
**Five seconds:** For: moving between Home, Chat, Approvals, Funds, Memory and the list of my agents. First click: a remora in the list, or the "Approve" rows under "Needs you".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G1-shell-1 | loading, error · desktop | Blocker | While data loads or fails, the shell falls back to a brand-new account: the list shows only "Import a team..." and an empty "Rooms", and a "Set up 1/3 · Next: Add USDC" card appears. This is an account with 31 remoras and a footer that says "19.78 USDC" (`loading-home`, `error-home`, `loading-approvals`, `error-approvals`, `loading-funds`, `error-funds`). | Show 6 to 8 skeleton rows (face circle and two bars) in the list while loading. Never show the setup card until balance and remoras have both loaded. On error, keep the last known list and add a small "offline" dot. |
| R0G1-shell-2 | all · desktop | Minor | The red "Pause all" pill is the loudest thing in the top bar on every page, even on a new account with nothing to pause (`empty-home`). It competes with each page's main action. | Hide it when no remora is live. Otherwise make it a quiet icon button (pause glyph with a "Pause all remoras" tooltip) and ask for confirmation. |
| R0G1-shell-3 | filled · desktop | Minor | Seven rows read "Researcher · demo" with nothing to tell them apart. The two "Needs you" rows cut off as "Researcher mvi..." and "Researcher mv...", so they look identical. | Add a second key on each row: the budget meter or the last amount ("0.01 USDC · 9h"). In "Needs you", show the amount ("0.02 USDC") in place of the cut-off name tail. |
| R0G1-shell-4 | filled · desktop | Minor | Row previews are the agents' instructions in the second person ("You answer the owner's questi...", "You watch the owner's addres...", "Answers questions by buying t..."). They say nothing about what the agent did. | Preview the last event ("Paid 0.01 USDC to Sui risk check") or the state from the face legend ("watching", "blocked a payment"). |
| R0G1-shell-5 | filled · desktop | Minor | The green and orange dots on the faces have no legend or text. Orange also means "needs you" (badges, "Approve" chips) and "practice", so it's a colour-only fact with two meanings. | Give the dot a tooltip and aria-label ("live", "practice"). Use a different mark for practice, such as a hollow ring, so orange stays reserved for "needs you". |
| R0G1-shell-6 | filled · desktop | Minor | The orange "Approve" chip in "Needs you" looks like a one-click button that pays. On Approvals the real button says "Pay once (0.02 USDC)". | Replace the chip with the amount ("0.02 USDC ›") so the row reads as a link to the decision, not the decision itself. |
| R0G1-shell-7 | all · desktop | Nit | The pencil icon next to "Pause all" and the panel icon before the breadcrumb have no labels. | Add tooltips ("New chat", "Hide list"). |
| R0G1-shell-8 | filled · desktop | Nit | "Rooms › Team" is only reachable after scrolling past 31 remoras. | Collapse the remora list to about 10 rows with "Show all 31", or move Rooms above Remoras. |

**Words that could go:** "Asks you to approve a payment" (twice, under each "Needs you" row; the chip already says it)

## Home (`home`)
**Five seconds:** For: an overview of my agents, what's waiting on me, and my money. First click: "Review" on the "2 approvals waiting" banner.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G1-home-1 | filled · desktop | Blocker | The "Ready to spend" tile says "$0.00 in your address balance", but the footer of the same screen says "19.78 USDC" and Funds says "Ready to spend $19.78". The headline money number on Home is wrong. | Drive the tile from the same balance as Funds and the footer. While it's unknown, show "—" with a skeleton, never "$0.00". |
| R0G1-home-2 | filled · desktop | Major | Every Researcher card reads "Budget not readable just now." and one reads "Reading its spending limit...". The number this product is about (spent against the limit) is missing from all 13 spending cards, as a grey sentence with no retry. | Put a meter on each card: "0.00 / 0.10 USDC" with a filled bar. If a limit can't be read, show an empty grey meter with a "?" hint and a small retry icon, not a sentence. |
| R0G1-home-3 | filled · desktop | Major | Home is about 5,300 px tall. It shows all 31 remora cards (with a "See all" link that adds nothing), then an activity feed with no end, every row carrying thumbs up, thumbs down and "Why?". Nothing ranks what matters. | Show the 6 most recent cards plus "See all 31". Cap Activity at about 10 rows plus "See all". Show the thumbs and "Why?" on hover only. |
| R0G1-home-4 | filled · desktop | Blocker | Activity shows raw internals as if they were output: `<untrusted source="reef:sui-risk">not paid: the service answered 200</untrusted>I'm sorry...`, unrendered Markdown ("_I tried to buy Sui risk check ... (x402.unsettled), so this answer doesn't use it..._", "Sources: * reef:sui-risk ($0)") and backtick-wrapped ids. To a judge it reads as a bug. | Strip the wrapper tags, render the Markdown, and map internal codes to plain words ("payment didn't settle"). Show sources as a chip ("Sui risk check · 0.01 USDC"). |
| R0G1-home-5 | filled · desktop | Major | Red "Blocked" rows say "Didn't pay Sui risk check: the service answered 200" or "fetch failed". "Blocked" looks like the Sui limit stopping a payment (the face legend has "blocked a payment"), but these are service failures. "200" means success to anyone who knows HTTP and nothing to anyone else. | Split the states: "Limit stopped it" (red, shield icon) and "Service failed" (grey, plug icon). Give plain reasons ("sent no data", "didn't answer"), with no status codes. |
| R0G1-home-6 | filled · desktop | Minor | Questions and answers repeat the full 64-hex package id "0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95e3c69e88434a5d6d" about 10 times. It has no short form, copy button or explorer link. | Show "0xcc05…5d6d" as a chip with copy and an explorer link. |
| R0G1-home-7 | filled · desktop | Minor | A row labelled "Researcher · demo" says "Scout · demo is live." The name in the text doesn't match the remora the row belongs to. | Render the current name, or show "(was Scout · demo)". |
| R0G1-home-8 | filled · desktop | Minor | Each paid answer is two rows (Answer, then "Paid 0.01 USDC to Sui risk check"), and the cost inside the answer is worded four ways ("Source: Sui risk check (0.01 USDC)", "Cost: 0.01 USDC from Reef", "Cost: 0.01 USDC from "Sui risk check"", "(Cost: 0.01 USDC from reef:sui-risk)"). | Fold the payment into the answer as one receipt chip ("0.01 USDC · Sui risk check · Verify ›"). Drop the separate Paid row when it belongs to an answer. |
| R0G1-home-9 | filled · desktop | Minor | The event chips aren't one system. "Action" has no fill while the others do, and "Learned" and "Paid" share the same green. | Give each event type its own icon and colour. Use the same chip shape for all of them, "Action" included. |
| R0G1-home-10 | filled · desktop | Minor | Every start writes two rows: "Researcher · demo is live." and then "...is ready. Its spending limit is live; it starts in practice mode." "Live" and "practice mode" contradict each other, and the pair repeats 5 times. | Write one event: "Started · practice mode · limit 0.10 USDC". |
| R0G1-home-11 | filled · desktop | Minor | "2" appears four times above the fold (banner, "Waiting for you" tile, "Needs you", rail badge). The banner says "A payment is over its per-payment cap" (singular) for two approvals. | Keep the banner and drop the "Waiting for you" tile, or the reverse. Make the banner show the amounts ("2 × 0.02 USDC to Odds"). |

**Words that could go:** "Your remoras, what needs you, and what they did lately:", "on this network", "approvals need a yes", "in your address balance", "Researcher" (the kind line under names that already start with "Researcher")

## Home, new account and signed out (`empty-home`, `out-home`)
**Five seconds:** For: learning what a remora is and setting one up. First click: "Add funds" (new account), "Try a Researcher, no wallet" (signed out).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G1-home-12 | empty, out · desktop | Major | The "What's a remora?" card is about 8 lines of prose: a 2-line definition plus 3-line blurbs for Researcher and Wallet watcher. It pushes the setup checklist down. The blurbs repeat the template cards below ("Answers questions by buying the best data, and learns..."). | Replace the definition with a 4-node diagram: own key → spending limit (Sui) → memory (Walrus) → receipt. Delete the two blurbs; the template cards already say it. |
| R0G1-home-13 | out · desktop | Major | Three white primary buttons compete: "Try a Researcher, no wallet" (hero), "Connect wallet" (checklist step 1) and "Sign in" (sidebar footer). "Connect wallet" and "Sign in" are the same act under two names. | Make one primary, "Try a Researcher, no wallet". Use one secondary label, "Sign in with wallet", in both the footer and step 1. |
| R0G1-home-14 | empty · desktop | Minor | The checklist says "1 of 3 done" (sidebar "1/3") but shows four numbered rows, and the bar is in thirds. | Number only the three required steps. Show Telegram as an unnumbered "optional" row. |
| R0G1-home-15 | empty · desktop | Minor | The order forces "Add USDC" before "Create your first remora", yet the Wallet watcher template is "Read-only" and never pays. | Let a Wallet watcher be created with 0 USDC. Label step 2 "Add USDC (Researchers only)". |
| R0G1-home-16 | empty, out · desktop | Minor | The breadcrumb says "Remora" while the rail highlights Home, and the filled Home's breadcrumb says "Home". | Use "Home" in every state. |
| R0G1-home-17 | empty, out · desktop | Nit | The six legend faces are about 20 px, all the same cyan, and differ only by tiny marks. "Paid" and "paused" are hard to tell apart. | Draw them at 32 px and give each state its own colour accent. |

**Words that could go:** "Already at home here? Open the chat.", "Teach it in plain words, like "ignore incoming SUI under 0.002". It never pays." (the template card says "Read-only"), "Answers your questions. It buys the data it needs from paid services, like a 0.01 USDC risk report on a Sui package, and learns which sources are worth it."

## Home, loading and error (`loading-home`, `error-home`)
**Five seconds:** For: loading looks like Home with no data; error looks like a brand-new account. First click: "New remora" (loading); "Add funds" (error, which is wrong for this account).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G1-home-18 | loading · desktop | Blocker | While loading, the subtitle says "0 remoras on testnet" and the tiles say "Remoras 0", "Waiting for you 0 · nothing needs you" and "Ready to spend $0.00". These are zeros presented as facts. | Skeleton bars in the three tiles. Leave the count out of the subtitle until it's loaded. The remora and activity skeletons are already the right shape. |
| R0G1-home-19 | error · desktop | Blocker | When the server fails, Home silently becomes the new-account page ("Always-on agents you own", "Create your first remora", "Next: Add USDC"). The account has 31 remoras and 19.78 USDC, and there's no error at all. | Keep Home's layout with "—" tiles and a one-line banner: "Can't reach Remora's server. Your limits still hold. Retry" with a Retry button. |

**Words that could go:** none (fix the states first)

## Try a Researcher (`out-playground`, `playground`)
**Five seconds:** For: trying a paid AI researcher for free, no wallet. First click: "Start my Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G1-playground-1 | out, filled · desktop | Major | "How it works" is three bullet sentences carrying three numbers ("1.00 USDC spending limit", "up to 2 questions", "ends after 3 minutes"). Under the button sits about 600 px of empty space. | Three big-number tiles: "1.00 USDC limit", "2 questions", "3 min". Add a 5-step flow strip under them: Start → Ask → Pays 0.01 → Receipt → Limit revoked. |
| R0G1-playground-2 | out, filled · desktop | Minor | The same amount appears in two units two lines apart: "with a $1 budget" and "a 1.00 USDC spending limit". | Use "1.00 USDC" in both places. |
| R0G1-playground-3 | out, filled · desktop | Minor | The intro paragraph repeats the bullets ("Sui enforces the limit onchain", "A receipt is the onchain record of what each answer paid, and anyone can check it"). | Cut the intro to one line ("Your own Researcher, 1.00 USDC it can't go over"), with a `?` hint on "receipt". |
| R0G1-playground-4 | filled · desktop | Minor | A signed-in owner of 31 remoras still sees "Sign in for a Researcher that learns." and a "Get your own" button. | When signed in, drop that sentence and change the button to "New remora". |

**Words that could go:** "Sui enforces the limit onchain. A receipt is the onchain record of what each answer paid, and anyone can check it.", "Questions here are not kept in memory." (could be a tooltip)

## Set up (`onboarding`, `empty-onboarding`)
**Five seconds:** For: a setup checklist. First click: "Add funds" (new account); filled: only "Link Telegram (optional)", so there's no real next step.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G1-onboarding-1 | filled · desktop | Minor | Done ("3 of 3 done", all checks) is a dead end. Nothing says "you're set" or points onward, and the only button is the optional Telegram one. | When complete, show a happy face, "You're set", and a primary "Open Home" or "Ask your first question". Keep Telegram as a secondary action. |
| R0G1-onboarding-2 | filled, empty · desktop | Minor | The subtitle "Sign in with your wallet to keep your remoras, memory and budget in one place." shows to signed-in users. The heading "Set up Remora" repeats right under itself as the section label. | When signed in, drop the subtitle and the duplicate label. |
| R0G1-onboarding-3 | empty · desktop | Minor | "Add USDC" doesn't say how much, or where a newcomer gets test USDC. | Make the step read "Add ≥ 1 test USDC" with a `?` hint linking a faucet, and show the deposit address with a copy button. |

**Words that could go:** "Sign in with your wallet to keep your remoras, memory and budget in one place." (when signed in), the second "Set up Remora"

## Sign in (`out-sign-in`)
**Five seconds:** For: connecting a Sui wallet. First click: can't tell. With no wallet installed, the only control is the close button.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G1-sign-in-1 | out · desktop | Major | "No wallet found. Install Slush or another Sui wallet, then reload this page." is a dead end: no install link, no way forward, and no mention of the wallet-free path the app offers elsewhere. | Add a face plus two buttons: "Get Slush ↗" (primary) and "Try without a wallet" (secondary, opens Try a Researcher). |

**Words that could go:** "Slush, or any other Sui wallet in this browser." (repeated by the line below), "then reload this page" (detect the wallet when the tab regains focus)

## Approvals (`approvals`, `empty-approvals`, `loading-approvals`, `error-approvals`)
**Five seconds:** For: saying yes or no to payments over a remora's cap. First click: "Pay once (0.02 USDC)".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G1-approvals-1 | filled · desktop | Major | "Over its per-payment cap. You pay this once from your own balance." The cap is never shown, so 0.02 USDC has nothing to compare against. The balance it comes from isn't shown either. | A mini meter under the amount: the cap marked at 0.01, the bar reaching 0.02, and the overflow in amber. Add a chip "from your balance · 19.78 USDC". |
| R0G1-approvals-2 | filled · desktop | Minor | The cards have no face, while the same requests in the left list do (with the amber "needs you" badge). | Put the remora's face, with the needs-you badge, before "Researcher mvi9nqpw". |
| R0G1-approvals-3 | filled · desktop | Nit | "pending" chip, amber card and "Waiting (2)" tab all say the same thing. "13d ago" and "16d ago" don't say whether the request still stands or expires. | Drop the "pending" chip. Add "expires in …" or "still waiting since 13d". |
| R0G1-approvals-4 | empty · desktop | Minor | The empty state is an inbox icon plus "You're all caught up" with no face and no button. The "Waiting" tab drops its count (the filled state shows "Waiting (2)"). | Use a calm remora face, the one line, and a button ("See decided"). Show "Waiting (0)". |
| R0G1-approvals-5 | loading · desktop | Minor | Under the tabs the pane is blank, with no skeleton, so loading can't be told apart from empty. | Two skeleton cards in the approval-card shape (name bar, big amount bar, two button blocks). |
| R0G1-approvals-6 | error · desktop | Blocker | The error is a lone red word, "down", and directly below it says "You're all caught up". It tells the owner nothing is waiting while the list failed (two approvals are waiting). | Never show the caught-up state on error. Show: face + "Couldn't load approvals. Nothing pays without you. Retry" + Retry button. |

**Words that could go:** "When a remora needs a payment over its cap, it lands here first." (repeats the subtitle), "pending", "You pay this once from your own balance." (becomes the chip)

## Funds (`funds`, `empty-funds`, `loading-funds`, `error-funds`)
**Five seconds:** For: my USDC and each remora's budget. First click: can't tell. The only top button is "Detect funds", and there's no Add or Deposit.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G1-funds-1 | filled, empty · desktop | Major | The main action is unclear. "Detect funds" doesn't say what it does. On a new account the setup card says "Next: Add USDC" and the checklist button says "Add funds", yet Funds offers no deposit address, QR code or faucet. | Primary "Add USDC": a panel with the address, a copy button, a QR code and a test-USDC faucet link. Rename "Detect funds" to "Refresh balance" and make it an icon button. |
| R0G1-funds-2 | filled · desktop | Major | Budgets lists one row, "e2e-burner", a name that matches none of the 31 remoras. Home shows 13 Researchers with "Budget not readable just now". The page doesn't say the others couldn't be read. | One row per spending remora, with face and name. An unreadable one gets a grey meter with "?" and a retry. Add a header count ("1 of 13 read"). |
| R0G1-funds-3 | filled · desktop | Major | The budget is a small grey sentence, "0.00 of 0.10 USDC spent · up to 0.01 a payment · 1 payee · until 11/18/2026", under a hairline track. The key number isn't the biggest thing, and the date has no relative form. | Make "0.00 / 0.10 USDC" large beside a real meter bar. Put chips under it: "≤ 0.01 per payment", "1 payee", "ends in 14 days" (the full date on hover). |
| R0G1-funds-4 | all · desktop | Major | "Where it goes" draws the money path as a sentence with arrows: "USDC in coins → your address balance → each remora's spending limit → a merchant. A spending limit can only spend what is already in your address balance, and only up to its cap." | A 4-node flow diagram with live amounts on the nodes: Coins $0.00 → Balance 19.78 → Limits 0.10 → Merchants. Turn the rule into a `?` hint on the limit node. |
| R0G1-funds-5 | all · desktop | Minor | "In coins", "address balance" and "Advanced: withdraw to a coin" are unexplained jargon to a newcomer, and the difference between the two balances is the point of the tiles. | Add a `?` hint on "In coins": "USDC objects in your wallet; remoras spend only the address balance". |
| R0G1-funds-6 | all · desktop | Minor | The limit rule is said three times: the subtitle ("only within their spending limits"), the tile ("Remoras spend this within their spending limits.") and Budgets ("Each remora spends only within its spending limit, which Sui enforces, not us."). | Keep one, as a "Sui-enforced" shield chip on the Budgets header. |
| R0G1-funds-7 | loading, error · desktop | Blocker | The "In coins" tile shows "$—" next to a green "✓ Nothing to move", an all-clear given while the number is unknown (the same on error). | Hide the status line until the balance loads. On error, show a grey "?". |
| R0G1-funds-8 | error · desktop | Major | The error is a lone red "down" above the tiles. It doesn't say what failed or what to do. | "Couldn't read your balance from Sui. Retry" (8 words) with a Retry button, in the shared error card. |
| R0G1-funds-9 | empty · desktop | Minor | The Budgets empty state uses a wallet icon, not a face. The line and the "Create a remora" button are good. | Swap the icon for the remora face. |

**Words that could go:** "A short version of the money path.", "Remoras spend this within their spending limits.", "which Sui enforces, not us" (becomes a chip), "Remoras spend USDC from your address balance, only within their spending limits."

## Verify (`verify`, `out-verify`)
**Five seconds:** For: checking that a receipt is real on Sui. First click: the input, then "Verify", but a newcomer has nothing to paste.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G1-verify-1 | filled, out · desktop | Major | The page needs a digest no newcomer has. There's no "Try a sample receipt", and a signed-in owner with dozens of paid answers doesn't see their own receipts. | Add a "Try a sample" chip under the input. When signed in, show a "Your recent receipts" list of 5 rows (amount, payee, relative time, Verify). After checking, turn the four "What we check" cards into the result checklist (green or red ticks). |
| R0G1-verify-2 | filled, out · desktop | Minor | Jargon: "transaction digest", "receipt id", "through Tatum", "The intent hash matches". | Use "Paste a receipt link or Sui transaction ID" with a `?` hint, and drop the vendor name from the subtitle. On the first card: "What it said it would do matches what it did". |
| R0G1-verify-3 | filled, out · desktop | Nit | The subtitle breaks at the hyphen: "no sign-" / "in needed." | Widen the subtitle or use a non-breaking hyphen. |

**Words that could go:** "Nothing here asks you to take Remora's word.", "We check it against Sui through Tatum;"

## Across pages
| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G1-x-1 | all · desktop | Minor | Money has mixed units: "$19.78" (Funds), "$0.00" (Home tile), "19.78 USDC" (footer), "0.02 USDC" (Approvals), "$1 budget" next to "1.00 USDC" (Try a Researcher). | Use one format everywhere: "19.78 USDC". |
| R0G1-x-2 | filled · desktop | Minor | Status words differ for the same idea: "active" or "practice" chips (Home cards), a "live" chip (Funds budget), "is live" (Activity), "pending" (Approvals), and the face legend ("watching", "paid", "blocked a payment"). | One status vocabulary, with one chip style, shared with the face legend. |
| R0G1-x-3 | all · desktop | Minor | Checking a receipt has three names: "Check a receipt" (signed-out Home), "Verify a receipt" (page title), "Verify" (rail). | Use "Verify a receipt" and "Verify". |
| R0G1-x-4 | empty, filled · desktop | Minor | Setup has four names: "Set up Remora" (heading and section), "Get started" (breadcrumb), "Set up" (sidebar card), and "Already at home here?" on Home. Its count is "1 of 3 done" or "1/3" over four rows. | Use one name ("Set up") and one count. |
| R0G1-x-5 | error · desktop | Minor | Each page fails differently: Home falls back to onboarding without a word, Approvals and Funds print a red "down", and Sign in writes a sentence. | One error card everywhere: face, at most 12 words (what happened and what to do), Retry. |
| R0G1-x-6 | empty · desktop | Minor | Empty states differ: Approvals has an inbox icon and no button, Funds Budgets has a wallet icon and a button, and Home has the explainer. The rubric asks for a face, a line and a button. | One empty-state component: face, one line, one button. |
| R0G1-x-7 | filled · desktop | Minor | The face shows in the list and on Home cards but is missing on Approval cards, Funds budget rows and Activity rows, the places that name a remora. | Put the small face next to every remora name. |
| R0G1-x-8 | loading · desktop | Minor | Loading looks different on each page: Home shows zeros, Funds shows "$—", Approvals is blank, and the shell list shows the new-account state. | Use skeletons of the final shape everywhere, and "—" for unknown numbers. |

**Counts:** Blocker 7 · Major 14 · Minor 35 · Nit 5
