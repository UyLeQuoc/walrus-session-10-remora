# Round 0 · G2 · Remoras and chat · desktop

Reviewer persona: a hackathon judge with three minutes. Only the screenshots in `docs/ux/review/r0/desktop/` were used. The shell (rail, remora list, wallet chip) is reviewed once, under `loading-remora`, where it goes wrong.

## Remoras list (`remoras`)
**Five seconds:** For: all my agents at a glance, plus what needs me. First click: "New remora" (or "Review" on the orange approvals banner).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-remoras-1 | filled · desktop | Major | Every Researcher card's only data line reads "Budget not readable just now." (15 cards), and every watcher card reads "Read-only: no budget to spend." The number that matters, spent against the limit, is missing from every card, and the grid reads like a wall of errors. | Give each card a spend meter ("0.02 / 0.50 USDC") with a skeleton bar while the chain read is pending. If the read fails, show one banner above the grid, not one per card. For watchers, show "watching N wallets · N pings" instead of a sentence. |
| R0G2-remoras-2 | filled · desktop | Major | Below the 31 cards, an "Activity" log of about 60 rows makes the page 5,100 px tall. The grid and the full log compete as the page's purpose. | Show the latest 5 rows with "See all", or move the log to its own page. Keep this page about the remoras. |
| R0G2-remoras-3 | filled · desktop | Blocker | A red "Blocked" pill says "Didn't pay Sui risk check: the service answered 200" (also "answered 500" and "fetch failed"). A judge reads "Blocked" as "the spending limit stopped it", which is the product's core claim, yet the reason given is an HTTP success code. The event is mislabelled. | Keep "Blocked" for limit or cap refusals only. Label these "Not paid · service error" in grey, and write the reason in plain words ("the service sent no price"). |
| R0G2-remoras-4 | filled · desktop | Major | Answer rows show raw markup: backticks (`` `0x2` ``, `` `sui-risk` ``), "_I tried to buy … (x402.unsettled) …_" with literal underscores, "* reef:sui-risk ($0)", and a leaked `<untrusted source="reef:sui-risk"> … </untrusted>` tag around one answer. It looks broken and exposes internals ("x402.unsettled"). | Render answer Markdown, strip the internal wrapper tags before display, and map error codes to plain words. |
| R0G2-remoras-5 | filled · desktop | Minor | Questions show the full 66-character package id "0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95e3c69e88434a5d6d" inline, and it wraps rows. | Shorten it to "0xcc05…5d6d" with copy and an explorer link. |
| R0G2-remoras-6 | filled · desktop | Minor | Seven cards are titled "Researcher · demo" with the same subtitle and the same "Budget not readable" line. Nothing on a card tells them apart except the colour of the face. | Add one differentiating fact per card: last active ("9h ago"), spent this month, or questions answered. |
| R0G2-remoras-7 | filled · desktop | Minor | The status pill mixes two ideas: green "active" on Researchers, orange "practice" on watchers. Orange reads as a warning, and "practice" on a "Read-only" watcher that can't spend is confusing. | Use one status pill (Live / Practice / Paused / Retired) with a `?` hint for practice ("acts, but never pays"), in a neutral colour that isn't a warning. |
| R0G2-remoras-8 | filled · desktop | Minor | A row's actor says "Researcher · demo · 3d ago" while its text says "Scout · demo is live." and "Scout · demo is ready…". The same remora appears under two names in one row. | Render event text from the remora's current name, or show "(then: Scout · demo)". |
| R0G2-remoras-9 | filled · desktop | Minor | On Answer rows with long questions, the 👍 👎 "Why?" controls drop to a second line on the left. On short ones they sit on the right. Rows don't line up. | Keep the controls in a fixed right column and truncate the question with an ellipsis instead. |
| R0G2-remoras-10 | filled · desktop | Nit | The banner says "2 approvals waiting" and then "A payment went over its per-payment cap." (singular). | "2 payments went over their cap". |
| R0G2-remoras-11 | filled · desktop | Nit | The "Action" label has no pill background, unlike Answer, Paid, Learned, Blocked and Practice. | Give it the same neutral pill. |

**Words that could go:** "Budget not readable just now." (×15), "Read-only: no budget to spend." (×16), "Learned: " after a "Learned" pill, "(practice mode)" after a "Practice" pill, "Its spending limit is live; it starts in practice mode."

## Remoras, empty account (`empty-remoras`)
**Five seconds:** For: making my first agent. First click: "New remora", or one of the two template cards (it's unclear whether those are clickable).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-emptyrem-1 | empty · desktop | Minor | The empty state uses a small generic logo glyph, not a remora face, and has no button. The two cards "Researcher" and "Wallet watcher" have no arrow or "Start" affordance, so the main action sits only in the header. | Put the two faces (Researcher, Wallet watcher) on the cards, each with a "Create" button, and keep "New remora" as the single loud button. |
| R0G2-emptyrem-2 | empty · desktop | Minor | Three lines of centred prose ("A Researcher buys answers with a budget Sui enforces. A Wallet watcher watches wallets and learns what matters. Pick a template to start.") repeat what the two cards below already say. | Keep one line: "Pick one to start." |

**Words that could go:** "A Researcher buys answers with a budget Sui enforces. A Wallet watcher watches wallets and learns what matters."

## Remoras, signed out (`out-remoras`)
**Five seconds:** For: signing in. First click: "Sign in with your wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-outrem-1 | signed out · desktop | Minor | The breadcrumb reads "remora" in lowercase, the title reads "Sign in", and signed in the same route is "Remoras". | Breadcrumb "Remoras", and title "Remoras" with the sign-in card below it. |
| R0G2-outrem-2 | signed out · desktop | Minor | The main pane gives one line and a button. It doesn't say what a remora is or offer the no-wallet "Try a Researcher" path that sits in the sidebar. | Add the two faces with one line each, plus a secondary "Try one without a wallet" link. |

## New remora (`remoras-new`)
**Five seconds:** For: creating an agent with a spending limit. First click: "Create Researcher". Clear.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-new-1 | filled · desktop | Minor | The limits are explained three times: "Sui won't let it spend more than this a month.", "Anything above this asks you first.", then "Sui enforces this budget onchain, not us. It pays only these sources; anything over 0.05 USDC asks you first." | Drop the last paragraph. Put "Enforced on Sui" as a small badge on the Summary card. |
| R0G2-new-2 | filled · desktop | Minor | "It can pay: Sui risk check · Odds · Brief" are flat chips with no selected or unselected look, so you can't tell whether they're toggles. | Show a check mark on selected chips, or render them as read-only text with "change later". |
| R0G2-new-3 | filled · desktop | Minor | The template cards row ends at about x=1058, the form column at about 987, and the Summary starts at about 1019. Three different right edges. | Make the template row span the form column only, or the full width to 1403. |
| R0G2-new-4 | filled · desktop | Nit | The two limits are only numbers. | Add a small meter under the inputs: a bar for 1 USDC/month with a tick at 0.05 labelled "asks you above this". |

**Words that could go:** "What you will call it in the feed.", "Sui enforces this budget onchain, not us. It pays only these sources; anything over 0.05 USDC asks you first."

## Import a team (`remoras-import`)
**Five seconds:** For: setting up several remoras from one file. First click: can't tell. "Preview" looks disabled though a full file is showing.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-import-1 | filled · desktop | Major | The text box shows a complete team file in bright monospace, yet "Preview" is greyed out. Either the file is a placeholder that looks like real content, or the main button is disabled for no visible reason. "Preview", "Open a .md file" and "Use the example" carry the same weight. | Dim the sample as a real placeholder (or label it "Example"), make "Use the example" fill it in, and make "Preview" the one solid button once there's content. |
| R0G2-import-2 | filled · desktop | Minor | Nothing visual shows what the file creates (2 remoras, a room, budgets). A judge must read YAML. | Beside the box, show a live preview: one card per remora with face, kind and budget meter, plus the room. |

**Words that could go:** "Paste it, or open a .md file."

## Share as a template (`share`)
**Five seconds:** For: publishing this remora for others to copy. First click: can't tell above the fold. The "Publish" button is about 1,100 px down.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-share-1 | filled · desktop | Major | The main action, "Publish as a template (one signature)", is below the fold, under the whole YAML file. | Put "Publish" in the header (top right), and collapse "The file" behind "Show file (560 bytes)". |
| R0G2-share-2 | filled · desktop | Major | The budget and sources are one sentence of raw ids: "May pay only reef:sui-risk, reef:odds, reef:brief, 0.50 USDC a month, at most 0.015 a payment." ("0.015" has no unit). Under it is a developer line: "Tools: memory.recall, memory.remember, pay, notify, handoff". | Show source chips with their plain names (Sui risk check, Odds, Brief), the same budget meter used elsewhere ("0.50 USDC / month · 0.015 USDC max each"), and drop the tools line or put it behind a `?`. |
| R0G2-share-3 | filled · desktop | Minor | "What stays with you" uses raw lowercase keys: "memories:", "keys:", "disc:", "wakes:". "disc" means nothing to a newcomer, and "wakes:" sits next to "Receipts and history stay with you." | Make it a check list with icons: ✓ Memories ✓ Keys ✓ Spending limit ✓ Receipts and history. |
| R0G2-share-4 | filled · desktop | Minor | "560 bytes, public, permanent for about 50 testnet epochs" contradicts itself ("permanent" against "about 50"), and "epochs" is jargon. | "Public on Walrus · 560 B · kept until ~<date> (in N days)". |
| R0G2-share-5 | filled · desktop | Minor | The safety review reads as jargon: "No credentials, no injection or exfiltration phrasing, no raw addresses. Checked: scrubber, patterns, reef, model." | Show a 3-item check list: ✓ No secrets ✓ No hidden instructions ✓ No addresses, with a `?` for the details. |
| R0G2-share-6 | filled · desktop | Nit | The title "Share as a template" doesn't name the remora being shared. | "Share Researcher · demo", with its face. |

**Words that could go:** "This is what people see before they use it.", "Templates never carry memories; the hatcher's remora starts fresh.", "Checked: scrubber, patterns, reef, model."

## Researcher · Overview (`remora-researcher-overview`)
**Five seconds:** For: one agent's home: ask it, see its budget and cost. First click: "Ask" (the "Chat" button competes).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-rov-1 | filled · desktop | Major | The Budget card shows "Reading its spending limit…" in a filled, loaded page, and never shows spent against the limit. It only offers two unit-less edit boxes ("0.50", "0.015") and "Change budget". The core promise, a limit enforced onchain, has no picture. The Cost card next to it does this well ($0.03, big). | Make Budget a meter: "0.02 of 0.50 USDC this month" with a tick for the 0.015 per-payment cap and an "Enforced on Sui ↗" link to the object. Move editing to Settings. |
| R0G2-rov-2 | filled · desktop | Minor | Two ways to talk to it (the "Ask" box and the header "Chat" button), and the bordered "Pause" is the loudest header button. | Keep the Ask box as the main action, make "Chat" a quiet link, and give "Pause" ghost weight. |
| R0G2-rov-3 | filled · desktop | Nit | The cost breakdown is three rows of "< $0.01 · 21%". | A single stacked bar (Model / Gas / Purchases) with the dollar figures on hover. |
| R0G2-rov-4 | filled · desktop | Nit | The Ask box text "Is package 0x2 safe to depend on?" is nearly as bright as typed text, so it's unclear whether it's a placeholder (Ask is greyed). | Dim the placeholder further, or prefill it and enable Ask. |

**Words that could go:** "It buys data when that helps, and tells you what each answer cost.", "Up to 0.50 USDC a month, at most 0.015 a payment" (repeats the inputs), "What this remora spent, from its recorded turns, gas and payments."

## Researcher · Activity (`remora-researcher-activity`)
**Five seconds:** For: what this agent did and paid. First click: 👍/👎 or "Why?" on an answer.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-ract-1 | filled · desktop | Major | Payments are one-line sentences, "Paid 0.01 USDC to Sui risk check", with no receipt: no transaction link, no "limit left after this". The product promises "a receipt for everything", and here only "Why?" is visible. | Render Paid rows as a small receipt card: big "0.01 USDC", to "Sui risk check", tx "Fh8x…7GcT ↗", "0.48 left this month". |
| R0G2-ract-2 | filled · desktop | Minor | A lone "Its memory" button floats top right above the list, with no heading or context. | Move it into the header actions, or label the area ("Activity · open its memory ↗"). |
| R0G2-ract-3 | filled · desktop | Minor | A flat list with relative times only. The chat thread for the same events has day separators ("Yesterday"). | Group by day with the same separators, and draw it as a timeline (dot + line), with Paid and Blocked dots coloured. |

**Words that could go:** "Researcher · demo is live." / "Researcher · demo is ready." (on its own page, "Is live" / "Ready" is enough), "(practice mode)".

## Researcher · Learning (`remora-researcher-learning`)
**Five seconds:** For: whether it's getting better. First click: can't tell. Nothing on the page is clickable.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-rlearn-1 | filled · desktop | Major | Both metrics depend on your 👍/👎 ("0 data points"), but the page gives no way to give them, and there's no next step. | Add one button: "Rate 3 recent answers" (opens them inline with 👍/👎). |
| R0G2-rlearn-2 | filled · desktop | Major | "Answered from memory 33%" claims 3 data points, but the chart shows one dot. In Activity, the only answer that bought nothing is the failure "I can't tell you if it's safe…", so 33% probably counts a failed answer as "answered from memory". The headline number reads as a success it isn't. | Show "1 of 3 answers" next to the %, plot every point, and count only answers rated useful (or at least not failures). |
| R0G2-rlearn-3 | filled · desktop | Minor | The "Proof of Learning" empty state is a two-line sentence whose example is about a Wallet watcher ("thumbs-down a ping as noise") on a Researcher's page. It has no face and no button. | Use the face, one line ("Rate an answer to teach it"), and a button that does the same as rlearn-1. |

**Words that could go:** "A day without data has no point.", "What the remora paid, divided by the answers you marked 👍 useful.", "The same kind of input, a different decision, and the memory that made the difference."

## Researcher · Settings (`remora-researcher-settings`)
**Five seconds:** For: editing this agent. First click: the Name/Persona fields (Save is greyed until a change).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-rset-1 | filled · desktop | Minor | The schedule line reads "weekdays at 8am UTC: next 11/4/2026, 3:00:00 PM, 11/5/2026, 3:00:00 PM, …". 8am next to 3 PM with no timezone label looks wrong, and the absolute dates carry seconds with no relative form. | "Next: today 3 PM (your time) · tomorrow · Fri", with "8:00 UTC" in a `?` hint. |
| R0G2-rset-2 | filled · desktop | Minor | Brain reads "Remora default" with a dropdown showing "Remora". The label and value say the same thing, and no model name is visible. | Show the actual model name and its price ("≤ $1 / 1M tokens") in the row. |
| R0G2-rset-3 | filled · desktop | Minor | Keys: "Spending limit 0xd5...c8". A label that reads like an amount shows an object id, with copy but no explorer link (same for "Spending key 0x8a...e3"). | Rename it "Limit object" (or show "0.50 USDC/month · 0xd5…c8 ↗") and add explorer links. |
| R0G2-rset-4 | filled · desktop | Minor | The Budget block duplicates the Overview's, including the stuck "Reading its spending limit…". | Keep the edit form here only, and show the meter (rov-1) on Overview. |
| R0G2-rset-5 | filled · desktop | Nit | Sources: "Sui risk check · 2 calls · 0 useful · 0 noise · 0.02 USDC spent" is a stats sentence. | A tiny bar per source (useful / noise / unrated) with the spend as the big number. |

**Words that could go:** "The name and the one-sentence persona it answers as.", "Up to 0.50 USDC a month, at most 0.015 a payment", "A question it asks on its own, and tells you the answer.", "From your thumbs up and down; written to its memory as it learns."

## Wallet watcher · Overview (`remora-watcher-overview`)
**Five seconds:** For: a retired watcher's summary. First click: can't tell. Only a "…" menu.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-wov-1 | filled · desktop | Major | A watcher's key facts are missing from the overview: which wallets it watches, its rules, how many pings it sent and how many it ignored. Instead it shows a Budget section ("No budget to change.") and a Cost card that don't apply to a read-only watcher. There is no action. | Lead with "Watching 0xab…cd ↗" chips, a rules list, and two big numbers (pings / ignored). Drop Budget for watchers. Offer "Make a copy" when retired. |
| R0G2-wov-2 | filled · desktop | Major | "Watcher mvwcctl7 is watching 1 address(es) on testnet:" ends at the colon with no address, here and in the chat thread. It is the only place the watched wallet would appear. | Append the short address with an explorer link, and pluralise properly ("1 wallet"). |
| R0G2-wov-3 | filled · desktop | Minor | "Retired" is said three times: the header pill, a banner ("Its spending limit is revoked, so it can't act or pay…"), and Budget ("Retired: its spending limit was revoked, so it never pays again."). | Keep the pill and one short banner line. |
| R0G2-wov-4 | filled · desktop | Minor | "Learned: ignore incoming SUI under 0.002 (from 🔕)". The source is only an emoji, with no text alternative. | "(from your 👎 on a ping)", or an icon with a text label. |

**Words that could go:** "Retired: its spending limit was revoked, so it never pays again.", "No budget to change.", "What this remora spent, from its recorded turns, gas and payments."

## Wallet watcher · Activity (`remora-watcher-activity`)
**Five seconds:** For: what it saw and whether it pinged me. First click: 👎 on the ping.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-wact-1 | filled · desktop | Minor | Transaction digests "(84t7yEiU...)" and "(49Lnbdfi...)" are short but have no copy or explorer link. | Make each digest a link ↗ to the explorer. |
| R0G2-wact-2 | filled · desktop | Nit | "Ignored" pill followed by "Ignored: Received 0.001 SUI". | Drop the second "Ignored:". |

**Words that could go:** "Ignored:", "Its memory stays yours."

## Wallet watcher · Learning (`remora-watcher-learning`)
**Five seconds:** For: proof it learned to stay quiet. First click: "Verify this decision".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-wlearn-1 | filled · desktop | Major | The biggest number on the page is "Noise rate 100%", from 1 data point, and it reads as failure. Just below, the Before/After proof shows the watcher learned and stayed quiet. | Show "1 of 1 pings marked noise · before learning" and add the after figure ("0 noisy pings since"). Or lead with the Before/After card. |
| R0G2-wlearn-2 | filled · desktop | Minor | The proof opens with a two-line sentence with nested parentheses ("Before, it pinged you (Received 0.001 SUI (49Lnbdfi...)). After it learned “…(from 🔕)”, it stayed quiet (…)") that repeats the two cards beneath it. | Drop the sentence. The Before → After cards with an arrow between them say it. |
| R0G2-wlearn-3 | filled · desktop | Minor | "What it learned in between" shows the full Walrus id "HYsBxscSKPcNaSjqQam1rKmuZbzWg-v-AB_NNv5fEw8", and the cards use "10/31/2026, 6:53:33 PM" while the chart axis says "2026-10-31". | Shorten it to "HYsB…fEw8 ↗ Walrus" and use "Oct 31, 6:53 PM · 4d ago" in one format. |

**Words that could go:** "A day without data has no point.", the whole "Before, it pinged you … it stayed quiet (…)." sentence.

## Wallet watcher · Settings (`remora-watcher-settings`)
**Five seconds:** For: editing this watcher. First click: can't tell. It's retired, yet fields look editable.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-wset-1 | filled · desktop | Minor | "Danger zone" says "Both actions need a signature and take effect immediately." next to an empty red box. There are no actions (it's retired). | Hide the section when retired, or show "Retired on Oct 31 · nothing left to do here". |
| R0G2-wset-2 | filled · desktop | Minor | A retired remora that "can't act" still shows editable Name, Persona, a Brain dropdown and Save. There's also no Addresses or Rules section, which are a watcher's actual settings. | Make the retired view read-only, and add "Watching" and "Rules" sections for watchers. |

**Words that could go:** "Both actions need a signature and take effect immediately." (when there are none), "The key that acts, and the spending limit that caps it."

## Remora, loading (`loading-remora`)
**Five seconds:** For: can't tell (it's loading). First click: none expected.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-loadrem-1 | loading · desktop (shell; also `error-remora`, `loading-chat`, `error-chat`) | Blocker | While data loads or fails, the shell shows a brand-new account. The remora list is empty except "Import a team…", and a "Set up 1/3 · Next: Add USDC" card appears, while the wallet chip shows "19.78 USDC". This is an empty state shown while data loads, and it contradicts the balance. | Show skeleton rows in the sidebar list while loading (an error row on failure), and never render the setup card until the account is known. |
| R0G2-loadrem-2 | loading · desktop | Minor | The skeleton is a title bar, one line and one big block. The real page has a face, a status pill, header buttons, tabs, an Ask box and two cards side by side. | Match the final shape: face circle + name bar, four tab pills, the Ask box, and two half-width cards. |

## Remora, error (`error-remora`)
**Five seconds:** For: it failed. First click: "Try again".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-errrem-1 | error · desktop | Major | "Couldn't read this remora" over the single word "down". It doesn't say what failed or what to do beyond the button, and there's no face or name. | "Our server isn't answering. Your remora is safe onchain. Try again in a minute." (12 words or fewer), with the remora's face greyed. |

**Words that could go:** "down".

## Chat, new (`chat`)
**Five seconds:** For: talking to my agents. First click: one of the four suggestion chips.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-chat-1 | filled · desktop | Minor | "Oh, hello 👋 / Got something to untangle?" and "Message your remora…" don't say who will answer. The picker under the box reads only "Remora ⌄". | Show the face and name of the remora that will answer ("Researcher · demo will answer ⌄"). |
| R0G2-chat-2 | filled · desktop | Minor | Two unlabelled icon buttons (ⓘ and a list icon) sit next to the picker. | Add text labels or tooltips with aria-labels. |
| R0G2-chat-3 | filled · desktop | Minor | An animated ASCII field (clusters of "S%X$t8@") fills the background and changes between captures while nothing on the page changes. It competes with the composer. | Make it static on app pages (or keep it for the landing page), and respect reduced motion. |

**Words that could go:** "Oh, hello", "Got something to untangle?"

## Chat, empty account (`empty-chat`)
**Five seconds:** For: talking to agents, but I have none. First click: a chip that refers to remoras I don't have.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-emptychat-1 | empty · desktop | Major | A brand-new account (0 remoras, 0.00 USDC) sees the same composer and chips: "Teach Wallet watcher…", "Ask Researcher…". Neither exists. There's no prompt to create one first. | Replace the chips with the two faces and "Create a Researcher" / "Create a Wallet watcher" buttons, or one "Make your first remora" button. |
| R0G2-emptychat-2 | empty · desktop | Nit | The greeting subtitle changes between loads ("What are we figuring out today?" here, "Got something to untangle?" elsewhere, "Plot twist." on error). | Use one fixed line. |

## Chat, loading (`loading-chat`)
**Five seconds:** For: chat. First click: the composer, though nothing is loaded yet.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-loadchat-1 | loading · desktop | Minor | The page is identical to the loaded one. The composer and chips are live while the remora list is still unknown (shell issue: R0G2-loadrem-1). | Show a skeleton picker ("Loading your remoras…") and disable send until they load. |

## Chat, error (`error-chat`)
**Five seconds:** For: can't tell. First click: can't tell.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-errchat-1 | error · desktop | Major | The data server fails but no error is shown. The heading reads "Plot twist. / What are we actually solving?", like a joke about the failure, and the sidebar looks like an empty account. | Show an inline error above the composer: "Can't reach your remoras. Try again." with a Try again button. |

## Thread with a Researcher (`thread-researcher`)
**Five seconds:** For: my conversation with this agent. First click: the message box.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-thr-1 | filled · desktop | Minor | My own questions appear only as small grey "Re: Is the package 0xcc05642d…a5d6d safe to depend on?" lines (full id), not as my bubbles. The room shows them as right-aligned bubbles. | Render the question as my bubble on the right, with the id shortened (`0xcc05…5d6d`). |
| R0G2-thr-2 | filled · desktop | Minor | Answers here have no 👍/👎, though Learning depends on them and Activity has them. "Why?" sits only on system lines. | Add 👍/👎 and "Why?" under each answer bubble. |

**Words that could go:** "Re:", "This cost me $0." (shown as a cost chip instead).

## Thread with a Wallet watcher (`thread-watcher`)
**Five seconds:** For: what this watcher told me. First click: can't tell. It's retired, but the composer looks live.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-thw-1 | filled · desktop | Minor | The composer for a retired watcher looks active (box, send arrow). Only the placeholder says "Watcher mvwcctl7 is retired." | Replace the composer with a read-only bar: "Retired · history only". |
| R0G2-thw-2 | filled · desktop | Minor | The Ping bubble is blue text on blue, which reads as a link: "Received 0.001 SUI (49Lnbdfi...)". It doesn't say which wallet received it or from whom, and the digest has no link. | Draw a ping card: big "+0.001 SUI", "to 0xab…cd (your wallet)", "from 0x…", tx ↗. |

## Room (`room`)
**Five seconds:** For: a group chat with all my remoras. First click: the message box (with "@" to name one).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-room-1 | filled · desktop | Minor | The header member list is "Researcher · demo, Researcher · demo, Researcher · demo, Researcher · demo, Resea…", unreadable. Two wide dropdowns, "Auto" and "Lead: first member", sit as loud as the title with no explanation. | Show a stack of faces with "+28", and put the two settings behind a gear with `?` hints ("Auto: the room picks who answers"). |
| R0G2-room-2 | filled · desktop | Minor | Routing labels under my messages: "→ Researcher mvjnvzx3 · matched", "→ Wallet watcher mvjn9e9c · named". "matched/named" is internal jargon. | "→ answered by Researcher mvjnvzx3", with a small face. |
| R0G2-room-3 | filled · desktop | Minor | The approval card keeps the title "Needs your approval" after it shows "Approved". It names "reef:odds", while the next line says "Paid 0.02 USDC to Odds". | Retitle it "Approved · 0.02 USDC to Odds" once approved, and use the plain source name. |

**Words that could go:** "· matched", "· named", "It's over this remora's per-payment cap, so you pay it once, from your balance." (use a cap meter instead).

## Templates (`hatchery`)
**Five seconds:** For: copying remoras other people shared. First click: a card (no visible "Use" button).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-hatch-1 | filled · desktop | Major | Half the gallery is red-pilled "blocked" templates ("Free money mvwcctl7"…), with empty bodies and no reason, at the same weight as the usable ones. A judge's first impression of the gallery is "half of this is scams". | Hide blocked templates by default (a "Blocked (12)" filter), and show the reason on the card when shown. |
| R0G2-hatch-2 | filled · desktop | Minor | Cards have no "Use" or "Copy" affordance. | Add a "Use" button on hover or in the card footer. |
| R0G2-hatch-3 | filled · desktop | Minor | The "⑂ 0 / ⑂ 1" icon count has no label. | "1 copy" text, or a tooltip. |

**Words that could go:** "Each one is a file on Walrus with its author onchain;" could become a small "on Walrus ↗" badge per card.

## Templates, signed out (`out-hatchery`)
**Five seconds:** For: browsing shared remoras. First click: a card. But will it work signed out? Can't tell.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G2-outhatch-1 | signed out · desktop | Minor | Identical to the signed-in page. Nothing says using a template needs a wallet ("using one makes your own copy … with your own budget"). | Change the card action to "Sign in to use", or add a one-line strip under the title. |

## Across pages
| # | Pages | Sev | What's drawn differently | Suggested fix |
|---|---|---|---|---|
| R0G2-x-1 | remoras, remora overview/settings, watcher overview | Minor | One budget fact, five texts: "Budget not readable just now." (list) against "Reading its spending limit…" (overview, settings), which disagree on whether it's loading or failed; "Read-only: no budget to spend." against "No budget to change." for watchers. | One budget meter component with three states: skeleton, value, "n/a (read-only)". |
| R0G2-x-2 | remoras, overview, activity, thread, room | Minor | Cost of an answer is written six ways: "Source: Sui risk check (0.01 USDC)", "Cost: 0.01 USDC from Reef", "Cost: 0.01 USDC from \"Sui risk check\"", "(Cost: 0.01 USDC from reef:sui-risk)", "This cost me $0.", "Sources: * reef:sui-risk ($0)". The Cost card uses "$0.03" while everything else is USDC. | One cost chip under every answer ("0.01 USDC · Sui risk check ↗"), and USDC everywhere (or $ everywhere). |
| R0G2-x-3 | new, share, activity, room | Minor | Source names: "Sui risk check" / "sui-risk" / "reef:sui-risk" / "Reef"; "Odds" / "reef:odds"; "Brief" / "reef:brief". | Plain names in the UI. Raw ids only in "The file". |
| R0G2-x-4 | import, share, watcher settings, room, remoras | Minor | Kind names leak: "scout" / "sentinel" (YAML), "You are Sentinel." (persona), "@Sentinel mvj0yzcl" (room), and "Checker …" cards whose kind is Researcher. | Use "Researcher" and "Wallet watcher" everywhere users see them, including the @-mention. |
| R0G2-x-5 | remoras, activity, watcher activity | Minor | Modes and status: "practice" pill, "(practice mode)", "starts in shadow mode" (watcher), "is live", and an "active" pill. | Pick two words (Practice, Live) and one pill style. |
| R0G2-x-6 | remoras/activity, hatchery, share | Minor | "Blocked" means "didn't pay" in activity (red pill) and "failed the safety review" in Templates (red pill). Share says "Passed the safety review" while cards say "reviewed". | "Not paid" for payments, "Rejected" for templates, and "Safe ✓" in both template places. |
| R0G2-x-7 | activity, thread, watcher thread, learning, settings, sidebar | Minor | Seven date styles: "9h ago", "Nov 3", "Yesterday", "Sat 31 Oct", "2026-11-03", "10/31/2026, 6:53:33 PM", "11/4/2026, 3:00:00 PM". | One format: relative ("9h ago") with the absolute "Nov 3, 6:53 PM" on hover, and day separators as "Yesterday" / "Oct 31". |
| R0G2-x-8 | hatchery, empty-remoras, share, activity | Minor | Faces appear in the list, sidebar, header and chat, but Templates use a generic egg glyph, the empty state a logo glyph, the share card no face, and activity rows no face. | Use the remora face (or the kind's face for templates) everywhere a remora is named. |
| R0G2-x-9 | remoras, new, empty-remoras, share, thread header | Minor | Kind badge drawn four ways: grey subtitle (grid), blue "Spends USDC" / grey "Read-only" pills (new, empty), outlined "Researcher" pill (share), grey text after the status (thread header). | One kind badge (icon + "Researcher" / "Wallet watcher"). |
| R0G2-x-10 | researcher vs watcher header, sidebar | Minor | The Researcher's header subtitle is a description ("Answers questions by buying the best data…"). The watcher's is its raw persona prompt ("You watch the owner's addresses…"). The sidebar mixes both ("You answer the owner's questi…"). | Always show the third-person description, never the persona prompt. |
| R0G2-x-11 | room, thread, activity | Minor | My question is a right-hand bubble (room), a grey "Re:" line (thread), and bold row text (activity). | The same bubble in both chats, and a quoted line in activity. |
| R0G2-x-12 | chat, thread header, settings | Minor | The model picker is labelled "Remora ⌄" (composer, thread header), and Settings says "Remora default" / "Remora". The product's noun is reused as a model name. | Name the model ("Model: <name> ⌄"). |
| R0G2-x-13 | new, overview, share, room, banner | Minor | The per-payment cap has five names: "Most it pays at once", "Per payment", "at most 0.015 a payment", "per-payment cap", "perPaymentUsd". | One term ("Max per payment") plus the meter tick. |
| R0G2-x-14 | activity vs thread | Nit | 👍/👎 appear on answers in Activity but not on the same answers in the chat thread. | Same controls in both (see thr-2). |

**Counts:** Blocker 2 · Major 17 · Minor 59 · Nit 10
