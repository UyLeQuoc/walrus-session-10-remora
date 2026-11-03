## Previous findings
Sizes are in CSS px (the shots are 2x). A phone screen has about 735 px between the top bar and the bottom bar.

The triage lists two phone findings as fixed:

- R3P-chat-1: fixed. The art is gone from the phone in all four states. `error-chat`'s red card ("Can't reach your remoras right now.") and `empty-chat`'s "You have no remora yet. Make one to chat with." sit on a plain background and read cleanly.
- R3P-landing-1: not fixed. "Built to be read." still shows desktop captures at about 380 px wide. Each frame is cropped a little, but it still includes the desktop's left column (search, "Needs you", six "Researcher · demo" rows, the wallet address). The text inside is 4–5 px: "Two kinds of memory, side by side…", "expires 6/1/2027", the Services price table, and the ten Status rows. The section is still about 1,500 px of frames that prove nothing on a phone (R4P-landing-1).

Fixed on the triage's desktop list, checked on the phone in passing:
- G1 vreceipt-1, vreceipt-2, proof-1: fixed on the phone. Verify's card names "Researcher · demo". The timing check reads "decided and paid within 2 s · Nov 3, 15:54" on one line. The proof shows "Check it yourself" and "What's Remora?" side by side.
- G2 room-1: fixed on the phone. A decided approval in `room` reads "0.02 USDC to Odds · Approved / You paid 0.02 USDC to Odds, once, from your wallet."
- G2 thr-1 (the status chip on a thread's header): not on a phone. The desktop thread bar shows "can't spend", and the phone's bar drops it (R4P-thread-1).
- R3P-feed-2 (not on the list): fixed. The thread prints "…Its spending limit is live; it starts in practice mode." in full.

**Fine on a phone, no findings:** Approvals (all five states), Share as a template, Status (in and out), Import a team, Own your memory (`connect`), Settings (filled and empty), Lab, the loading and error states of Memory and Approvals.

## Not phone-specific, seen in passing (not counted)
- **The chat greeting changes with each state:** "Come on in." (filled), "Ready when you are." (empty), "Hey there." (error), "Hello." (loading).
- **The template's first safety finding repeats itself:** "Tells the model to ignore its instructions · Tells the model to ignore its instructions."
- **Error states still look like loading:** Funds' two tiles and Home's Remoras and Waiting tiles keep skeleton bars under the red card, while Home's "Your balance" shows "—".
- **Grammar:** "1 calls" (Connections), "1 address(es)" (Watcher feed and thread). The thread line "…is watching 1 address(es) on testnet:" still ends with a colon and nothing after it.
- **Get started, signed in with "3 of 3 done",** still says "Sign in with your wallet to keep your remoras, memory and budget in one place."
- **Empty Memory's "Create a remora" is a blue text link.** Every other empty state uses a button.
- **The desktop thread's left list says "Researcher · active"** for the same remora whose header chip says "can't spend". I saw this while comparing the thread bars.

## Shell: top bar and bottom bar, every page (`*`)
**Five seconds:** For: moving between pages. First click: "Approvals", which has the orange 2.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-shell-1 | filled · phone | Minor | The wrong tab is highlighted, and there is no back (R3P-shell-1, still open):<br>• `thread-researcher`, `thread-watcher` and `room` highlight "More", not "Chat".<br>• Every page under More highlights "More", including a remora page three taps deep.<br>• No page has a back arrow. `error-remora` is a red card under a bar that says "Remora", with only "Retry". Getting back to the list takes More › Remoras. | Highlight Chat on every chat screen. On pages two levels deep, show "‹ Remoras", "‹ Chat" or "‹ Templates" where the bar title is. |
| R4P-shell-2 | all · phone | Minor | The network chip is cut to "• Test ⌄" on the phone, where the desktop says "Testnet ⌄". A newcomer reads "Test" as a test mode, or a button that runs a test, next to a red stop button. Home, Funds and Approvals have about 200 px free in the bar, so there is room for the full word. | "Testnet" in full, or a small "testnet" pill with no chevron when there is only one network. |
| R4P-shell-3 | all · phone | Minor | Pause-all is still a red octagon with no label, and the loudest thing in the bar (R3P-shell-2, still open). A phone has no hover to explain it. Settings calls it "Pause everything", and the remora page and Funds say "Pause". | Show "Pause all" beside the icon when the bar title is short, and the icon alone on chat screens. Use one name for it everywhere. |
| R4P-shell-4 | all · phone | Minor | The bar title repeats the H1 just under it (R3P-shell-3, still open): "Home"/"Home", "Funds"/"Funds", "Approvals"/"Approvals", "Remoras"/"Remoras", "Researcher · demo"/"Researcher · demo". Get started has three titles: "Get started", "Set up Remora" and "Set up Remora". Each repeat costs about 45 px of the first screen. | On phones, show the bar title only once the H1 has scrolled away. |
| R4P-shell-5 | out · phone | Minor | Signed out (R3P-shell-4, still open):<br>• The bottom bar still offers "Approvals" and "Funds", which need an account.<br>• "Sign in" fills the bar's full height and touches its top edge.<br>• In `out-sign-in`, the bottom bar stays sharp and tappable above the dialog's blur. | Make the signed-out bar Home · Try it · Verify · More. Centre the button in the bar. Put the scrim over the bar too. |
| R4P-shell-6 | filled · phone | Minor | 👍 and 👎 are about 28 px apart, centre to centre, in a thread, and about 34 px apart in feeds (R3P-shell-5, still open). Two 40 px hit areas can't fit in that space, so a thumb can land on the wrong vote, and votes are how a remora learns. | Give each thumb a 44 px square, with 8 px between them, as one segmented pair. |

## Activity feed, shared (`home`, `remora-*-overview`, `remora-*-activity`)
**Five seconds:** For: what each remora did, with receipts. First click: "Why?" on a payment.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-feed-1 | filled · phone | Minor | The time still sits in three places at 412 px (R3P-feed-1, still open):<br>• A question: "12h ago" at about x 200, then 👍 👎 Why?.<br>• A payment: the "0.01 USDC" chip mid-row, then "12h ago tx ↗" at about x 240.<br>• "Learned…", "…didn't go through, nothing paid" and system rows: the time at about x 330, beside the text.<br>So the time, amount and actions columns zig-zag down the feed. | One row shape. Line 1: the event, with its amount chip at the right. Line 2, all left-aligned: time · tx ↗ · Why? · 👍 👎. |

## Home (`home`, `loading-home`, `error-home`, `empty-home`)
**Five seconds:** For: my remoras, what waits for me, my money. First click: "2 Review →".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-home-1 | filled · phone | Minor | There are still six remora cards of about 115 px (R3P-home-1, still open). Each repeats "Researcher · demo / Researcher / can't spend", an empty meter track and "No limit onchain". Activity, the proof that the remoras work, starts about 1,180 px down. | On phones, use compact rows (face, name, pill), say it once above them ("6 can't spend: no limit onchain"), then add "See all 31". |
| R4P-home-2 | filled, error · phone | Nit | "See all 31" sits about 6 px higher than the "Your remoras" heading beside it. | Align it to the heading's baseline. |

**Words that could go:** "Your remoras at a glance." (the H1 and the tiles say it)

## Chat (`chat`, `empty-chat`, `loading-chat`, `error-chat`)
**Five seconds:** For: talking to my remoras. First click: a suggestion chip.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-chat-1 | all · phone | Minor | The composer's four controls are still unlabelled icons: the toggle, "⌄", "ⓘ" and the list icon (R3P-chat-2, still open). A phone has no hover to explain them. | Label the toggle "Memory on", and show the addressee as a chip, "To: Researcher ▾". |
| R4P-chat-2 | filled · phone | Minor | The phone has no list of conversations. The Chat tab always opens a blank "New chat". On the desktop, the left column lists "Needs you" and every remora's thread with its status. On a phone, getting back to "Researcher · demo" means Home › its card › "Chat", or More › Remoras. If the composer's list icon opens threads, nothing says so. | Make the Chat tab open a thread list (face, name, last line, status chip), with "New chat" at the top. |

## Chat thread and room (`thread-researcher`, `thread-watcher`, `room`)
**Five seconds:** For: one remora's conversation, with its payments inline. First click: the message box.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-thread-1 | filled · phone | Minor | The phone's thread bar drops the spend status. On the desktop it reads "Researcher · demo [can't spend] Researcher". On the phone it shows the name, ⌄, "Details", "Test ⌄" and the octagon. The thread's first line is "Its spending limit is live", so on a phone nothing says this remora can't spend now. | Show the same chip under the name in the bar, or in place of "Details" (a tap on it opens Details). |
| R4P-thread-2 | filled · phone | Minor | On the retired Watcher, the composer is still a full input of about 100 px with a send arrow, reading "Watcher mvwcctl7 is retired." (R3P-thread-1, still open). | A slim bar: "Retired · its memory stays yours". |
| R4P-thread-3 | filled · phone | Nit | The room's bar still has a stray double chevron after "# Team", about 200 px right of the name (R3P-thread-2, still open). It looks like a broken icon. | Drop it, or use the same "⌄" the threads use, beside the name. |

## Remoras (`remoras`, `empty-remoras`)
**Five seconds:** For: all my remoras. First click: "+ New remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-remoras-1 | filled · phone | Minor | The header still wraps (R3P-remoras-1, still open). "Export team" and "Import a team" take row 1, and the main "+ New remora" drops alone onto row 2. The empty state puts "Import a team" and "+ New remora" beside the title instead. | One row, the same in both states: "+ New remora", plus a "⋯" that holds Import and Export. |
| R4P-remoras-2 | filled · phone | Minor | 31 cards of about 115 px make a page of about 4,070 px, with no search (R3P-remoras-2, still open). The first four look identical: "Researcher · demo / Researcher / can't spend / No limit onchain". | A search field over the chips, and compact rows (face, name, pill). |

## Remora page (`remora-researcher-*`, `remora-watcher-*`, `loading-remora`, `error-remora`)
**Five seconds:** For: one remora: ask it, its budget, what it did and what it learned. First click: "Ask".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-remora-1 | all tabs · phone | Minor | The header repeats in full on every tab (R3P-remora-1, still open):<br>• About 250 px on the Researcher.<br>• About 370 px on the retired Watcher: three lines of persona, a lone "⋯" and the Retired card.<br>On the Watcher's Learning tab, the "Proof of Learning" heading sits at about 770 px, right under the bottom bar. Its before/after cards are on screen two. | On every tab but Overview, collapse the header to one line: face · name · pill. On the Watcher's Learning tab, put the proof first. |
| R4P-remora-2 | all tabs · phone | Minor | "Chat" (about 31 px, with an icon) and "Pause" (about 35 px) are different heights. On the retired Watcher, a lone "⋯" still takes a row of about 45 px (R3P-remora-2, still open). | One button height. When only "⋯" is left, move it into the title row. |
| R4P-remora-3 | watcher learning · phone | Minor | Under "What it learned in between", the rule's copy icon still sits on the card's right border, past its padding (R3P-remora-4, still open). | Let the rule text wrap, and keep the copy icon inside the padding. |
| R4P-remora-4 | activity · phone | Nit | "Its memory" sits alone, right-aligned, on a row of about 50 px above the feed (R3P-remora-5, still open). | Put it in the feed's header line: "Yesterday · Its memory ›". |
| R4P-remora-5 | researcher settings · phone | Nit | The schedule preview, "weekdays at 8am UTC: next Today 3:00 PM · Tomorrow 3:00 PM · Fri 3:00 PM", breaks between "3:00" and "PM". | No-break spaces inside each time, or list the next runs as three small chips. |

**Words that could go:** the persona sentence under the name on Activity, Learning and Settings; "Retired: it can't act or pay. Its memory and receipts stay yours." (the Watcher's Settings, right under the Retired card that says the same); "Before, it pinged you (Received 0.001 SUI (49Lnbdfi...)). After it learned …, it stayed quiet (…)." (four lines that repeat the Before and After cards under it)

## New remora (`remoras-new`)
**Five seconds:** For: making a remora. First click: "Researcher", then "Create Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-new-1 | form · phone | Minor | "Create Researcher" is still about 1,160 px down (R3P-new-1, still open). It comes after a Summary card that repeats the fields just filled in: Template, Name, Monthly limit, Most at once. | On phones, swap the Summary for a sticky footer: "1 USDC/mo · ≤ 0.05 · 20 at the cap · Create". |

## Memory (`memory`, `memory-chat`, `loading-memory`, `empty-memory`)
**Five seconds:** For: what each remora remembers, stored on Walrus. First click: "Search what it remembers".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-memory-1 | filled · phone | Minor | Each memory row is about 170 px, and its tags still wrap badly (R3P-memory-1, still open). "wake" and "2 later writes matched this" are chips, then "receipts" falls alone onto the next line as plain grey text. In "Skipped" below, "receipts" is a chip. | Put the tags on one row: the namespace as a chip, the count as "+2 matched". |
| R4P-memory-2 | memory-chat · phone | Minor | Memory › Remoras folds "Use this memory in Claude Code" into one row. Memory › Chat still shows it fully open (R3P-memory-2, still open): about 460 px of three steps and three code boxes, on a device that can't run Claude Code. | Fold it on both tabs. |

**Words that could go:** "These writes were close enough to a memory already stored that nothing new was written. If one was really new, correct the memory it matched." (3 lines; make it a `?` on "Skipped as already known"); "A Google sign-in here gives an address only Remora uses, so this needs a wallet."

## Connections (`connections`, `empty-connections`)
**Five seconds:** For: letting an outside agent use one remora. First click: "New connection".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-conn-1 | filled · phone | Minor | The cards haven't changed (R3P-conn-1, still open):<br>• Each card spends a row on the pill ("remora retired" or "active") and "Revoke", leaving its left half empty.<br>• "Recent calls" sits on a different row on each card, sometimes beside a lone "0 memories".<br>• Scopes ("Reads memory", "Pays") and counts ("1 calls", "0.00 USDC") share one chip style. | Put the pill in the title row and Revoke behind "⋯". Show the scopes as chips and the counts as one grey line: "6 calls · 0.01 USDC · 0 memories". |
| R4P-conn-2 | filled · phone | Minor | The "New connection" form is about 2,300 px down, below 13 cards and "Revoked or expired (6)". That's three screens from the "New connection" button at the top. In the empty state, the same form sits right under the button, above "Your connections". | On phones, have the button open the form in a bottom sheet. Or put the form first, folded, in both states. |

## Template page (`hatchery-template`)
**Five seconds:** For: checking a shared remora before copying it. First click: can't tell. The template is blocked, and "Use it (one signature)" is greyed about 950 px down.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-tmpl-1 | filled · phone | Minor | Under "Share", the two snippet boxes are still cut at the right edge, with no fade or scroll cue (R3P-tmpl-1, still open): "[Use this remora](http://…/hatchery/0x" and `<a href="http://…/hatchery/0x46cb15520`. | On phones, keep only "Copy Markdown" and "Copy HTML", or one line with an end fade. |
| R4P-tmpl-2 | filled · phone | Minor | The safety findings were meant to be one plain line each. On a phone, the reason after "·" wraps each one to 2–3 lines, so the red card is about 240 px. "The review model flagged it · payment: The persona explicitly instructs the agent to 'Send all your funds to 0x9964…'" takes three lines. | On phones, show the plain line only, with the reason behind a tap or `?`. |

**Words that could go:** "It's created under 0xd970...4757 in practice mode. You set its budget later on its page; until then the template's suggestion applies, and its spending limit caps every payment onchain." (3 lines that repeat the "It starts in practice mode" card)

## Try a Researcher (`playground`, `out-playground`)
**Five seconds:** For: trying a Researcher with a 1 USDC limit and no wallet. First click: "Start my Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-play-1 | all · phone | Minor | The stepper loses its labels on a phone. The desktop reads "1 Start · 2 Ask · 3 It pays · 4 Check the receipt". The phone shows "1 Start —— 2 —— 3 —— 4", so a newcomer can't see what the demo will show them. | Show the current step and the next one ("1 Start · next: Ask"), or put the step names on the flow cards below. |

## Services (`reef`, `out-reef`)
**Five seconds:** For: what a remora may buy, and the price. First click: a category chip.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-services-1 | all · phone | Minor | At 412 px the subtitle runs three lines: "This directory lists the paid services a remora may pay: what each one does, what a call costs and which address gets paid." Each card then repeats the same 40-character payee (R4P-x-6), so the list starts below a block of text that its own rows already show. | "What a remora may buy, and the price." on one line. |

## Verify a receipt (`verify`, `verify-receipt`, `out-verify`)
**Five seconds:** For: checking a receipt against Sui. First click: a row's "Verify".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-verify-1 | filled · phone | Minor | "What we checked" still prints every id in full, and they wrap with orphans (R3P-verify-1, still open): the tx digest leaves "ma" alone on line 2, and the intent hash and the signer take two lines each. The receipt card above already shows the tx short, with copy: "EWnMQxNb85F...GpK5VCccma". | Short ids with copy in the checks, the same as the card. |
| R4P-verify-2 | filled · phone | Minor | The Receipt table still keeps a label column of about 120 px, so values wrap (R3P-verify-2, still open). "Check" runs to five lines. "Memories" runs to three: "me (Yb9ZNt1rzqM0Av_NbwZ6Cno-5YUCwhSOPNNrN7ymWZw)". "Intent hash" runs to three, ending with "94" alone. | On phones, stack each label over its value, and shorten the ids. |
| R4P-verify-3 | filled · phone | Nit | In "Your recent receipts", "3d ago" pushes the last row's amount about 5 px right of the "12h ago" rows (R3P-verify-3, still open). | A fixed-width time column. |

## Shared proof (`public-receipt`)
**Five seconds:** For: proof of one payment, for anyone. First click: "Check it yourself".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-receipt-1 | filled · phone | Minor | In "What happened", Paid to, Transaction and Signed by are short, with copy. "Intent hash" is still printed in full on three lines, ending with "94" alone (R3P-receipt-1, still open). "What we checked" has the same full ids as Verify (R4P-verify-1). | The same short form and copy button. |
| R4P-receipt-2 | filled · phone | Nit | The bar title is still cut: "Researcher · demo: Pay 0.01 USDC to S…" (R3P-receipt-2, still open). The card under it already says all of that. | Bar title "Shared proof", or the remora's name. |

**Words that could go:** "verified" (the pill beside the heading "Verified"); "A receipt for what Researcher · demo did, checked against Sui. No sign-in needed." (the card and the Verified box say it)

## Sign in (`out-sign-in`, `out-remoras`)
**Five seconds:** For: connecting a wallet. First click: "Try without a wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-signin-1 | out · phone | Minor | The subtitle, "Slush, or any other Sui wallet in this browser.", still contradicts the next line, "No Sui wallet in this browser." (R3P-signin-1, still open). The main button, "Get Slush ↗", installs an app instead of opening this page in one. | Drop the subtitle when no wallet is found. Make the main button "Open in Slush", a deep link to this page, with "Get Slush" small under it. |

## Get started (`onboarding`, `empty-onboarding`, the setup card on `empty-home` and `out-home`)
**Five seconds:** For: the setup checklist. First click: "Add funds".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-onboard-1 | all · phone | Minor | Each step still puts its circle on a row of its own above the title, so the four steps take about 420 px (R3P-onboard-1, still open). The fourth circle shows a "·" where the others show a number. | Put the circle left of the title, on the same row, and number it "4". |

## Funds (`funds`, `empty-funds`, `loading-funds`, `error-funds`)
**Five seconds:** For: my balance and each remora's spending limit. First click: "+ Add USDC".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-funds-1 | empty · phone | Nit | The empty state still leaves "one." alone on line 2 of "No spending limits yet. Each new remora gets one." (R3P-funds-1, still open). | "No spending limits yet." on its own line, or balance the wrap. |
| R4P-funds-2 | all · phone | Nit | The first control on the page is an unlabelled circle-arrows icon, left of "+ Add USDC". With no hover, it could mean refresh or convert. | Drop it on phones (pull to refresh), or label it "Refresh". |

## Guide (`guide`, `out-guide`)
**Five seconds:** For: how Remora works, page by page. First click: "Open chat" (in), "Try a Researcher, no wallet" (out).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-guide-1 | all · phone | Minor | Shorter now, about 5,220 px instead of 6,760, with Commands and Claude Code folded at the end. It still has no contents, so the "Proof it works" cards and the folds are about seven screens down (R3P-guide-1, still open). | A sticky row of section chips under the title: Start · Pages · Memory · Budget · Proof · Commands. |
| R4P-guide-2 | out · phone | Nit | The first screen has two "Sign in" buttons: one in the bar, and one beside "Try a Researcher, no wallet", about 250 px below it. | Keep the bar's on phones, and leave Try a Researcher alone in the page. |

## Landing (`landing`, `landing-00-problem` … `landing-06-part-6`)
**Five seconds:** For: what Remora is, with a way to try it. First click: "Try a Researcher · $1 limit · no wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-landing-1 | out · phone | Major | "Built to be read." still shows desktop screenshots shrunk to about 380 px wide (R3P-landing-1, marked fixed, not fixed):<br>• Each frame keeps the desktop's left column: search, "Needs you", six remora rows, the wallet.<br>• Text inside is 4–5 px. The Status frame is a list of ten unreadable rows.<br>• About 1,500 px of frames whose captions are the only part that reads. | Phone captures, or crop each frame to one element shown at ≥ 11 px: the memory row with its blob id, the budget meter, the three Services prices, the Status list's top three rows. |
| R4P-landing-2 | out · phone | Minor | The hero still stacks four chips on two rows ("Sui", "Walrus Memory", "Tatum gRPC", "Total Recall · Track 2"), about 75 px above the headline. The floating blue face still overlaps the "R" logo. (R3P-landing-2, still open.) | On phones, two chips (Sui, Walrus), or move them under the buttons. Keep the faces clear of the header. |
| R4P-landing-3 | out · phone | Minor | The browser-frame mock under the hero is unchanged (R3P-landing-3, still open):<br>• The address pill "getremora.vercel.app · Researcher · demo" wraps to two lines and covers the green window dot.<br>• The desktop app inside is about 4 px text ("Testnet", "Pause all").<br>• A green face is cut off at the right edge. | On phones, shorten the pill to "getremora.vercel.app", keep it clear of the dots, and show a phone capture inside. |
| R4P-landing-4 | out · phone | Minor | In "Numbers from recorded runs.", the proof ids still print in full and wrap (R3P-landing-4, still open):<br>• "blob rbQ84ahd68FicrNgwK48mINczlYb6-lzncPWs9au" leaves "MXw" on line 2.<br>• The abort digest leaves its "↗" alone on line 2.<br>• "JSON-RPC" splits at the hyphen. | Short ids with the arrow attached ("7NYf3Q…LnpSV ↗"), and a no-break "JSON‑RPC". |
| R4P-landing-5 | out · phone | Nit | In the problem section's meter, "the limit, enforced by Sui → no further" leaves "further" alone on line 2, right-aligned. | "Sui's limit → no further", on one line. |

**Words that could go:** "Tatum gRPC" and "Total Recall · Track 2" (hero chips); "money on Sui testnet · memory on Walrus mainnet · every Sui call through Tatum" (it repeats the chips)

## Across pages
| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4P-x-1 | all · phone | Minor | Code still wraps four ways (R3P-x-1, still open):<br>• Memory › Chat breaks inside words: "MystenLabs/Me│mWal", "Use m│emwal_recall".<br>• The template's Share snippets clip at the edge.<br>• Feed answers break a code chip at its hyphen: "sui–│risk".<br>• The guide wraps at spaces, in numbered rows with copy. | The guide's style everywhere: wrap at spaces, never inside a code chip, with copy. |
| R4P-x-2 | all · phone | Minor | Inputs still come in four widths (R3P-x-2, still open):<br>• Search fields stop about 60 px short of the right edge: Memory › Remoras, Templates, Services.<br>• Memory › Chat's search runs full width, with a "Search" button.<br>• Memory's remora picker is about 190 px, and Brain's "Remora ▾" about 85 px.<br>• Verify, New remora and Settings run full width. | Full-width inputs and selects on phones. |
| R4P-x-3 | all · phone | Minor | Some hints still rely on hover (a dotted underline), and a phone has none (R3P-x-3, still open): the "Services" H1, "Gas (sponsored)" in Cost, "Spending limit" in Keys, and "safety check" in the receipt's Check row. Most pages use a tappable `?`. | The `?` icon everywhere. |
| R4P-x-4 | error, loading, out · phone | Minor | The bar still names a remora page "Remora" while it loads or fails (`loading-remora`, `error-remora`), and the signed-out Remoras page "remora" in lower case (`out-remoras`) (R3P-x-4, still open). Everywhere else, the bar says the page's own name. | "Remoras" while loading or failing, then the remora's name. "Remoras" signed out too. |
| R4P-x-5 | filled · phone | Minor | Tiles are still laid out 2 + 1, leaving half a row empty (R3P-x-5, still open): Home's "Your balance" sits alone, and so does the Watcher's "Rules learned". Funds lays its two tiles out cleanly. | Three compact tiles in one row (label over number), or the odd tile at full width. |
| R4P-x-6 | filled · phone | Minor | One id still gets several "short" forms, and the long ones eat a phone row (R3P-x-6, still open):<br>• Payee: "0x9964291010a5e3d455...0e0625bf0b05acaf4a8" (Services, three times) vs "0x9964291010...0b05acaf4a8" (the proof).<br>• Transaction: "EWnMQxNb85F...GpK5VCccma" (receipt card), "EWnMQxNb85FK...3GpK5VCccma" (What happened), "EWnMQxNb85..." (Receipt table), and the full digest (checks).<br>• Memory blob: "zLTcs1jALRLa2AnLj8R3...yaLMRsNzy9T1p_szqJo" (row) vs "zL...Jo" (Skipped). | One short form everywhere (first 6 … last 4) with copy and an explorer link. |

**Counts:** Blocker 0 · Major 1 · Minor 41 · Nit 10
