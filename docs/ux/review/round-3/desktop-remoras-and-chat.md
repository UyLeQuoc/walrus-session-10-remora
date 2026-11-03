# Round 3 · G2 · Remoras and chat · desktop

Reviewer persona: a hackathon judge with three minutes, who knows crypto a little and has never heard of Remora, Disc or x402. I used only the screenshots in `docs/ux/review/r3/desktop/`, the rubric, round 2's findings for these pages, and round 2's triage. I review the shell (rail, remora list, wallet chip) once, at the top. Findings that round 2 carried as "moved to round 3" are raised again below if I can still see them, since this is the last round.

## Previous findings
- R2G2-remoras-1: fixed. A card whose limit is gone now shows a grey "can't spend" pill and "No limit onchain". The roster's green "active" was declined, so I don't raise it again. Two related gaps are new: a card says green "active" while its limit is still being read (R3G2-remoras-1), and the thread header says "active" (R3G2-thr-1).
- R2G2-rov-1: fixed. The header says "can't spend". The Budget says "Was: Up to 0.50 USDC a month…", and the edit boxes are gone. An empty meter track is still drawn under the gone state (R3G2-rov-2).
- R2G2-rset-1: fixed. Keys reads "Spending limit 0xd5…c8 · revoked", and Budget says "Was:".
- R2G2-wov-1: not fixed, in part. "Rules it learned" now lists "ignore incoming SUI under 0.002". But the page's only control is still "…", so I can't see a next step (R3G2-wov-3).
- R2G2-wset-1: fixed. A retired watcher's Settings are read-only: one line, then Keys. There's no Name, Persona or Brain box, and no empty Danger zone. The retired line now repeats the banner above it (R3G2-wset-1).
- R2G2-new-1: fixed. The Summary now says "At the cap · 20 payments a month" and no longer claims a maximum. "Cap" is still an undefined third word (R3G2-new-1).
- R2G2-tmpl-1: fixed. The header has "All templates" and a red "blocked" pill, and the only "Use it (one signature)" is greyed out.

## The shell (every page; states `loading-*`, `error-*`, `empty-*`, `out-*`)
**Five seconds:** For: getting around, with my remoras on the left. First click: a remora in the list, or a "Needs you" row.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-shell-1 | filled · desktop | Minor | On a remora's own pages (Overview, Activity, Learning, Settings), no sidebar row is marked as the open one, and seven rows read "Researcher · demo". The thread does highlight its row (`thread-researcher`), so the two pages disagree. | Highlight the open remora's row on its pages too, as the thread does. |
| R3G2-shell-2 | filled · desktop | Minor | The two "Needs you" rows are identical: "Researcher m… · 0.02 USDC · wants your yes". Their names are cut before the part that tells them apart. | Cut the middle of the name, not the end ("Researcher…08dw"), or show what it wants to buy: "Odds · 0.02 USDC". |
| R3G2-shell-3 | loading, error · desktop | Minor | While loading (`loading-remora`, `loading-chat`) and on error (`error-remora`, `error-chat`), the "Needs you 2" section and the rail's Approvals "2" badge vanish with no placeholder. That reads as "nothing waiting", while the wallet chip still shows "19.78 USDC". | Keep the Approvals badge as a grey dot while loading. Give "Needs you" one skeleton row, or the line "Can't load approvals. Retry". |
| R3G2-shell-4 | filled · desktop | Minor | The rail lights "Home" on every Remoras page (`remoras`, `remoras-new`, `remoras-import`, `share`, every remora tab), while the bar title says "Remoras". Templates and Chat light their own rail item. | Give Remoras a rail item, or light none rather than the wrong one. |
| R3G2-shell-5 | empty · desktop | Nit | Under Rooms, "Team · No members yet" has a blank gap where every other row has a face. | Put the room's group icon in the slot, as in the room header. |
| R3G2-shell-6 | empty · desktop | Nit | The red "Pause all" sits in the top bar of an account with 0 remoras. | Hide it until there's at least one remora. |

## Remoras (`remoras`, `remoras.full`)
**Five seconds:** For: all my remoras at a glance. First click: "New remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-remoras-1 | filled · desktop | Blocker | A card claims green "active" before its limit has been read, and the claim turns out wrong. In the above-the-fold shot, the 6th card ("Researcher · demo", cyan triangle) shows green "active" over "Reading limit". In the whole-page shot, taken later, the same card shows "can't spend · No limit onchain". Eight other cards still show "active" or "practice" over "Reading limit", including "Researcher · demo" (purple triangle), the only demo card that hasn't resolved, while its six siblings all say "can't spend". This is a status shown while data loads. | Until the limit is read, show a neutral grey pill "checking…", or no pill, with a shimmer in the meter slot. Show "active" only after the limit is confirmed onchain. |
| R3G2-remoras-2 | filled · desktop | Minor | Nine cards still say "Reading limit" in the later whole-page shot (the five "Checker" cards, "Researcher u12 mvwclxei", "Researcher u12 mvqswyg0", "Researcher mvieduji" and one demo card). A pending read is drawn as words, and it never times out, so it looks stuck. | Draw a shimmering bar in the meter slot, with no words. After a few seconds, show one strip above the grid: "Couldn't read 9 spending limits from Sui · Retry". |
| R3G2-remoras-3 | filled · desktop | Nit | Twenty-two cards wear an orange "practice" pill, the colour the sidebar uses for "wants your yes", so a safe mode reads as a warning. Each Researcher card also repeats "Researcher" as a subtitle under "Researcher · demo". | Draw "practice" as a neutral or blue pill. Drop the kind subtitle when the name already says it. |

**Words that could go:** "Researcher" (subtitle under "Researcher · demo", ×7), "Reading limit" (×9; a shimmer says it)

## Remoras, empty account (`empty-remoras`)
**Five seconds:** For: making my first remora. First click: "New remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-emptyrem-1 | empty · desktop | Minor | The two kind cards ("Researcher · Spends USDC", "Wallet watcher · Never pays") have no button, arrow or hover sign, so I can't tell whether they're clickable. They use a cube and a shield, while every remora elsewhere has a face. | Make each card a button ("Create a Researcher →") that opens New remora with that kind picked. Use the two kinds' faces instead of the cube and shield. |

**Words that could go:** none

## Remoras, signed out (`out-remoras`)
**Five seconds:** For: signing in. First click: "Sign in with your wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-outrem-1 | signed out · desktop | Minor | The pane never says what a remora is. "Sign in with your wallet to see your remoras." assumes I know. The no-wallet path a judge would want, "Try a Researcher · no wallet", is tucked into the sidebar. The bar title reads lowercase "remora" over a "Sign in" heading. | Add one line under the logo: "AI agents that spend only within a limit enforced on Sui." Add a secondary button "Try one without a wallet". Make the bar title "Remoras". |

**Words that could go:** none

## New remora (`remoras-new`)
**Five seconds:** For: creating a remora with a spending limit. First click: "Create Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-new-1 | filled · desktop | Minor | "At the cap · 20 payments a month" uses a third word for the 0.05 limit, which the form calls "Most it pays at once" and the Summary calls "Most at once". "The cap" can just as well mean the monthly limit, so 20 still reads like a payment count. The chips "Sui risk check · Odds · Brief" show no prices, so I can't tell what 1 USDC buys. | Write "20 payments at 0.05 USDC each". Put prices on the chips ("Sui risk check · 0.01"), and add a line such as "≈ 100 Sui risk checks a month". |
| R3G2-new-2 | filled · desktop | Minor | Nothing says whether any USDC leaves my wallet when I create it. "You'll sign 1 transaction to set its spending limit." doesn't say if 1 USDC moves now, or only as it pays. | Add one fact beside the signature line, "No USDC moves now" or "1 USDC moves to it now", whichever is true. |
| R3G2-new-3 | filled · desktop | Minor | There are three right edges: the kind cards end at x≈1057, the form at ≈987, and the Summary at 1403. The "Enforced on Sui" pill floats alone under the Summary card, belonging to neither the card nor the signature line. | Let the kind cards span the form's width. Put the pill in the Summary header ("Summary · ✓ Enforced on Sui"). |
| R3G2-new-4 | filled · desktop | Minor | The unselected radio on "Wallet watcher" is a dark circle on a dark card, near invisible (well under 3:1). Only the border tells which kind is picked. | Draw the empty radio with a mid-grey ring at 3:1 or more. |

**Words that could go:** "Pick what it does. You can change it later.", "Sui won't let it spend more than this a month." (the "Enforced on Sui" pill says it)

## Import a team (`remoras-import`)
**Five seconds:** For: setting up several remoras from one Markdown file. First click: "Use the example".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-import-1 | filled · desktop | Minor | The disabled "Preview" is a solid light-grey block, the heaviest thing on the page. The enabled "Use the example" beside it is a dark outline, so the button I can't use looks like the main one. | Draw a disabled button as a faint outline with muted text. Make "Use the example" the filled button until there's text to preview. |

**Words that could go:** none

## Share as a template (`share`, `share.full`)
**Five seconds:** For: publishing this remora for others to copy. First click: "Publish as a template (one signature)".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-share-1 | filled · desktop | Minor | Each "What stays with you" row repeats its heading in a sub-line ("Receipts and history · Receipts and history stay with you."). The rest is jargon: "memory delegate", "the hatcher's remora", "Spending limit ids", "Checked: scrubber, patterns, reef, model." | Keep four ticks with headings only: "✓ Memories ✓ Keys ✓ Spending limit ✓ Receipts stay with you". Put the details behind one `?`. Cut the "Checked:" line. |

**Words that could go:** "This is what people see before they use it.", "Receipts and history stay with you.", "Templates never carry memories; the hatcher's remora starts fresh.", "Checked: scrubber, patterns, reef, model."

## Researcher · Overview (`remora-researcher-overview`, `.full`)
**Five seconds:** For: one remora's home: ask it, and see its budget, cost and recent work. First click: the Ask box.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-rov-1 | filled · desktop | Minor | The header says "can't spend", but the Ask box below still promises "It buys data when that helps, and tells you what each answer cost.", and the subtitle says "Answers questions by buying the best data". A judge who asks will expect a purchase that can't happen. | In the can't-spend state, change the Ask line to "It can't buy now; it answers from memory." |
| R3G2-rov-2 | filled · desktop | Minor | The gone-state Budget card still draws an empty meter track above "No spending limit onchain: it can't spend". The empty bar reads as "0 spent", while the Cost card beside it shows "Purchases $0.02" this month. The key fact is the smallest, greyest text on the card. | Drop the track in this state. Show one larger line: "No spending limit on Sui · can't buy", with "was 0.50 USDC / month" muted beneath. |
| R3G2-rov-3 | filled · desktop | Minor | Budget and Cost don't line up. Budget's box runs y≈488–552, and Cost's box y≈532–695, pushed down by the "November 2026" picker. The tops differ, and Budget leaves a 140 px hole under it. | Move the month picker into the Cost heading row, at the right, so both boxes start at one y and stretch to one height. |
| R3G2-rov-4 | filled · desktop | Nit | "Pause" is a larger, bordered button, while "Chat" is a small ghost button. On a remora that can't spend, chatting is the likelier first action. | Give both the same size, or make Chat the filled one. |

**Words that could go:** "It buys data when that helps, and tells you what each answer cost." (repeats the subtitle), "What this remora spent, from its recorded turns, gas and payments."

## Researcher · Activity (`remora-researcher-activity`, `.full`)
**Five seconds:** For: what it did and what it paid. First click: "tx ↗" or "Why?" on a payment.

The right-hand columns now line up (amount · time · tx · Why?), and the long question is shortened to "0xcc05…5d6d".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-ract-1 | filled · desktop | Minor | The header says "can't spend", but the timeline never says why. Its status rows are "Researcher · demo is live." and "…is ready. Its spending limit is live; it starts in practice mode.", and no event records the limit going away. | Add an event at the top, "Spending limit gone onchain · can't spend · tx ↗", in the status style. |
| R3G2-ract-2 | filled · desktop | Minor | The practice row "Would pay Sui risk check · 0.01 USDC" puts its amount in the same column and weight as the two real payments. A judge adding up the column gets 0.03 USDC, while Cost says $0.02. | Grey or strike the practice amount ("~~0.01~~ practice"), and put a "practice" pill in the tx slot. |
| R3G2-ract-3 | filled · desktop | Nit | Icons are drawn two ways: questions, payments and practice sit in tinted circles, while status (⚡) and failure (broken link) rows are bare glyphs. "Its memory" floats alone at the top right above the list. | Put every icon in a circle, grey for status and failures. Move "Its memory" into the header row with the tabs. |

**Words that could go:** "Researcher · demo is live.", "Its spending limit is live; it starts in practice mode." (a muted status row can say "Ready · practice")

## Researcher · Learning (`remora-researcher-learning`)
**Five seconds:** For: whether it's getting better. First click: "Rate recent ones".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-rlearn-1 | filled · desktop | Major | "Answered from memory 33% · 1 of 3 answers" counts a failure as a success. On Activity, the only one of the three answers that bought nothing is "I can't tell you if it's safe because the sui-risk service… didn't provide any data. This cost me $0." So the one "answered from memory" is the one that didn't answer. It's the headline of "How it's learning", and it overstates what it learned. | Count only answers that gave an answer: leave out the ones whose purchase failed, or mark them "couldn't answer". With today's data that's "0 of 2 answered from memory". |
| R3G2-rlearn-2 | filled · desktop | Nit | The empty proof says "Rate its answers or pings" on a Researcher, which has no pings. The chart's x label is "2026-11-03", while every other date reads "Nov 3". | Say "Rate its answers". Use "Nov 3" on the axis. |

**Words that could go:** "No data yet." (the "—" says it), "What the remora paid, divided by the answers you marked 👍 useful. 0 data points." (into a `?`), "Answers that used a memory and bought nothing. 3 data points."

## Researcher · Settings (`remora-researcher-settings`, `.full`)
**Five seconds:** For: editing this remora. First click: the Name field.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-rset-1 | filled · desktop | Minor | The Schedules line still reads "weekdays at 8am UTC: next Today 3:00 PM · Tomorrow 3:00 PM · Fri 3:00 PM", with 8am and 3:00 PM side by side and a zone on only one. I can't tell whether "weekdays at 8am" + "What are the odds for this weekend?" + "Add" is a saved schedule or a new one being typed. | List saved schedules as rows ("Weekdays 3:00 PM your time (8:00 UTC) · 'What are the odds…' · next today · ✕"), with an empty "Add a schedule" row under them. |
| R3G2-rset-2 | filled · desktop | Nit | Schedules is the only section whose right side isn't in a card. Brain reads "Remora default / Remora ⌄", the product's name twice, with no model name. | Put the schedule rows in a card. Name the model in the picker ("Remora default · <model>"). |

**Words that could go:** "The name and the one-sentence persona it answers as.", "A question it asks on its own, and tells you the answer.", "The key that acts, and the spending limit that caps it.", "Both actions need a signature and take effect immediately."

## Wallet watcher · Overview (`remora-watcher-overview`, `.full`)
**Five seconds:** For: a retired watcher's record: what it watched and the rule it learned. First click: can't tell. The Learning tab is my guess, since the only control is "…".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-wov-1 | filled · desktop | Minor | Each stat card says "1 recently" (Pings, Ignored, Rules learned). "Recently" has no period, and the Cost card right below has a month picker. | Name the window once under the three numbers: "since Oct 31", or "last 30 days". |
| R3G2-wov-2 | filled · desktop | Minor | The rule's source is an emoji alone: "ignore incoming SUI under 0.002 (from 🔕)". There's no text alternative, and the Learning tab gives the same source as "pings you marked 👎 noise". | Write the source in words, with the same icon as Learning: "from your 👎 on Oct 31". |
| R3G2-wov-3 | filled · desktop | Minor | Retired, and no next step: the header has only "…". (This is the unfixed part of R2G2-wov-1.) | Add one header button, "Make a copy", which starts a new watcher on 0xe7…8d with this rule. |
| R3G2-wov-4 | filled · desktop | Nit | "Retired" is said three times above the fold (the pill, a two-sentence banner, and the first event), and the Cost section spends a whole block on "No spend this month" for a remora that never pays. | Keep the pill and one muted line, "Retired Oct 31 · can't act or pay". Hide Cost for a watcher. |

**Words that could go:** "Its memory and receipts stay yours." (the banner, and "Its memory stays yours." in the event), "What this remora spent, from its recorded turns, gas and payments.", the persona as the subtitle ("You watch the owner's addresses and decide…")

## Wallet watcher · Activity (`remora-watcher-activity`)
**Five seconds:** For: what it saw and whether it pinged me. First click: "Why?" on the ignored event.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-wact-1 | filled · desktop | Nit | "Watcher mvwcctl7 is watching 1 address(es) on testnet" uses a programmer's plural, and doesn't name the address. | "Watching 0xe7…8d ↗ on testnet". |

**Words that could go:** "Ignored:" (the eye-off icon says it), "Its memory stays yours."

## Wallet watcher · Learning (`remora-watcher-learning`, `.full`)
**Five seconds:** For: proof it learned to stay quiet. First click: "Verify this decision".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-wlearn-1 | filled · desktop | Minor | The biggest number on the page is "Noise rate 100%", which reads as a failure. It counts the one ping before the rule. The success, that it then stayed quiet on the same kind of event, isn't in any number. | Lead with before and after as two numbers: "Noise pings: 1 before the rule → 0 after (1 ignored)". |
| R3G2-wlearn-2 | filled · desktop | Minor | The Proof box opens with a two-line sentence with nested parentheses ("Before, it pinged you (Received 0.001 SUI (49Lnbdfi…)). After it learned…"). The Before and After cards right under it say the same thing. | Drop the sentence. The Before → After cards are the picture. |
| R3G2-wlearn-3 | filled · desktop | Minor | "What it learned in between" shows the full Walrus id "HYsBxscSKPcNaSjqQam1rKmuZbzWg-v-AB_NNv5fEw8" in monospace beside a bare "rules" chip, with a copy button but no short form and no explorer link. | Show "HYsB…fEw8 ↗" linking to the Walrus explorer, and label the chip "Rule saved on Walrus". |

**Words that could go:** "The Wallet watcher's pings you marked 👎 noise. 1 data point." (into a `?`), the Proof sentence (see -2)

## Wallet watcher · Settings (`remora-watcher-settings`)
**Five seconds:** For: a retired watcher's keys, read-only. First click: none expected, and that's right here.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-wset-1 | filled · desktop | Minor | "Retired: it can't act or pay. Its memory and receipts stay yours." sits right under the banner, which says almost the same words. | Drop the line. The banner and pill say it. |

**Words that could go:** "Retired: it can't act or pay. Its memory and receipts stay yours.", "The key that acts, and the spending limit that caps it."

## Remora, loading (`loading-remora`)
**Five seconds:** For: a remora page that's loading. First click: none expected.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-loadrem-1 | loading · desktop | Nit | The skeleton has no tab row, so the Ask box and the cards jump down about 50 px when the page loads. | Add four short pill bars for Overview · Activity · Learning · Settings. |

## Remora, error (`error-remora`)
**Five seconds:** For: it failed; try again. First click: "Retry".

No findings in the main pane: a face, ten words ("Can't reach Remora right now. Your remora is safe onchain.") and Retry. For the shell, see R3G2-shell-3.

## Chat, new (`chat`, and the art in `empty-chat`, `loading-chat`, `error-chat`)
**Five seconds:** For: talking to my remoras. First click: one of the four suggestion chips.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-chat-1 | filled, empty, loading, error · desktop | Minor | The ASCII-art creatures sit in a different place in each of the four shots, so they move or are redrawn on each visit. On an app page that's motion that shows nothing changing, and in every shot they cross text:<br>- a column runs through the "H" of "Half a thought?" (`loading-chat`);<br>- one sits behind "night." and "small thing" (`error-chat`);<br>- one runs into "Got something to untangle?" and under the composer's right edge (`empty-chat`). | Keep the art static, and outside the heading, composer and chips column (or fade it to near zero there). Turn any movement off under reduced motion. |
| R3G2-chat-2 | filled · desktop | Minor | Nothing says who will answer. The heading is a different quip on every visit ("Still at it?", "Half a thought?", "A quiet night.", "Oh, hello"), the composer says "Message your remora...", and "Remora ⌄" is the model, not a remora. With 31 remoras I can't tell which one gets the message. | Put a "To: Auto (best fit) ⌄" chip with faces at the left of the composer, and keep one steady heading ("Ask your remoras"). |
| R3G2-chat-3 | filled · desktop | Nit | The ⓘ and list icons in the composer have no labels. | Add tooltips or short labels ("Costs", "Tools"). |

**Words that could go:** "I'm here." / "That's plenty to start with." / "Start with the small thing." / "Got something to untangle?" (the sub-quips)

## Chat, empty account (`empty-chat`)
**Five seconds:** For: making a remora so I can chat. First click: "Create a remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-emptychat-1 | empty · desktop | Minor | The live composer, with Memory, model picker and send, is the biggest thing on the page, above "You have no remora yet. Make one to chat with." and the button. With no remora, a message has nowhere to go. | Put the face, line and "Create a remora" first, and dim the composer ("Make a remora to start"). |
| R3G2-emptychat-2 | empty · desktop | Nit | The waving hand touches the last "o" of "Oh, hello". | Add a space before the emoji. |

**Words that could go:** "Got something to untangle?"

## Chat, loading (`loading-chat`)
**Five seconds:** For: chat, still loading my remoras. First click: a chip.

No findings of its own. For the art, see R3G2-chat-1. For the vanished "Needs you", see R3G2-shell-3.

## Chat, error (`error-chat`)
**Five seconds:** For: chat that can't reach the server. First click: "Retry".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-errchat-1 | error · desktop | Minor | While "Can't reach your remoras right now." shows, the composer stays fully live, and a calm "A quiet night. / Start with the small thing." sits above the failure. The error card is see-through, and the art shows through its left end behind the face icon. | Dim the composer ("Can't send until Remora is back"). Put the error card where the greeting is, on a solid background. |

**Words that could go:** "A quiet night.", "Start with the small thing."

## Thread with a Researcher (`thread-researcher`)
**Five seconds:** For: my conversation with this remora. First click: the message box.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-thr-1 | filled · desktop | Blocker | The thread header shows a green "active" pill for "Researcher · demo". Its own page (the same remora, with the same three questions and two 0.01 USDC payments) says "can't spend", and so does its card on Remoras. This is one remora's header, not the roster, so the roster's decline (31 reads) doesn't cover it. | Use the remora header's pill here: grey "can't spend". |
| R3G2-thr-2 | filled · desktop | Minor | The three answers have no 👍/👎. The Activity tab rates these same answers, Learning asks me to "Rate its answers", and the watcher's thread puts 👍/👎 under its ping. | Put 👍/👎 and "Why?" under each answer bubble, as under the ping. |

**Words that could go:** "Re:" (the quote styling says it), "(practice mode)" (a practice pill says it)

## Thread with a Wallet watcher (`thread-watcher`)
**Five seconds:** For: what this watcher told me, and that it's retired. First click: "Why?" under the ping.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-thw-1 | filled · desktop | Minor | "Watcher mvwcctl7 is watching 1 address(es) on testnet:" still ends at a colon with nothing after it. The Overview and Activity draw the same event without the colon. | Render it with the timeline's component, and append the address chip "0xe7…8d ↗". |

**Words that could go:** "and starts in shadow mode" (see R3G2-x-9)

## Room (`room`, `room.full`)
**Five seconds:** For: a group chat with my remoras. First click: the message box, using "@" to name one.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-room-1 | filled · desktop | Major | The room contradicts itself about whose money paid. Each approval card says "Approved" and still asks "Pay 0.02 USDC to Odds? It's over its per-payment cap; you pay it once, from your wallet." A few lines down, "Researcher mvwcarot: Paid 0.02 USDC to Odds" says the remora paid. This repeats for every researcher in the room (mvig08dw, mvj0yzcl, mvjnvzx3, mvwcarot). | Title the decided card as a receipt: "You paid 0.02 USDC to Odds for Researcher mvwcarot · Approved · tx ↗". Drop the question once it's decided. Word the payment line the same way ("Paid from your wallet"). |
| R3G2-room-2 | filled · desktop | Minor | The header is a run-on list, "Researcher · demo, Researcher · demo, Researcher · demo, Researcher · demo, Resea…", next to two unexplained dropdowns, "Auto" and "Lead: first member". | Use a stack of faces with "+27" that opens the member list. Put who answers in one control with a `?` ("Auto: the best fit answers; name one with @"). |
| R3G2-room-3 | filled · desktop | Minor | The order of each exchange is hard to follow. The "Approved" card comes first, then an answer saying "I haven't bought anything yet", then "Paid 0.02 USDC", then a second answer to the same question. It reads as two answers, and as a payment approved before the remora wanted it. | Group one exchange: question → "wants 0.02 USDC for Odds · Approved" → the answer, with a "Paid 0.02 USDC · tx ↗" chip on it. Fold the interim "haven't bought yet" reply into it. |
| R3G2-room-4 | filled · desktop | Nit | The face beside each "Approved" card still wears the orange "wants your yes" dot. The remora's name turns green on its payment line, while its bubbles use the face's colour (pink, orange, purple). | Remove the dot once the card is decided. Keep the name in the face's colour, and mark the payment with a small green $ icon. |

**Words that could go:** "Pay 0.02 USDC to Odds?" (once it's Approved), "It's over its per-payment cap; you pay it once, from your wallet." (a cap tick would say it)

## Templates (`hatchery`, `hatchery.full`)
**Five seconds:** For: copying remoras other people shared. First click: a card.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-hatch-1 | filled · desktop | Minor | All 14 cards look alike. Each has the same sentence ("Answers questions by buying the best data, and learns which sources are worth it."), a green "reviewed" and "Researcher", and nothing about money, so the name is the only difference. For a product about capped spending, a card doesn't say what the remora may spend. | Replace the repeated sentence with a money line: "1 USDC / month · up to 0.05 a payment · 3 sources", and add a "Use" button on hover. |
| R3G2-hatch-2 | filled · desktop | Nit | "⑂ 1" has no word, and my own templates say "by 0xd970…4757" instead of "by you". | "1 copy". "by you" when the author is the signed-in wallet. |

**Words that could go:** the repeated description (×14)

## Templates, signed out (`out-hatchery`)
**Five seconds:** For: browsing shared remoras. First click: a card, but I can't tell whether that works signed out.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-outhatch-1 | signed out · desktop | Minor | It looks the same as the signed-in page, and nothing says that using a template needs a wallet. | One strip under the title: "Sign in with your wallet to use one · Sign in". |

## A template (`hatchery-template`, `.full`)
**Five seconds:** For: checking a shared remora before copying it, and seeing that this one is blocked. First click: "All templates" (back), which is right for a blocked one.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G2-tmpl-1 | filled · desktop | Major | The "Blocked by the safety review" box is a six-line red wall:<br>- raw field paths ("remoras[0].persona:" ×3, "file: payment:");<br>- a full 64-character address "0x9964…9964" across a line;<br>- the model's reason, which stops mid-sentence at "which is a direct attempt to initiate an".<br>The key fact, why it's blocked, is the hardest thing on the page to read. | Show three ✗ rows in plain words: "✗ Tells the model to ignore its instructions · ✗ Asks to move all funds · ✗ Pays a raw address 0x9964…9964". Put the model's full reason, untruncated, behind a `?`. |
| R3G2-tmpl-2 | filled · desktop | Minor | A blocked scam template still offers sharing: "Copy link", "Copy Telegram link", a "Use this remora" badge, and Copy Markdown and Copy HTML. The two code boxes also clip their text at the right edge. | Hide Share (and the badge) while it's blocked. When it shows, wrap the code or add a copy-only field. |
| R3G2-tmpl-3 | filled · desktop | Minor | The title says "Free money mvwcctl7", and the card under "Before you use it" says "Helper mvwcctl7". There's no word on which one people would get. | Use one name, or label them "Template: Free money · creates: Helper". |
| R3G2-tmpl-4 | filled · desktop | Minor | The sources are named twice: as chips "Sui risk check · Odds · Brief", then as a monospace table "reef:sui-risk · reef:odds · reef:brief" with prices. | Put the prices on the chips ("Sui risk check · 0.01 USDC") and drop the table. |
| R3G2-tmpl-5 | filled · desktop | Minor | Practice mode is explained twice in a row: the "It starts in practice mode" box, then "It's created under 0xd970…4757 in practice mode. You set its budget later on its page; until then…" (two lines). | Keep the box. Cut the paragraph to "Created under your wallet." |
| R3G2-tmpl-6 | filled · desktop | Nit | The red "blocked" pill sits at the far top right, next to "All templates", 600 px from the title it describes. | Put the pill beside the title, after "0 copies". |

**Words that could go:** "It's created under 0xd970…4757 in practice mode. You set its budget later on its page; until then the template's suggestion applies, and its spending limit caps every payment onchain.", "Put this badge in a README, blog or post. Anyone who clicks it lands on this template.", "Checked: scrubber, patterns, reef, model."

## Across pages
| # | Pages | Sev | What's drawn differently | Suggested fix |
|---|---|---|---|---|
| R3G2-x-1 | researcher activity, thread vs remoras, remora header, sidebar | Minor | One state has two words: the pills and the sidebar say "active", while the timeline and the thread say "Researcher · demo is live." and "Its spending limit is live". | Pick "active" everywhere, including the events ("…is active"). |
| R3G2-x-2 | researcher activity/overview vs thread-researcher, room | Minor | Only Activity and Overview link a payment ("0.01 USDC · 11h ago · tx ↗"). The same payment in the thread ("Paid 0.01 USDC to Sui risk check · Why?") and in the room ("Paid 0.02 USDC to Odds · Why?") has no link, exactly where a judge reads the story. | Add "tx ↗" to the payment line in threads and rooms, from the same component. |
| R3G2-x-3 | thread-researcher vs researcher activity | Minor | A failed purchase has "Why?" in the thread ("Sui risk check didn't go through, nothing paid · Why?"), but the same two rows on the Activity tab have none. | Give the Activity rows the same "Why?". |
| R3G2-x-4 | researcher activity vs thread-researcher | Minor | One practice payment is drawn two ways: "Would pay Sui risk check · 0.01 USDC" with a flask icon (Activity), and "Would have paid 0.01 USDC to Sui risk check (practice mode)" with an eye-off icon (thread). | One wording and one icon: "Practice · would have paid 0.01 USDC to Sui risk check". |
| R3G2-x-5 | watcher overview vs remoras, empty-remoras, remoras-new | Minor | The no-money badge is a lowercase "never pays" pill with no icon next to "Watching" on the watcher's Overview. Elsewhere it's "Never pays" with an eye-off icon (cards), or a grey "Never pays" label (empty state, New remora). | One "Never pays" badge, with the same icon, on all four pages. |
| R3G2-x-6 | researcher settings vs watcher settings | Minor | A revoked limit reads "Spending limit 0xd5…c8 · revoked" on the Researcher, but "Spending limit —" on the retired watcher, whose banner says "Its spending limit is revoked". | Show "0x…· revoked ↗" on both. |
| R3G2-x-7 | researcher overview vs activity, thread, room, funds | Minor | The Cost card is in dollars ("$0.03", "Purchases $0.02"), while every payment beside it is in USDC ("0.01 USDC"). | Show Cost in USDC, with "≈ $" in muted text if needed. |
| R3G2-x-8 | thread-watcher, room vs watcher activity, overview, learning | Minor | A transaction digest is blue and link-looking in the ping bubbles ("Received 0.001 SUI (49Lnbdfi…)"), but plain grey in Activity, Overview and Learning. I can't tell which one opens. | Make every digest the same short link, "49Ln…fi ↗", to the explorer. |
| R3G2-x-9 | watcher activity, thread-watcher vs remoras, sidebar, template | Minor | One mode has two names: events say "starts in shadow mode", while pills, the sidebar and the template say "practice". | Say "practice" in the events too. |
| R3G2-x-10 | share, hatchery-template, remoras-import, both Learning tabs | Minor | Content columns stop at x≈1147 (the share cards, template boxes, import textarea and Proof boxes), while the headers, banners and main buttons reach 1403. The watcher's Learning has three right edges (886, 1147, 1403). | One content width per page: full width, or 1147 for everything, header button included. |
| R3G2-x-11 | share, hatchery-template, researcher overview and settings vs remoras-new | Minor | The per-payment cap has no unit everywhere except the wizard: "at most 0.015 a payment" (share, Budget "Was:"), "at most 0.05 a payment" (template), against "0.05 USDC" (New remora). | "at most 0.015 USDC a payment" on every page. |
| R3G2-x-12 | room vs watcher overview, thread-watcher | Nit | The retired Watcher mvwcctl7 has a grey square face with "--" eyes on its page and in its thread header, but a blue face with dots in the room. | One face per remora everywhere, with the retired variant once it's retired. |
| R3G2-x-13 | hatchery, hatchery-template, wallet chip | Nit | My address has three short forms: "0xd970…4757" (bylines, practice line), "0xd9…57" (Provenance) and "0xd9703e08d…917f634757" (wallet chip). | One short form ("0xd970…4757") everywhere, with copy. |
| R3G2-x-14 | remoras vs hatchery | Nit | The kind tabs carry counts on Remoras ("All 31 · Researcher 15 · Wallet watcher 16") but none on Templates. | Counts on both. |

**Counts:** Blocker 2 · Major 3 · Minor 51 · Nit 18
