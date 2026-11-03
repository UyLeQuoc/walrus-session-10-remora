# Round 4 · G2 · Remoras and chat · desktop

Reviewer persona: a hackathon judge with three minutes, who knows crypto a little and has never heard of Remora, Disc or x402. I used only the screenshots in `docs/ux/review/r4/desktop/`, the rubric, round 3's findings for these pages and round 3's triage. I review the shell (rail, remora list, wallet chip) once, at the top. Many of round 3's minors were neither fixed nor declined, and I can still see them, so they come back below with new IDs and a "(still R3G2-…)" tag, so triage can match them.

## Previous findings
- R3G2-remoras-1: fixed. Every card whose limit hasn't been read yet wears a grey "checking" pill over "Reading limit". No card says "active", in either the above-the-fold shot or the whole-page shot.
- R3G2-thr-1: fixed. The thread header reads "Researcher · demo · can't spend · Researcher". But the highlighted sidebar row right beside it still says "Researcher · active" with a green dot (R4G2-x-1).
- R3G2-room-1: not fixed, in part. The decided card is now a receipt: "0.02 USDC to Odds · Approved · You paid 0.02 USDC to Odds, once, from your wallet.", and it no longer asks "Pay …?". But two bubbles later, the payment line still reads "Researcher mvwcarot: Paid 0.02 USDC to Odds" (the same for mvig08dw, mvj0yzcl, mvjn9e9c, mvjnvzx3, mvlutd68 and mvqsgk1v). The room still tells whose money paid in two ways (R4G2-room-1).
- R3G2-tmpl-1: fixed. The red wall is now four plain lines with ✗ or !, and the field paths and the 64-character address are gone. What's left: one line repeats itself, one contradicts its own heading, and one keeps a raw "payment:" prefix (R4G2-tmpl-1).
- Not on the fixed list, but changed by the phone fix (chat-1): the art is gone from `empty-chat` and `error-chat`, and `error-chat`'s card is now solid. In `chat` the art still runs into the heading, and in `loading-chat` it runs behind the chips (R4G2-chat-1).
- Declined R3G2-rlearn-1: the reason holds in the picture. "33%" is grey, not white, and sits beside "1 of 3 answers · too few to tell yet". I don't raise it again.

## The shell (every page; states `loading-*`, `error-*`, `empty-*`, `out-*`)
**Five seconds:** For: getting around, with my remoras on the left. First click: a remora row, or a "Needs you" row.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-shell-1 | filled · desktop | Minor | On a remora's own pages (Overview, Activity, Learning, Settings), no sidebar row is marked as the open one. The thread does mark its row (`thread-researcher`). Seven rows read "Researcher · demo", so I can't find which one I'm on. (still R3G2-shell-1) | Highlight the open remora's row on its pages, as the thread does. |
| R4G2-shell-2 | filled · desktop | Minor | The two "Needs you" rows are identical, "Researcher m… · 0.02 USDC · wants your yes". The name is cut before the part that tells them apart. (still R3G2-shell-2) | Cut the middle of the name ("Researcher…08dw"), or say what it wants: "Odds · 0.02 USDC". |
| R4G2-shell-3 | loading, error · desktop | Minor | In `loading-remora`, `loading-chat`, `error-remora` and `error-chat`, the "Needs you 2" section and the rail's amber "2" on Approvals vanish without a trace, which reads as "nothing waiting". The wallet chip still shows "19.78 USDC". (still R3G2-shell-3) | While loading, keep a grey dot on Approvals and one skeleton row under "Needs you". On error, show "Can't load approvals · Retry". |
| R4G2-shell-4 | filled · desktop | Minor | The rail lights "Home" on every Remoras page (`remoras`, `remoras-new`, `remoras-import`, `share`, every remora tab), while the bar title says "Remoras" or the remora's name. Chat and Templates light their own items. (still R3G2-shell-4) | Give Remoras its own rail item, or light none rather than the wrong one. |
| R4G2-shell-5 | empty · desktop | Nit | Under Rooms, "Team · No members yet" has a blank gap where every other row has a face. (still) | Put the room's group icon there, as in the room header. |
| R4G2-shell-6 | empty · desktop | Nit | The red "Pause all" sits in the top bar of an account with 0 remoras (`empty-remoras`, `empty-chat`). (still) | Hide it until there's at least one remora. |

For the sidebar's green "active" beside "can't spend", see R4G2-x-1.

## Remoras (`remoras`, `remoras.full`)
**Five seconds:** For: all my remoras at a glance. First click: "New remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-remoras-1 | filled · desktop | Minor | Nine cards still say "checking · Reading limit" in the whole-page shot, which was taken later: "Researcher · demo" (purple triangle), "Researcher u12 mvwcl…", "Researcher u12 mvqsw…", the five "Checker" cards and "Researcher mvieduji". A pending read is drawn as words over an empty track, and nothing says whether it will finish. The purple demo card is still checking while its six identical siblings have resolved to "can't spend". (still R3G2-remoras-2) | Put a shimmer in the meter slot, with no words. After a few seconds, show one strip above the grid: "Couldn't read 9 spending limits from Sui · Retry". |
| R4G2-remoras-2 | filled · desktop | Minor | A retired remora isn't anywhere on this page. "31 on testnet" = Researcher 15 + Wallet watcher 16, and "Watcher mvwcctl7" (retired) is in neither. It's the one whose Learning tab shows the before-and-after proof, so a judge can't reach the best story from Remoras. | Add a "Retired 1" tab, or put muted retired cards at the end of All. |
| R4G2-remoras-3 | filled · desktop | Nit | 1. Twenty-two cards wear an orange "practice" pill, the colour the sidebar uses for "wants your yes".<br>2. Each Researcher card repeats "Researcher" under "Researcher · demo".<br>3. "checking" and "can't spend" are the same grey pill, so a pending state and a final state look alike. (partly still R3G2-remoras-3) | 1. Draw "practice" as a neutral or blue pill.<br>2. Drop the kind subtitle when the name already says it.<br>3. Give "checking" a small spinner dot. |

**Words that could go:** "Researcher" (the subtitle under "Researcher · demo", ×7), "Reading limit" (×9; a shimmer says it)

## Remoras, empty account (`empty-remoras`)
**Five seconds:** For: making my first remora. First click: "New remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-emptyrem-1 | empty · desktop | Minor | The two kind cards ("Researcher · Spends USDC", "Wallet watcher · Never pays") have no button, arrow or hover sign, so I can't tell whether they're clickable. They use a cube and a shield, while every remora elsewhere has a face. (still R3G2-emptyrem-1) | Make each card a button ("Create a Researcher →") that opens New remora with that kind picked. Use the kinds' faces. |

**Words that could go:** none

## Remoras, signed out (`out-remoras`)
**Five seconds:** For: signing in. First click: "Sign in with your wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-outrem-1 | signed out · desktop | Minor | 1. The pane never says what a remora is: "Sign in with your wallet to see your remoras." assumes I know.<br>2. The no-wallet path, "Try a Researcher · no wallet", is only in the sidebar.<br>3. The bar title is a lowercase "remora" over a "Sign in" heading.<br>4. Two "Sign in" buttons show at once (the pane and the sidebar foot). (still R3G2-outrem-1) | 1. Add one line under the logo: "AI agents that spend only within a limit enforced on Sui."<br>2. Add a secondary button, "Try a Researcher · no wallet".<br>3. Title the bar "Remoras". |

**Words that could go:** none

## New remora (`remoras-new`)
**Five seconds:** For: creating a remora with a spending limit. First click: "Create Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-new-1 | filled · desktop | Minor | "At the cap · 20 payments a month" uses a third word for the 0.05 limit, which the form calls "Most it pays at once" and the Summary "Most at once". The chips "Sui risk check · Odds · Brief" show no prices, so I can't tell what 1 USDC buys. (still R3G2-new-1) | Write "20 payments of 0.05 USDC". Put prices on the chips ("Odds · 0.02"). |
| R4G2-new-2 | filled · desktop | Minor | "You'll sign 1 transaction to set its spending limit." doesn't say whether 1 USDC leaves my wallet now or only as it pays. (still R3G2-new-2) | Add one fact beside it: "No USDC moves now". |
| R4G2-new-3 | filled · desktop | Minor | There are three right edges: the kind cards end at x≈1057, the form at ≈987, and the Summary at 1403. The "Enforced on Sui" pill floats alone between the Summary and the signature line. (still R3G2-new-3) | Let the kind cards span the form's width. Put the pill in the Summary header. |
| R4G2-new-4 | filled · desktop | Minor | The unselected radio on "Wallet watcher" is a dark circle on a dark card, well under 3:1. (still R3G2-new-4) | Give the empty radio a mid-grey ring at 3:1 or more. |

**Words that could go:** "Pick what it does. You can change it later.", "Sui won't let it spend more than this a month." (the "Enforced on Sui" pill says it)

## Import a team (`remoras-import`)
**Five seconds:** For: setting up several remoras from one Markdown file. First click: "Use the example".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-import-1 | filled · desktop | Minor | The disabled "Preview" is a solid light-grey block, the heaviest thing on the page. The enabled "Use the example" beside it is a dark outline. (still R3G2-import-1; see R4G2-x-13) | Draw a disabled button as a faint outline. Make "Use the example" the filled button until there's text. |

**Words that could go:** none

## Share as a template (`share`, `share.full`)
**Five seconds:** For: publishing this remora for others to copy. First click: "Publish as a template (one signature)".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-share-1 | filled · desktop | Minor | Each "What stays with you" row repeats its heading in its sub-line ("Receipts and history · Receipts and history stay with you."). The rest is jargon: "memory delegate", "the hatcher's remora", "Spending limit ids", "Checked: scrubber, patterns, reef, model." "Uses 5 tools" names none of them. (still R3G2-share-1) | Show one row of four ticks: "✓ Memories ✓ Keys ✓ Spending limit ✓ Receipts stay with you", with the details behind one `?`. Cut the "Checked:" line. |

**Words that could go:** "This is what people see before they use it.", "Receipts and history stay with you.", "Templates never carry memories; the hatcher's remora starts fresh.", "Checked: scrubber, patterns, reef, model."

## Researcher · Overview (`remora-researcher-overview`, `.full`)
**Five seconds:** For: one remora's home: ask it, and see its budget, cost and recent work. First click: the Ask box.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-rov-1 | filled · desktop | Minor | The header says "can't spend", but the Ask box still promises "It buys data when that helps, and tells you what each answer cost." (still R3G2-rov-1) | In the can't-spend state, change the line to "It can't buy now; it answers from memory." |
| R4G2-rov-2 | filled · desktop | Minor | The Budget card still draws an empty meter track above "No spending limit onchain: it can't spend". The empty bar reads as "0 spent", while Cost beside it shows "Purchases $0.02", and the key fact is the smallest, greyest text in the card. Settings' Budget does the same. (still R3G2-rov-2) | Drop the track in this state. Show "No spending limit on Sui · can't buy" in body size, with "was 0.50 USDC / month" muted under it. |
| R4G2-rov-3 | filled · desktop | Minor | Budget and Cost don't line up. Budget's box runs y≈488–552 and Cost's y≈532–695, pushed down by the "November 2026" picker, which leaves a 140 px hole under Budget. (still R3G2-rov-3) | Move the month picker into the Cost heading row, so both boxes start at one y. |
| R4G2-rov-4 | filled · desktop | Nit | "Pause" is a larger bordered button and "Chat" a small ghost one. On a remora that can't spend, Chat is the likelier action. (still) | Make them the same size, or make Chat the main one. |

**Words that could go:** "It buys data when that helps, and tells you what each answer cost." (repeats the subtitle), "What this remora spent, from its recorded turns, gas and payments."

## Researcher · Activity (`remora-researcher-activity`, `.full`)
**Five seconds:** For: what it did and what it paid. First click: "tx ↗" or "Why?" on a payment.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-ract-1 | filled · desktop | Minor | The header says "can't spend", but the timeline never says why. Its last word on the limit is "…is ready. Its spending limit is live; it starts in practice mode." (still R3G2-ract-1) | Add an event at the top: "Spending limit gone onchain · can't spend · tx ↗". |
| R4G2-ract-2 | filled · desktop | Minor | The practice row "Would pay Sui risk check · 0.01 USDC" puts its amount in the same column and weight as the two real payments. The column adds up to 0.03 USDC, while Cost says "Purchases $0.02" (and a total of "$0.03" for other reasons). (still R3G2-ract-2) | Grey and strike the practice amount, and put a "practice" pill in the tx slot. |
| R4G2-ract-3 | filled · desktop | Nit | Icons are drawn two ways: tinted circles for questions, payments and practice, bare glyphs for status (⚡) and failures. "Its memory" floats alone above the list. (still) | Put every icon in a circle. Move "Its memory" into the tab row. |

**Words that could go:** "Researcher · demo is live.", "Its spending limit is live; it starts in practice mode."

## Researcher · Learning (`remora-researcher-learning`)
**Five seconds:** For: whether it's getting better. First click: "Rate recent ones".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-rlearn-1 | filled · desktop | Nit | The empty proof says "Rate its answers or pings" on a Researcher, which has no pings. The chart's x label is "2026-11-03", while every other date reads "Nov 3". (still R3G2-rlearn-2) | "Rate its answers". "Nov 3" on the axis. |

**Words that could go:** "No data yet." (the "—" says it), "What the remora paid, divided by the answers you marked 👍 useful. 0 data points." (into the `?`), "Answers that used a memory and bought nothing. 3 data points."

## Researcher · Settings (`remora-researcher-settings`, `.full`)
**Five seconds:** For: editing this remora. First click: the Name field.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-rset-1 | filled · desktop | Minor | Schedules reads "weekdays at 8am UTC: next Today 3:00 PM · Tomorrow 3:00 PM · Fri 3:00 PM". It gives 8am and 3:00 PM side by side, with a zone on only one. I can't tell whether "weekdays at 8am" + "What are the odds for this weekend?" + "Add" is a saved schedule or a new one being typed. (still R3G2-rset-1) | List saved schedules as rows ("Weekdays 3:00 PM your time (8:00 UTC) · 'What are the odds…' · ✕"), with an empty "Add a schedule" row under them. |
| R4G2-rset-2 | filled · desktop | Nit | Schedules is the only section that isn't in a card. Brain reads "Remora default / Remora ⌄" and never names a model. (still) | Put schedules in a card. Name the model in the picker. |

**Words that could go:** "The name and the one-sentence persona it answers as.", "A question it asks on its own, and tells you the answer.", "The key that acts, and the spending limit that caps it.", "Both actions need a signature and take effect immediately."

## Wallet watcher · Overview (`remora-watcher-overview`, `.full`)
**Five seconds:** For: a retired watcher's record: what it watched and the rule it learned. First click: can't tell. The only control is "…".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-wov-1 | filled · desktop | Minor | All three stat cards say "1 recently" (Pings, Ignored, Rules learned). "Recently" has no period, and the Cost card below has a month picker. (still R3G2-wov-1) | Name the window once under the three numbers: "since Oct 31". |
| R4G2-wov-2 | filled · desktop | Minor | The rule's source is an emoji alone, "ignore incoming SUI under 0.002 (from 🔕)", with no text alternative. Learning gives the same source as "pings you marked 👎 noise". (still R3G2-wov-2) | "from your 👎 on Oct 31". |
| R4G2-wov-3 | filled · desktop | Minor | It's retired, and the page offers no next step: the header has only "…". (still R3G2-wov-3, the unfixed part of R2G2-wov-1) | Add one header button, "Make a copy", which starts a new watcher on 0xe7…8d with this rule. |
| R4G2-wov-4 | filled · desktop | Nit | "Retired" is said three times above the fold: the pill, a two-sentence banner and the first event. Cost spends a block on "No spend this month" for a kind that never pays. (still) | Keep the pill and one muted line. Hide Cost for a watcher. |

**Words that could go:** "Its memory and receipts stay yours.", "What this remora spent, from its recorded turns, gas and payments.", the persona as the subtitle ("You watch the owner's addresses and decide…")

## Wallet watcher · Activity (`remora-watcher-activity`)
**Five seconds:** For: what it saw and whether it pinged me. First click: "Why?" on the ignored event.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-wact-1 | filled · desktop | Nit | "Watcher mvwcctl7 is watching 1 address(es) on testnet" uses a programmer's plural and doesn't name the address. (still) | "Watching 0xe7…8d ↗ on testnet". |

**Words that could go:** "Ignored:" (the eye-off icon says it), "Its memory stays yours."

## Wallet watcher · Learning (`remora-watcher-learning`, `.full`)
**Five seconds:** For: proof it learned to stay quiet. First click: "Verify this decision".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-wlearn-1 | filled · desktop | Minor | The only number on the page is "Noise rate 100%". It's grey now, with "too few to tell yet", but it still reads as a failure. The success, that the watcher stayed quiet after it learned, isn't in any number. (still R3G2-wlearn-1) | Lead with before and after: "Noise pings: 1 before the rule → 0 after (1 ignored)". |
| R4G2-wlearn-2 | filled · desktop | Minor | The Proof box opens with a two-line sentence of nested parentheses ("Before, it pinged you (Received 0.001 SUI (49Lnbdfi…)). After it learned…"). The Before and After cards right under it say the same thing. (still R3G2-wlearn-2) | Drop the sentence. The Before → After cards are the picture. |
| R4G2-wlearn-3 | filled · desktop | Minor | "What it learned in between" prints the whole Walrus id "HYsBxscSKPcNaSjqQam1rKmuZbzWg-v-AB_NNv5fEw8" beside a bare "rules" chip, with a copy button but no short form and no explorer link. (still R3G2-wlearn-3) | "HYsB…fEw8 ↗" to the Walrus explorer, and the chip "Rule saved on Walrus". |

**Words that could go:** "The Wallet watcher's pings you marked 👎 noise. 1 data point." (into the `?`), the Proof sentence

## Wallet watcher · Settings (`remora-watcher-settings`)
**Five seconds:** For: a retired watcher's keys, read-only. First click: none expected, and that's right here.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-wset-1 | filled · desktop | Minor | "Retired: it can't act or pay. Its memory and receipts stay yours." sits right under the banner, which says nearly the same words. (still R3G2-wset-1) | Drop the line. |

**Words that could go:** "Retired: it can't act or pay. Its memory and receipts stay yours.", "The key that acts, and the spending limit that caps it."

## Remora, loading (`loading-remora`)
**Five seconds:** For: a remora page that's loading. First click: none expected.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-loadrem-1 | loading · desktop | Nit | The skeleton has no tab row, so the Ask box and cards jump about 50 px when the page arrives. (still) | Add four short pill bars for the tabs. |

For the vanished "Needs you", see R4G2-shell-3.

## Remora, error (`error-remora`)
**Five seconds:** For: it failed; try again. First click: "Retry".

No findings in the main pane: a face, ten words ("Can't reach Remora right now. Your remora is safe onchain.") and Retry. For the shell, see R4G2-shell-3.

## Chat, new (`chat`, and the art in `loading-chat`)
**Five seconds:** For: talking to my remoras. First click: one of the four suggestion chips.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-chat-1 | filled, loading · desktop | Minor | The ASCII-art creatures are in a different place in each shot, so they move or are redrawn on each visit, and they still cross text. In `chat`, a column of glyphs runs into the "H" of "Hey there" and down past "What shall we untangle?". In `loading-chat`, a creature sits behind the fourth chip and fills the gap between chips 3 and 4. (Fixed for `empty-chat` and `error-chat`.) | Keep the art static and outside the heading, composer and chips column, or fade it to near zero there. Turn movement off under reduced motion. |
| R4G2-chat-2 | filled · desktop | Minor | Nothing says who will answer. The heading is a different quip on every visit ("Hey there☺", "A quiet moment.", "Oh, hello", "Hello."), the composer says "Message your remora...", and "Remora ⌄" is the model, not a remora. The chips now name a kind ("Ask Researcher: …"), which helps, but with 31 remoras I still can't tell which one gets a typed message. (still R3G2-chat-2) | Put a "To: Auto (best fit) ⌄" chip with faces at the left of the composer. Keep one steady heading ("Ask your remoras"). |
| R4G2-chat-3 | filled · desktop | Nit | The ⓘ and list icons in the composer have no labels. The "☺" touches "there" with no space. (still) | Add tooltips ("Costs", "Tools"), and a space before the emoji. |

**Words that could go:** "What shall we untangle?" / "Room for a thought or two." / "What are we figuring out today?" (the sub-quips)

## Chat, empty account (`empty-chat`)
**Five seconds:** For: making a remora so I can chat. First click: "Create a remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-emptychat-1 | empty · desktop | Minor | The live composer (Memory switch, model picker, send) is the biggest thing on the page and sits above "You have no remora yet. Make one to chat with." and its button. With no remora, a message has nowhere to go. (still R3G2-emptychat-1) | Put the face, the line and "Create a remora" first, and dim the composer ("Make a remora to start"). |

**Words that could go:** "Tell me what you're sitting with."

## Chat, loading (`loading-chat`)
**Five seconds:** For: chat, still loading my remoras. First click: a chip.

No findings of its own. For the art, see R4G2-chat-1. For the vanished "Needs you", see R4G2-shell-3.

## Chat, error (`error-chat`)
**Five seconds:** For: chat that can't reach the server. First click: "Retry".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-errchat-1 | error · desktop | Minor | While "Can't reach your remoras right now." shows, the composer stays fully live, and a cheerful "Oh, hello ✨ / What are we figuring out today?" sits above the failure. (The art and the see-through card are fixed.) (still in part R3G2-errchat-1) | Dim the composer ("Can't send until Remora is back"). Put the error card where the greeting is. |

**Words that could go:** "What are we figuring out today?"

## Thread with a Researcher (`thread-researcher`)
**Five seconds:** For: my conversation with this remora. First click: the message box.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-thr-1 | filled · desktop | Minor | The three answers have no 👍/👎. Activity rates these same answers, Learning asks me to "Rate its answers", and the watcher's thread puts 👍/👎 under its ping. (still R3G2-thr-2) | Put 👍/👎 and "Why?" under each answer bubble, as under the ping. |

**Words that could go:** "Re:" (the quote styling says it), "(practice mode)" (a practice pill can say it)

## Thread with a Wallet watcher (`thread-watcher`)
**Five seconds:** For: what this watcher told me, and that it's retired. First click: "Why?" under the ping.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-thw-1 | filled · desktop | Minor | "Watcher mvwcctl7 is watching 1 address(es) on testnet:" still ends at a colon with nothing after it. (still R3G2-thw-1) | Append the address chip "0xe7…8d ↗", or drop the colon. |

**Words that could go:** "and starts in shadow mode" (see R4G2-x-10)

## Room (`room`, `room.full`)
**Five seconds:** For: a group chat with my remoras. First click: the message box, using "@" to name one.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-room-1 | filled · desktop | Minor | The room still tells one payment two ways. The card says "You paid 0.02 USDC to Odds, once, from your wallet." Two bubbles later, a green line says "Researcher mvwcarot: Paid 0.02 USDC to Odds · Why?", in the same style the thread uses when a remora pays from its own limit. I can read that as two payments of 0.02 USDC, one mine and one its own. This repeats for all seven researchers in the room. (the unfixed part of R3G2-room-1) | Make it one event. Either drop the green line when an approval card already shows the payment, or word it "Paid 0.02 USDC to Odds from your wallet · tx ↗" and attach it to the card. |
| R4G2-room-2 | filled · desktop | Minor | The header is a run-on list ("Researcher · demo, Researcher · demo, Researcher · demo, Researcher · demo, Resea…") beside two unexplained dropdowns, "Auto" and "Lead: first member". (still R3G2-room-2) | Show a stack of faces with "+27" that opens the member list. Put who answers in one control with a `?` ("Auto: the best fit answers; @ to name one"). |
| R4G2-room-3 | filled · desktop | Minor | Each exchange runs out of order: the "Approved" receipt comes first, then an answer saying "I haven't bought anything yet", then "Paid 0.02 USDC", then a second answer to the same question. It reads as a payment approved before the remora asked for it, followed by two answers. (still R3G2-room-3) | Group one exchange: question → "wants 0.02 USDC for Odds · Approved" → the answer, with a "Paid · tx ↗" chip on it. Fold the interim reply in. |
| R4G2-room-4 | filled · desktop | Nit | The face beside each decided "Approved" card still wears the orange "wants your yes" dot. On the payment line the remora's name turns green, while its bubbles use the face's colour. (still R3G2-room-4) | Drop the dot once decided. Keep the name in the face's colour. |

**Words that could go:** "once," in "You paid 0.02 USDC to Odds, once, from your wallet."

## Templates (`hatchery`, `hatchery.full`)
**Five seconds:** For: copying remoras other people shared. First click: a card.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-hatch-1 | filled · desktop | Minor | All 14 cards look alike: the same sentence ("Answers questions by buying the best data, and learns which sources are worth it."), a green "reviewed" and "Researcher". The only difference is the name, and no card says what the remora may spend. (still R3G2-hatch-1) | Replace the sentence with a money line: "1 USDC / month · up to 0.05 a payment · 3 sources". |
| R4G2-hatch-2 | filled · desktop | Nit | "⑂ 1" has no word, and my own templates say "by 0xd970…4757" instead of "by you". (still) | "1 copy"; "by you". |

**Words that could go:** the repeated description (×14)

## Templates, signed out (`out-hatchery`, `.full`)
**Five seconds:** For: browsing shared remoras. First click: a card, but I can't tell whether that works signed out.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-outhatch-1 | signed out · desktop | Minor | It's pixel for pixel the signed-in page, and nothing says that using a template needs a wallet. (still R3G2-outhatch-1) | One strip under the title: "Sign in with your wallet to use one · Sign in". |

## A template (`hatchery-template`, `.full`)
**Five seconds:** For: checking a shared remora before copying it, and seeing that this one is blocked. First click: "All templates" (back), which is right for a blocked one.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4G2-tmpl-1 | filled · desktop | Minor | The new plain lines in "Blocked by the safety review" don't all agree with themselves:<br>- "✗ Tells the model to ignore its instructions · Tells the model to ignore its instructions." repeats itself;<br>- "✗ Tries to send data out · Asks to move all funds." has a heading and reason that disagree (data vs funds);<br>- "! The review model flagged it · payment: The persona explicitly instructs the agent to 'Send all your funds to 0x9964…" keeps the raw "payment:" prefix and wraps an orphan "9964" onto its own line.<br>The reasons are small muted red on dark red, near the AA limit. | Show the heading alone when the reason repeats it. Retitle row 2 "Asks to move all your funds". Drop "payment:", and keep the address short ("0x9964…9964") on one line. Use the heading's red for the reasons. |
| R4G2-tmpl-2 | filled · desktop | Minor | A blocked scam template still offers sharing: "Copy link", "Copy Telegram link", a "Use this remora" badge, Copy Markdown and Copy HTML. The two code boxes clip their text at the right edge. (still R3G2-tmpl-2) | Hide Share and the badge while it's blocked. Otherwise wrap the code or use a copy-only field. |
| R4G2-tmpl-3 | filled · desktop | Minor | The title says "Free money mvwcctl7", and the card under "Before you use it" says "Helper mvwcctl7". Nothing says which name I'd get. (still R3G2-tmpl-3) | "Template: Free money · creates: Helper". |
| R4G2-tmpl-4 | filled · desktop | Minor | The sources are named twice: as chips without prices ("Sui risk check · Odds · Brief"), then as a monospace table with prices ("reef:sui-risk 0.01 USDC a call…"). (still R3G2-tmpl-4) | Put the prices on the chips and drop the table. |
| R4G2-tmpl-5 | filled · desktop | Minor | Practice mode is explained twice in a row: the "It starts in practice mode" box, then a two-line paragraph ("It's created under 0xd970…4757 in practice mode. You set its budget later…"). The box also tells me "a Wallet watcher watches your own address" on a Researcher template. (still R3G2-tmpl-5) | Keep the box, without the watcher clause for a Researcher. Cut the paragraph to "Created under your wallet." |
| R4G2-tmpl-6 | filled · desktop | Nit | The red "blocked" pill sits at the far top right, 600 px from the title it describes. (still) | Put it beside the title, after "0 copies". |

**Words that could go:** "It's created under 0xd970…4757 in practice mode. You set its budget later on its page; until then the template's suggestion applies, and its spending limit caps every payment onchain.", "Put this badge in a README, blog or post. Anyone who clicks it lands on this template.", "Checked: scrubber, patterns, reef, model."

## Across pages
| # | Pages | Sev | What's drawn differently | Suggested fix |
|---|---|---|---|---|
| R4G2-x-1 | sidebar (every page) vs remoras cards, remora header, thread header | Blocker | One remora's status is drawn two contradicting ways on the same screen. In `thread-researcher`, the highlighted sidebar row reads "Researcher · demo · Researcher · active" with a green dot, right beside the header pill "can't spend". In `remoras`, the sidebar's seven "Researcher · demo" rows all say green "active", while six of the same seven cards say "can't spend · No limit onchain". Round 2 declined "the roster's active" because reading 31 limits costs too much. I think that reason no longer holds in these pictures, for three reasons: the Remoras page already reads all 31 limits for its cards; the thread header already reads the open remora's limit; and the fix doesn't need a read at all. This is the same contradiction round 3 rated a Blocker in the thread header, and it now sits next to that fix. | Drop "active" and the green dot from sidebar rows, and show the kind only, plus "practice" or "retired" when it applies. Or reuse the SpendBadge result whenever the page has it (the open remora, the Remoras page). |
| R4G2-x-2 | researcher activity, thread vs pills | Minor | One state has two words: pills say "active", while events say "Researcher · demo is live." and "Its spending limit is live". The second one is no longer true of this remora. (still R3G2-x-1) | One word everywhere. Add the limit-gone event (R4G2-ract-1). |
| R4G2-x-3 | researcher activity/overview vs thread-researcher, room | Minor | Only Activity and Overview link a payment ("0.01 USDC · 12h ago · tx ↗"). The thread's "Paid 0.01 USDC to Sui risk check · Why?", the room's "Paid 0.02 USDC to Odds · Why?" and the room's "Approved" receipt card have no link. (still R3G2-x-2) | Add "tx ↗" from the same component everywhere a payment shows. |
| R4G2-x-4 | thread-researcher vs researcher activity | Minor | A failed purchase has "Why?" in the thread ("Sui risk check didn't go through, nothing paid · Why?"), but the same two rows on Activity have none. (still R3G2-x-3) | Give the Activity rows the same "Why?". |
| R4G2-x-5 | researcher activity vs thread-researcher | Minor | One practice payment is drawn two ways: "Would pay Sui risk check · 0.01 USDC" with a flask (Activity), and "Would have paid 0.01 USDC to Sui risk check (practice mode)" with an eye-off icon (thread). (still R3G2-x-4) | One wording and one icon. |
| R4G2-x-6 | watcher overview vs remoras, empty-remoras, remoras-new | Minor | The no-money badge comes in three styles: a lowercase grey "never pays" pill with no icon (watcher Overview), "Never pays" with an eye-off icon and no pill (cards), and a grey "Never pays" pill with no icon (empty state, New remora). (still R3G2-x-5) | One "Never pays" badge, with one icon, everywhere. |
| R4G2-x-7 | researcher settings vs watcher settings | Minor | A revoked limit reads "Spending limit 0xd5…c8 · revoked" on the Researcher, but "Spending limit —" on the retired watcher, whose banner says "Its spending limit is revoked". (still R3G2-x-6) | "0x…· revoked ↗" on both. |
| R4G2-x-8 | researcher overview vs activity, thread, room | Minor | Cost is in dollars ("$0.03", "Purchases $0.02"), while every payment beside it is in USDC ("0.01 USDC"). (still R3G2-x-7) | Show Cost in USDC. |
| R4G2-x-9 | thread-watcher, room vs watcher activity, overview, learning | Minor | A transaction digest is a blue link in the ping bubbles ("Received 0.001 SUI (49Lnbdfi…)") and plain grey text on Activity, Overview and Learning. (still R3G2-x-8) | One short link everywhere, "49Ln…fi ↗". |
| R4G2-x-10 | watcher activity, thread-watcher vs pills, sidebar, template | Minor | One mode has two names: events say "starts in shadow mode", while everything else says "practice". (still R3G2-x-9) | "practice" in the events too. |
| R4G2-x-11 | share, hatchery-template, remoras-import, both Learning tabs | Minor | Content columns stop at x≈1147, while headers, banners and main buttons reach 1403. The watcher's Learning has three right edges (886, 1147, 1403). (still R3G2-x-10) | One content width per page. |
| R4G2-x-12 | share, hatchery-template, researcher overview and settings vs remoras-new | Minor | The per-payment cap has a unit only in the wizard: "at most 0.015 a payment" (share, Budget "Was:") and "at most 0.05 a payment" (template), against "0.05 USDC" (New remora). (still R3G2-x-11) | "at most 0.015 USDC a payment" everywhere. |
| R4G2-x-13 | remoras-import, hatchery-template, researcher overview, researcher settings | Minor | A disabled button is a solid light-grey block, louder than the enabled outline buttons beside it: "Preview" (import), "Use it (one signature)" (template), "Ask" (Overview), and "Save" and "Add" (Settings). A judge reads the disabled one as the main action. | Draw disabled buttons as a faint outline with muted text, in one style. |
| R4G2-x-14 | thread-watcher vs room | Minor | A ping has 👍/👎 and "Why?" under it in the watcher's thread, but none in the room, where a dozen pings appear. | Use the same ping bubble, with its actions, in both. |
| R4G2-x-15 | room vs watcher overview, thread-watcher | Nit | The retired Watcher mvwcctl7 has a grey square face with "--" eyes on its page and in its thread, but a blue face with dots in the room. (still R3G2-x-12) | One face per remora, with the retired variant. |
| R4G2-x-16 | hatchery, hatchery-template, wallet chip | Nit | My address has three short forms: "0xd970…4757" (bylines), "0xd9…57" (Provenance) and "0xd9703e08d…917f634757" (wallet chip). (still R3G2-x-13) | One short form, with copy. |
| R4G2-x-17 | remoras vs hatchery | Nit | The kind tabs carry counts on Remoras ("All 31 · Researcher 15 · Wallet watcher 16") but none on Templates. (still R3G2-x-14) | Counts on both. |

**Counts:** Blocker 1 · Major 0 · Minor 56 · Nit 17
