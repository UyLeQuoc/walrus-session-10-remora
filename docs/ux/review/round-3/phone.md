## Previous findings
Sizes are in CSS px (the shots are 2x). A phone screen has about 735 px between the top bar and the bottom bar.

The triage lists one phone finding as fixed:

- R2P-thread-1: fixed. Both thread bars now show the whole name ("Researcher · demo", "Watcher mvwcctl7"), then ⌄, "Details", "Test ⌄" and the red octagon. The room still has the stray double chevron after "# Team" (R3P-thread-2).

Not on the triage's fixed list, but checked in passing:
- R2P-thread-2: fixed. The quote reads "Re: Is the package 0xcc05...5d6d safe to depend on?".
- R2P-feed-2: half fixed. The id is short now ("Is the package 0xcc05...5d6d safe to depend on?"), but "…it starts in…" still hides the mode (R3P-feed-2).
- R2P-memory-1: fixed. "Search memories" fits.
- R2P-verify-1: half fixed. The payment leads the page ("Paid to Sui risk check · 0.01 USDC"), and the timing check fits on one line. The ids in "What we checked" are still printed in full (R3P-verify-1).
- R2P-x-4: half fixed. Home's bar says "Home" in every state. `error-remora` and `loading-remora` say "Remora", and `out-remoras` says "remora" (R3P-x-4).
- R2P-shell-2: declined, because touch screens get 40 px hit areas, which a screenshot can't show. One pair can't be 40 px each, though: see R3P-shell-5.
- R2P-landing-1: moved to Part D. Nothing has changed yet (R3P-landing-1).

## Not phone-specific, seen in passing (not counted)
- **Two names for one receipt.** On Verify, the receipt card is titled with a raw id, "6283e52d-1e39-4c2f-8bab-9a51500fa67d". The Shared proof of the same receipt (same tx, same intent hash) names "Researcher · demo".
- **The timing check reads as paying first.** "It decided as it paid" shows "decided 15:54:48 · paid 15:54:47 · stored 15:54:48", so the decision looks one second later than the payment.
- **Lists of checks differ.** Verify's "What we check" lists 4 checks, but a verified receipt shows 6.
- **Error states still look like loading.** Funds' two tiles and Home's Remoras and Waiting tiles keep skeleton bars, while Home's Ready to spend shows "—".
- **Money comes in two units.** "$1 limit" (landing CTA), "$1 spending limits" (landing), "$0.03" (Cost) and "$0.01 per call" (Services), against "1 USDC limit onchain" (landing demo) and "0.01 USDC a call" (template).
- **Inline grammar.** "1 calls" on Connections, and "1 address(es)" in the Watcher's feed.

## Shell: top bar and bottom bar, every page (`*`)
**Five seconds:** For: moving between pages. First click: "Approvals", which has the orange 2.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-shell-1 | filled · phone | Minor | The wrong tab is highlighted, and you can't go back (R2P-shell-1, still open):<br>• Chat threads and the room (`thread-researcher`, `thread-watcher`, `room`) highlight "More", not "Chat".<br>• Every page under More (Remoras, a remora, Memory, Templates, Connections, Verify, Status, Services, Try a Researcher) also highlights "More".<br>• No page has a back arrow. On `error-remora` the screen is a red card under a bar that says "Remora". To get back to the list you need More › Remoras, or the browser. | Highlight Chat on every chat screen. On pages two levels deep, show "‹ Remoras", "‹ Chat" or "‹ Templates" where the bar title is. |
| R3P-shell-2 | all · phone | Minor | Pause-all is now a red octagon with no label, on every page. That frees room in chat bars, but:<br>• On Home, Funds and Approvals the bar has about 200 px free, and a newcomer can't tell what the loudest thing in the bar does. It reads as stop or close.<br>• A phone has no hover to explain it.<br>• Settings calls the same action "Pause everything", and the remora page and Funds say "Pause". | Show "Pause all" beside the icon when the bar title is short, and the icon alone on chat screens. Use one name for it everywhere. |
| R3P-shell-3 | all · phone | Minor | The bar title repeats the H1 just under it (R2P-shell-3, still open). Examples: "Approvals"/"Approvals", "Funds"/"Funds", "Memory"/"Memory", "Templates"/"Templates", "Services"/"Services", "Remoras"/"Remoras", "Researcher · demo"/"Researcher · demo". Onboarding has three titles: the bar's "Get started", the H1 "Set up Remora", and the card's "Set up Remora". Each repeat costs about 45 px of the first screen. | On phones, show the bar title only once the H1 has scrolled away. |
| R3P-shell-4 | out · phone | Minor | Signed out (R2P-shell-4, still open):<br>• The bottom bar still offers "Approvals" and "Funds", which need an account.<br>• "Sign in" fills the bar's full height and touches its top edge.<br>• In `out-sign-in`, the bottom bar stays sharp and tappable above the dialog's blur. | Make the signed-out bar Home · Try it · Verify · More. Centre the button in the bar. Put the scrim over the bar too. |
| R3P-shell-5 | filled · phone | Minor | 👍 and 👎 are about 28 px apart, centre to centre, in a chat thread (`thread-researcher`), and about 35 px apart in feeds (`home`, `remora-*-activity`). Two 40 px hit areas can't fit in 28 px, so a thumb can land on the wrong vote. Votes are how a remora learns. | Give each thumb a 44 px square with 8 px between them, as one segmented pair. |

## Activity feed, shared (`home`, `remora-*-overview`, `remora-*-activity`)
**Five seconds:** For: what each remora did, with receipts. First click: "Why?" on a payment.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-feed-1 | filled · phone | Minor | The time sits in three places at 412 px (R2P-feed-1, still open):<br>• A question: "11h ago" at about x 190, then 👍 👎 Why?.<br>• A payment: its amount chip floats mid-row, with "11h ago tx ↗" at about x 230.<br>• "Learned", "didn't go through" and system rows: the time at the far right, about x 325.<br>So the time, amount and actions columns zig-zag down the feed. | One row shape. Line 1: the event, with its amount chip at the right. Line 2, all left-aligned: time · tx ↗ · Why? · 👍 👎. |
| R3P-feed-2 | filled · phone | Minor | The two-line clamp still cuts the point of "Researcher · demo is ready. Its spending limit is live; it starts in…": it hides the mode it starts in. | Show the mode as a chip ("practice mode"), and keep the sentence to one line. |

## Home (`home`, `loading-home`, `error-home`, `empty-home`)
**Five seconds:** For: my remoras, what waits for me, my money. First click: "2 Review →".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-home-1 | filled · phone | Minor | There are six remora cards of about 115 px. Each one repeats "Researcher · demo / Researcher / can't spend", an empty meter track and "No limit onchain". Activity, the proof that the remoras work, starts about 1,180 px down, past the second screen. (R2P-home-1, still open.) | On phones, use compact rows (face, name, pill), say it once above them ("6 can't spend: no limit onchain"), then add "See all 31". |

**Words that could go:** "Your remoras at a glance." (the H1 and the tiles say it)

## Chat (`chat`, `empty-chat`, `loading-chat`, `error-chat`)
**Five seconds:** For: talking to my remoras. First click: a suggestion chip.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-chat-1 | all · phone | Major | The ASCII art still draws over the text you need, now in the error state too (R2P-chat-1, third round open):<br>• `error-chat`: glyph cells paint inside the red card, over "right" in "Can't reach your remoras right now.", up to the Retry button.<br>• `empty-chat`: rows of "%%t%%SX" and "%%@@@%X8" sit right above and below "You have no remora yet". That is the empty state's only line, and "have no" is hard to read.<br>• `chat`, `loading-chat`: art sits behind the chips ("depend on?", "USDC on testnet") and under the subtitle. | On phones, draw the art only above the greeting, or mask it out of the text column and every card. |
| R3P-chat-2 | all · phone | Minor | The composer's four controls are unlabelled icons: the toggle, "⌄", "ⓘ" and the list icon. A phone has no hover to explain them. (R2P-chat-2, still open.) | Label the toggle "Memory on", and show the addressee as a chip, "To: Researcher ▾". |

## Chat thread and room (`thread-researcher`, `thread-watcher`, `room`)
**Five seconds:** For: one remora's conversation, with its payments inline. First click: the message box.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-thread-1 | filled · phone | Minor | On the retired Watcher, the composer is still a full input of about 100 px with a send arrow, reading "Watcher mvwcctl7 is retired." (R2P-thread-3, still open.) | A slim bar: "Retired · its memory stays yours". |
| R3P-thread-2 | filled · phone | Nit | The room's bar has a stray double chevron after "# Team", about 70 px right of the name. It looks like a broken icon. | Drop it, or make it the same "⌄" the threads use. |
| R3P-thread-3 | filled · phone | Minor | In `thread-watcher`, "Watcher mvwcctl7 is watching 1 address(es) on testnet:" ends with a colon and nothing after it. The address it watches (0xe7…8d on Overview) is missing. | Finish the line: "Watching 0xe7…8d on testnet", with copy. |

## Memory (`memory`, `memory-chat`, `loading-memory`, `empty-memory`)
**Five seconds:** For: what each remora remembers, stored on Walrus. First click: "Search what it remembers".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-memory-1 | filled · phone | Minor | Each memory row is about 170 px and its tags wrap badly (R2P-memory-3, still open):<br>• "wake" and "2 later writes matched this" are chips.<br>• "receipts" then falls alone onto the next line as plain grey text. In "Skipped" below, "receipts" is a chip. | Put the tags on one row: the namespace as a chip, the count as "+2 matched". |
| R3P-memory-2 | memory-chat · phone | Minor | Memory › Remoras folds "Use this memory in Claude Code" into one row. Memory › Chat shows it fully open: about 450 px of three steps and three code boxes, on a device that can't run Claude Code. (R2P-memory-2, still open.) | Fold it on both tabs. |
| R3P-memory-3 | memory-chat · phone | Nit | In the Account flow, the "one signature" label sits on the connector line, with the blue dot under its letters touching the "Your wallet" card. (R2P-x-6, still open.) | Put the label beside the line, and keep the dot clear of the card. |

**Words that could go:** "These writes were close enough to a memory already stored that nothing new was written. If one was really new, correct the memory it matched." (3 lines; make it a `?` on "Skipped as already known"); "A Google sign-in here gives an address only Remora uses, so this needs a wallet."

## Connections (`connections`, `empty-connections`)
**Five seconds:** For: letting an outside agent use one remora. First click: "New connection".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-conn-1 | filled · phone | Minor | The cards haven't changed since round 2 (R2P-conn-1, still open):<br>• Each card spends a row on the pill ("remora retired" or "active") and "Revoke", leaving its left half empty.<br>• "Recent calls" sits on a different row on each card. Sometimes it is beside a lone "0 memories".<br>• Scopes ("Reads memory", "Pays") and counts ("1 calls", "0.00 USDC") share one chip style. | Put the pill in the title row and Revoke behind "⋯". Show the scopes as chips and the counts as one grey line: "6 calls · 0.01 USDC · 0 memories". |

## Remoras (`remoras`, `empty-remoras`)
**Five seconds:** For: all my remoras. First click: "+ New remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-remoras-1 | filled · phone | Minor | The header still wraps. "Export team" and "Import a team" take row 1, and the main "+ New remora" drops alone onto row 2. The empty state puts "Import a team" and "New remora" beside the title instead. (R2P-remoras-1, still open.) | One row, the same in both states: "+ New remora", plus a "⋯" that holds Import and Export. |
| R3P-remoras-2 | filled · phone | Minor | 31 cards of about 115 px make a page of about 4,070 px, with no search. The first four look identical: "Researcher · demo / Researcher / can't spend / No limit onchain". (R2P-remoras-2, still open.) | A search field over the chips, and compact rows (face, name, pill). |

## Remora page (`remora-researcher-*`, `remora-watcher-*`, `loading-remora`, `error-remora`)
**Five seconds:** For: one remora: ask it, its budget, what it did and what it learned. First click: "Ask".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-remora-1 | all tabs · phone | Minor | The header repeats in full on every tab (R2P-remora-1, still open):<br>• About 240 px on the Researcher.<br>• About 370 px on the retired Watcher: three lines of persona, a lone "⋯" and the Retired card.<br>On the Watcher's Learning tab, "Proof of Learning", the page's best story, has its heading at about 770 px, right under the bottom bar. Its before/after cards are on screen two. | On every tab but Overview, collapse the header to one line: face · name · pill. On the Watcher's Learning tab, put the proof first. |
| R3P-remora-2 | all tabs · phone | Minor | "Chat" (about 31 px, with an icon) and "Pause" (about 35 px) are different heights. On the retired Watcher, a lone "⋯" takes a row of about 45 px. (R2P-remora-2, still open.) | One button height. When only "⋯" is left, move it into the title row. |
| R3P-remora-3 | settings · phone | Minor | Field widths differ on one tab: Brain's "Remora ▾" is a chip of about 85 px, while Name, Persona, Schedules and the "Add" button run full width. (R2P-remora-3, still open.) | On phones, every input and select full width. |
| R3P-remora-4 | watcher learning · phone | Minor | Under "What it learned in between", the rule's copy icon sits on the card's right border, past its padding. The row is wider than the card at 412 px. | Let the rule text wrap, and keep the copy icon inside the padding. |
| R3P-remora-5 | activity · phone | Nit | "Its memory" sits alone, right-aligned, on a row of about 50 px above the feed. | Put it in the feed's header line: "Yesterday · Its memory ›". |

**Words that could go:** the persona sentence under the name on Activity, Learning and Settings; "Retired: it can't act or pay. Its memory and receipts stay yours." (the Watcher's Settings, right under the Retired card that says the same); "Before, it pinged you (Received 0.001 SUI (49Lnbdfi...)). After it learned …, it stayed quiet (…)." (four lines that repeat the Before and After cards under it).

## New remora (`remoras-new`)
**Five seconds:** For: making a remora. First click: "Researcher", then "Create Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-new-1 | form · phone | Minor | "Create Researcher" is about 1,160 px down, after a Summary card that repeats the fields just filled in: Template, Name, Monthly limit, Most at once. (R2P-new-1, still open.) | On phones, swap the Summary for a sticky footer: "1 USDC/mo · ≤ 0.05 · 20 at the cap · Create". |

## Template page (`hatchery-template`)
**Five seconds:** For: checking a shared remora before copying it. First click: can't tell. The template is blocked, and "Use it (one signature)" is greyed about 980 px down.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-tmpl-1 | filled · phone | Minor | Under "Share", the two snippet boxes are still cut at the right edge, with no fade or scroll cue: "[Use this remora](http://…/hatchery/0x" and `<a href="http://…/hatchery/0x46cb15520`. (R2P-tmpl-1, still open.) | On phones, keep only "Copy Markdown" and "Copy HTML", or one line with an end fade. |

**Words that could go:** "It's created under 0xd970...4757 in practice mode. You set its budget later on its page; until then the template's suggestion applies, and its spending limit caps every payment onchain." (3 lines that repeat the "It starts in practice mode" card)

## Verify a receipt (`verify`, `verify-receipt`, `out-verify`)
**Five seconds:** For: checking a receipt against Sui. First click: a row's "Verify".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-verify-1 | filled · phone | Minor | "What we checked" still prints every id in full, and they wrap with orphans:<br>• The tx digest leaves "ma" alone on line 2.<br>• The intent hash and the signer each take two lines.<br>The receipt card just above already shows the tx short, with copy: "EWnMQxNb85F...GpK5VCccma". | Short ids with copy in the checks, the same as the card. |
| R3P-verify-2 | filled · phone | Minor | The Receipt table keeps a label column of about 120 px, so values wrap (R2P-verify-2, still open):<br>• "Check" runs to five lines.<br>• "Memories" runs to three: "me (Yb9ZNt1rzqM0Av_NbwZ6Cno-5YUCwhSOPNNrN7ymWZw)".<br>• "Intent hash" runs to three, ending with "94" alone. | On phones, stack each label over its value, and shorten the ids. |
| R3P-verify-3 | filled · phone | Nit | In "Your recent receipts", "3d ago" pushes the last row's amount about 4 px right of the "11h ago" rows. (R2P-verify-3, still open.) | A fixed-width time column. |

## Shared proof (`public-receipt`)
**Five seconds:** For: proof of one payment, for anyone. First click: the transaction link.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-receipt-1 | filled · phone | Minor | In "What happened", Paid to, Transaction and Signed by are short, with copy. "Intent hash" in the same card is still printed in full on three lines, ending with "94" alone (R2P-receipt-1, still open). "What we checked" has the same full ids as Verify (R3P-verify-1). | The same short form and copy button. |
| R3P-receipt-2 | filled · phone | Nit | The bar title is cut: "Researcher · demo: Pay 0.01 USDC to S…". The receipt card under it already says all of that. | Bar title "Shared proof", or the remora's name. |

**Words that could go:** "verified" (the pill beside the heading "Verified"); "A receipt for what Researcher · demo did, checked against Sui. No sign-in needed." (the card and the Verified box say it)

## Sign in (`out-sign-in`, `out-remoras`)
**Five seconds:** For: connecting a wallet. First click: "Try without a wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-signin-1 | out · phone | Minor | The subtitle, "Slush, or any other Sui wallet in this browser.", still contradicts the next line, "No Sui wallet in this browser." The main button, "Get Slush ↗", installs an app instead of opening this page in one. (R2P-signin-1, still open.) | Drop the subtitle when no wallet is found. Make the main button "Open in Slush", a deep link to this page, with "Get Slush" small under it. |

## Get started (`onboarding`, `empty-onboarding`, the setup card on `empty-home`)
**Five seconds:** For: the setup checklist. First click: "Add funds".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-onboard-1 | all · phone | Minor | Each step still puts its circle on a row of its own above the title, so the four steps take about 420 px. The fourth circle shows a "·" where the others show a number. (R2P-onboard-1, still open.) | Put the circle left of the title, on the same row, and number it "4". |

## Funds (`funds`, `empty-funds`, `loading-funds`, `error-funds`)
**Five seconds:** For: my balance and each remora's spending limit. First click: "+ Add USDC".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-funds-1 | empty · phone | Nit | The empty state leaves "one." alone on line 2 of "No spending limits yet. Each new remora gets one." | "No spending limits yet." on its own line, or balance the wrap. |

## Landing (`landing`, `landing-00-problem` … `landing-06-part-6`)
**Five seconds:** For: what Remora is, with a way to try it. First click: "Try a Researcher · $1 limit · no wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-landing-1 | out · phone | Major | "Built to be read." still shows desktop screenshots shrunk to about 385 px wide, with text of 3–4 px. About 1,300 px of frames prove nothing on a phone. (R2P-landing-1, moved to Part D, unchanged.) | Use phone captures, or crop each frame to one zoomed piece: the memory row, the budget meter, the Services prices, the Status list. |
| R3P-landing-2 | out · phone | Minor | The hero still stacks four chips on two rows ("Sui", "Walrus Memory", "Tatum gRPC", "Total Recall · Track 2"), about 75 px above the headline. A floating blue face overlaps the "remora" logo. (R2P-landing-2, still open.) | On phones, two chips (Sui, Walrus), or move them under the buttons. Keep the faces clear of the header. |
| R3P-landing-3 | out · phone | Minor | The browser-frame mock under the hero breaks at 412 px:<br>• Its address pill, "getremora.vercel.app · Researcher · demo", wraps to two lines and covers the green window dot.<br>• The desktop app inside it is shrunk to about 4 px text again ("Testnet", "Pause all").<br>• A green face is cut off at the right edge. | On phones, shorten the pill to "getremora.vercel.app", keep it clear of the dots, and show a phone capture inside. |
| R3P-landing-4 | out · phone | Minor | In "Numbers from recorded runs.", the proof ids print in full and wrap:<br>• "blob rbQ84ahd68FicrNgwK48mINczlYb6-lzncPWs9au" leaves "MXw" on line 2.<br>• The abort digest "7NYf3QGEX8UEbU7nBhv1egC6tZFoUq23NWZZSjoLnpSV" leaves its "↗" alone on line 2.<br>• "JSON-RPC" splits at the hyphen. | Short ids with the arrow attached ("7NYf3Q…LnpSV ↗"), and a no-break "JSON‑RPC". |

**Words that could go:** "Tatum gRPC" and "Total Recall · Track 2" (hero chips); "money on Sui testnet · memory on Walrus mainnet · every Sui call through Tatum" (it repeats the chips)

## Guide (`guide`, `out-guide`)
**Five seconds:** For: how Remora works, page by page. First click: "Open chat".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-guide-1 | all · phone | Minor | The page is about 6,760 px with no contents. "Commands" and "The same memory in Claude Code" are about nine screens down. (R2P-guide-1, still open.) | A sticky row of section chips under the title: Start · Pages · Memory · Budget · Receipts · Commands. |

## Across pages
| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3P-x-1 | all · phone | Minor | Code wraps four ways (R2P-x-1, still open):<br>• Memory › Chat breaks inside words: "MystenLabs/Me│mWal", "Use m│emwal_recall".<br>• The template's Share snippets clip at the edge.<br>• Feed answers break a code chip at its hyphen: "sui–│risk".<br>• The guide wraps at spaces, in numbered rows with copy. | The guide's style everywhere: wrap at spaces, never inside a code chip, with copy. |
| R3P-x-2 | all · phone | Minor | Inputs come in four widths (R2P-x-2, still open):<br>• Search fields stop about 60 px short of the right edge: Memory › Remoras, Templates, Services.<br>• Memory › Chat's search runs full width, with a "Search" button.<br>• Memory's remora picker is about 190 px, and Brain's select about 85 px.<br>• Verify and New remora run full width. | Full-width inputs and selects on phones. |
| R3P-x-3 | all · phone | Minor | Some hints still rely on hover (a dotted underline), and a phone has none: the "Services" H1, "Gas (sponsored)" in Cost, "Spending limit" in Keys, and "safety check" in the receipt's Check row. Most pages use a tappable `?`. (R2P-x-3, still open.) | The `?` icon everywhere. |
| R3P-x-4 | error, loading, out · phone | Minor | The bar names a remora page "Remora" while it loads or fails (`loading-remora`, `error-remora`), and the signed-out Remoras page "remora" in lower case (`out-remoras`). Everywhere else, the bar says the page's own name. | "Remoras" while loading or failing, then the remora's name. "Remoras" signed out too. |
| R3P-x-5 | filled · phone | Minor | Tiles are laid out 2 + 1, leaving half a row empty: Home's "Ready to spend" sits alone, and so does the Watcher's "Rules learned". Funds lays its two tiles out cleanly. (R2P-x-5, still open.) | Three compact tiles in one row (label over number), or the odd tile at full width. |
| R3P-x-6 | filled · phone | Minor | One id gets several "short" forms, and the long ones eat a phone row:<br>• Payee: "0x9964291010a5e3d455...0e0625bf0b05acaf4a8" (40 characters, Services) vs "0x9964291010...0b05acaf4a8" (the proof).<br>• Transaction: "EWnMQxNb85F...GpK5VCccma" (receipt card), "EWnMQxNb85FK...3GpK5VCccma" (What happened), "EWnMQxNb85..." (Receipt table), and the full digest (checks).<br>• Memory blob: "zLTcs1jALRLa2AnLj8R3...yaLMRsNzy9T1p_szqJo" (row) vs "zL...Jo" (Skipped). | One short form everywhere (first 6 … last 4) with copy and an explorer link. |

**Counts:** Blocker 0 · Major 2 · Minor 37 · Nit 6
