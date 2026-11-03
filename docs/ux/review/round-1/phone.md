# Round 1, phone review (Pixel 7, 412 px)

Only phone-specific findings. Sizes are CSS px (the shots are 2x). The usable screen is about 700 px between the top bar and the bottom bar. Not re-reported, because the triage moved them to round 2: the panic button and tap targets (R0P-shell-2, R0P-shell-6) and the landing gallery's desktop shots (R0P-landing-1).

## Previous findings
- R0P-shell-1: fixed. The bottom bar is now Home · Chat · Approvals · Funds · More, and the active tab is drawn. The new bar has its own layout fault, see R1P-shell-1.
- R0P-feed-1: not fixed. The feed rows now cut long text, but in `thread-researcher` the quoted question "Re: Is the package 0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95e3c6…" still runs off the right edge (R1P-thread-1).
- R0P-home-1: fixed. Home shows six remoras, "See all 31", and Activity starts about 1,100 px down instead of about 4,300.
- R0P-remoras-2: fixed. Kind chips ("All 31 · Researcher 15 · Wallet watcher 16") and no feed: the page is about 3,900 px instead of more than 9,000. It still has no search (R1P-remoras-2).
- R0P-conn-1: not fixed. Active tokens come first and the old ones fold into "Revoked or expired (6)". But every active card is still about 340 px, with the status pill alone on its own row, so the page is still about 4,700 px (R1P-conn-1).
- R0P-memory-1: fixed (the part triaged). There is one "Export" button, the orange warning is gone, and the first memory starts about 385 px down. Each row still leads with a blob id (declined, G3 memory-2).
- R0P-remora-2: fixed. Brain shows a visible "Remora ▾" select on both remoras. It is still a small chip about 32 px tall, not a full-width field.
- R0P-share-1: fixed. The file is folded behind "Show the file (560 bytes, public on Walrus)". No shot shows it opened, so how it wraps isn't checked.
- R0P-guide-1: fixed. Step 2 says "Connect a Sui wallet with the Sign in button" and the next section says "Every page in the menu, then three more."
- R0P-signin-1: fixed. The dialog says "On a phone, open this page in the Slush app" and offers "Get Slush ↗" and "Try without a wallet".
- R0P-landing-2: not fixed. "Problem" now renders in full. "How" (`landing-01-how`) still has about 640 px of black above card 02, and card 01 and the section title are missing. "Proof" (`landing-03-proof`) still has about 660 px of black under its three numbers (R1P-landing-1).
- R0P-x-1: not fixed. Home no longer says "$0.00", but in the filled account its "Ready to spend" tile is blank, while Funds says "19.78 USDC" (R1P-home-1).
- R0P-x-2: fixed on Home: no more zeros while loading, only blank tiles and skeleton rows. A new case of the same kind: Chat says "You have no remora yet" while it loads (R1P-chat-1).
- R0P-x-3: not fixed. Approvals, Funds, Memory, Chat, the remora page and Home now share one red error card with Retry. Approvals and Funds no longer claim "caught up" or "Nothing to move". But under its error card, Home still shows "No remoras yet · Create a remora" and an empty Activity, "Nothing yet. Its work shows up here." (R1P-home-2).

## Shell: top bar and bottom bar, every page (`*`)
**Five seconds:** For: moving between pages. First click: "Approvals" (it has the orange 2).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-shell-1 | all signed in · phone | Blocker | The bottom bar's layout breaks:<br>• "Approvals" is the only tab with no icon, and its orange "2" badge sits on top of the Funds wallet icon, so the count reads as Funds'.<br>• On the Funds page, the active Funds pill covers the badge, so only an orange sliver shows (`funds`).<br>• "Chat" and "Approvals" sit about 10 px apart, so they read as one label, "Chat Approvals", while the other gaps are about 40 px.<br>• The active "Approvals" pill is narrower than its own label (`approvals`, `loading-approvals`).<br>This happens on every signed-in page. | Five equal-width tabs, each with the icon stacked over a short label (11–12 px). Give Approvals an icon (an inbox or a check) and pin the badge to that icon's top-right corner, inside the tab. |
| R1P-shell-2 | filled · phone | Minor | The wrong tab is highlighted:<br>• A chat thread (`thread-researcher`, `thread-watcher`) and the room highlight "More", not "Chat".<br>• A remora's page, Memory and Templates also highlight "More", so you can't tell where you are.<br>The top bar has no back arrow, so leaving a remora page means using Home or the browser's back. | Highlight Chat on every chat screen. On pages more than one level deep (a remora, a thread, a template), show "‹ Back" in the top bar in place of the page title. |
| R1P-shell-3 | all · phone | Minor | The top bar title still repeats the H1 directly under it: "Approvals"/"Approvals", "Funds"/"Funds", "Memory"/"Memory", "Connections"/"Connections". That costs about 45 px of each first screen. | On phones, drop the H1 or show the bar title only after the H1 scrolls away. |
| R1P-shell-4 | out · phone | Minor | Signed out:<br>• The "Sign in" button still touches the top edge of the bar.<br>• The bar title says "remora" in lower case on `out-remoras` and "Remora" elsewhere.<br>• The bottom bar still offers "Approvals" and "Funds", which need an account. | Centre the button vertically and use one spelling. When signed out, make the bar Home · Try it · Verify · More. |

**Words that could go:** the repeated H1 under the bar title.

## Activity feed, shared (`home`, `remora-researcher-overview`, `remora-researcher-activity`, `remora-watcher-overview`, `remora-watcher-activity`)
**Five seconds:** For: what each remora did, with receipts. First click: "Why?".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-feed-1 | filled · phone | Major | Each event is now forced onto one line, and at 412 px the part that matters is cut:<br>• On Home, the remora name takes about 40% of the row, so a payment reads "Researcher · demo Su… 0.01 USDC" and a lesson reads "Wallet watcher mvw… Learned: i…".<br>• On a remora's Activity: "Sui risk check didn't go through, n…" hides the reason, "Would pay Su…", and "Researcher · demo is ready. Its spe…".<br>• On the Watcher: "Received 0.001 …" loses its unit, and "Learned: ignore incoming SUI unde…" loses the threshold.<br>A newcomer can't see what was paid, ignored or learned without opening each row. | Two lines per row on phones: the event on line 1 (up to two lines), and the face, name and "10h ago" small on line 2. Never cut an amount or its unit: keep "0.001 SUI" as one unbreakable chip. |

## Home (`home`, `empty-home`, `loading-home`, `error-home`)
**Five seconds:** For: my remoras and what needs me. First click: "2 Review →".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-home-1 | filled · phone | Major | "Ready to spend" is blank in an account that has money. It has no number, no "—" and no skeleton bar, while Funds shows "19.78 USDC". The loading and error tiles look exactly the same (`loading-home`, `error-funds`), so you can't tell "loading", "failed" and "missing" apart. It is the money number, and it is the one that is missing. | Read it from the same source as Funds. While it is unknown, draw a skeleton bar where the number goes, and show "— USDC" with a small Retry if it fails. |
| R1P-home-2 | error · phone | Blocker | Under the error card "Can't reach Remora right now", Home still says "No remoras yet." with "Create a remora", and "Nothing yet. Its work shows up here." This account has 31 remoras. The unknown is shown as an empty account. | When the request failed, show the error card alone, or keep the skeleton rows under it. Never show an empty state after a failed request. |
| R1P-home-3 | empty · phone | Major | On a brand-new account, the first screen is still the "What's a remora?" explainer: the five-step flow, two kinds and six faces. "Set up Remora" starts about 1,000 px down and its "Add funds" button about 1,130 px down, two screens below the fold. | Put the "Set up Remora · 1 of 3 done" card first, with the active step's button. Fold "What's a remora?" into one row with a `?` that opens the flow. |
| R1P-home-4 | filled · phone | Minor | The three tiles are laid out 2 + 1: "Ready to spend" sits alone on the second row with an empty half beside it. Three numbers take about 370 px. | One row of three compact tiles (label over number), or two tiles, with Ready to spend full width and the number large. |

**Words that could go:** "Your remoras at a glance." (the title says it), "Already at home here? Open the chat." (empty).

## Chat (`chat`, `empty-chat`, `loading-chat`, `error-chat`)
**Five seconds:** For: talking to my remoras. First click: a suggestion chip.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-chat-1 | loading · phone | Blocker | While the remoras load, Chat says "You have no remora yet. Make one to chat with." and shows "+ Create a remora". The account has 31. This is probably not phone-only. | While loading, show the composer with the chips as skeletons, and keep the empty state for a list that has loaded and is truly empty. |
| R1P-chat-2 | all · phone | Minor | The ASCII art still draws over text at this width: glyphs sit on the fourth chip ("…0.05 USDC at once") in `chat`, beside "Hey there" in `error-chat`, and behind the error card. The composer's four icons (toggle, chevron, ⓘ, list) still have no labels, and a phone has no hover. | Keep the art out of the text column on phones, or put it under a solid backing. Label the toggle (for example "Memory on") and give the target as a chip ("To: Researcher ▾"). |

## Chat thread and room (`thread-researcher`, `thread-watcher`, `room`)
**Five seconds:** For: one remora's conversation, with its payments inline. First click: the message box.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-thread-1 | filled · phone | Blocker | The quoted question "Re: Is the package 0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95e3c6…" runs off the right edge, both at the top of the first screen and in the full thread. The address is cut, and the page likely scrolls sideways. | Shorten long ids in quotes to `0xcc05…3c6` with copy, and add `overflow-wrap:anywhere` to the quote line. |
| R1P-thread-2 | filled · phone | Minor | The top bar packs face, name, "⌄", "Details", "Test ▾" and the pause icon into 412 px. "Details" is plain text, and the room has a stray double chevron next to "# Team". | On chat screens, move the network picker into More, make Details a 44 px ⓘ button, and drop the stray chevron. |
| R1P-thread-3 | filled · phone | Minor | On the retired watcher, the composer is still a full 100 px input with a send arrow that reads "Watcher mvwcctl7 is retired." | Swap it for a slim "Retired · its memory stays yours" bar with no input. |

## Memory (`memory`, `memory-chat`, `empty-memory`)
**Five seconds:** For: what a remora remembers, stored on Walrus. First click: "Search what it remembers".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-memory-1 | memory-chat · phone | Minor | The search placeholder is still cut: "Read them back: what do you". | A short placeholder: "Search memories". |
| R1P-memory-2 | memory-chat · phone | Minor | "Use the same memory in Claude Code" is still fully expanded on a phone (about 450 px: three steps, three code boxes). Claude Code doesn't run on a phone. | On phones, collapse it into one row, "Use in Claude Code ›". |

**Words that could go:** "These writes were close enough to a memory already stored that nothing new was written. If one was really new, correct the memory it matched." (three lines at 412 px; make it a `?` on "Skipped as already known"); "A Google sign-in here gives an address only Remora uses, so this needs a wallet."

## Connections (`connections`, `empty-connections`)
**Five seconds:** For: giving an outside agent a token for one remora. First click: "Revoke" (the only button on the first screen), which is not the main action.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-conn-1 | filled · phone | Major | Folding "Revoked or expired (6)" was not enough on a phone. About nine active cards of about 340 px each make the page about 4,700 px. Each card still has the pill alone on its row, the scope chips, three number columns, a date sentence, "Recent calls" and "Revoke". With the form moved below the list, "New connection" and "Create token" now sit about 4,500 px down, and no button at the top leads to them. | Make each token one compact row (name · remora · pill · ⋯ with Revoke) that expands on tap. Add a "+ New connection" button under the title that opens the form as a sheet. |

**Words that could go:** "Made 3d ago, last used 3d ago, expires Nov 30, 2026." on every card (use "expires in 26d"), the token prefix "rmcp_hj0s…" in each card's subtitle.

## Remoras (`remoras`, `empty-remoras`)
**Five seconds:** For: all my remoras. First click: "+ New remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-remoras-1 | filled · phone | Minor | The header buttons still wrap. "Export team" and "Import a team" take row 1, and the main "+ New remora" drops alone onto row 2. The empty state puts "Import a team" and "New remora" beside the title instead. | One row: "+ New remora" plus a "⋯" holding Import and Export, the same in both states. |
| R1P-remoras-2 | filled · phone | Minor | 31 cards of about 100 px each and no search. The first five are all "Researcher · demo / Researcher / Limit not readable now", so they can't be told apart. | Add a search field over the chips. Use compact rows (face, name, pill) and show "Limit not readable now" once at the top. |

**Words that could go:** "Limit not readable now" on every card, the kind line under each name ("Researcher") when the chips already filter by kind.

## Remora page (`remora-researcher-*`, `remora-watcher-*`)
**Five seconds:** For: one remora: ask it, its budget, what it did and learned. First click: "Ask".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-remora-1 | all tabs · phone | Minor | The header (face, name, persona, buttons, tabs) still repeats in full on every tab: about 230 px for the Researcher, about 370 px for the retired Watcher with its "Retired" card. Activity on the Watcher starts at about 465 px. | On every tab except Overview, collapse it into one line (face · name · pill), with "retired" as the pill. |
| R1P-remora-2 | all tabs · phone | Minor | "Chat" (small, with an icon) and "Pause" (larger) are still different sizes. On the retired Watcher, the action row is a lone "⋯" on its own line (about 45 px of nothing). | Make the buttons one size, each at least 44 px. When only "⋯" is left, put it in the title row. |

**Words that could go:** the persona sentence under the name on Activity, Learning and Settings; "What this remora spent, from its recorded turns, gas and payments."; "It buys data when that helps, and tells you what each answer cost."

## New remora (`remoras-new`)
**Five seconds:** For: making a remora. First click: "Researcher", then "Create Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-new-1 | form · phone | Minor | "Create Researcher" is still about 1,160 px down, after the form and a Summary card that repeats the five fields just filled in. | On phones, drop the Summary for a sticky footer: "1 USDC/mo · 0.05 max · Create". |

**Words that could go:** "Sui enforces this budget onchain, not us. It pays only these sources; anything over 0.05 USDC asks you first." (it repeats the two hints above it).

## Template page (`hatchery-template`)
**Five seconds:** For: checking a shared remora before copying it. First click: "Use it (one signature)", which is greyed out here because the review blocked it.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-tmpl-1 | filled · phone | Minor | Under "Share", the two snippet boxes are cut at the right edge: "[Use this remora](http://…/hatchery/0x" and `<a href="http://…/hatchery/0x46cb15520`. Nothing shows that they scroll. | Show one line with an end fade and "Copy". Or drop the boxes on phones and keep only the "Copy Markdown" and "Copy HTML" buttons. |

## Get started (`onboarding`, `empty-onboarding`, and the setup card on `empty-home`, `out-home`)
**Five seconds:** For: the setup checklist. First click: "Add funds".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-onboard-1 | all · phone | Minor | Each step still puts its number or check circle on its own row above the title, so four steps take about 330 px. | Put the circle to the left of the title, on the same row. |

## Own your memory (`connect`)
**Five seconds:** For: moving my memory to an account I own. First click: "Own this memory".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-connect-1 | error · phone | Minor | The help `?` sits alone on its own row under the gas sentence, and the "one signature" label collides with the connector's dot between the two nodes. | Put the `?` at the end of the chips row, and the label beside the line, not on it. |

**Words that could go:** "Walrus Memory sponsors the gas. If it can't, your wallet pays instead, and you're asked first." (the "gas sponsored" chip plus the `?` cover it).

## Sign in (`out-sign-in`, `out-remoras`)
**Five seconds:** For: connecting a wallet. First click: "Try without a wallet" (on a phone).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-signin-1 | out · phone | Minor | The dialog's subtitle, "Slush, or any other Sui wallet in this browser.", contradicts the next line, "No Sui wallet in this browser." "Get Slush ↗" points at an install, not at opening this page in the app. | Drop the subtitle when no wallet is found. Make the main button "Open in Slush" (a deep link to this page), with "Get Slush" small under it. |

## Landing (`landing`, `landing-00-problem` … `landing-06-part-6`)
**Five seconds:** For: what Remora is, with a way to try it. First click: "Try a Researcher · $1 limit · no wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-landing-1 | out · phone | Major | Black voids remain on two sections:<br>• "How" opens with about 640 px of black; its title and card 01 are missing, and card 02 is half under the sticky header.<br>• "Proof" shows three numbers, then about 660 px of black.<br>A quick scroll on a phone shows empty screens. | Reveal on a phone at the first pixel in view, or don't hide sections on phones at all, and trim the bottom padding of Proof. |
| R1P-landing-2 | out · phone | Minor | The hero still stacks four chips on two rows ("Sui", "Walrus Memory", "Tatum gRPC", "Total Recall · Track 2"), about 80 px above the headline. A newcomer doesn't know "Tatum gRPC". | Two chips on phones (Sui, Walrus), or move them under the buttons. |
| R1P-landing-3 | out · phone | Minor | The footer links "GitHub  App  Proof" are still bare text about 20 px tall. | 44 px targets. |

**Words that could go:** "Tatum gRPC" and "Total Recall · Track 2" (hero chips); "money on Sui testnet · memory on Walrus mainnet · every Sui call through Tatum" (it repeats the chips).

## Guide (`guide`, `out-guide`)
**Five seconds:** For: how Remora works, page by page. First click: "Open chat".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-guide-1 | all · phone | Minor | The page is about 6,760 px with no contents or jump links. "Commands" and "The same memory in Claude Code" are 9–10 screens down. | A sticky row of section chips under the title (What · Start · Pages · Memory · Budget · Receipts · Commands). |

## Verify (`verify`, `out-verify`)
**Five seconds:** For: checking a receipt against Sui. First click: a row's "Verify".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-verify-1 | filled · phone | Nit | In "Your recent receipts", the last row's "0.01 USDC 3d ago" sits about 5 px right of the rows above it, because "3d ago" is shorter than "10h ago". | Right-align the amount and give the time column a fixed width. |

## Across pages
| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1P-x-1 | filled · phone | Minor | Money has two units:<br>• In dollars: a remora's Cost ("$0.03", "< $0.01") and Services ("$0.01 per call").<br>• In USDC: Funds, Approvals, Verify and the feed ("0.01 USDC").<br>It reads as two currencies. | USDC everywhere, with the same Amount style (number big, "USDC" small). |
| R1P-x-2 | all · phone | Minor | Inputs are three widths:<br>• The search fields stop about 60 px short of the right edge (Memory, Templates, Services), and Memory's remora picker is half width.<br>• Verify, New remora and Settings run full width. | Full-width inputs on phones. |
| R1P-x-3 | all · phone | Minor | Code wraps three ways:<br>• Memory › Chat breaks inside words ("MystenLabs/Me / mWal", "Use m / emwal_recall").<br>• The template page's Share snippets clip at the edge.<br>• The guide wraps at spaces. | One code style: wrap at spaces, with a hanging indent and a copy button. |
| R1P-x-4 | all · phone | Minor | A few hints still rely on hover (dotted underline): the "Services" heading, "Gas (sponsored)" in Cost and "Spending limit" in Keys. Most pages now use a tappable `?`. | The `?` icon everywhere. |
| R1P-x-5 | all · phone | Minor | The top bar names the same Home three ways: "Home" (filled), "Remora" (`empty-home`, `out-home`) and "remora" (`out-remoras`). | "Home" on Home, and one spelling of the brand. |
| R1P-x-6 | error · phone | Minor | One failure, five wordings. "Can't reach Remora right now" (Home, Memory, the remora page), "Can't reach your remoras right now" (Chat), "Couldn't load approvals" (Approvals), and "Couldn't read your balance from Sui." (Funds), which blames Sui when the data server is down. | One line per failure: "Can't reach Remora. <what still holds>." Name Sui only when Sui failed. |

**Counts:** Blocker 4 · Major 5 · Minor 27 · Nit 1
