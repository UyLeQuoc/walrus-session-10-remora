# Round 2 review, G1: getting started and money (desktop)

Persona: a hackathon judge with three minutes who knows a little crypto and has never heard of the product. I judged only the pictures. Motion can't be judged from stills, except where a still shows a moving element (the Flow's dot). `public-receipt` was captured signed in only, so the stranger's view of a shared proof isn't in the set.

## Previous findings
- R1G1-shell-1: fixed. The list shows five skeleton rows while it loads and "Can't load your remoras. Retry" on error. One leftover: the "Needs you" section and the rail's Approvals "2" badge still vanish while loading and on error (R2G1-shell-2).
- R1G1-home-1: fixed. "Ready to spend 19.78 USDC" matches Funds and the footer.
- R1G1-home-14: fixed. The error shows "Your remoras show once Remora is back." and "The activity shows once Remora is back.", with no empty state.
- R1G1-home-2: not fixed. The cards now say "No spending limit onchain: it can't spend" over an empty track, but every card still carries a green "active" chip right next to "it can't spend", and the list still says "Researcher · live" with a green dot. The card also gives no way to fix the missing limit (R2G1-home-1).
- R1G1-funds-1: fixed. The spent amount comes first, the track shows at zero, and the chips read "≤ 0.01 USDC a payment", "1 payee" and "ends in 15 days". The amount is still body-size and the track is barely visible (R2G1-funds-2).
- R1G1-verify-1: fixed for the part that was accepted. Signed out, Verify now says "No receipt yet? A Researcher makes one in a minute." with a "Try a Researcher" button.

Declined findings, rechecked against the pictures:
- G1 home-8, as the triage names it ("fold a payment into its answer", R1G1-home-3): the reason holds. Each payment row sits directly under its answer, inside the same day group.
- G1 verify-1 signed out (a sample receipt): the reason doesn't hold. A sample needs one known receipt, not a list, and the "Shared proof" page (`public-receipt`) shows that a public, no-sign-in proof of a real receipt exists. Raised again as R2G1-verify-3.

Fixed in the pictures though the triage doesn't list them: R1G1-home-8 (the sidebar's "Sign in" is now secondary), R1G1-x-4 (Funds' empty state has the face), R1G1-verify-2 in part (the placeholder is "Receipt id or Sui transaction" and the first check is "It did what it said").

Moved to round 3 and still visible: R1G1-shell-2 (the red "Pause all" pill, even on a new account), R1G1-shell-4 (green and orange status dots with no legend; orange also means "needs you"), R1G1-shell-5 ("0xd9703e08d...917f634757"), R1G1-home-9/-10/-11 (the kinds described twice, the setup shown twice, the "Remora" breadcrumb), R1G1-home-16 (two skeleton cards for six), R1G1-playground-2/-3, R1G1-onboarding-1/-2/-3, R1G1-sign-in-1, R1G1-approvals-1/-2/-3, R1G1-funds-2/-3/-4, R1G1-verify-3/-4/-5, R1G1-x-1/-2/-5/-6. Where one of these still matters, it's repeated below under a fresh ID.

## Shell: rail, top bar, remora list (`home`, `loading-home`)
**Five seconds:** For: moving between Home, Chat, Approvals, Funds and my remoras, with what's waiting on top. First click: a "Needs you" row.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G1-shell-1 | filled · desktop | Minor | The "Needs you" rows cut the name to "Researcher m..." to make room for the "0.02 USDC" chip, so the two waiting payments look identical. Approvals names them "Researcher mvi9nqpw" and "Researcher mvee216v". | Give the name the full first line and move the amount to the second: "0.02 USDC · wants your yes". |
| R2G1-shell-2 | loading, error · desktop | Minor | While loading and on error, the "Needs you" section and the rail's Approvals "2" badge disappear (`loading-home`, `error-home`, `loading-approvals`, `error-approvals`, `loading-funds`, `error-funds`). The one "something waits on you" signal blinks off whenever the API is slow. | Keep the badge, with a grey "·" while loading. On error, keep the last count, greyed. |
| R2G1-shell-3 | filled · desktop | Nit | Each "Needs you" face has two badges, an orange "!" at the top right and a small orange face at the bottom right, beside an orange chip: three orange marks on a 60 px row. | One badge, the "!", and let the chip carry the amount. |
| R2G1-shell-4 | loading · desktop | Nit | The skeleton rows use rounded squares; the faces they stand in for are circles, triangles and drops. | A circle placeholder at the face's size. |

**Words that could go:** "wants your yes" (once the chip and the section title say it), "Researcher" in "Researcher · live" under names that already start with "Researcher".

## Home (`home`)
**Five seconds:** For: my remoras, what's waiting on me, my balance and what they did. First click: "2 Review →".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G1-home-1 | filled · desktop | Major | All six cards show a green "active" chip on the same card as "No spending limit onchain: it can't spend", and the list calls every one "live" with a green dot. A judge reads "working" and "can't spend" at once, about the product's main promise. The card offers no way out: no "Set a limit" button, and the empty track is a meter of a limit that doesn't exist. | When there's no limit: a grey "can't spend" chip in place of "active", a dashed outline in place of the track, and a small "Set limit" button. Use the same chip in the list (R2G1-x-1). |
| R2G1-home-2 | filled · desktop | Minor | The question "Is the package 0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95e3c69e88434a5d6d safe to depend on?" fills the row, so its "10h ago 👍 👎 Why?" drops to a new line on the left. Every other row keeps that column on the right. | Shorten ids in titles to "0xcc05…5d6d", with the full id on hover, and keep the meta column fixed on the right. |
| R2G1-home-3 | filled · desktop | Minor | A payment row ends in "tx ↗", a jargon link to the explorer, but nothing on Home opens its receipt or Verify, the product's proof. | Replace "tx ↗" with a "Receipt ›" chip that opens the verify result, and keep the explorer link as an icon. |

**Words that could go:** "Your remoras at a glance.", "Researcher" (the kind line under six names that start with "Researcher"), "No spending limit onchain:" (the chip can say "can't spend")

## Home, new account and signed out (`empty-home`, `out-home`)
**Five seconds:** For: learning what a remora is and setting one up. First click: "Add funds" (new account), "Try a Researcher, no wallet" (signed out).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G1-start-1 | empty, out · desktop | Minor | The two kinds share one picture: the Researcher and Wallet watcher tiles use the identical cyan face. 150 px lower, "Start from a template" draws the same two kinds as a cube icon and a shield, and the list uses a different face again. | One kind badge per kind (a shape and a colour), used in the explainer, the templates and the list. |
| R2G1-start-2 | empty, out · desktop | Minor | Setup progress is drawn twice, in two ways: a white underline under "Set up Remora" that reads as a selected tab ("1 of 3 done" at the far right), and the sidebar card's thin bar with "1/3". Signed out, one screen asks for a wallet three times: the checklist's "Sign in", the card's "Next: Connect your wallet" and the sidebar's "Sign in". | Draw the progress as a 3-segment bar with "1 of 3" beside it, and hide the sidebar card while the checklist is on screen. |
| R2G1-start-3 | empty, out · desktop | Nit | The face legend is six faces about 18 px tall that differ only in their eyes; "watching" and "thinking" look the same. | Move it to the `?` on "What's a remora?", or draw the faces at 28 px. |
| R2G1-start-4 | empty, out · desktop | Nit | The Flow's nodes have uneven widths (Remora about 88 px, Your wallet and Receipt about 128 px). Only the Remora → Paid service edge is drawn at visible contrast. | Equal node widths, and every edge visible. |

**Words that could go:** "Already at home here? Open the chat.", "An AI agent with a budget it can't break." (the subtitle already says "a budget Sui enforces"), the two template descriptions (they repeat the kind tiles)

## Home, loading and error (`loading-home`, `error-home`)
**Five seconds:** For: Home while data loads (loading); Home that can't reach the server (error). First click: nothing yet (loading); "Retry" (error).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G1-home-4 | error · desktop | Minor | Under "Can't reach Remora right now.", the "Remoras" and "Waiting for you" tiles keep their loading bars, while "Ready to spend" shows "—". Bars say "coming", but nothing is coming. | "—" in every tile under an error. |
| R2G1-home-5 | error · desktop | Minor | "Ready to spend —" sits a few inches from the footer's "19.78 USDC". Either the balance is known or it isn't. | Show the footer's value in the tile, marked "from Sui", or grey the footer amount with "as of 2m ago". |

**Words that could go:** "Your limits still hold." (keep it only if it's the one reassurance; it's 5 words of 10)

## Try a Researcher (`out-playground`, `playground`)
**Five seconds:** For: trying a Researcher with a 1 USDC limit and no wallet. First click: "Start my Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G1-playground-1 | out, filled · desktop | Minor | The steps row ("1 Start, 2 Ask, 3 It pays, 4 Check the receipt") and the Flow below it are two strips off one grid: "3 It pays" starts at about 815 px, "Paid service" at 823 px, "4 Check the receipt" at 1028 px and "Receipt" at 1019 px. They tell the same sequence twice. | Put the step number on each node ("1 · Spending limit 1.00 USDC") and drop the steps row. |
| R2G1-playground-2 | out, filled · desktop | Nit | The subtitle says "a 1 USDC limit"; the node and the tile say "1.00 USDC". | "1.00 USDC" in all three. |
| R2G1-playground-3 | filled · desktop | Nit | Signed in, nothing in the rail or the list is highlighted on this page. | Highlight Home, or list "Try a Researcher" under Remoras when signed in. |

**Words that could go:** "answers" (under "Your Researcher"), "Not kept in memory." (as a `?` hint)

## Set up (`onboarding`, `empty-onboarding`)
**Five seconds:** For: a setup checklist. First click: "Add funds" (new account); when done, only the optional "Link Telegram".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G1-onboarding-1 | filled · desktop | Minor | "3 of 3 done" is still a dead end: three ticks, the optional "Link Telegram", and 500 px of empty page. | When complete: the happy face, "You're set", and a primary "Ask your first question". |
| R2G1-onboarding-2 | filled, empty · desktop | Minor | One page, three names: the breadcrumb "Get started", the title "Set up Remora", the section "Set up Remora", and the sidebar card "Set up". Signed in, the subtitle still asks "Sign in with your wallet…" above a ticked "Connect your wallet". No rail item is highlighted. | Call it "Set up" everywhere. Drop the subtitle when signed in, and highlight Home. |

**Words that could go:** "Sign in with your wallet to keep your remoras, memory and budget in one place." (signed in), the second "Set up Remora"

## Sign in (`out-sign-in`)
**Five seconds:** For: connecting a Sui wallet when none is installed. First click: "Get Slush ↗" or "Try without a wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G1-sign-in-1 | out · desktop | Minor | "Slush, or any other Sui wallet in this browser." is followed straight away by "No Sui wallet in this browser.", and a desktop shows "On a phone, open this page in the Slush app." | With no wallet: the title "No Sui wallet found", one line "Get Slush, or try Remora without one.", then the two buttons. Show the phone line only on a phone. |

The close button shows a visible focus ring, which is good.

**Words that could go:** "Slush, or any other Sui wallet in this browser.", "On a phone, open this page in the Slush app." (on desktop)

## Approvals (`approvals`, `empty-approvals`, `loading-approvals`, `error-approvals`)
**Five seconds:** For: saying yes or no to a payment over a remora's cap. First click: "Pay once (0.02 USDC)".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G1-approvals-1 | filled · desktop | Minor | The meter is a full red bar, with "its cap: 0.015 a payment" and "over the cap" under it. Nothing marks where the cap sits, so it reads as 100% of something, and 0.015 has no unit. | Scale the track to 0.02, put a tick at 0.015 labelled "cap 0.015 USDC", and colour only the part past it: "+0.005 USDC over". |
| R2G1-approvals-2 | filled · desktop | Minor | Both requests are for "What are the odds for tonight's match?", asked 13 and 16 days ago, and both still offer a white "Pay once". Their age is small grey text at the far top right. | Next to the amount, an amber chip "asked 13 days ago" when a request is older than a day, or expire old requests into Decided as "expired". |
| R2G1-approvals-3 | loading, error · desktop | Minor | The tab reads "Waiting (...)" while loading and still reads "Waiting (...)" under "Couldn't load approvals.", so the error state looks like it's still loading. The loading cards are plain blocks split down the middle, not the card's shape. | "Waiting (—)" on error. Loading cards with a name bar, an amount bar, a meter bar and two button blocks. |

The empty state (face, "You're all caught up.", "See decided") and the error line ("Couldn't load approvals. Nothing pays without you." with Retry) work.

**Words that could go:** "its" (in "its cap:"), "You pay it once," (the button says "Pay once")

## Funds (`funds`, `empty-funds`, `loading-funds`, `error-funds`)
**Five seconds:** For: my USDC and each remora's spending limit. First click: "Add USDC".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G1-funds-1 | filled, loading, error · desktop | Minor | The one spending limit is titled "e2e-burner", with no face and no remora name. On an account of 31 remoras, whose Home cards all say "can't spend", a judge can't tell which remora this limit lets spend. | Show the face and remora name on the row. Above the list, a count: "1 of 31 remoras can spend". |
| R2G1-funds-2 | filled · desktop | Minor | "0.00 / 0.10 USDC spent" is body-size, smaller than the "e2e-burner" title, and the track at zero is only a shade lighter than the card (below 3:1). The key number is still not the biggest thing on the row. | Set the amount at 20 px, bold, and give the track at least 3:1 contrast against the card. |
| R2G1-funds-3 | error · desktop | Minor | Under "Couldn't read your balance from Sui.", both tiles keep their loading bars, while Home's error shows "—" for the same "Ready to spend". On the same screen, the footer shows "19.78 USDC" and the onchain limit "0.00 / 0.10 USDC" reads fine, so blaming Sui looks wrong. | "—" in both tiles. Grey the footer amount with "as of …". Name the right source in the error: "Couldn't load your balance. Retry." |
| R2G1-funds-4 | empty · desktop | Minor | On a 0.00 USDC account, the empty state's white "Create a remora" is as loud as "Add USDC", while the sidebar says the next step is "Add USDC". | Make "Create a remora" secondary until there's money. |

**Words that could go:** "Advanced:", "Nothing to move" (0.00 says it)

## Verify (`verify`, `out-verify`)
**Five seconds:** For: checking that a payment receipt is real on Sui. First click: a row's "Verify" (signed in), "Try a Researcher" (signed out).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G1-verify-1 | filled · desktop | Minor | "Your recent receipts" is five identical rows, "Sui risk check 0.01 USDC 10h ago Verify", with no remora and no id. The amount column also shifts per row (x ≈ 938, 940, 943), because "10h ago", "11h ago" and "3d ago" have different widths. | Each row: the face, the remora's name, the payee, the amount in a fixed right-aligned column, the relative time and "0x8f3a…c21b". |
| R2G1-verify-2 | filled, out · desktop | Minor | One page, three right edges: the input row ends at about 1052 px, the lists at about 1147 px, and the verify result at 1403 px (`verify-receipt`). | One column width for the input, the lists and the result. |
| R2G1-verify-3 | out · desktop | Minor | Signed out, the checks never light up without first spending a minute on a Researcher. The decline said no public list exists, but a sample needs only one receipt, and the "Shared proof" page proves a public one exists. | A "See a sample" chip under the input that fills in one shared proof's id and runs it. |
| R2G1-verify-4 | out · desktop | Minor | Two white primary buttons: "Verify", next to an empty input, and "Try a Researcher". | Disable "Verify" until something is typed. |

**Words that could go:** "No sign-in needed." (when signed in), "In the transaction you pasted." (it's wrong when you verify from the list)

## Verify result (`verify-receipt`)
**Five seconds:** For: proof that one payment is real. First click: "Share proof".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G1-vreceipt-1 | filled · desktop | Blocker | "payTo balance change: 10000 of 10000". The same payment is "Pay 0.01 USDC" lower on the page. A raw base-unit count with no unit reads as 10,000 of something. | "The payee got 0.01 USDC (of 0.01 USDC)". |
| R2G1-vreceipt-2 | filled · desktop | Blocker | The check "decided before paying" passes, but its line reads "Receipt 2026-11-03T08:54:48.612Z, tx 2026-11-03T08:54:47.043Z, stored 2026-11-03T08:54:48.613Z". The receipt time is 1.6 s after the transaction, so the evidence reads as the opposite of the claim, in raw ISO with milliseconds. | A three-point timeline: "Decided 08:54:46 → Paid 08:54:47 → Saved 08:54:48 · Nov 3, 11h ago". Name the decision time, not the receipt write. |
| R2G1-vreceipt-3 | filled · desktop | Major | Before you verify, the page promises four plain checks ("It did what it said", "The payment is onchain", "The payee got the amount", "Its own key signed"). After, it shows six other checks named like code ("intent hash", "transaction succeeded", "Paid.intent matches", "payTo balance change", "decided before paying", "signed by the remora"), each over a full hash. A judge can't map the promise to the result. | Keep the same titles and turn each one green in place, adding "It decided before paying". Put the hash under a "Details" disclosure, in short form with copy. |
| R2G1-vreceipt-4 | filled · desktop | Major | The top of the result is "Verified" + "verified" + "The receipt matches the chain." Who paid, how much, to whom and when sit in the "Receipt" table below the fold, as the cell "Pay 0.01 USDC to Sui risk check". There's no face and no remora name anywhere. | A receipt card in the green banner: the face, "Researcher · demo paid **0.01 USDC** to Sui risk check", "Nov 3 · 11h ago", "✓ Verified on Sui". |
| R2G1-vreceipt-5 | filled · desktop | Minor | The Receipt table is raw and jargon: "Read 0 object(s) via Tatum", "Memories me (Yb9ZNt1rzqM0Av_NbwZ6Cno-5YUCwhSOPNNrN7ymWZw)", a two-line "Check" sentence that repeats itself ("payee allowed and listed; under per-payment cap; check model: Payee is authorized and amount is within limits"), "Model google/gemini-2.5-flash", and "Verify: Check it against the chain" on the page you just verified on. | "Check" as three ticks: "payee allowed ✓ · under cap ✓ · on list ✓". "Memories" as "1 memory · on Walrus ↗". Fold Trigger, Read, Model and Intent hash into "Details", and drop the Verify row. |
| R2G1-vreceipt-6 | filled · desktop | Minor | Full 64-character hashes and addresses with no copy under the intent hash, the transaction and the signer, while the table below shortens the transaction to "EWnMQxNb85...". One page, two forms. | "858b…1b94" with a copy icon everywhere, and an explorer link on the transaction and the signer. |

**Words that could go:** "verified" (the chip next to "Verified"), "saved onchain", "Verify: Check it against the chain"

## Shared proof (`public-receipt`)
**Five seconds:** For: a public proof of one payment, to send to someone. First click: can't tell. Nothing to click but copy icons, and the page has no "Verify it yourself" or "What's Remora?".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G1-proof-1 | filled · desktop | Major | The page meant for strangers leads with "Verified verified" and a table. The payment, "Pay 0.01 USDC to Sui risk check", is a body-size table cell, with no face and no picture. A stranger also gets no next step. | The same receipt card as R2G1-vreceipt-4 at the top, with 0.01 USDC as the biggest thing, and under it one action: "Check it yourself on Sui" (re-runs the checks), plus a quiet "What's Remora?". |
| R2G1-proof-2 | filled · desktop | Minor | "What happened" shows "Paid to", "Signed by", the transaction and the intent hash in full (64 hex characters), then "What we checked" prints the intent hash, the transaction and the signer in full again. | Short forms with copy and explorer links in the table. The checks refer to them ("✓ signed by 0x8aee…2ce3") without reprinting them. |
| R2G1-proof-3 | filled · desktop | Minor | "Paid to" is a raw address ("0x9964291010a5e3d455d030605e15df7e73c947d777b820e0625bf0b05acaf4a8") while "Action" names the payee "Sui risk check". | "Sui risk check · 0x9964…f4a8 ↗". |

The checks on this page are the same block as on the Verify result and carry R2G1-vreceipt-1, -2 and -3 unchanged: "10000 of 10000", the timestamps out of order, and the code-named titles.

**Words that could go:** "verified" (the chip), "checked against Sui" (the banner says it)

## Across pages
| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G1-x-1 | filled · desktop | Major | "Can this remora spend?" is answered three ways. The list says "Researcher · live" with a green dot. A Home card says "active" in green and "it can't spend" in grey. Funds says "e2e-burner live 0.00 / 0.10 USDC", with no remora. A judge can't find which remora can spend what. | One spend status (can spend · can't spend, no limit · paused · needs you), as one chip and one dot, on the list, the cards and the Funds rows. Every limit row names its remora. |
| R2G1-x-2 | filled · desktop | Minor | One receipt, four layouts: the Home feed row (amount, "tx ↗", "Why?"), the Verify list row (amount, "Verify", no remora), the Verify result's "Receipt" table (Decision, Reason, Trigger, Read, Memories, Check, Model…), and Shared proof's "What happened" (Remora, Action, Paid to, When, Signed by…). The same field is "Decision" on one page and "Action" on another. | One receipt card (face, remora, payee, amount, relative time, Verify ›) in the feed and the lists, and one detail table with the same labels on Verify and Shared proof. |
| R2G1-x-3 | filled · desktop | Minor | Hashes and addresses come in three forms: "0xd9703e08d...917f634757" (footer, 10 + 10 characters), "EWnMQxNb85..." (Receipt table, head only), and the full 64 characters (checks, Shared proof). | One short form, "0xd970…4757", with copy, and an explorer link where there's a page. |
| R2G1-x-4 | loading, error · desktop | Minor | "Not known" is drawn three ways: a loading bar kept under an error (`error-home` tiles, `error-funds` tiles), "—" (`error-home` Ready to spend), and "(...)" (Approvals' tab while loading and on error). | A skeleton while loading and "—" on error, everywhere. |
| R2G1-x-5 | filled, empty · desktop | Minor | The face changes from page to page: coloured with two badges in "Needs you", grey and monochrome on Approval cards, tiny in Activity, one shared cyan face for both kinds in the explainer, a cube and a shield on the templates, and missing on the Funds limit row, the Verify rows, the Verify result and Shared proof. | The same coloured face next to every remora name, and one kind badge. |
| R2G1-x-6 | all · desktop | Minor | The same generic Flow (Your wallet → Spending limit → Remora → Paid service → Receipt), with its dot on Remora → Paid service, appears on Home's explainer, Try a Researcher and Funds' "Where it goes". On Funds it carries none of the account's numbers, so the dot moves while nothing is changing. | Drop it from Funds, or put live amounts on its nodes. Run the dot only while a payment is in flight, and respect reduced motion. |
| R2G1-x-7 | filled · desktop | Minor | Dates come in four forms: "Nov 3" and "Oct 31" in the list (yesterday shown as a date), "13d ago" on Approvals, "10h ago" and "11h ago" in the feed and on the proof, and "2026-11-03T08:54:48.612Z" in the checks. | Relative everywhere ("yesterday", "13 days ago"), with the full date on hover. Never raw ISO. |
| R2G1-x-8 | empty, out, filled · desktop | Minor | Names still differ for one thing. Adding money is "Add funds" (the checklist button) and "Add USDC" (the step, the sidebar card, the Funds button). The spendable balance is "Ready to spend" (Home and Funds), "Your wallet · USDC stays yours" (the Flow) and "from your wallet" (Approvals). Setup is "Set up Remora", "Set up", "Get started" and "Remora". | "Add USDC", "Ready to spend" and "Set up", each everywhere. |

**Counts:** Blocker 2 · Major 5 · Minor 34 · Nit 6
