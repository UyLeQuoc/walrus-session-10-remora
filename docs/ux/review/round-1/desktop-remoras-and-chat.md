# Round 1 · G2 · Remoras and chat · desktop

Reviewer persona: a hackathon judge with three minutes. I used only the screenshots in `docs/ux/review/r1/desktop/`, the rubric, and the round-0 notes and triage. I review the shell (rail, remora list, wallet chip) once, at the top.

When a round-0 finding is still visible and the triage didn't list it as moved, I raise it again under a new ID and name the old one. I don't raise again findings that were moved to round 2 or 3. Where they're still visible, the page says so in one line.

## Previous findings
- R0G2-remoras-1: not fixed. No card has a meter. Eight Researcher cards still read "Limit not readable now", one per card, and seven more show nothing where the limit goes. Watchers say "Never pays", not what they watch. See R1G2-remoras-1.
- R0G2-remoras-2: fixed. The Activity log is gone, and the page is now about 1,570 px tall.
- R0G2-remoras-3: fixed on a remora's Activity tab, which shows a grey "Sui risk check didn't go through, nothing paid". The chat thread still shows the old red label (R1G2-thr-1).
- R0G2-remoras-4: fixed. Answers render as Markdown, with no `<untrusted>` wrapper and no `x402.unsettled`. One leftover is a missing space, "immutable.Source:" (R1G2-rov-2).
- R0G2-remoras-10: fixed. The banner is gone, and "Needs you 2" sits in the sidebar.
- R0G2-remoras-11: fixed. The feed is a timeline with one icon per kind, with no pills.
- R0G2-emptyrem-2: fixed. It's now one line: "Your first remora: pick a kind."
- R0G2-share-1: fixed. Publish is at the top right.
- R0G2-share-2: not fixed. The source chips are in, and the tools line became "Uses 5 tools". The budget is still a sentence, "0.50 USDC a month, at most 0.015 a payment": the 0.015 has no unit and there's no meter. See R1G2-share-3.
- R0G2-share-3: fixed. It's a check list: Memories, Keys, Spending limit, Receipts and history.
- R0G2-share-4: fixed. The fold reads "Show the file (560 bytes, public on Walrus)", with no epochs.
- R0G2-import-1: fixed. The placeholder is dimmed, "Use the example" comes first, and Preview is disabled while the box is empty.
- R0G2-rov-1: not fixed. Budget still reads "Its spending limit can't be read right now." above two edit boxes, with no meter of spent against the limit. See R1G2-rov-1.
- R0G2-ract-1: not fixed. A payment is still one row ("Sui risk check · 0.01 USDC · 10h ago · Why?"), with no transaction link and no "left this month". See R1G2-ract-1.
- R0G2-rlearn-2: fixed. It reads "33% · 1 of 3 answers · too few to tell yet", muted, with one dot plotted. What it counts is R1G2-rlearn-2.
- R0G2-wov-1: not fixed. A "Watching 0xe7…8d" chip was added and Budget is gone. There are still no ping or ignored numbers, no rules list and no action. See R1G2-wov-1.
- R0G2-wov-2: not fixed. The overview chip shows the address. The chat thread still ends "…is watching 1 address(es) on testnet:" at the colon (R1G2-thw-1).
- R0G2-wlearn-1: fixed. "100%" is muted, with "1 of 1 ping marked noise · too few to tell yet".
- R0G2-loadrem-1: not fixed. The setup card is gone. While loading, the sidebar roster still shows only "Import a team…" and an empty Rooms, with no skeleton rows, and "Needs you" and the rail's Approvals badge disappear. See R1G2-shell-1.
- R0G2-loadrem-2: fixed. The skeleton has a face square, a name bar, a subtitle bar, the Ask block and two half-width cards.
- R0G2-errrem-1: fixed. It says "Can't reach Remora right now. Your remora is safe onchain.", with a face and a Retry button.
- R0G2-errchat-1: fixed. It says "Can't reach your remoras right now.", with a Retry button.
- R0G2-emptychat-1: fixed. The chips are gone, and there's a face, "You have no remora yet…" and a "Create a remora" button.
- R0G2-hatch-1: fixed. Blocked templates are behind "Show blocked (14)".
- R0G2-hatch-3: not fixed. Cards still read "⑂ 1" with no word. Only the template page says "0 copies". See R1G2-hatch-1.
- R0G2-x-1: not fixed. The budget is still five different texts and no meter is drawn anywhere. See R1G2-x-1.
- R0G2-x-6 (payments): fixed. No payment says "Blocked" any more. The thread's red ⊗ icon is a separate issue (R1G2-thr-1).

## The shell (`loading-remora`, `error-remora`, `loading-chat`, `error-chat`, and every filled page)
**Five seconds:** For: getting around, with my remoras on the left. First click: a remora in the list, or "Approve" under "Needs you".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-shell-1 | loading, error · desktop | Blocker | When data is slow or the server fails, the roster looks like a brand-new account. Under "Remoras" there's only "Import a team…", Rooms is empty, the "Needs you 2" section is gone and the rail's Approvals badge is gone, while the wallet chip still reads "19.78 USDC". The error state has no error row in the list either. (Still R0G2-loadrem-1.) | Draw three or four skeleton rows (face circle and two bars) under Remoras while loading. On failure, put one "Can't load your remoras · Retry" row there. Keep the last known Approvals badge, or show a grey dot, until the data is known. |
| R1G2-shell-2 | filled · desktop | Minor | On every Remoras page (the list, New, Import, Share and a remora's four tabs), the rail highlights "Home". There's no Remoras item, so the rail tells you you're on Home. | Add a "Remoras" rail item, or leave nothing highlighted. Never light up Home on a page that isn't Home. |
| R1G2-shell-3 | filled · desktop | Minor | The two "Needs you" rows read "Researcher mvi…" and "Researcher mv…", both "Asks you to approve a payment". The part of the name that tells them apart is cut, and the amount, the number that matters, is missing. | Put the amount on the row ("0.02 USDC to Odds"), and cut the middle of the name, not its end ("Researcher …carot"). |

## Remoras (`remoras`)
**Five seconds:** For: all my remoras at a glance. First click: "New remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-remoras-1 | filled · desktop | Major | No card shows spent against the limit. Eight Researcher cards each say "Limit not readable now". Seven others ("Researcher u12 mvqswyg0", five "Checker" cards, "Researcher mvieduji") are blank where the limit goes. In the above-the-fold shot, "Researcher u12 mvwclxei" is blank too, then later flips to "Limit not readable now", so a pending read draws nothing, not a skeleton. The 16 watcher cards say only "Never pays". (Still R0G2-remoras-1.) | Give every Researcher card the same budget meter ("0.02 / 0.50 USDC this month"), with a skeleton bar while the chain read is pending. If reads fail, show one strip above the grid ("Spending limits can't be read from Sui right now · Retry"), not one sentence per card. On a watcher, show "Watching 0xe7…8d · 3 pings". |
| R1G2-remoras-2 | filled · desktop | Minor | The status pill mixes a state and a warning colour. Researchers get a green "active", and every watcher gets an orange "practice" next to "Never pays". Orange reads as a problem, and "practice" means nothing for a remora that can never pay. (Raises R0G2-remoras-7 again; it wasn't in the triage.) | Use one neutral pill set (Live / Practice / Paused / Retired), with a `?` hint on Practice ("acts, but never pays"). Don't show Practice on a watcher. |
| R1G2-remoras-3 | filled · desktop | Minor | A card carries only its name, its kind and the limit line. The sidebar row shows when it last acted ("Nov 3"), but the card doesn't, so the cards can't be told apart or sorted by eye. | Add one fact per card: "last active 10h ago" and, for a Researcher, "3 answers · 0.02 USDC this month". |
| R1G2-remoras-4 | filled · desktop | Nit | The first three rows of cards are about 98 px tall and the rest about 114 px, so the grid's rhythm changes halfway down, with an empty band at the bottom of the taller cards. | Give every card one fixed height, with the meter or watch line always in the same slot. |

**Words that could go:** "Limit not readable now" (×8), "Researcher" as the subtitle under "Researcher · demo" (×7)

## Remoras, empty account (`empty-remoras`)
**Five seconds:** For: making my first remora. First click: "New remora". Whether the two kind cards are clickable is unclear.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-emptyrem-1 | empty · desktop | Minor | The "Researcher" and "Wallet watcher" cards have no button, arrow or hover cue, and they use a cube and a shield icon instead of the two faces. The only obvious action is the header's "New remora". (Raises R0G2-emptyrem-1 again; it wasn't in the triage.) | Put the kind's face on each card, with a "Create" button in the card's footer. |

**Words that could go:** none

## Remoras, signed out (`out-remoras`)
**Five seconds:** For: signing in. First click: "Sign in with your wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-outrem-1 | signed out · desktop | Minor | The breadcrumb reads "remora" in lowercase and the title reads "Sign in". Signed in, the same route is "Remoras". (Raises R0G2-outrem-1 again.) | Use "Remoras" for both the breadcrumb and the title, with the sign-in card below. |
| R1G2-outrem-2 | signed out · desktop | Minor | The main pane is one line and a button. It doesn't say what a remora is, and the no-wallet "Try a Researcher" path appears only in the sidebar. (Raises R0G2-outrem-2 again.) | Add the two faces with one line each, plus a secondary "Try a Researcher, no wallet" link under the button. |
| R1G2-outrem-3 | signed out · desktop | Minor | There are two solid white sign-in buttons of equal weight, the card's "Sign in with your wallet" and the sidebar's "Sign in", plus a third call in the checklist ("Next: Connect your wallet"). | Keep the card's button as the only solid one, and make the sidebar's "Sign in" a ghost button. |

**Words that could go:** none

## New remora (`remoras-new`)
**Five seconds:** For: creating a remora with a spending limit. First click: "Create Researcher". Clear.

R0G2-new-1 to new-4 (moved to round 2) are all still visible: three explanations of the limit, the flat chips, three right edges, and no meter.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-new-1 | filled · desktop | Minor | The Summary says "Monthly limit 1 USDC" and "You'll sign 1 transaction", but not whether any USDC leaves my 19.78 balance now, or where the remora's payments come from. A judge can't tell whether creating it costs 1 USDC. | Add a row to the Summary: "Moves now: 0 USDC · pays from: your balance (19.78 USDC), up to 1 USDC a month". |
| R1G2-new-2 | filled · desktop | Nit | The unselected Wallet watcher radio is a dark circle on a dark card and is nearly invisible. | Give the unselected radio a visible ring. |

**Words that could go:** "What you will call it in the feed.", "Sui enforces this budget onchain, not us. It pays only these sources; anything over 0.05 USDC asks you first."

## Import a team (`remoras-import`)
**Five seconds:** For: setting up several remoras from one Markdown file. First click: "Use the example".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-import-1 | filled · desktop | Nit | The disabled "Preview" is a solid grey block, heavier than the enabled outlined "Use the example" beside it. It reads as the main button, greyed out. | Draw the disabled Preview as an outline, and make it solid once there's text. |

**Words that could go:** none

## Share as a template (`share`)
**Five seconds:** For: publishing this remora for others to copy. First click: "Publish as a template (one signature)".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-share-1 | filled · desktop | Minor | Each "What stays with you" check repeats its heading in a sub-line: "Receipts and history" over "Receipts and history stay with you." The Keys line adds jargon: "its memory delegate". | Drop the sub-lines and keep the four checks. Put "whoever copies it sets their own budget" in a `?` hint on Spending limit. |
| R1G2-share-2 | filled · desktop | Minor | The safety review is still jargon: "No credentials, no injection or exfiltration phrasing, no raw addresses. Checked: scrubber, patterns, reef, model." (Raises R0G2-share-5 again; it wasn't in the triage.) | A three-item check list: ✓ No secrets ✓ No hidden instructions ✓ No wallet addresses, with "how we check" behind a `?`. |
| R1G2-share-3 | filled · desktop | Minor | The budget is still the sentence "0.50 USDC a month, at most 0.015 a payment". The 0.015 has no unit, and the other pages' budget picture isn't used. (Still R0G2-share-2.) | Use the same budget meter, "0.50 USDC / month", with a tick labelled "0.015 USDC max each". |

**Words that could go:** "This is what people see before they use it.", "Templates never carry memories; the hatcher's remora starts fresh.", "Receipts and history stay with you.", "(one signature)" (could be a `?` hint)

## Researcher · Overview (`remora-researcher-overview`)
**Five seconds:** For: one remora's home: ask it, and see its budget, cost and recent work. First click: the Ask box.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-rov-1 | filled · desktop | Major | The Budget card is a sentence ("Its spending limit can't be read right now.") over two unit-less edit boxes and "Change budget". The page knows this month's spend (the Cost card says Purchases $0.02) and the limit (0.50 USDC), but never draws one against the other. The product's core promise has no picture here. (Still R0G2-rov-1.) | Draw a meter from the recorded spend, "0.02 of 0.50 USDC this month", with a tick at 0.015 for the per-payment cap and an "Enforced on Sui ↗" link. Mark the chain read as a small "onchain check failed · Retry" under it, and move the edit boxes to Settings. |
| R1G2-rov-2 | filled · desktop | Minor | In Recent activity, an answer's source is glued onto its last sentence: "…and is immutable.Source: Sui risk check (0.01 USDC)" and "…no upgrade capability.Cost: 0.01 USDC from Reef". In the thread, the same text is two paragraphs. | Keep the paragraph break in the preview, or pull the cost out as a chip ("0.01 USDC · Sui risk check"). |
| R1G2-rov-3 | filled · desktop | Nit | In the header, "Pause" is set larger than "Chat" and is the heaviest button, though neither is the page's main action. (Raises R0G2-rov-2 again.) | Make "Pause" a ghost button the size of "Chat". |

**Words that could go:** "It buys data when that helps, and tells you what each answer cost." (repeats the subtitle above it), "Up to 0.50 USDC a month, at most 0.015 a payment" (repeats the boxes), "What this remora spent, from its recorded turns, gas and payments."

## Researcher · Activity (`remora-researcher-activity`)
**Five seconds:** For: what it did and what it paid. First click: 👍/👎 or "Why?" on an answer.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-ract-1 | filled · desktop | Major | A payment is a single row ("Sui risk check · 0.01 USDC · 10h ago · Why?"), with no transaction link, no "left this month" and nothing that looks like a receipt. "A receipt for everything" is the product's promise. (Still R0G2-ract-1.) | Draw paid rows as the kit's receipt card: a big "0.01 USDC", "to Sui risk check", "tx Fh8x…7GcT ↗" and a mini meter "0.48 left this month". |
| R1G2-ract-2 | filled · desktop | Minor | The two "Sui risk check didn't go through, nothing paid" rows give no reason and have no "Why?". The thread gives the reason for the same events (in internal words), and the answer just above blames the service. | Add a plain reason and "Why?": "didn't go through · the service sent no data". |
| R1G2-ract-3 | filled · desktop | Minor | "Would pay Sui risk check 0.01 USDC" with a flask icon is unexplained. A newcomer can't tell it's a practice run that paid nothing. | Put a `?` hint on the flask ("Practice: shows what it would pay, pays nothing"), or write "Practice · would pay". |
| R1G2-ract-4 | filled · desktop | Minor | A lone "Its memory" button floats at the top right above the list, with no heading. The watcher's Activity tab has the same. (Raises R0G2-ract-2 again.) | Move it into the header actions next to Chat, or into a "See its memory ↗" link in the tab bar. |

**Words that could go:** "Researcher · demo is live.", "Its spending limit is live; it starts in practice mode."

## Researcher · Learning (`remora-researcher-learning`)
**Five seconds:** For: whether it's getting better. First click: can't tell. Nothing on the page is clickable.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-rlearn-1 | filled · desktop | Major | Both metrics and the proof depend on my 👍/👎. The Proof of Learning empty state now has a face and a line ("Rate its answers or pings with 👍/👎 to teach it.") but no button, and nothing on the page lets me rate. The empty state lacks its button, and the page fails the first-click test. (Raises R0G2-rlearn-1 and rlearn-3 again; they weren't in the triage.) | Add one button to the empty state, "Rate 3 recent answers", which opens them inline with 👍/👎. |
| R1G2-rlearn-2 | filled · desktop | Minor | "Answered from memory 33% · 1 of 3 answers" counts "answers that used a memory and bought nothing". In Activity, the only answer that bought nothing is the failure "I can't tell you if it's safe… This cost me $0." A failed answer seems to count as answered from memory. | Count only answers that weren't failures (or that were rated useful), and let the "1 of 3" link to the answer it counts. |
| R1G2-rlearn-3 | filled · desktop | Minor | The Proof of Learning box stops at about x=1147, while the two metric cards above run to 1403, so its right edge is off the page's grid. | Run the box the full width of the column, like the cards above. |
| R1G2-rlearn-4 | filled · desktop | Nit | The empty line says "Rate its answers or pings" on a Researcher, which has no pings. | "Rate its answers with 👍/👎 to teach it." |

**Words that could go:** "What the remora paid, divided by the answers you marked 👍 useful. 0 data points." (into the `?`), "No data yet." (the "—" already says it), "Answers that used a memory and bought nothing. 3 data points." (into the `?`; "1 of 3" already says it)

## Researcher · Settings (`remora-researcher-settings`)
**Five seconds:** For: editing this remora. First click: the Name or Persona field.

No new findings. R0G2-rset-1 to rset-5 (moved to round 2) are all still visible: the schedule's "11/4/2026, 3:00:00 PM" times, "Remora default / Remora", the "Spending limit 0xd5…c8" id, the duplicate Budget block and the stats sentence under Sources.

**Words that could go:** "The name and the one-sentence persona it answers as.", "Up to 0.50 USDC a month, at most 0.015 a payment", "A question it asks on its own, and tells you the answer.", "From your thumbs up and down; written to its memory as it learns."

## Wallet watcher · Overview (`remora-watcher-overview`)
**Five seconds:** For: a retired watcher's summary. First click: can't tell. There's only a "…" menu.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-wov-1 | filled · desktop | Major | The watched wallet ("0xe7…8d") is now shown, but a watcher's numbers are still missing: how many pings it sent, how many it ignored, and what rules it learned. Half the page is a Cost card reading "No spend this month" for a remora that never pays, and there's no action for a retired one. (Still R0G2-wov-1.) | Two big numbers, "1 ping · 1 ignored", then a "Rules" list ("ignore incoming SUI under 0.002"). Drop the Cost card when there's no spend, and offer "Make a copy" when retired. |
| R1G2-wov-2 | filled · desktop | Minor | Retirement is said three times: the header's "retired" pill, the banner ("Its spending limit is revoked, so it can't act or pay. Its memory and receipts stay yours.") and the top event ("…is retired. Its memory stays yours."). (Raises R0G2-wov-3 again.) | Keep the pill and a one-line banner ("Retired · can't act or pay · its memory stays yours"). |
| R1G2-wov-3 | filled · desktop | Minor | "Learned: ignore incoming SUI under 0.002 (from 🔕)" credits the source with only an emoji, which has no text alternative. The same line is on Activity, Learning and the thread. (Raises R0G2-wov-4 again.) | "(from your 👎 on a ping)", or an icon with a text label. |
| R1G2-wov-4 | filled · desktop | Nit | A "never pays" pill sits next to the "Watching" heading. It's a trait of the kind, not of what it watches, and the list draws the same fact as "Never pays" with an eye-off icon. | Move "never pays" to the kind badge in the header, the same on both pages. |

**Words that could go:** "Its memory stays yours." (in the event, after the banner says it), "What this remora spent, from its recorded turns, gas and payments.", "You watch the owner's addresses and decide whether an event is worth a ping, following the rules the owner taught you." (the raw persona as the subtitle, R0G2-x-10, moved)

## Wallet watcher · Activity (`remora-watcher-activity`)
**Five seconds:** For: what it saw and whether it pinged me. First click: 👎 on the ping.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-wact-1 | filled · desktop | Minor | The transaction digests "(84t7yEiU…)" and "(49Lnbdfi…)" are shortened but have no copy and no explorer link. They're the only evidence of what the watcher saw. (Raises R0G2-wact-1 again.) | Make each digest a "84t7…EiU ↗" link to the explorer. |

**Words that could go:** "Ignored:" (after the eye-off icon), "Its memory stays yours."

## Wallet watcher · Learning (`remora-watcher-learning`)
**Five seconds:** For: proof it learned to stay quiet. First click: "Verify this decision".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-wlearn-1 | filled · desktop | Minor | The proof still opens with a two-line sentence with nested parentheses ("Before, it pinged you (Received 0.001 SUI (49Lnbdfi…)). After it learned "…(from 🔕)", it stayed quiet (Ignored: …)."). The Before and After cards right under it say the same. (Raises R0G2-wlearn-2 again.) | Drop the sentence, and put an arrow between the Before and After cards. |
| R1G2-wlearn-2 | filled · desktop | Minor | "What it learned in between" shows the full Walrus id "HYsBxscSKPcNaSjqQam1rKmuZbzWg-v-AB_NNv5fEw8" with only a copy icon, next to a bare "rules" chip. (Raises the id half of R0G2-wlearn-3 again; the date half is x-7, moved.) | "HYsB…fEw8 ↗ on Walrus", and drop the "rules" chip or say "a rule". |

**Words that could go:** "The Wallet watcher's pings you marked 👎 noise. 1 data point." ("1 of 1 ping marked noise" already says it)

## Wallet watcher · Settings (`remora-watcher-settings`)
**Five seconds:** For: editing this watcher. First click: can't tell. It's retired, yet the fields look editable.

No new findings. R0G2-wset-1 and wset-2 (moved to round 2) are still visible: an empty red Danger zone, and editable Name, Persona and Brain on a retired remora with no Watching or Rules section.

**Words that could go:** "Retired: its spending limit was revoked, so it never pays again.", "No budget to change.", "Both actions need a signature and take effect immediately." (there are no actions)

## Remora, loading (`loading-remora`)
**Five seconds:** For: a remora page that's loading. First click: none expected.

No new findings in the main pane: the skeleton now has the page's final shape. The sidebar is R1G2-shell-1.

## Remora, error (`error-remora`)
**Five seconds:** For: it failed; try again. First click: "Retry".

No new findings in the main pane: the error card has a face, 10 words and Retry. The sidebar is R1G2-shell-1.

## Chat, new (`chat`)
**Five seconds:** For: talking to my remoras. First click: one of the four suggestion chips.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-chat-1 | filled · desktop | Minor | Nothing says which of my 31 remoras will answer. The box reads "Message your remora…", and the only picker under it, "Remora ⌄", is the model. (Raises R0G2-chat-1 again; it wasn't in the triage.) | Show the face and name of the remora that will answer ("Researcher · demo answers ⌄"), or "the right remora answers" with a `?`. |
| R1G2-chat-2 | filled · desktop | Minor | The ⓘ and list icons next to the picker have no labels, and the "Memory" toggle doesn't say what turning it off does. (Raises R0G2-chat-2 again.) | Add tooltips and aria-labels, plus a `?` on Memory ("Off: it won't read or write its memory for this chat"). |

**Words that could go:** "Oh, hello", "What are we figuring out today?"

## Chat, empty account (`empty-chat`)
**Five seconds:** For: making a remora so I can chat. First click: "Create a remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-emptychat-1 | empty · desktop | Minor | The live composer ("Message your remora…", send arrow, Memory toggle) is still the biggest thing on the page, above "Create a remora", though there's no remora to message. Two things compete as the main action. | Disable the composer with the placeholder "Create a remora first", or put the face and "Create a remora" above it. |

**Words that could go:** "Hey there", "What shall we untangle?"

## Chat, loading (`loading-chat`)
**Five seconds:** For: it tells me I have no remora. First click: "Create a remora", which is wrong for this account.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-loadchat-1 | loading · desktop | Blocker | While the remoras load, the chat shows the empty-account state: a face, "You have no remora yet. Make one to chat with." and "Create a remora". This is an account with 31 remoras, 2 approvals waiting and 19.78 USDC in the wallet chip. An unknown is shown as "none". | Show a skeleton picker ("Loading your remoras…") and the chips as skeleton pills, and show the empty state only once the list is known to be empty. |

## Chat, error (`error-chat`)
**Five seconds:** For: chat that can't reach the server. First click: "Retry".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-errchat-1 | error · desktop | Minor | The error card is see-through: the ASCII art shows through its right third, behind and around "Retry". | Make the error card opaque, or stop the art behind the composer column. |

**Words that could go:** "Half a thought?", "That's plenty to start with." (a joke heading above a failure)

## Thread with a Researcher (`thread-researcher`)
**Five seconds:** For: my conversation with this remora. First click: the message box.

R0G2-thr-1 and thr-2 (moved to round 2) are still visible: the "Re:" lines with the full 66-character id, and no 👍/👎 on answers.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-thr-1 | filled · desktop | Major | The thread still uses the old failure label. Two lines read "Didn't pay Sui risk check: the service answered 200", with a red ⊗. The red icon reads as the limit stopping it, and "answered 200" is an HTTP success code. On the same remora's Activity tab, the same events are a grey "didn't go through, nothing paid". | Use the Activity tab's wording and grey icon here too: "Sui risk check didn't go through · the service sent no data · nothing paid". Keep red for a guard's refusal. |

**Words that could go:** "Re:", "This cost me $0.", "(practice mode)"

## Thread with a Wallet watcher (`thread-watcher`)
**Five seconds:** For: what this watcher told me. First click: can't tell. It's retired, but the composer looks live (R0G2-thw-1, moved).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-thw-1 | filled · desktop | Major | "Watcher mvwcctl7 is watching 1 address(es) on testnet:" still ends at the colon, with no address. In the thread, this is the only place the watched wallet could appear. (Still R0G2-wov-2; only the overview was fixed.) | Append the same chip as the overview ("0xe7…8d ↗"), and write "1 wallet". |

**Words that could go:** "and starts in shadow mode" (see R1G2-x-5)

## Room (`room`)
**Five seconds:** For: a group chat with all my remoras. First click: the message box, using "@" to name one.

R0G2-room-1 to room-3 (moved to round 2) are still visible: the run-on member list with the "Auto" and "Lead: first member" dropdowns, "· matched" and "· named", and "Needs your approval" kept after "Approved".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-room-1 | filled · desktop | Minor | One payment is told in two places, and they disagree on who paid. The approval card says "…so you pay it once, from your balance." An answer that says "I haven't bought anything" comes in between. Then a line says "Researcher mvwcarot: Paid 0.02 USDC to Odds". This repeats for every question in the room. | Fold the approval and the payment into one receipt card where the payment happened: "You paid 0.02 USDC to Odds · over its 0.015 USDC cap · approved · tx ↗". |

**Words that could go:** "It's over this remora's per-payment cap, so you pay it once, from your balance." (a cap meter says it)

## Templates (`hatchery`)
**Five seconds:** For: copying remoras other people shared. First click: a card, though there's no visible "Use".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-hatch-1 | filled · desktop | Minor | The copies count is still "⑂ 1", an icon and a number with no word. The template page says "0 copies". (Still R0G2-hatch-3.) | "1 copy" on the card, the same as the template page. |
| R1G2-hatch-2 | filled · desktop | Minor | Cards have no "Use" button or hover cue. (Raises R0G2-hatch-2 again; it wasn't in the triage.) | Put a "Use" button in the card's footer, next to the kind. |
| R1G2-hatch-3 | filled · desktop | Minor | A card says nothing about money. All 14 show only the same description line, though the template page knows the budget ("1.00 USDC a month, at most 0.05") and the services it may pay. | Add the budget as a small "1 USDC / month" figure and the service chips (Sui risk check · Odds · Brief) to each card. |
| R1G2-hatch-4 | filled · desktop | Minor | Every card reads "by 0xd970…4757", which is my own wallet (the chip reads "0xd9703e08d…917f634757"), but the card doesn't say it's mine. | "by you" for my own templates, and the short address for others. |

**Words that could go:** none

## Templates, signed out (`out-hatchery`)
**Five seconds:** For: browsing shared remoras. First click: a card, but I can't tell whether that works signed out.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-outhatch-1 | signed out · desktop | Minor | It's identical to the signed-in page. Nothing says that using a template needs a wallet. (Raises R0G2-outhatch-1 again; it wasn't in the triage.) | Make the card's action "Sign in to use", or add a one-line strip under the title with "Sign in". |

## A template (`hatchery-template`; first captured this round)
**Five seconds:** For: checking a shared remora before copying it. First click: can't tell above the fold. The only buttons there are "Copy link" and "Copy Telegram link".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R1G2-tmpl-1 | filled · desktop | Major | The main action, "Use it (one signature)", is about 1,140 px down. It sits under Provenance (four ids), two copy-link buttons, the details card, a sources table, the safety verdict and two paragraphs about practice mode. Above the fold, sharing looks like the main action. | Put "Use it" in the header at the top right, as Share does with Publish, and move the copy links into the Share section. |
| R1G2-tmpl-2 | filled · desktop | Minor | This template was blocked, but the fold looks like a normal one. The red "Blocked by the safety review" starts at about y=810, and the title carries only "0 copies". | Put a red "Blocked" pill next to the title, and make the verdict the first block on the page. |
| R1G2-tmpl-3 | filled · desktop | Minor | It has two names on one page: the title is "Free money mvwcctl7", and the card under "Before you use it" is "Helper mvwcctl7". | Use one name, or label the second "it creates: Helper mvwcctl7". |
| R1G2-tmpl-4 | filled · desktop | Minor | The block reasons are raw field paths in red, five lines of them: "remoras[0].persona: Tells the model to ignore its instructions.", "file: payment: The persona explicitly instructs…", ending "Checked: scrubber, patterns, reef, model." | A ✗ check list in plain words: ✗ Tells it to ignore its instructions ✗ Asks to move all funds ✗ Names a wallet address. Put the field paths behind "details". |
| R1G2-tmpl-5 | filled · desktop | Minor | The services appear twice in two vocabularies: chips "Sui risk check · Odds · Brief", then a table of "reef:sui-risk / reef:odds / reef:brief" with prices. | One table with plain names and prices: "Sui risk check · 0.01 USDC a call". |
| R1G2-tmpl-6 | filled · desktop | Minor | Practice mode is explained twice in a row: a card ("It shows what it would pay and pays nothing until you turn it on. Schedules arrive paused; a Wallet watcher watches your own address.") and a two-line paragraph ("It's created under 0xd970…4757 in practice mode. You set its budget later…"). | One line above the button, "Starts in practice: pays nothing until you turn it on", with the rest in a `?`. |
| R1G2-tmpl-7 | filled · desktop | Minor | The Share section offers a "Use this remora" badge, Markdown and HTML for a template the safety review blocked. Its two code boxes clip the URL at the right edge mid-id. | Hide Share when a template is blocked. Cut the code boxes with an ellipsis, since Copy is beside them. |
| R1G2-tmpl-8 | filled · desktop | Minor | The first block is Provenance: four ids labelled "Author", "Walrus blob", "Published in" and "Template object". It comes before what the template does, and its labels are jargon to a newcomer. | Lead with what it does. Fold provenance into one line, "On Walrus ✓ · author onchain ✓ · details", that opens the four ids. |

**Words that could go:** "The file on Walrus and its author onchain.", "Read back from Walrus and checked again just now.", "It's created under 0xd970…4757 in practice mode. You set its budget later on its page; until then the template's suggestion applies, and its spending limit caps every payment onchain.", "Put this badge in a README, blog or post. Anyone who clicks it lands on this template.", "Checked: scrubber, patterns, reef, model."

## Across pages
| # | Pages | Sev | What's drawn differently | Suggested fix |
|---|---|---|---|---|
| R1G2-x-1 | remoras, Researcher overview and settings, watcher overview and settings, share | Minor | The budget is still five texts and never a meter: "Limit not readable now" (list), "Its spending limit can't be read right now." (overview, settings), "Never pays" (list) and a "never pays" pill (watcher overview), "No budget to change." with "Retired: its spending limit was revoked, so it never pays again." (watcher settings), and "0.50 USDC a month, at most 0.015 a payment" (share) against "Up to 0.50 USDC a month, at most 0.015 a payment" (overview). (Still R0G2-x-1.) | One budget meter with three states (skeleton, value, "can't be read · Retry"), plus one "Never pays" badge for watchers, used on every one of these pages. |
| R1G2-x-2 | Researcher activity, Researcher thread, room | Minor | One payment is written three ways: "Sui risk check · 0.01 USDC" (activity row), "Paid 0.01 USDC to Sui risk check" (thread), "Researcher mvwcarot: Paid 0.02 USDC to Odds" (room). Practice is two ways: "Would pay Sui risk check" against "Would have paid 0.01 USDC to Sui risk check (practice mode)". A failure is two ways (R1G2-thr-1). | One event renderer for the timeline and both chats: the same icon, words, amount and receipt link. |
| R1G2-x-3 | Researcher overview, Researcher settings, thread, activity | Minor | The same money is in two units. The Cost card says "$0.03", "< $0.01" and "Purchases $0.02", and an answer says "This cost me $0.", while Settings says "0.02 USDC spent" for the same purchases and every payment row is in USDC. | Use USDC in the Cost card, as the balances already do: "0.03 USDC", with "≈ $0.03" in a hint if wanted. |
| R1G2-x-4 | wallet chip, template cards, template page | Minor | One wallet is written four ways: "0xd9703e08d…917f634757" (chip), "by 0xd970…4757" (cards), "Author 0xd9…57" (template page), "created under 0xd970…4757" (template page). Other ids are cut to 2+2 ("0xe7…8d", "0x8a…e3"). | One short form (0x + 4 … 4) with copy and ↗ everywhere, and "you" when it's the signed-in wallet. |
| R1G2-x-5 | remoras, Researcher activity, watcher activity, watcher thread, template | Minor | The trial mode has two names: an orange "practice" pill, "(practice mode)" and "It starts in practice mode" against "is ready and starts in shadow mode" on the watcher. (Raises R0G2-x-5 again; it wasn't in the triage.) | Use "Practice" everywhere, with the same pill and `?` hint. |
| R1G2-x-6 | Templates, template page, share | Minor | The safety review shows as a green "reviewed" pill (cards), "Passed the safety review" (share) and "Blocked by the safety review" (template page). Copies show as "⑂ 1" (cards) and "0 copies" (template page). | One review badge ("Safe ✓" / "Blocked ✗") and one "n copies" label on both the cards and the template page. |
| R1G2-x-7 | share, template page, timeline | Minor | Faces are missing wherever a remora is named outside the list and header: share's "What it can do" card, the template page's "Before you use it" card, and the activity timeline, which uses kind icons. (Raises R0G2-x-8 again; it wasn't in the triage.) | Put the remora's face (or its kind's face, for a template) on every card that names a remora. |
| R1G2-x-8 | share, template page, Researcher learning vs overview and settings | Minor | There are two content widths. Share, the template page and the Proof of Learning box stop at about x=1147, with their header buttons at 1403. Overview, Settings, the list and the learning cards run to 1403. | Pick one column width for the main pane (1403) and keep it on every remora page. |

**Counts:** Blocker 2 · Major 8 · Minor 48 · Nit 6
