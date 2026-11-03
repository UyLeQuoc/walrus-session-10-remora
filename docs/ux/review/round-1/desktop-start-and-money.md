# Round 1 review, G1: getting started and money (desktop)

Reviewer persona: hackathon judge, three minutes, a little crypto, never heard of the product. Pictures only.
`verify-receipt` and `public-receipt` were not captured, so the verify result (the checks lighting up) and the public receipt page could not be judged.

## Previous findings
- R0G1-shell-1: not fixed. The setup card is gone, but while loading or failing the remora list still shows the new-account state ("Import a team...", empty "Rooms"), and "Needs you" and the rail's Approvals "2" badge vanish (`loading-home`, `error-home`, `loading-approvals`, `error-approvals`, `loading-funds`, `error-funds`).
- R0G1-home-1: not fixed. The "Ready to spend" tile on the filled Home is now empty (a label with no number, no "—" and no skeleton), while the footer and Funds both say "19.78 USDC".
- R0G1-home-2: not fixed. Five of six cards still carry the grey sentence "Limit not readable now", the sixth has nothing under its name, and there's no meter and no retry.
- R0G1-home-3: fixed
- R0G1-home-4: fixed
- R0G1-home-5: fixed
- R0G1-home-8: not fixed. Each paid answer is still followed by its own "Sui risk check 0.01 USDC" row, and the answers word the cost differently ("Source: Sui risk check (0.01 USDC)", "Cost: 0.01 USDC from Reef", "This cost me $0.").
- R0G1-home-9: fixed
- R0G1-home-11: fixed
- R0G1-home-12: fixed
- R0G1-home-13: not fixed. The checklist's "Sign in" is now secondary, but the sidebar's full-width white "Sign in" is still as loud as "Try a Researcher, no wallet".
- R0G1-home-14: fixed
- R0G1-home-18: fixed
- R0G1-home-19: not fixed. The Problem banner is there, but under it "Your remoras" says "No remoras yet." with a "Create a remora" button and Activity says "Nothing yet.", on an account with 31 remoras.
- R0G1-playground-1: fixed
- R0G1-playground-3: fixed
- R0G1-sign-in-1: fixed
- R0G1-approvals-1: fixed
- R0G1-approvals-5: fixed
- R0G1-approvals-6: fixed
- R0G1-funds-3: not fixed. "0.00 of 0.10 USDC spent" is still small grey text, no meter track shows at 0 spent, and "until Nov 18" has no relative form.
- R0G1-funds-4: fixed
- R0G1-funds-6: fixed
- R0G1-funds-7: fixed
- R0G1-funds-8: fixed
- R0G1-verify-2: not fixed. The placeholder still says "Transaction digest or receipt id" and the first check still says "The intent hash matches the receipt." (Tatum is gone from the subtitle.)
- R0G1-x-1: not fixed. Balances are in USDC now, but Try a Researcher still says "$1 limit" two lines above "1.00 USDC".
- R0G1-x-5: fixed
- R0G1-x-6: not fixed. Approvals and Home use the face, but Funds' "No spending limits yet" still uses a wallet icon.
- R0G1-x-8: not fixed. The pages use skeletons now, but the shell list still falls back to the new-account state while loading (see R1G1-shell-1).

Moved to round 2 and still visible: shell-3 (seven identical "Researcher · demo" rows, "Researcher mvi..." and "Researcher mv..." cut off), shell-4 (previews "You answer the owner's questi..."), shell-6 (the orange "Approve" chip), home-6 (the full "0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95e3c69e88434..." id in a question on Home).

## Shell: rail, top bar, remora list (`home`, `loading-home`)
**Five seconds:** For: moving between Home, Chat, Approvals, Funds, Memory and my remoras. First click: a "Needs you" row.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G1-shell-1 | loading, error · desktop | Blocker | While loading or failing, the list shows the new-account state: "Remoras +", "Import a team...", "Rooms +". "Needs you" and the rail's "2" badge on Approvals disappear. It tells a 31-remora owner they have none and nothing waits (R0G1-shell-1 again). | 6 to 8 skeleton rows (face circle, two bars) while loading; keep the badge as "…". On error keep the last list with a grey "offline" dot on the Remoras heading. |
| R1G1-shell-2 | all · desktop | Minor | The red "Pause all" pill is the loudest thing in the top bar on every page, including a brand-new account with nothing to pause (`empty-home`, `empty-approvals`, `empty-funds`). Round 0's shell-2 wasn't triaged. | Hide it when nothing is live. Otherwise a quiet pause icon button with a "Pause all remoras" tooltip and a confirm. |
| R1G1-shell-3 | error · desktop | Minor | On `error-funds` the page says "Couldn't read your balance from Sui." while the footer still says "19.78 USDC" with no hint that it's old. | Grey the footer amount and add "as of 2m ago" on hover, or show "—" while the balance read is failing. |
| R1G1-shell-4 | filled · desktop | Minor | The status dot on each face is green on Researchers and orange on Wallet watchers, with no legend or label. Orange is also the "Needs you" badge and the "Approve" chip, so one colour has two meanings. Round 0's shell-5 wasn't triaged. | A tooltip and aria-label on the dot ("live", "practice"), and a hollow ring for practice so orange stays "needs you". |
| R1G1-shell-5 | all · desktop | Nit | The footer address "0xd9703e08d...917f634757" is a 20-character short form in monospace. | "0xd970…4757" with a copy icon. |

**Words that could go:** "Asks you to approve a payment" (under each "Needs you" row; the chip says it)

## Home (`home`)
**Five seconds:** For: my remoras, what waits on me and what they did. First click: "2 Review →".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G1-home-1 | filled · desktop | Blocker | The "Ready to spend" tile is blank: a label and no number, while the footer and Funds both show "19.78 USDC". The one money number on Home is missing, and the tile looks the same as the loading state. | Fill it from the same balance as Funds ("19.78 USDC", big). While unknown, a skeleton bar; on failure "—" with a retry icon. |
| R1G1-home-2 | filled · desktop | Major | Every card has a green "active" chip, five say "Limit not readable now" and the sixth has an empty line. The spending limit is the product's promise, and here it's a grey sentence on every card with no meter or retry. Per the round-0 triage these limits were revoked by the test setup, so "not readable now" (a passing fault) also misreports the state. | One meter on every card: "0.00 / 0.10 USDC". Revoked: a grey empty meter labelled "No limit · revoked" and a "can't spend" chip instead of "active". Unknown: a skeleton meter, then "?" with a retry icon. |
| R1G1-home-3 | filled · desktop | Minor | Each paid answer is two rows (the answer, then "Sui risk check 0.01 USDC"), and the answers state the cost three ways: "Source: Sui risk check (0.01 USDC)", "Cost: 0.01 USDC from Reef", "This cost me $0." (R0G1-home-8 again.) | Fold the payment into the answer row as one receipt chip: "0.01 USDC · Sui risk check · Verify ›". Drop the separate row when it belongs to an answer. |
| R1G1-home-4 | filled · desktop | Minor | Answer text runs two sentences together: "immutable.Source: Sui risk check (0.01 USDC)", "capability.Cost: 0.01 USDC from Reef". | Keep the line break when rendering, or lift the source line out into the receipt chip above. |
| R1G1-home-5 | filled · desktop | Minor | Payment rows read "Sui risk check 0.01 USDC 10h ago Why?": no verb ("paid") and no way to the receipt. A judge can't get from a payment on Home to its proof. | "Paid 0.01 USDC to Sui risk check", with the amount as a chip that opens the receipt or Verify. |
| R1G1-home-6 | filled · desktop | Minor | Activity stops after 8 rows with no "See all" link, unlike "Your remoras" ("See all 31"). | Add "See all activity ›" at the bottom right of the feed. |
| R1G1-home-7 | filled · desktop | Nit | Thumbs up, thumbs down and "Why?" sit on every answer row, three controls per row. | Show them on hover or focus. |

**Words that could go:** "Your remoras at a glance.", "Researcher" (the kind line under six names that already start with "Researcher")

## Home, new account and signed out (`empty-home`, `out-home`)
**Five seconds:** For: learning what a remora is and setting one up. First click: "Add funds" (new account), "Try a Researcher, no wallet" (signed out).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G1-home-8 | out · desktop | Minor | The sidebar's full-width white "Sign in" has the same weight as the hero's "Try a Researcher, no wallet", so two main actions compete (R0G1-home-13 again). | Make the sidebar "Sign in" a secondary (outlined) button on every signed-out page. |
| R1G1-home-9 | empty, out · desktop | Minor | The two kinds are described twice on one page: in the explainer ("Answers questions, buys the data it needs", "Watches your wallets, pings what matters") and again in "Start from a template" ("Answers questions by buying the best data, and learns...", "Watches your wallets and only wakes you for what matters..."). | Make the explainer's two kind tiles the template buttons (click to start) and drop "Start from a template", or drop the kind row. |
| R1G1-home-10 | empty, out · desktop | Minor | The setup checklist shows twice on the same screen: the page's "Set up Remora · 1 of 3 done" and the sidebar's "Set up 1/3 · Next: Add USDC". | Hide the sidebar card on Home and on Set up, where the checklist is already on screen. |
| R1G1-home-11 | empty, out · desktop | Minor | The breadcrumb says "Remora" while the rail highlights Home, and the filled Home's breadcrumb says "Home". Round 0's home-16 wasn't triaged. | "Home" in every state. |
| R1G1-home-12 | empty, out · desktop | Minor | The explainer's Flow (Your wallet → Spending limit → Remora → Paid service → Receipt) has no memory node, though the line above it promises "Memory you can read". Only the Remora → Paid service edge is visible; the other edges are almost the colour of the card. | Add a "Memory · on Walrus" node off the Remora node. Draw every edge at visible contrast and keep the moving dot on the active one. |
| R1G1-home-13 | empty · desktop | Nit | A brand-new account's list shows "Rooms › Team · No members yet". | Hide Rooms until a room has a member. |

**Words that could go:** "Already at home here? Open the chat.", "Answers questions by buying the best data, and learns which sources are worth it.", "Watches your wallets and only wakes you for what matters, learning from what you say."

## Home, loading and error (`loading-home`, `error-home`)
**Five seconds:** For: Home while data loads (loading); Home that can't reach the server (error). First click: nothing yet (loading); "Retry" (error).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G1-home-14 | error · desktop | Blocker | Under "Can't reach Remora right now. Your limits still hold.", "Your remoras" says "No remoras yet." with a "Create a remora" button, and Activity says "Nothing yet. Its work shows up here." The account has 31 remoras (R0G1-home-19 again). | Under an error, never show the empty state: keep skeleton cards greyed out, or one line "Your remoras show once Remora is back". |
| R1G1-home-15 | loading, error · desktop | Minor | The three tiles show only their labels with blank bodies, with no bar and no "—". Blank reads as "nothing", and it looks the same as the filled Home's broken "Ready to spend" tile. The same goes for Funds' two tiles (`loading-funds`, `error-funds`). | A skeleton bar where the number goes while loading; "—" on error. |
| R1G1-home-16 | loading · desktop | Minor | The remora skeleton is two cards in a three-column grid; the loaded page shows six, so the page jumps. | Six skeleton cards (two rows of three), each with a face circle and two bars. |

**Words that could go:** "Its work shows up here."

## Try a Researcher (`out-playground`, `playground`)
**Five seconds:** For: trying a Researcher with a 1 USDC limit, no wallet. First click: "Start my Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G1-playground-1 | out, filled · desktop | Minor | The subtitle says "a $1 limit"; the tile below says "1.00 USDC". | "Your own Researcher with a 1.00 USDC limit." |
| R1G1-playground-2 | out, filled · desktop | Minor | Two strips tell the same sequence one above the other: Steps ("1 Start, 2 Ask, 3 It pays, 4 Check the receipt") and the Flow ("Spending limit → Your Researcher → Paid service → Receipt"), with the step labels set off from the nodes. | One strip: put the step number and verb on each Flow node ("1 · Start · Spending limit 1.00 USDC") and drop the separate Steps row. |
| R1G1-playground-3 | filled · desktop | Minor | A signed-in owner of 31 remoras still gets "Get your own" at the top right. Round 0's playground-4 wasn't triaged. | When signed in, "New remora". |

**Words that could go:** "answers" (under "Your Researcher"), "Not kept in memory." (a `?` hint on the button)

The flow after "Start my Researcher" (ask, pay, receipt, limit revoked) isn't in the screenshots.

## Set up (`onboarding`, `empty-onboarding`)
**Five seconds:** For: a setup checklist. First click: "Add funds" (new account); when done, only "Link Telegram", so there's no real next step.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G1-onboarding-1 | filled · desktop | Minor | "3 of 3 done" is a dead end: three ticks, the optional "Link Telegram", and 500 px of nothing. Round 0's onboarding-1 wasn't triaged. | When complete, a happy face, "You're set" and a primary "Ask your first question"; keep Telegram secondary. |
| R1G1-onboarding-2 | filled, empty · desktop | Minor | Signed-in users see "Sign in with your wallet to keep your remoras, memory and budget in one place.", and "Set up Remora" repeats as the section label right under the heading. Round 0's onboarding-2 wasn't triaged. | When signed in, drop the subtitle and the second "Set up Remora". |
| R1G1-onboarding-3 | filled, empty · desktop | Minor | No rail item is highlighted on this page, so you can't tell where you are. | Highlight Home (Set up is reached from Home), or give Set up its own state. |

**Words that could go:** "Sign in with your wallet to keep your remoras, memory and budget in one place." (when signed in), the second "Set up Remora"

## Sign in (`out-sign-in`)
**Five seconds:** For: connecting a Sui wallet when none is installed. First click: "Get Slush ↗" or "Try without a wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G1-sign-in-1 | out · desktop | Minor | The subtitle "Slush, or any other Sui wallet in this browser." is contradicted by the next line, "No Sui wallet in this browser.", so it reads as two messages. | With no wallet: title "No Sui wallet found", one line "Get Slush, or try Remora without one.", then the two buttons. |

**Words that could go:** "Slush, or any other Sui wallet in this browser.", "On a phone, open this page in the Slush app." (show it only on a phone)

## Approvals (`approvals`, `empty-approvals`, `loading-approvals`, `error-approvals`)
**Five seconds:** For: saying yes or no to a payment over a remora's cap. First click: "Pay once (0.02 USDC)".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G1-approvals-1 | filled · desktop | Minor | The cap meter is a full red bar with "its cap: 0.015 a payment" and "over the cap" under it. Nothing marks where the cap sits on the bar, so it reads as 100% of something, and 0.015 has no unit. | Scale the track to the amount, put a tick at 0.015 labelled "cap 0.015 USDC", and colour only the part past the tick ("+0.005 over"). |
| R1G1-approvals-2 | filled · desktop | Minor | "You pay it once, from your wallet" doesn't show what's there, and "wallet" isn't a name Funds uses ("Ready to spend"). | A chip: "from Ready to spend · 19.78 USDC". |
| R1G1-approvals-3 | loading · desktop | Nit | The skeletons are plain blocks split down the middle, not the card's shape. | Name bar, big amount bar, meter bar and two button blocks. |

**Words that could go:** "its" (in "its cap:"), "You pay it once," (the button says "Pay once")

The empty state (face, "You're all caught up.", "See decided", "Waiting (0)") and the error card ("Couldn't load approvals. Nothing pays without you." with Retry) work.

## Funds (`funds`, `empty-funds`, `loading-funds`, `error-funds`)
**Five seconds:** For: my USDC and each remora's spending limit. First click: "Add USDC".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G1-funds-1 | filled, loading, error · desktop | Major | The spending limit, the product's key number, is small grey text: "0.00 of 0.10 USDC spent". No meter track shows at 0 spent (it's the card's colour), "until Nov 18" has no relative form, and "≤ 0.01 a payment  1 payee" is plain text with no unit on 0.01 (R0G1-funds-3 again). | "0.00 / 0.10 USDC" large beside a visible track. Chips under it: "≤ 0.01 USDC a payment", "1 payee", "ends in 14 days" (full date on hover). |
| R1G1-funds-2 | all · desktop | Minor | "Where it goes" is the same generic Flow as Home's explainer ("USDC stays yours", "e.g. 0.01 USDC"). On Funds it carries none of this account's numbers. | Put live amounts on the nodes: "Ready to spend 19.78" → "Limits 0.10 · 1 live" → "Remoras 31" → "Paid 0.05 this week" → "Receipts 5". |
| R1G1-funds-3 | all · desktop | Minor | "In coins" with "✓ Nothing to move", and "Advanced: withdraw to a coin", are unexplained. The difference between the two tiles is the point of the page. Round 0's funds-5 wasn't triaged. | A `?` on "In coins": "USDC held as coins. Remoras spend only Ready to spend." |
| R1G1-funds-4 | empty · desktop | Minor | On a 0 USDC account, the empty state's white "Create a remora" is as loud as "Add USDC", though the sidebar says the next step is "Add USDC". | Make "Create a remora" secondary here, or drop it until there's money. |

**Words that could go:** "Advanced:", "Nothing to move" (when In coins is 0.00, the number says it)

## Verify (`verify`, `out-verify`)
**Five seconds:** For: checking that a payment receipt is real on Sui. First click: a row's "Verify" (signed in); signed out, can't tell, because there's nothing to paste.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G1-verify-1 | out · desktop | Major | A signed-out judge has nothing to paste: no sample and no public receipts, so the four checks never light up for them. This is the page that proves the product's claim. Round 0's verify-1 wasn't triaged; the signed-in half (recent receipts) is done. | A "Try a sample receipt" chip under the input that fills in a real testnet receipt and runs it. |
| R1G1-verify-2 | filled, out · desktop | Minor | Jargon: the placeholder "Transaction digest or receipt id" and the first check's line "The intent hash matches the receipt." (R0G1-verify-2 again.) | Placeholder "Paste a receipt link or Sui transaction ID" with a `?` hint; first line "What it planned matches what it paid." |
| R1G1-verify-3 | filled · desktop | Minor | "Your recent receipts" is five identical rows, "Sui risk check 0.01 USDC 10h ago Verify", with no remora and no transaction id, so you can't tell them apart or match one to Activity. | Each row: the face and remora name, the payee, the amount, the relative time and a short id ("0x8f3a…c21b"). |
| R1G1-verify-4 | filled · desktop | Minor | Two loud Verify actions: the white "Verify" next to an empty input, and five row "Verify" buttons. The input row ends at about 1050 px and the lists at about 1150 px, off the same right edge. | Disable the top Verify until something is typed, and give the input row the lists' width. |
| R1G1-verify-5 | filled · desktop | Nit | "The payment is onchain: in the transaction you pasted." is wrong when you verify from your own list. | "In this transaction." |

**Words that could go:** "No sign-in needed." (when signed in)

## Across pages
| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G1-x-1 | filled · desktop | Minor | Status words differ: an "active" chip (Home cards), a "live" chip (Funds limit), green and orange dots (list), and the legend's "watching / thinking / paid / needs you / blocked a payment / paused" (Home explainer). Round 0's x-2 wasn't triaged. | One status vocabulary and one chip, shared with the face legend. |
| R1G1-x-2 | empty, filled, out · desktop | Minor | Setup has four names: "Set up Remora" (heading and section), "Get started" (breadcrumb), "Set up" (sidebar card), and "Remora" (the new Home's breadcrumb). Round 0's x-4 wasn't triaged. | One name, "Set up", in the heading, breadcrumb and card. |
| R1G1-x-3 | filled · desktop | Minor | The face changes from page to page: coloured with a status dot in the list and on Home cards, grey and monochrome on Approval cards, tiny in Activity, and missing on the Funds limit row and the Verify receipt rows. Round 0's x-7 wasn't triaged. | The same coloured face (with its badge) next to every remora name. |
| R1G1-x-4 | empty · desktop | Minor | Empty states differ: a face on Approvals and Home, a wallet icon with a bold title and a line on Funds' "No spending limits yet" (R0G1-x-6). | Funds uses the shared empty state: face, one line, one button. |
| R1G1-x-5 | empty, out · desktop | Minor | Adding money has two labels: "Add funds" (Home and Set up checklist buttons) and "Add USDC" (the step name, the sidebar's "Next: Add USDC", Funds' button). | "Add USDC" everywhere. |
| R1G1-x-6 | filled · desktop | Minor | The spendable balance has three names: "Ready to spend" (Funds and Home tiles), "Your wallet · USDC stays yours" (the Flow's first node) and "from your wallet" (Approvals). | Call it "Ready to spend" in all three. |
| R1G1-x-7 | filled · desktop | Minor | One payment looks three ways: the Activity row ("Sui risk check 0.01 USDC 10h ago Why?"), the Verify row ("Sui risk check 0.01 USDC 10h ago Verify") and the answer text ("Source: Sui risk check (0.01 USDC)"). The feed row can't verify and the Verify row has no remora. | One receipt row everywhere: face, remora, payee, amount, relative time, Verify. |

**Counts:** Blocker 3 · Major 3 · Minor 36 · Nit 5
