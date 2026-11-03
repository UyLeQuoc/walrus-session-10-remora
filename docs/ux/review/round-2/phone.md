## Previous findings
Sizes are in CSS px (the shots are 2x). A phone screen has about 700 px between the top bar and the bottom bar.

- R1P-shell-1: fixed. The bar has five equal tabs, each an icon over a label. The orange "2" sits on the Approvals inbox icon, and the active pill fits its label on Funds and on Approvals.
- R1P-feed-1: fixed. Rows wrap to two lines and amounts stay whole: "Sui risk check 0.01 USDC", "Learned: ignore incoming SUI under 0.002", "Received 0.001 SUI (49Lnbdfi…)". Only the remora's name is cut ("Wallet watcher mvw…"), which is fine. One row still loses its point (R2P-feed-2).
- R1P-thread-1: fixed. The quoted package id wraps inside the screen. It is still the full 66-character id on two lines (R2P-thread-2).
- R1P-home-1: fixed. "Ready to spend 19.78 USDC" matches Funds. While loading the tile shows a skeleton bar, and on error it shows "—". Funds under the same failure is not fixed: both balance tiles keep skeleton bars, so they look like they are still loading (see the not-counted list).
- R1P-home-2: fixed. Under the error card, Home says "Your remoras show once Remora is back." and "The activity shows once Remora is back." There is no empty state.
- R1P-home-3: fixed. A new account opens on "Set up Remora · 1 of 3 done", and "Add funds" is about 380 px down, on the first screen.
- R1P-chat-1: fixed. `loading-chat` shows the composer and the four chips, with no "You have no remora yet".
- x-1, x-3 (the triage lists them under "Unknowns", so read as R0P-x-1 and R0P-x-3, carried as home-1 and home-2): fixed, as above. If R1P-x-1 (two money units) and R1P-x-3 (three code wraps) were meant, neither is fixed:
  - Units: Cost still says "$0.03", Services says "$0.01 per call", and guide step 1 and the landing say "$1 spending limit".
  - Code: Memory › Chat still breaks "MystenLabs/Me│mWal" and "Use m│emwal_recall" (R2P-x-1).
- R1P-conn-1: fixed, mostly. The page is about 3,120 px (it was about 4,700), cards are about 170–210 px (they were about 340), and "New connection" sits under the title. The status pill still takes a row of its own (R2P-conn-1).
- R1P-landing-1: fixed. "How" shows its title and all four cards. "Proof" shows its six numbers with no black void.
- R0P-shell-2 (moved to round 2): fixed. The octagon now reads "Pause all". It is about 28 px tall.
- R0P-shell-6 (moved to round 2): not fixed. Many tap targets are still under 40 px; R2P-shell-2 lists them.

## Not phone-specific, seen in passing (not counted)
- The remora page's Budget says "Up to 0.50 USDC a month" and shows 0.50 and 0.015 in its fields, while its meter says "No spending limit onchain: it can't spend".
- The template page's "Use it" at the top looks enabled on a template the safety review blocked, while "Use it (one signature)" lower down is greyed.
- "Own this memory" looks enabled under "This link expired." (`connect`).
- The retired Watcher's Settings draws an empty red "Danger zone" box.
- Under an error, Funds' two balance tiles and Home's Remoras and Waiting tiles keep skeleton bars, while Home's Ready to spend shows "—".
- Money still comes in two units ($ and USDC).
- A service has three names: "sui-risk", "reef:sui-risk" and "Sui risk check".
- One failure has six wordings.

## Shell: top bar and bottom bar, every page (`*`)
**Five seconds:** For: moving between pages. First click: "Approvals", which has the orange 2.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-shell-1 | filled · phone | Minor | The wrong tab is highlighted, and the top bar has no way back:<br>• A chat thread and the room (`thread-researcher`, `thread-watcher`, `room`) highlight "More", not "Chat".<br>• The remora page, Memory, Templates, Connections, Verify, Status and the receipt also all highlight "More".<br>• The top bar has no back arrow. When a remora page fails (`error-remora`), the screen is a red card and the bottom bar, and the only way back to that list is the browser. | Highlight Chat on every chat screen. On pages two levels deep, put "‹ Remoras", "‹ Chat" or "‹ Templates" in the top bar where the title is. |
| R2P-shell-2 | all · phone | Major | Tap targets under 40 px (R0P-shell-6, still open):<br>• Thumbs up and down are about 26 px: the pressed 👎 on `thread-watcher` draws a box of about 26×24, and the two thumbs sit about 35 px apart, centre to centre.<br>• "Why?", "tx ↗", "Hide", "Correct", "Revoke" and "Open a .md file" are bare text, about 20 px tall.<br>• Segmented tabs are about 28 px: Waiting / Decided, Overview / Activity / Learning / Settings, Remoras / Chat.<br>• "Pause all" is about 28 px. The "×" in Choose a wallet is about 24 px. Copy icons are about 15 px glyphs.<br>• Even the money buttons are short: "Pay once (0.02 USDC)" and "Decline" are about 36 px.<br>The thumbs are how a remora learns, so a missed tap loses a signal. | Give every control a 44 px hit area. Make tabs 44 px tall. Turn "Why?" into a chip with a receipt icon, and give 👍 and 👎 44 px squares with 8 px between them. |
| R2P-shell-3 | all · phone | Minor | The bar title repeats the H1 right under it: "Approvals"/"Approvals", "Funds"/"Funds", "Memory"/"Memory", "Connections"/"Connections", "Settings"/"Settings", "Status"/"Status", "Verify a receipt"/"Verify a receipt". That costs about 45 px of every first screen. (R1P-shell-3, still open.) | On phones, show the bar title only once the H1 has scrolled away. |
| R2P-shell-4 | out · phone | Minor | Signed out:<br>• The bottom bar still offers "Approvals" and "Funds", which need an account.<br>• "Sign in" fills the bar's full height and touches its top edge.<br>• In `out-sign-in`, the bottom bar stays sharp and tappable above the dialog's blur. | Make the signed-out bar Home · Try it · Verify · More. Centre the button in the bar. Put the dialog's scrim over the bar too. |

**Words that could go:** the repeated H1 under the bar title.

## Activity feed, shared (`home`, `remora-*-overview`, `remora-*-activity`)
**Five seconds:** For: what each remora did, with receipts. First click: "Why?" on a payment.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-feed-1 | filled · phone | Minor | Rows have three layouts at 412 px:<br>• A question puts its time on the right, with 👍 👎 Why? under it.<br>• A payment puts its amount chip on the right, and "10h ago tx ↗ Why?" on a second line.<br>• The Watcher's "Ignored: Received 0.001 SUI (84t7yEiU…)" pushes "3d ago" about 60 px left to fit "Why?" beside it (`remora-watcher-overview`, `remora-watcher-activity`).<br>The time column is ragged, and Why? jumps between rows. | One row shape. Line 1: the event, with its amount chip on the right. Line 2, all left-aligned: time · tx ↗ · Why? · 👍 👎. |
| R2P-feed-2 | filled · phone | Minor | The two-line clamp still hides the point of some rows:<br>• "Researcher · demo is ready. Its spending limit is live; it starts in…" hides the mode it starts in.<br>• "Is the package 0xcc05642d8f85d0ba4a229677c67…" spends both lines on a raw id. | Short ids in event titles ("0xcc05…5d6d"). Show the mode as a chip ("practice mode"). |

## Home (`home`, `loading-home`, `error-home`, `empty-home`)
**Five seconds:** For: my remoras, what waits for me, my money. First click: "2 Review →".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-home-1 | filled · phone | Minor | The six remora cards are about 115 px each, and each one repeats an empty meter track and "No spending limit onchain: it can't spend". Activity, the proof that the remoras work, starts about 1,180 px down, past the second screen. | On phones, use compact rows (face, name, pill), and say it once above the list: "6 have no spending limit onchain". Or show three rows, then "See all 31". |

**Words that could go:** "Your remoras at a glance." (the title says it).

## Chat (`chat`, `empty-chat`, `loading-chat`, `error-chat`)
**Five seconds:** For: talking to my remoras. First click: a suggestion chip.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-chat-1 | all · phone | Minor | The ASCII art still draws over text at this width (R1P-chat-2, still open):<br>• Glyphs sit on the "r" of "What's worth thinking through?" (`loading-chat`).<br>• Dashes strike through "You have no remora yet", so it reads as crossed out (`empty-chat`).<br>• Art sits behind the chips (`chat`, `loading-chat`).<br>• Art runs to the right edge beside the error card's "Retry" (`error-chat`). | On phones, keep the art above the greeting only, or mask it out of the text column. |
| R2P-chat-2 | all · phone | Minor | The composer's four controls (the toggle, "⌄", "ⓘ" and the list icon) are unlabelled icons, with glyphs of about 15–24 px. A phone has no hover to explain them. | Label the toggle "Memory on". Show who you're talking to as a chip, "To: Researcher ▾". |

## Chat thread and room (`thread-researcher`, `thread-watcher`, `room`)
**Five seconds:** For: one remora's conversation, with its payments inline. First click: the message box.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-thread-1 | filled · phone | Major | The top bar now clips the remora's name with no ellipsis: "Researche" (`thread-researcher`) and "Watcher m" (`thread-watcher`). With 16 watchers named "Watcher mv…", you can't tell which one you're talking to. Six things share 412 px: face, name, "⌄", "Details", "Test ⌄" and "Pause all". The room also has a stray double chevron after "# Team". | On chat screens, move "Test ⌄" into More and make Details a 44 px ⓘ. Give the name the freed space, with an ellipsis ("Watcher mvwcctl7"). Drop the stray chevron. |
| R2P-thread-2 | filled · phone | Minor | The quoted question wraps now, but prints the full id: "Re: Is the package 0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95e3c69e88434a5d6d safe to depend on?", three lines of hex above the answer. | "Re: Is the package 0xcc05…5d6d safe…", with copy. |
| R2P-thread-3 | filled · phone | Minor | On the retired Watcher, the composer is still a full input of about 100 px with a send arrow, reading "Watcher mvwcctl7 is retired." (R1P-thread-3, still open.) | A slim bar: "Retired · its memory stays yours", with no input. |

## Memory (`memory`, `memory-chat`, `loading-memory`)
**Five seconds:** For: what each remora remembers, stored on Walrus. First click: "Search what it remembers".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-memory-1 | memory-chat · phone | Minor | The search placeholder is still cut: "Read them back: what do you". (R1P-memory-1, still open.) | "Search memories". |
| R2P-memory-2 | memory-chat · phone | Minor | "Use the same memory in Claude Code" is folded into one row on Memory › Remoras, but fully open on Memory › Chat: about 450 px of three steps and three code boxes, on a device that can't run Claude Code. | Fold it on both tabs: "Use in Claude Code ›". |
| R2P-memory-3 | filled · phone | Minor | Each memory row is about 170 px, and its tags wrap badly:<br>• "wake" and "2 later writes matched this" are chips.<br>• Then "receipts" falls alone onto the next line as plain grey text with no chip outline, although the "Skipped" list below draws "receipts" as a chip.<br>• Then "active" sits on a third line. | Put the tags on one row, with the count as a short chip ("+2 matched"). Put the pill on the same line as "expires 6/1/2027 · 1.1 KB". |

**Words that could go:** "These writes were close enough to a memory already stored that nothing new was written. If one was really new, correct the memory it matched." (three lines at 412 px; make it a `?` on "Skipped as already known"); "A Google sign-in here gives an address only Remora uses, so this needs a wallet."

## Connections (`connections`, `empty-connections`)
**Five seconds:** For: letting an outside agent use one remora. First click: "New connection".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-conn-1 | filled · phone | Minor | The cards are smaller, but:<br>• Each card still spends a row on the pill ("active" or "remora retired") and "Revoke", leaving its left half empty.<br>• "Recent calls" lands on a different row on each card, depending on how the chips wrap. Sometimes it sits beside a lone "0 memories".<br>• Permissions ("Reads memory", "Pays") and counts ("1 calls", "0.00 USDC") share one chip style, so they read as one list. | Put the pill in the title row and Revoke in a "⋯". Show the scopes as chips and the counts as one grey line: "6 calls · 0.01 USDC · 0 memories". |

## Remoras (`remoras`, `empty-remoras`)
**Five seconds:** For: all my remoras. First click: "+ New remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-remoras-1 | filled · phone | Minor | The header still wraps. "Export team" and "Import a team" take row 1, and the main "+ New remora" drops alone onto row 2. The empty state puts "Import a team" and "New remora" beside the title instead. (R1P-remoras-1, still open.) | One row, the same in both states: "+ New remora", plus a "⋯" holding Import and Export. |
| R2P-remoras-2 | filled · phone | Minor | 31 cards of about 115 px make about 4,070 px with no search. The first five are all "Researcher · demo / Researcher / No spending limit onchain: it can't spend". (R1P-remoras-2, still open.) | Put a search field over the chips, and use compact rows (face, name, pill). |

## Remora page (`remora-researcher-*`, `remora-watcher-*`, `loading-remora`, `error-remora`)
**Five seconds:** For: one remora: ask it, its budget, what it did and what it learned. First click: "Ask".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-remora-1 | all tabs · phone | Minor | The header repeats in full on every tab (R1P-remora-1, still open):<br>• About 260 px on the Researcher.<br>• About 390 px on the retired Watcher: three lines of persona, a lone "⋯" and the Retired card.<br>The Watcher's Activity starts about 465 px down. On Learning, "Proof of Learning", the page's best story (before 🔔, after quiet), starts about 765 px down, below the fold. | On every tab except Overview, collapse the header into one line: face · name · pill, with "retired" as the pill. On the Watcher's Learning tab, put the proof first. |
| R2P-remora-2 | all tabs · phone | Minor | "Chat" (about 31 px, with an icon) and "Pause" (about 35 px) are different sizes. On the retired Watcher, the action row is a lone "⋯" on a row of about 45 px. (R1P-remora-2, still open.) | One button size of at least 44 px. When only "⋯" is left, put it in the title row. |
| R2P-remora-3 | settings · phone | Minor | Field widths differ on one tab:<br>• Brain's "Remora ▾" is a chip about 85×32 px.<br>• Budget's two inputs are half width, and "Change budget" is a small ghost button.<br>• Name, Persona and Schedules run full width, and the Schedules "Add" button is full width. | On phones, make every input and select full width, and every form's main button one width. |

**Words that could go:** the persona sentence under the name on Activity, Learning and Settings; "It buys data when that helps, and tells you what each answer cost."; "What this remora spent, from its recorded turns, gas and payments."

## New remora (`remoras-new`)
**Five seconds:** For: making a remora. First click: "Researcher", then "Create Researcher" on screen 2.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-new-1 | form · phone | Minor | "Create Researcher" is still about 1,160 px down, after a Summary card that repeats the fields just filled in (Template, Name, Monthly limit, Most at once). (R1P-new-1, still open.) | On phones, swap the Summary for a sticky footer: "1 USDC/mo · ≤ 0.05 · 20 payments · Create". |

## Template page (`hatchery-template`)
**Five seconds:** For: checking a shared remora before copying it. First click: "Use it".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-tmpl-1 | filled · phone | Minor | Under "Share", the two snippet boxes are still cut at the right edge, "[Use this remora](http://…/hatchery/0x" and `<a href="http://…/hatchery/0x46cb15520`, with no fade or scroll cue. (R1P-tmpl-1, still open.) | On phones, keep only "Copy Markdown" and "Copy HTML", or one line with an end fade. |

**Words that could go:** "It's created under 0xd970...4757 in practice mode. You set its budget later on its page; until then the template's suggestion applies, and its spending limit caps every payment onchain." (three lines that repeat the "It starts in practice mode" card above it).

## Verify a receipt (`verify`, `verify-receipt`, `out-verify`)
**Five seconds:** For: checking a receipt against Sui. First click: a row's "Verify".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-verify-1 | filled · phone | Minor | On a verified receipt, "What we checked" prints every id in full on two lines (intent hash, tx digest, signer). The "decided before paying" check breaks a timestamp in the middle of a number: "tx 2026-11-03T08:5│4:47.043Z". What was paid ("Decision: Pay 0.01 USDC to Sui risk check") starts about 1,000 px down. | Short ids with copy in the checks, and one relative line: "decided 1.6 s before the payment". Put "Pay 0.01 USDC to Sui risk check" under "Verified", as the shared proof does. |
| R2P-verify-2 | filled · phone | Minor | The Receipt table keeps a label column of about 135 px, so values wrap: "Check" runs to five lines, and "Intent hash" to three, ending with "94" alone. | On phones, stack each label over its value. |
| R2P-verify-3 | filled · phone | Nit | In "Your recent receipts", the amount moves with the width of the time beside it: "10h ago" pulls the first row a few px left, and "3d ago" pushes the last row right. (R1P-verify-1, still open.) | Give the time column a fixed width and right-align the amount. |

## Shared proof (`public-receipt`)
**Five seconds:** For: proof of one payment, for anyone. First click: the transaction link.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-receipt-1 | filled · phone | Minor | In "What happened", Paid to, Transaction and Signed by are short with copy ("0x9964291010…0b05acaf4a8"). "Intent hash" in the same card is printed in full on three lines, ending with "94" alone. | The same short form and copy button. |

## Sign in (`out-sign-in`, `out-remoras`)
**Five seconds:** For: connecting a wallet. First click: "Try without a wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-signin-1 | out · phone | Minor | The subtitle, "Slush, or any other Sui wallet in this browser.", contradicts the next line, "No Sui wallet in this browser." "Get Slush ↗" points at an install, not at opening this page in the app. (R1P-signin-1, still open.) | Drop the subtitle when no wallet is found. Make the main button "Open in Slush" (a deep link to this page), with "Get Slush" small under it. |

## Own your memory (`connect`)
**Five seconds:** For: moving my memory to a wallet I own. First click: "Own this memory".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-connect-1 | error · phone | Minor | The help `?` sits alone on a row of about 40 px under the gas sentence. (R1P-connect-1, still open.) | Put the `?` at the end of the chips row. |

**Words that could go:** "Walrus Memory sponsors the gas. If it can't, your wallet pays instead, and you're asked first." (the "gas sponsored" chip and the `?` cover it).

## Get started (`onboarding`, and the setup card on `empty-home`)
**Five seconds:** For: the setup checklist. First click: "Add funds".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-onboard-1 | all · phone | Minor | Each step still puts its number or check circle on a row of its own above the title, so the four steps take about 420 px. (R1P-onboard-1, still open.) | Put the circle left of the title, on the same row. |

## Landing (`landing`, `landing-00-problem` … `landing-06-part-6`)
**Five seconds:** For: what Remora is, with a way to try it. First click: "Try a Researcher · $1 limit · no wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-landing-1 | out · phone | Major | "Built to be read." (`landing-04-part-4`) still shows desktop screenshots shrunk to about 385 px wide. Their text is 3–4 px and unreadable, so about 1,300 px of frames prove nothing on a phone. (R0P-landing-1, moved to round 2.) | Use phone captures, or crop each frame to one zoomed piece: the memory row, the $1 budget meter, the Services prices, the Status list. |
| R2P-landing-2 | out · phone | Minor | The hero still stacks four chips on two rows ("Sui", "Walrus Memory", "Tatum gRPC", "Total Recall · Track 2"), about 75 px above the headline. A floating blue face also overlaps the "remora" logo. (R1P-landing-2, still open.) | On phones, two chips (Sui, Walrus), or move them under the buttons. Keep the faces clear of the header. |
| R2P-landing-3 | out · phone | Minor | The footer links "GitHub  App  Proof" are still bare text about 15 px tall. (R1P-landing-3, still open.) | 44 px targets. |

**Words that could go:** "Tatum gRPC" and "Total Recall · Track 2" (hero chips); "money on Sui testnet · memory on Walrus mainnet · every Sui call through Tatum" (it repeats the chips).

## Guide (`guide`, `out-guide`)
**Five seconds:** For: how Remora works, page by page. First click: "Open chat".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-guide-1 | all · phone | Minor | The page is about 6,760 px with no contents. "Commands" and "The same memory in Claude Code" are 9–10 screens down. (R1P-guide-1, still open.) | A sticky row of section chips under the title: Start · Pages · Memory · Budget · Receipts · Commands. |

## Across pages
| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2P-x-1 | all · phone | Minor | Code wraps three ways:<br>• Memory › Chat breaks inside words ("MystenLabs/Me│mWal", "Use m│emwal_recall").<br>• The template's Share snippets clip at the edge.<br>• The guide wraps at spaces in numbered rows, with a copy button.<br>(R1P-x-3, still open.) | The guide's style everywhere: wrap at spaces, with copy. |
| R2P-x-2 | all · phone | Minor | Inputs come in four widths:<br>• The search fields stop about 60 px short of the right edge (Memory, Templates, Services).<br>• Memory's remora picker is about 190 px wide.<br>• Brain's select is about 85 px wide.<br>• Verify, New remora, Settings and Schedules run full width.<br>(R1P-x-2, still open.) | Full-width inputs and selects on phones. |
| R2P-x-3 | all · phone | Minor | A few hints still rely on hover (a dotted underline), and a phone has none: the "Services" heading, "Gas (sponsored)" in Cost, "Spending limit" in Keys, and "safety check" in the receipt's Check row. Most pages use a tappable `?`. (R1P-x-4, still open.) | The `?` icon everywhere. |
| R2P-x-4 | all · phone | Minor | The top bar names Home three ways: "Home" (`home`), "Remora" (`empty-home`, `out-home`, and also `error-remora`) and "remora" (`out-remoras`). (R1P-x-5, still open.) | "Home" on Home, the remora's name on its page, and one spelling of the brand. |
| R2P-x-5 | filled · phone | Minor | Tiles are laid out 2 + 1 with half a row empty: on Home, "Ready to spend" sits alone, and on the Watcher's Overview, "Rules learned" sits alone. Funds lays its two tiles out cleanly. | Three compact tiles in one row (label over number), or the odd tile at full width. |
| R2P-x-6 | filled · phone | Minor | The "one signature" label in the account Flow sits on the connector line, with the blue dot under its letters, touching the "Your wallet" card (`memory-chat`, `connect`). | Put the label beside the line, and keep the dot clear of the cards. |

**Counts:** Blocker 0 · Major 3 · Minor 36 · Nit 1
