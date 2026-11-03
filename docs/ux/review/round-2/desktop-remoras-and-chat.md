# Round 2 · G2 · Remoras and chat · desktop

Reviewer persona: a hackathon judge with three minutes. I used only the screenshots in `docs/ux/review/r2/desktop/`, the rubric, round 1's findings for these pages and round 1's triage. I review the shell (rail, remora list, wallet chip) once, at the top. Where a round-1 finding that was moved to round 3 is still visible, the page says so in one line, and I don't raise it again.

## Previous findings
- R1G2-shell-1: not fixed, in part. The roster now shows five skeleton rows while loading and "Can't load your remoras. Retry" on error. But in both states the "Needs you 2" section and the rail's Approvals badge still disappear with no placeholder, while the wallet chip still reads "19.78 USDC". Rooms is empty while loading.
- R1G2-loadchat-1: fixed. While loading, chat shows the heading, the composer and the chips, and no longer says "You have no remora yet".
- R1G2-remoras-1: not fixed, in part. The three states are now told apart ("No spending limit onchain: it can't spend", "Reading its spending limit"). Still:
  - no card draws spent against a limit;
  - in the whole-page shot, 11 cards still say "Reading its spending limit" over a track that can't be seen (R2G2-remoras-2, -3);
  - watchers still say only "Never pays", not what they watch.
- R1G2-rov-1: not fixed, in part. The Budget card now has a state line, but the meter is an empty track under "No spending limit onchain: it can't spend". Meanwhile the subtitle and the boxes still say 0.50 / 0.015 and the Cost card shows $0.02 of purchases this month. The edit boxes are still on the Overview. See R2G2-rov-1.
- R1G2-ract-1: not fixed, in part. Each paid row now ends in a blue "tx ↗". It's still a one-line row ("Sui risk check · 0.01 USDC · 11h ago · tx ↗ · Why?"), with no receipt look and no "left this month".
- R1G2-thr-1: fixed. In the thread, a failed purchase is a grey "Sui risk check didn't go through, nothing paid · Why?", the same as on the Activity tab.
- R1G2-rlearn-1: fixed. The empty proof has a face, a line and a "Rate recent ones" button.
- R1G2-wov-1: not fixed, in part. "Pings 1 · Ignored 1 · Rules learned 1" are in, as three stat cards. Still:
  - "Rules learned 1" doesn't say the rule;
  - the Cost card still reads "No spend this month" for a remora that never pays;
  - a retired watcher still has no action (R2G2-wov-1).
- R1G2-tmpl-1: fixed. "Use it" is at the top right, and "Before you use it" comes before Provenance. But see R2G2-tmpl-1: the header button looks live on a blocked template.
- R1G2-shell-3 (round 0's list, "the amount on a wait"): not fixed, in part. The rows now show "0.02 USDC · wants your yes", but both names are still cut to "Researcher m…", so the two rows can't be told apart.
- R0G2-room-2 (round 0's list, plain routes): fixed. Rows read "→ Researcher mvig08dw · best fit" and "→ Wallet watcher mvj0yzcl · you named it".
- R0G2-room-3 (round 0's list, an approval titles itself): not fixed, in part. The card's title is "0.02 USDC to Odds" with a green "Approved", but its body still asks "Pay 0.02 USDC to Odds?" after it's decided.
- R0G2-rset-1 (round 0's list, upcoming times): fixed. It reads "next Today 3:00 PM · Tomorrow 3:00 PM · Fri 3:00 PM". See R2G2-rset-2 for the mix of 8am and 3:00 PM.
- Round 0's list, the wizard's "at most N payments a month": it's in, but the number is wrong (R2G2-new-1).
- R0G2-thw-1 (moved to round 2, composer live on a retired watcher): fixed. The composer reads "Watcher mvwcctl7 is retired."

## The shell (every page; states `loading-*`, `error-*`, `empty-*`, `out-*`)
**Five seconds:** For: getting around, with my remoras on the left. First click: a remora in the list, or a "Needs you" row.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-shell-1 | filled · desktop | Minor | On a remora's own page (Overview, Activity, Learning, Settings), no row in the sidebar is marked as the open one. Seven rows read "Researcher · demo", so I can't tell which one I'm looking at. The chat thread does highlight its row (`thread-researcher`), so the two pages disagree. | Highlight the open remora's row on its pages, as the thread does. Where names repeat, add the short id ("Researcher · demo · …k3f"). |
| R2G2-shell-2 | empty · desktop | Nit | Under Rooms, "Team · No members yet" has a blank gap where its icon should be. Every other row has a face, and the room header elsewhere uses a group icon. | Put the room's group icon in the slot. |
| R2G2-shell-3 | empty · desktop | Nit | The red "Pause all" button sits in the top bar of an account with 0 remoras, where there's nothing to pause. | Hide it, or grey it out, until there's at least one remora. |

Still visible (moved to round 3): the rail lights "Home" on every Remoras page (R1G2-shell-2).

## Remoras (`remoras`)
**Five seconds:** For: all my remoras at a glance. First click: "New remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-remoras-1 | filled · desktop | Blocker | The status contradicts the card. Eight Researcher cards carry a green "active" pill, and the sidebar calls them "Researcher · live", directly above "No spending limit onchain: it can't spend". On the watcher's page, the same condition (the limit gone onchain) is called "Retired… it can't act or pay". A judge can't tell whether these remoras work or not. | One rule for a remora whose limit is gone: a grey "No limit" pill (not green "active") and a "live" dot that isn't green. Say what it can still do in one line: "answers from memory · can't buy". |
| R2G2-remoras-2 | filled · desktop | Minor | A pending read is a sentence, not a skeleton. In the above-the-fold shot, 4 cards say "Reading its spending limit". In the whole-page shot, taken later, 11 still do (the five "Checker" cards, "Researcher u12 mvwclxei", "Researcher mvieduji"…), so it looks stuck, and one of them flips to "No spending limit onchain" between the two shots. | A shimmering bar in the meter's slot while reading, with no words. After a few seconds, show one strip above the grid: "Couldn't read 11 spending limits from Sui · Retry". |
| R2G2-remoras-3 | filled · desktop | Minor | The meter's track is invisible: it measures #252525 on a #1D1D1D card, about 1.04:1, against the 3:1 that a meaningful graphic needs. So the "track shows at zero" fix doesn't show. | Draw the track at 3:1 or more against the card (a mid-grey outline or fill), and the filled part in the accent colour. |

**Words that could go:** "No spending limit onchain: it can't spend" (×8; one strip above the grid says it once), "Reading its spending limit" (×11), "Researcher" as the subtitle under "Researcher · demo" (×7)

Still visible (moved to round 3): the orange "practice" pill on every watcher (R1G2-remoras-2), no last-active fact per card (-3), and rows of only watchers are 99 px tall against 115 px elsewhere (-4).

## Remoras, empty account (`empty-remoras`)
**Five seconds:** For: making my first remora. First click: "New remora".

No new findings. Still visible (moved): the two kind cards have no button and use a cube and a shield, not faces (R1G2-emptyrem-1). For the badge "Read-only", see R2G2-x-3.

**Words that could go:** none

## Remoras, signed out (`out-remoras`)
**Five seconds:** For: signing in. First click: "Sign in with your wallet".

No new findings. The sidebar's "Sign in" is now a dark secondary button (R1G2-outrem-3 looks done). Still visible (moved): the lowercase "remora" breadcrumb over the "Sign in" title (R1G2-outrem-1), and a pane that doesn't say what a remora is (-2).

**Words that could go:** none

## New remora (`remoras-new`)
**Five seconds:** For: creating a remora with a spending limit. First click: "Create Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-new-1 | filled · desktop | Blocker | The Summary says "At most 20 payments a month". That's 1 USDC ÷ 0.05 USDC, the number of *largest* payments, not a maximum. The sources it can pay cost 0.01–0.02 USDC a call (template page), so 1 USDC buys 50–100 payments. And "Anything above this asks you first" means a payment over 0.05 is still possible with my yes. A judge reads 20 as a hard cap. | Show what the money buys, as numbers: "≈ 100 Sui risk checks or 50 Odds a month", or "20 payments at the 0.05 maximum". If a payment count really is enforced onchain, say that next to it ("count enforced on Sui"). |
| R2G2-new-2 | filled · desktop | Nit | The "Enforced on Sui" pill floats on its own under the Summary card, left-aligned, between the card and "You'll sign 1 transaction…". It reads as an orphan, not as part of the summary. | Put it in the Summary's header ("Summary · ✓ Enforced on Sui"), or on the Monthly limit row. |

**Words that could go:** "Pick what it does. You can change it later.", "Sui won't let it spend more than this a month." (the "Enforced on Sui" pill says it)

Still visible (moved): the unselected radio is near-invisible (R1G2-new-2); there are three right edges (kind cards at x≈1057, the form at 987, the Summary at 1403) and no meter (R0G2-new-3, -4); nothing says whether any USDC leaves now (R1G2-new-1).

## Import a team (`remoras-import`)
**Five seconds:** For: setting up several remoras from one Markdown file. First click: "Use the example".

No new findings. Still visible (moved): the disabled "Preview" is a solid grey block, heavier than "Use the example" (R1G2-import-1).

**Words that could go:** none

## Share as a template (`share`)
**Five seconds:** For: publishing this remora for others to copy. First click: "Publish as a template (one signature)".

No new findings. Still visible (moved):
- sub-lines repeat their headings ("Receipts and history stay with you.") (R1G2-share-1);
- the safety jargon "scrubber, patterns, reef, model" (-2);
- "at most 0.015 a payment" has no unit (-3);
- the content stops at x≈1147 while Publish sits at 1403 (R1G2-x-8).

**Words that could go:** "This is what people see before they use it.", "Receipts and history stay with you.", "Spending limit ids stay with you;"

## Researcher · Overview (`remora-researcher-overview`)
**Five seconds:** For: one remora's home: ask it, and see its budget, cost and recent work. First click: the Ask box.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-rov-1 | filled · desktop | Blocker | The Budget card says three things about one limit. The subtitle says "Up to 0.50 USDC a month, at most 0.015 a payment". The meter says "No spending limit onchain: it can't spend". Under them sit live boxes, "0.50", "0.015" and "Change budget". The header still says green "active". The empty track also reads as 0 spent, while the Cost card next to it shows "Purchases $0.02" this month. The key fact is the smallest, faintest text in the card. | In the gone state, replace the card's contents with one big state: "No spending limit on Sui · it can't buy", a button "Set a new limit (1 signature)", and "was 0.50 USDC / month" in muted text. Drop the subtitle and the empty track. When a limit exists, draw "0.02 of 0.50 USDC this month". |
| R2G2-rov-2 | filled · desktop | Minor | The Budget and Cost boxes side by side don't line up. Budget's box runs y≈488–633, and Cost's box y≈532–695, pushed down by the "November 2026" picker. Neither the tops nor the bottoms match. | Put the month picker in the Cost heading row, at the right, so both boxes start at the same y and stretch to one height. |

**Words that could go:** "It buys data when that helps, and tells you what each answer cost." (repeats the subtitle), "Up to 0.50 USDC a month, at most 0.015 a payment", "What this remora spent, from its recorded turns, gas and payments."

Still visible (moved): "Pause" is larger and heavier than "Chat" (R1G2-rov-3); the Cost card is in $ while everything else is in USDC (R1G2-x-3). For the row alignment in Recent activity, see R2G2-ract-1.

## Researcher · Activity (`remora-researcher-activity`)
**Five seconds:** For: what it did and what it paid. First click: "tx ↗" or "Why?" on a payment.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-ract-1 | filled · desktop | Minor | The right-hand facts don't line up. "11h ago" sits at four x positions: ≈1229 on answers, 1271 on payments, 1298 on the practice row and 1357 on status rows. The long question ("Is the package 0xcc0564…5d6d safe…") pushes its 👍/👎/Why? to a second line on the left, unlike the two answers above it. The Overview's Recent activity has the same. | Fixed right-hand columns, the same on every row: amount · time · tx · Why?. Keep 👍/👎 in one slot, and cut a long question with an ellipsis so its controls stay on its line. |
| R2G2-ract-2 | filled · desktop | Nit | The icons are drawn two ways. Questions, payments, practice and learned rows sit in tinted circles, while status rows (⚡) and failures (broken link) are bare glyphs. | One icon style for every row: all in circles, with grey for status and failures. |

**Words that could go:** "Researcher · demo is live.", "Its spending limit is live; it starts in practice mode." (a muted status row can say "Ready · practice")

Still visible (moved): failures have no reason or Why? (R1G2-ract-2), the flask's practice row is unexplained (-3), and "Its memory" floats alone (-4).

## Researcher · Learning (`remora-researcher-learning`)
**Five seconds:** For: whether it's getting better. First click: "Rate recent ones".

No new findings. Still visible (moved):
- "1 of 3 answers" counts the failed answer as answered from memory (R1G2-rlearn-2);
- the Proof box stops at x≈1147 under cards that reach 1403 (-3);
- "answers or pings" on a Researcher (-4).

**Words that could go:** "No data yet." (the "—" says it), "What the remora paid, divided by the answers you marked 👍 useful. 0 data points.", "Answers that used a memory and bought nothing. 3 data points."

## Researcher · Settings (`remora-researcher-settings`)
**Five seconds:** For: editing this remora. First click: the Name field, or "Change budget".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-rset-1 | filled · desktop | Blocker | The page says there's no spending limit and also lists one. Budget reads "No spending limit onchain: it can't spend", under the label "Up to 0.50 USDC a month, at most 0.015 a payment". Keys lists "Spending limit 0xd5…c8" with a copy button, as if it were live. The retired watcher's Settings shows "Spending limit —" for the same condition. This has the same root as R2G2-rov-1. | Mark the Keys row "Spending limit · revoked ↗" in grey (with the explorer link), or "—" as on the watcher. Use the same gone-state block as the Overview in Budget, and drop the "Up to 0.50…" label. |
| R2G2-rset-2 | filled · desktop | Minor | The schedule line reads "weekdays at 8am UTC: next Today 3:00 PM · Tomorrow 3:00 PM · Fri 3:00 PM": 8am and 3:00 PM side by side, with a zone on only one of them. I can't tell whether "weekdays at 8am" + "What are the odds for this weekend?" + "Add" is a saved schedule or a new one being typed. | List saved schedules as rows ("Weekdays 3:00 PM your time (8:00 UTC) · 'What are the odds…' · next: today · ✕"). Put an empty "Add a schedule" row under them. |
| R2G2-rset-3 | filled · desktop | Nit | Schedules is the only section whose right side isn't in a card, so the column's rhythm breaks between Budget and Sources. | Put the schedule rows in a card like the other sections. |

**Words that could go:** "The name and the one-sentence persona it answers as.", "Up to 0.50 USDC a month, at most 0.015 a payment", "A question it asks on its own, and tells you the answer.", "The key that acts, and the spending limit that caps it."

Still visible (moved): "Remora default / Remora" (R0G2-rset-2), and a budget block that repeats itself (R0G2-rset-4).

## Wallet watcher · Overview (`remora-watcher-overview`)
**Five seconds:** For: a retired watcher's summary. First click: can't tell. The only control is the "…" menu.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-wov-1 | filled · desktop | Major | It fails the first-click test. The watcher is retired, and nothing on the page says what I can do next. There's no copy, restart or rules list, only "…" at the top right. "Rules learned 1" doesn't name the rule, so the most interesting thing it learned is one click away, on Activity. (This is the unfixed part of R1G2-wov-1.) | Under the stat cards, add a "Rules" list showing "ignore incoming SUI under 0.002 · from your 👎 on Oct 31". Give it one header button, "Make a copy", which starts a new watcher on 0xe7…8d with these rules. |
| R2G2-wov-2 | filled · desktop | Minor | Each stat card reads "1 recently". "Recently" has no period, while the Cost card right under it has a month picker. | Name the window: "1 ping · since Oct 31", or "last 30 days" under the three numbers. |

**Words that could go:** "Its memory stays yours." (in the event, after the banner says it), "What this remora spent, from its recorded turns, gas and payments.", the persona as the subtitle ("You watch the owner's addresses and decide…")

Still visible (moved): the banner repeats the pill (R1G2-wov-2), "(from 🔕)" has no text (-3), and the "never pays" pill sits next to Watching (-4).

## Wallet watcher · Activity (`remora-watcher-activity`)
**Five seconds:** For: what it saw and whether it pinged me. First click: "Why?" on the ignored event.

No new findings. Still visible (moved): the digests "(84t7yEiU…)" have no explorer link (R1G2-wact-1). For the time column, see R2G2-ract-1; it's the same here (3d ago at x≈1230, 1300 and 1358).

**Words that could go:** "Ignored:" (after the eye-off icon), "Its memory stays yours."

## Wallet watcher · Learning (`remora-watcher-learning`)
**Five seconds:** For: proof it learned to stay quiet. First click: "Verify this decision".

No new findings. Still visible (moved):
- the two-line proof sentence with nested parentheses (R1G2-wlearn-1);
- the full Walrus id "HYsBxscSKP…NNv5fEw8" with a bare "rules" chip (-2);
- three right edges: the Noise card at x≈886, the Proof box at 1147, the banner at 1403 (R1G2-x-8).

**Words that could go:** "The Wallet watcher's pings you marked 👎 noise. 1 data point.", "Before, it pinged you (Received 0.001 SUI (49Lnbdfi…)). After it learned …, it stayed quiet (Ignored: …)."

## Wallet watcher · Settings (`remora-watcher-settings`)
**Five seconds:** For: editing a watcher. First click: can't tell. It's retired, yet Name, Persona, Brain and Save look editable.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-wset-1 | filled · desktop | Major | It fails the five-second test, and it's still R0G2-wset-1 and -2, which were moved to this round:<br>- a retired remora shows live Name and Persona boxes with a Save button, and a Brain picker;<br>- the Danger zone is an empty red box under "Both actions need a signature and take effect immediately.", with no actions;<br>- there's no Watching or Rules section. | Show a retired watcher's settings read-only, under one line: "Retired Oct 31 · can't act or pay". List what it watched and the rules it learned. Make "Make a copy" the only button, and drop the empty Danger zone. |

**Words that could go:** "No budget to change.", "Retired: its spending limit was revoked, so it never pays again." (the banner says it), "Both actions need a signature and take effect immediately." (there are no actions)

## Remora, loading (`loading-remora`)
**Five seconds:** For: a remora page that's loading. First click: none expected.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-loadrem-1 | loading · desktop | Nit | The skeleton has no tab row. The real page has Overview · Activity · Learning · Settings between the subtitle and the Ask box, so everything below jumps about 50 px when it loads. | Add four short pill bars for the tabs. |

## Remora, error (`error-remora`)
**Five seconds:** For: it failed; try again. First click: "Retry".

No new findings in the main pane: a face, 10 words and Retry. The sidebar now says "Can't load your remoras. Retry". For the vanishing approvals, see the previous findings.

## Chat, new (`chat`)
**Five seconds:** For: talking to my remoras. First click: one of the four suggestion chips.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-chat-1 | filled, loading, error, empty · desktop | Minor | The ASCII-art creatures are in a different place in each of the four chat shots, so they're either animated or redrawn on each visit. On an app page that's motion that shows nothing changing, and from stills I can't tell whether it respects reduced motion. In every shot they cross text: a column runs behind "Oh, hello" and "Got something to untangle?" (`error-chat`), and a whale sits under the chips (`loading-chat`). | Keep the art static, outside the heading, composer and chips column (or fade it to near zero there), and turn any movement off under reduced motion. |

**Words that could go:** "The rough version is welcome."

Still visible (moved): nothing says which remora answers; "Remora ⌄" is the model (R1G2-chat-1); the ⓘ and list icons have no labels (-2).

## Chat, empty account (`empty-chat`)
**Five seconds:** For: making a remora so I can chat. First click: "Create a remora".

No new findings. Still visible (moved): the live composer is the biggest thing, above "Create a remora" (R1G2-emptychat-1).

**Words that could go:** "Something on your mind?", "The rough version is welcome."

## Chat, loading (`loading-chat`)
**Five seconds:** For: chat, still loading my remoras. First click: a chip.

No new findings. It no longer claims I have no remora.

**Words that could go:** "Pick a starting point." (the chips are the starting points)

## Chat, error (`error-chat`)
**Five seconds:** For: chat that can't reach the server. First click: "Retry".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-errchat-1 | error · desktop | Minor | While "Can't reach your remoras right now." is showing, the composer stays fully live: placeholder, Memory toggle, model picker and send. A cheerful "Oh, hello 👋 / Got something to untangle?" sits above the failure. Two things compete, and the one that will fail is the bigger. | Dim the composer, with the placeholder "Can't send until Remora is back", and put the error card above it in place of the greeting. |

**Words that could go:** "Oh, hello", "Got something to untangle?"

Still visible (moved): the error card is see-through, and the art shows through its right end behind "Retry" (R1G2-errchat-1).

## Thread with a Researcher (`thread-researcher`)
**Five seconds:** For: my conversation with this remora. First click: the message box.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-thr-1 | filled · desktop | Minor | The three answers have no 👍/👎, though the Learning tab says to rate answers to teach it, the Activity tab rates the same answers, and the watcher's thread puts 👍/👎 under its ping. (Still R0G2-thr-2, which was moved to this round.) | Put 👍/👎/Why? under each answer bubble, as under the watcher's ping. |

**Words that could go:** "(practice mode)" (a Practice pill says it), "Re:"

## Thread with a Wallet watcher (`thread-watcher`)
**Five seconds:** For: what this watcher told me, and that it's retired. First click: "Why?" under the ping.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-thw-1 | filled · desktop | Minor | "Watcher mvwcctl7 is watching 1 address(es) on testnet:" still ends at a colon. The decline said this is the stored text of a past event, but that reason doesn't hold in the pictures: the Overview and Activity timelines draw the same event as "…on testnet", without the colon. So the text is already cleaned in one place and not the other. | Render the event with the same component as the timeline, and append the address chip "0xe7…8d ↗" if it's known. |

**Words that could go:** "and starts in shadow mode" (Practice, R1G2-x-5, moved)

## Room (`room`)
**Five seconds:** For: a group chat with all my remoras. First click: the message box, using "@" to name one.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-room-1 | filled · desktop | Minor | The header is still a run-on list, "Researcher · demo, Researcher · demo, Researcher · demo, Researcher · demo, Resea…", next to two unexplained dropdowns, "Auto" and "Lead: first member". (Still R0G2-room-1, which was moved to this round.) | Use a stack of faces with "+27" that opens the member list. Put "who answers" in one control with a `?` ("Auto: the best fit answers; name one with @"). |
| R2G2-room-2 | filled · desktop | Nit | A remora's name takes its face's colour on its bubbles (pink "Researcher mvig08dw", orange "Researcher mvj0yzcl"), but turns green on its payment line ("Researcher mvig08dw: Paid 0.02 USDC to Odds"), and that line has no face. | Keep the name in the face's colour everywhere, and mark the payment with a small green $ icon instead. |

**Words that could go:** "Pay 0.02 USDC to Odds?" (once the card says Approved), "It's over its per-payment cap; you pay it once, from your wallet." (a cap tick would say it)

Still visible (moved): the approval says "you pay it once, from your wallet", then "Researcher …: Paid 0.02 USDC to Odds" says the remora paid (R1G2-room-1).

## Templates (`hatchery`)
**Five seconds:** For: copying remoras other people shared. First click: a card.

No new findings. Still visible (moved):
- "⑂ 1" with no word (R1G2-hatch-1);
- no "Use" button on a card (-2);
- nothing about money on a card (-3);
- "by 0xd970…4757" for my own templates (-4).

**Words that could go:** none

## Templates, signed out (`out-hatchery`)
**Five seconds:** For: browsing shared remoras. First click: a card, but I can't tell whether that works signed out.

No new findings. Still visible (moved): it's identical to the signed-in page, and nothing says using one needs a wallet (R1G2-outhatch-1).

## A template (`hatchery-template`)
**Five seconds:** For: checking a shared remora before copying it. First click: "Use it" at the top right. That's wrong here, because the template is blocked.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R2G2-tmpl-1 | filled · desktop | Major | The safety review blocked this template ("Asks to move all funds", "a clear attempt at a payment scam"), and the bottom "Use it (one signature)" is greyed out. Yet the new header button "Use it" is a bright white, enabled-looking button, the loudest thing on the page. The two buttons for one action disagree, and the live-looking one is on a scam. | Disable the header button the same way, or replace it with a red "Blocked" pill. Show "Use it" only when the review passed. |

**Words that could go:** "It's created under 0xd970…4757 in practice mode. You set its budget later on its page; until then the template's suggestion applies, and its spending limit caps every payment onchain.", "Put this badge in a README, blog or post. Anyone who clicks it lands on this template.", "Checked: scrubber, patterns, reef, model."

Still visible (moved):
- there's no "Blocked" pill by the title (R1G2-tmpl-2), and the title and card names differ, "Free money" against "Helper" (-3);
- the raw field paths in red (-4), and the `reef:` table that repeats the chips (-5);
- practice is explained twice (-6), and Share is offered for a blocked template, with clipped code boxes (-7);
- "at most 0.05 a payment" has no unit (R1G2-share-3).

## Across pages
| # | Pages | Sev | What's drawn differently | Suggested fix |
|---|---|---|---|---|
| R2G2-x-1 | remoras, sidebar, Researcher header, thread header, activity | Minor | One state has two names. Card, header and thread pills say green "active", while the sidebar says "Researcher · live" and the timeline "Researcher · demo is live". On a watcher, both say "practice". | Pick one word, Live or Active, for the pill, the sidebar and the event. |
| R2G2-x-2 | Researcher activity and overview, Researcher thread, room | Minor | Only the Activity tab links a payment's transaction ("0.01 USDC · 11h ago · tx ↗"). The same payment in the thread ("Paid 0.01 USDC to Sui risk check · Why?") and in the room ("Researcher mvwcarot: Paid 0.02 USDC to Odds · Why?") has no link, so the receipt goes missing exactly where a judge reads the story. | Add "tx ↗" to the payment line in threads and rooms, from the same component. |
| R2G2-x-3 | remoras, watcher overview, empty-remoras, remoras-new | Minor | A watcher's no-money trait has three labels: "Never pays" with an eye-off icon (list), a "never pays" pill (overview), and a grey "Read-only" pill (the empty state and New remora), opposite a blue "Spends USDC". | One badge, "Never pays", with the same icon, on all four pages. |
| R2G2-x-4 | thread-watcher, room, watcher activity, overview, learning | Minor | A transaction digest is a blue, link-looking "(49Lnbdfi…)" in the thread's and room's ping bubbles, but plain grey text in Activity, Overview and Learning. I can't tell which one is clickable. | Make every digest the same short link, "49Ln…fi ↗", to the explorer. |
| R2G2-x-5 | room vs watcher overview, thread header | Nit | The retired Watcher mvwcctl7 has a grey square face with "--" eyes on its page and in its thread header, but in the room its messages carry a blue face with dots. | Use one face per remora everywhere, with the retired variant once it's retired. |
| R2G2-x-6 | remoras vs Templates | Nit | The kind tabs carry counts on Remoras ("All 31 · Researcher 15 · Wallet watcher 16") but none on Templates ("All · Researcher · Wallet watcher"). | Show counts on both, or on neither. |

**Counts:** Blocker 4 · Major 3 · Minor 16 · Nit 9
