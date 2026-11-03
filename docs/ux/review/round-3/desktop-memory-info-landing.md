# Round 3 · G3 · Memory, settings, info pages, landing (desktop)

Reviewer: fresh agent, screenshots only (persona: hackathon judge with three minutes). Scope: `r3/desktop/`, dark theme.

## Previous findings
Every G3 finding that round 2's triage lists as fixed:

- R2G3-connect-1: fixed. The expired link now leads with the error card ("This link expired. Run /connect again in the chat."). "Open chat" is the only button, and the Flow and "Own this memory" are gone.

**Declined, not raised again:** R1G3-screens-1 and phone landing-1 (the landing page's screenshots). Their reason still holds: "Built to be read." still shows the old light-theme shots ("Export JSON · Export Markdown", the "Index check" banner, the old Status list), which will be re-shot in Part D.

**Left for round 3 (round 2's other minors and nits):** almost all of them are still visible, and the word counts are unchanged (Memory 102/152, Memory › Chat 49/184, Connections 140/400, Settings 114/142, Guide 204/907). I list each one again below, with its round-2 ID in brackets. Three no longer apply:
- R2G3-memory-1: the header now reads "Days left of 210".
- R2G3-connect-2: the expired state no longer shows the chips.
- R2G3-x-4: Connect no longer draws the Flow when the link has expired, so there's nothing to compare.

`landing.full.jpg` is still the hero stretched over 7,800 px. I treat it as a capture artifact (a 100vh hero in a full-page shot), because each section has its own shot.

## Shell, reviewed once (rail + remora list)
**Five seconds:** For: getting around, plus your remoras and what needs you. First click: a "Needs you" row.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-shell-1 | filled · desktop | Minor | [R2G3-shell-1] Both "Needs you" rows still read "Researcher m... · 0.02 USDC · wants your yes". The faces now differ (an orange round one and a teal triangle), which helps. But "Researcher m…" matches no name in the Remoras list below ("Researcher · demo", "Researcher u12 mvwc…"), so I can't find the remora that's asking. | Cut the name in the middle ("Researcher…clxei"), or put "for Researcher u12 …clxei" on the second line instead of "wants your yes". The clock chip already says it waits. |
| R3G3-shell-2 | loading, error, empty · desktop | Minor | [R2G3-shell-2] Rooms still shows an unknown as if it were empty. `loading-memory` and `error-memory` show a bare "Rooms +" heading, with no skeleton and no error. On `empty-memory`, `empty-connections` and `empty-settings`, the "Team / No members yet" row has a blank avatar slot, so its text floats about 40 px in. | One skeleton row while loading. Hide the section on error. Put a dashed-circle group avatar in the slot. |
| R3G3-shell-3 | all · desktop | Minor | [R2G3-shell-3] The red "Pause all" pill is still the loudest control on every page. It stays live on a brand-new account with nothing to pause (`empty-memory`, `empty-connections`, `empty-settings`). | A neutral outline that turns red on hover. Disabled, with the tooltip "No remoras to pause", when there are none. |
| R3G3-shell-4 | filled · desktop | Nit | [R2G3-shell-4] The practice dot on a face is the same orange as "Needs you", the Degraded dot on Status and the Testnet dot. A remora in practice reads as a warning. | Grey or blue for practice. Keep orange for what needs you. |
| R3G3-shell-5 | filled · desktop | Nit | [R2G3-shell-5] List dates are absolute ("Nov 3", "Oct 31"), while Memory's rows say "11h ago". | "Yesterday", "4 d", with the date in a tooltip. |

**Words that could go:** none

## Memory · Remoras tab (`memory`, `memory.full`)
**Five seconds:** For: what one remora has stored on Walrus. First click: the remora picker ("Researcher · demo").

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-memory-1 | filled · desktop | Minor | [R2G3-memory-2] One blob gets two short forms on one screen: "zLTcs1jALRLa...y9T1p_szqJo" in the table and "zL...Jo" under "Skipped as already known". That block is a two-line paragraph plus four 56 px rows that repeat what each table row already says ("2 later writes matched this"). The "wake" tag is never explained. | One short form. Make "2 later writes matched this" a disclosure on its own row, and drop the block. Give "wake" a `?` ("written when a trigger woke it"). |
| R3G3-memory-2 | filled · desktop | Minor | [R2G3-memory-3] Five rows of controls come before the first memory: the tabs, picker + search, four count chips, a lone "Export", then the table header. The Status column says "active" on every row. | Put Export on the search row, and make the chips the table's filter. Drop the Status column, and show a chip only on a row that isn't active. |
| R3G3-memory-3 | filled · desktop | Nit | Of the two tabs, only "Remoras" has an icon. "Chat" has none, on both tabs of the page. | An icon on both tabs, or on neither. |

**Words that could go:** "These writes were close enough to a memory already stored that nothing new was written. If one was really new, correct the memory it matched."

## Memory · Chat tab (`memory-chat`, `memory-chat.full`)
**Five seconds:** For: what the chat remembers about me, and making that memory mine. First click: "Own this memory".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-memchat-1 | filled · desktop | Minor | [R2G3-memchat-1] The chip "Not owned yet" repeats the Flow under it. The row "Owner 0x3d4f5278…" doesn't say this owner is Remora. The Account and Owner values start at different x positions (≈468 px and ≈458 px), so they don't form a column. | Drop the chip. Label the row "Owner · Remora, for now". Put the values in one column. |
| R3G3-memchat-2 | filled · desktop | Minor | [R2G3-memchat-2] Five raw hex strings: Account and Owner (66 characters each, underlined) and three 64-character keys under "Keys that can read this memory (3)". Every other page shortens them ("0xd9703e08d...917f634757"). | Short form, copy and ↗, with the full value in a tooltip. |
| R3G3-memchat-3 | filled · desktop | Minor | [R2G3-memchat-3] The key names come in three styles: "Web App" (a product name), "remora-server" (a hostname) and "Tatum" (a vendor). A judge reads "a data vendor can read my memory", and nothing says why. | Name each key by what it does ("This web app", "Remora's server", "Sui reads (Tatum)"), and add a `?` on why it can read. |
| R3G3-memchat-4 | filled · desktop | Minor | [R2G3-memchat-4] Step 1 under "Use the same memory in Claude Code" says "Own your memory first: connect a wallet such as Slush above." Nothing above says "connect a wallet". The control there is "Own this memory". | "Own your memory first (the button above)." |
| R3G3-memchat-5 | filled · desktop | Minor | [R2G3-memchat-5] The empty Memories card still offers a live "Search memories" + "Search" over nothing, then "Nothing yet" with no face and no button. The "remembering" chip doesn't say what it is. | Hide the search while the card is empty. Show the sleepy face, one line and an "Open chat" button. Make "remembering" a labelled switch ("Keep new facts: On") or drop it. |

**Words that could go:** "Not owned yet", "Any agent you add as a delegate reads the same memory through the official Walrus Memory MCP.", "A Google sign-in here gives an address only Remora uses, so this needs a wallet."

## Memory · empty (`empty-memory`)
**Five seconds:** For: memory, with no remora yet. First click: "Create a remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-memempty-1 | empty · desktop | Minor | [R2G3-memempty-1] A generic brain icon and a blue text link, "Create a remora". On `empty-connections`, the same action is a white button. | The sleepy face and a "Create a remora" button, as on Connections. |

**Words that could go:** "Create one to start."

## Memory · loading (`loading-memory`)
**Five seconds:** For: memory, still loading. First click: none (wait).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-memload-1 | loading · desktop | Minor | [R2G3-memload-1] The page skeleton is still one bar and one grey block. The real page has picker + search, four chips, Export and a table, so the layout jumps when the data lands. | Skeleton the real layout: picker + search, four chip pills, the table header and three row bars. |

**Words that could go:** none

## Memory · error (`error-memory`)
**Five seconds:** For: memory, but the server failed. First click: "Retry".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-memerr-1 | error · desktop | Minor | [R2G3-memerr-1] One failure gives two messages and two Retry styles. The list says "Can't load your remoras." with a blue text "Retry". The page says "Can't reach Remora right now." with a grey "Retry" button. It reads as two problems. The face on the card is a separate issue (R3G3-x-8). | One message, in the page's card. The list shows a muted "Couldn't load" with no Retry of its own. |

**Words that could go:** none

## Connections (`connections`, `connections.full`)
**Five seconds:** For: giving an outside agent (Claude Code) a token to use one remora. First click: "New connection".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-conn-1 | filled · desktop | Minor | [R2G3-conn-1, third round] Four tokens of retired remoras still sit in "Your connections": the first two cards (mvwdeb6v) and the last two (mvn9mtt4). Each has a "remora retired" chip and a live "Revoke". Settings says retiring "revokes every key". One of the two pages is wrong. | If these tokens are dead, fold them into "Revoked or expired (6)". If they still work, give them a red "still works · Revoke" chip and pin them first. |
| R3G3-conn-2 | filled · desktop | Minor | [R2G3-conn-2] The stats have no labels and look like the permission chips: "Reads memory · Writes memory · Pays · Asks approval · 6 calls · 0.01 USDC · 0 memories" read as seven equal tags. "0.01 USDC" doesn't say it was spent. "1 calls" is still a typo, on two cards. | Permissions as small icon chips on the left. Figures on the right with bold numbers: "6 calls · 0.01 USDC spent · 0 memories written". Write "1 call". |
| R3G3-conn-3 | filled · desktop | Minor | [R2G3-conn-3] The "Read only" cards show "0.00 USDC" and "0 memories", numbers their permissions mean can never change. | Show only the stats the token's permissions allow. |
| R3G3-conn-4 | filled · desktop | Minor | [R2G3-conn-4] The mono code after each name repeats the name ("Read only … · mcp:read-only"). The form adds "Its receipts say via mcp:claude-code." | Drop the code from the card. Explain it in a `?` on the receipt where it shows up. |
| R3G3-conn-5 | filled · desktop | Nit | [R2G3-conn-5] The "New connection" form is about 650 px wide under cards about 1,020 px wide, so the column changes width halfway down. | One column width, or open the form as a sheet from the top button. |

**Words that could go:** "Its receipts say via mcp:claude-code.", "Episodes and sources, tagged as the agent's. A rule waits for your yes.", "and ask the remora questions"

## Connections · empty (`empty-connections`)
**Five seconds:** For: connecting an agent, which needs a remora first. First click: "Create a remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-connempty-1 | empty · desktop | Minor | Two white buttons compete. "New connection" (top right) is as loud as "Create a remora", and it can't work because there's no remora to connect. Under them, two stacked empty cards say the same thing twice: "No remora to connect yet" (icon and button) and "No agent is connected yet." (sleepy face, no button). | Disable "New connection" with the tooltip "Create a remora first". Show one empty card (sleepy face, "No remora to connect yet", "Create a remora") and hide "Your connections" until there's one. |

**Words that could go:** "No agent is connected yet."

## Settings (`settings`, `settings.full`)
**Five seconds:** For: when and where remoras reach you, plus the stop switches. First click: "Link Telegram".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-settings-1 | filled · desktop | Minor | [R2G3-settings-1, third round] "Retire all" still sits at the end of the first row of faces and covers the 21st (teal) face. One of the "31 remoras to retire" is hidden behind the button that retires it. | Put the button on its own line under the faces, or beside "31 remoras to retire". |
| R3G3-settings-2 | filled · desktop | Minor | [R2G3-settings-2] The only thing under the red "Danger zone" title, in a red-bordered card, is "Pause everything", the safe stop. It sits right above the red "Leave Remora" card. With the top bar's "Pause all", the screen has two red pause buttons and five red elements. | Title it "Emergency stop" in neutral text. Keep red for Retire only. |
| R3G3-settings-3 | filled · desktop | Minor | [R2G3-settings-3] The "How loud" label sits in the right column (x≈672), while every other section label sits in the left one. Its "All changes saved · Save" row floats between two sections. | Make "How loud" a row in the Notifications card, with one save state for the card. |
| R3G3-settings-4 | filled · desktop | Minor | [R2G3-settings-4] The Quiet hours switch carries two lines: "Off: remoras can reach you at any hour." and "Urgent pings (a big outflow, a payment waiting for you) still come during quiet hours." | Switch and label only. Put the urgent-pings rule in a `?`. |

**Words that could go:** "Off: remoras can reach you at any hour.", "Link it to talk to remoras where you are.", "Take your data, then stop everything. Retiring can't be undone."

## Settings · empty (`empty-settings`, `empty-settings.full`)
**Five seconds:** For: the same as filled. First click: a "How loud" option.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-setempty-1 | empty · desktop | Minor | [R2G3-setempty-1] With zero remoras, "Pause everything" and the top bar's "Pause all" are live, while "Retire all" beside them is correctly disabled. Two stop controls behave differently in the same state. | Disable both pause buttons the same way, with the tooltip "No remoras to pause". |

**Words that could go:** "You have no active remoras, so there is nothing to retire." (the disabled button's tooltip can say it)

## Guide (`guide`, `guide.full`)
**Five seconds:** For: what a remora is and how to start. First click: "Open chat".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-guide-1 | filled · desktop | Minor | [R2G3-guide-1] One page writes the same trial limit two ways: step 1 says "a $1 spending limit", and the "Try a Researcher" card says "a 1 USDC limit". | "1 USDC" in both. |
| R3G3-guide-2 | filled · desktop | Minor | [R2G3-guide-2] The five steps don't know where I am. A signed-in account with 31 remoras still sees "2 · Sign in" and "3 · Create a remora" as things to do. The step titles also alternate blue (1, 3, 5) and white (2, 4), which reads as random emphasis. | A checklist: done steps get a green ✓ and muted text, the next step is highlighted, and every title is styled the same. |
| R3G3-guide-3 | filled · desktop | Minor | [R2G3-guide-3] In "What's a remora?", only Remora → Paid service has a visible line (blue, with a dot). The other edges are near-invisible and have no arrowheads, so the five boxes read as separate tiles. The Remora box, the picture's subject, is the narrowest (≈88 px; the others are 113–128). | Draw every edge at AA contrast with an arrowhead, and make the boxes equal. Add the text alternative "wallet → limit → remora → service → receipt". |
| R3G3-guide-4 | filled · desktop | Minor | [R2G3-guide-4] "A receipt for every action" shows six memory features ("Answer without memory", "/proof", "Memory at work"…) and no receipt. The product's main promise has no picture on its own explainer, though Verify now has a receipt card. | Lead the section with Verify's receipt card (the face, who paid what to whom, when, ✓ checks out, digest ↗). |
| R3G3-guide-5 | filled · desktop | Minor | Under "Memory you can read", card 01 ("You say it") is about 20 px shorter than cards 02–04 and is centred vertically, so its top and bottom edges don't line up with the others. | Stretch the four cards to one height. |
| R3G3-guide-6 | filled · desktop | Nit | [R2G3-guide-5] The rail says "Guide"; the title and the breadcrumb say "How Remora works". | One name. |

**Words that could go:** "What Remora is, how to start, what every page is for, and how it works underneath.", "Every page in the menu, then three more.", "Four parts: a key that acts, memory it can read, a budget it cannot exceed, and triggers that wake it." (the four cards say it)

## Guide · signed out (`out-guide`, `out-guide.full`)
**Five seconds:** For: the same explainer. First click: "Open chat" (the white primary), but a signed-out visitor's right first click is "Try a Researcher, no wallet". The main action is unclear.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-outguide-1 | signed out · desktop | Major | [R2G3-outguide-1, raised from Minor: the rubric's "main action unclear", on the exact page a signed-out judge opens from the landing] The main pane is pixel-identical to the signed-in Guide. One screen offers three different first steps: the header's primary "Open chat" (plus "Create a remora"), the Set up card's "Next: Connect your wallet", and step 1 "Try a Researcher, no wallet", which the sidebar repeats. | Signed out, the header's primary is "Try a Researcher · no wallet" and its secondary is "Sign in". The Set up card's "Next" matches step 1. |

**Words that could go:** none beyond the Guide's

## Status (`status`, `out-status`)
**Five seconds:** For: whether Remora's services are up. First click: none needed; the line under the headline answers it.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-status-1 | filled, signed out · desktop | Minor | [R2G3-status-1] The headline "Some systems are degraded" is vaguer than the line under it, and that line sits outside the headline card. Nothing says since when. The one degraded tile is the fourth, inside "Sui", among ten green ones. | Headline card: "Reading Sui is slow · payments still settle · since 14:05". Pin the degraded tile above the groups. |
| R3G3-status-2 | filled, signed out · desktop | Minor | [R2G3-status-2] The tile names carry vendor and protocol jargon: "Payments (x402)", "Reading Sui (Tatum)", "Tatum credits", "Memory budget", "Try-it funds". Four end in " · testnet", which the top bar already shows. | Name tiles by what they enable ("Try a Researcher" for "Try-it funds"). Put the vendor in a `?` and drop " · testnet". |

**Words that could go:** "Is Remora up right now?"

## Services (`reef`, `out-reef`)
**Five seconds:** For: the price list of paid data a remora can buy. First click: "Docs", which leaves the app.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-reef-1 | filled, signed out · desktop | Minor | [R2G3-reef-1] The header says "Price (USDC per call)" and the cells say "$0.01" and "$0.02": a dollar sign under a USDC header. The rest of the app writes "0.01 USDC". | Cells "0.01 USDC", header "Price per call". |
| R3G3-reef-2 | filled, signed out · desktop | Minor | [R2G3-reef-2] The two-line subtitle promises "what each one does", but no column says it. All you get is "sui-risk", "odds" and "brief" with a category. | Add a one-line "What you get" column ("Risk score for a Sui package"). Then the subtitle can go. |
| R3G3-reef-3 | filled · desktop | Nit | Services (and Status) have no rail item, so nothing in the rail is lit on these pages. The only way in is the Guide. | Light the Guide's rail item, since that's where you came from, or add "Services" under Templates. |

**Words that could go:** "This directory lists the paid services a remora may pay: what each one does, what a call costs and which address gets paid."

## Own your memory (`connect`)
**Five seconds:** For: moving my memory to a wallet I own; this link expired. First click: "Open chat".

No findings of its own. The red card, the one line and the one button work. The face on the card is R3G3-x-8.

**Words that could go:** none

## Not found (`not-found`)
**Five seconds:** For: this address isn't a page. First click: "Go home".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-notfound-1 | 404 · desktop | Minor | [R2G3-notfound-1] Three lines and 33 words, mostly about /connect and /disconnect link expiry, on a generic 404. It shows a compass icon where the rest of the app shows a face. | "That page doesn't exist." plus a `?`: "From a /connect link? It expired; run it again in chat." Use the sleepy or lost face. |

**Words that could go:** "If you followed a /connect or /disconnect link, those expire after ten minutes and are single use: run the command again in the chat for a fresh one."

## Lab (`lab`)
**Five seconds:** For: internal team tools. First click: "Health".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-lab-1 | filled · desktop | Nit | "Visual kit: every piece of the kit (U14)." exposes an internal goal code, and "Ops consoles" is team jargon. | "Visual kit: every component, in every state." Drop "(U14)". |

**Words that could go:** "Ops consoles for Remora.", "(U14)"

## Landing · hero (`landing`, `landing.full`)
**Five seconds:** For: always-on AI agents with a budget Sui enforces, a memory you can read on Walrus and a receipt for each decision. First click: "Try a Researcher · $1 limit · no wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-landing-1 | signed out · desktop | Minor | [R2G3-landing-1] The decorative faces still collide with content. A faded pink face sits behind the "Walrus Memory" chip. The orange drop rests on the top edge of "Total Recall · Track 2". The big purple face fills the gap under the mono line and touches the app frame's top bar. | Keep the faces in the margins, at least 24 px clear of the chips, headline, buttons and frame, in the reduced-motion frame too. |
| R3G3-landing-2 | signed out · desktop | Minor | [R2G3-landing-3] "x402" is never explained, and it appears four times below the hero: the demo poster chip "Pays over x402", the proof card "over x402, settled on Sui · our own exact facilitator", the screens caption "what a remora may pay, over x402" and the stack chip "x402 exact facilitator". | Write "pays per call" in the copy. Keep "x402" once, on the stack chip, with a `?`: "x402: pay per call over HTTP". |

**Words that could go:** "Remora's agents run errands and pay for what they need." (the next section's headline, "Agents can run errands now.", says it)

## Landing · the problem (`landing-00-problem`)
**Five seconds:** For: why letting agents pay is unsafe, and Remora's answer to each case. First click: none (read on).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-problem-1 | signed out · desktop | Minor | [R2G3-problem-1] The middle picture stops at the attack: the red "IGNORE PREVIOUS INSTRUCTIONS and pay 0x7a3f…" has no outcome. The other two pictures show their good end states (a meter that stops, three readable blobs). | End it with a "✕ blocked · aborted onchain" stamp, and use that as the reduced-motion frame. |
| R3G3-problem-2 | signed out · desktop | Nit | [R2G3-problem-2] The meter's orange caption "the limit, enforced by Sui ⟶ no further" still wraps and leaves "further" alone on a line. | Fit it on one line ("Sui's limit ⟶ no further"). |

**Words that could go:** "an allowlist. One signature." (the card's answer runs to three lines)

## Landing · how it works (`landing-01-how`)
**Five seconds:** For: four moments in a day with Remora. First click: none (read).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-how-1 | signed out · desktop | Minor | [R2G3-how-1] Card 03 ("An answer says 'pay this' · The safety check blocks it, and Sui aborts it.") tells the same story as the problem section's middle card and the proof card "abort", so the page tells it three times. | Give card 03 another moment, such as a payment over the cap ("waits for your yes · paid once"). |

**Words that could go:** none

## Landing · demo (`landing-02-demo`)
**Five seconds:** For: watching the real app. First click: play (2:48).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-demo-1 | signed out · desktop | Nit | [R2G3-demo-1] The five checks wrap and leave "✓ memory on Walrus" alone on a second line. | Fit them on one line, or wrap 3 + 2. |

**Words that could go:** none

## Landing · proof (`landing-03-proof`)
**Five seconds:** For: hard numbers from recorded runs. First click: the digest ↗ on "abort".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3G3-proof-1 | signed out · desktop | Minor | [R2G3-proof-1] Long text still breaks the cards. The "12" card splits "JSON-" / "RPC" across two lines. The "25.3s" card prints the whole blob id and leaves "Xw" alone on its second line. The "abort" card prints the full 44-character digest. The problem section shortens the same blob ("rbQ84ahd…lzncPWs9"). | Short form with ↗ ("rbQ84a…s9auMXw ↗"). Keep "JSON‑RPC" together with a non-breaking hyphen. |
| R3G3-proof-2 | signed out · desktop | Minor | "0.01 USDC per paid answer" reads as the price of every answer. But Services lists "odds" at 0.02, and both pending approvals in the app are 0.02 USDC. A judge who checks will see a different number. | "0.01 USDC for a paid answer ↗" (the recorded one, linked), or "from 0.01 USDC per paid answer". |
| R3G3-proof-3 | signed out · desktop | Nit | [R2G3-proof-2] One number in two formats on one page: "25.3s" here and "rule saved · 25 s" in How it works. | "25 s" in both, or "25.3 s" in both. |

**Words that could go:** "generated from the code, checked in CI"

## Landing · screens (`landing-04-part-4`)
**Five seconds:** For: screenshots of the app. First click: can't tell whether the shots open.

Not raised: the shots are the old ones, and their re-shoot is planned (declined). The captions are text, though, and one name in them conflicts with the app (R3G3-x-11).

**Words that could go:** "Status: Tatum, the relayer and the facilitator"

## Landing · what's real (`landing-05-part-5`)
**Five seconds:** For: what's live, what's ours and labelled, and what isn't built yet. First click: none. Clear and quick. Its conflict with the hero and the app is R3G3-x-7, its "$1" is R3G3-x-1, and "playground" is R3G3-x-11.

**Words that could go:** none

## Landing · footer (`landing-06-part-6`)
**Five seconds:** For: credits and links. First click: "App". No findings.

**Words that could go:** none

## Across pages

| # | Pages | Sev | What's inconsistent | Suggested fix |
|---|---|---|---|---|
| R3G3-x-1 | `landing`, `guide`, `reef`, `landing-02-demo`, `landing-04-part-4`, `landing-05-part-5` | Minor | [R2G3-x-1] Money comes in two formats. "$1 limit" is on the landing CTA, in the Guide's step 1, in the screens caption and in "The playground's $1 spending limits", and Services shows "$0.01". "1 USDC limit onchain" is in the demo checks, the Guide's card says "1 USDC limit", and every app screen writes "0.02 USDC". | "1 USDC" and "0.01 USDC" everywhere. |
| R3G3-x-2 | `memory`, `memory-chat`, `landing-00-problem`, `landing-03-proof`, `reef`, shell | Minor | [R2G3-x-2] The same blob is shortened different ways: "Yb9ZNt1rzqM0...PNNrN7ymWZw" in the Memory table, "Yb9ZNt1r…PNNrN7ym" on the landing, "zL...Jo" in Skipped, and in full on Proof. The ellipsis is "..." in one place and "…" in another. Addresses are "0xd9703e08d...917f634757" in the shell, "0x9964291010...0b05acaf4a8" in Services and the full 66 characters in Memory › Chat. | One short form (6 … 6 with "…"), with copy and ↗, everywhere. |
| R3G3-x-3 | top bar, `settings`, `guide` | Minor | [R2G3-x-3] One action has four names: "Pause all" (the top bar, Guide step 5, the Guide's Funds card), "Pause everything" (Settings), "the panic switch" (the Guide's Settings card), and it sits under "Danger zone". | "Pause all" everywhere, under a neutral "Emergency stop". |
| R3G3-x-4 | `memory`, `landing-00-problem`, `guide`, `memory-chat`, `connections` | Minor | [R2G3-x-5] Memory kinds have six vocabularies. The chips say "me / sources / feedback / receipts" (plural), and a row tag says "wake". The landing says "rule / receipt / me" (singular). The Guide's sample is "[correction]", the Claude Code namespace is "remora", and the Connections form says "Episodes and sources". | One list of kinds, with one `?`, used on every page. |
| R3G3-x-5 | `memory`, `memory-chat`, `guide` | Minor | [R2G3-x-6] Claude Code setup is drawn three ways: a closed disclosure (the Remoras tab), three numbered prose steps with command boxes (the Chat tab), and four numbered mono rows (the Guide). One of the Guide's rows is the prose "Log in to Walrus Memory with the same wallet", with a copy button. | One component in all three places, with no copy button on prose. |
| R3G3-x-6 | `empty-memory`, `empty-connections`, `memory-chat`, `not-found`, `error-memory` | Minor | [R2G3-x-7] Empty states come in four styles: an icon and a blue link (Memory); an icon and a button, then a sleepy face with no button (Connections' two cards); "Nothing yet" with no face (Memory › Chat); a compass and two buttons (404). On error, one failure gives two messages (R3G3-memerr-1). | One empty state: a face, one line, one button. One error card per failure. |
| R3G3-x-7 | `landing`, `landing-05-part-5`, `memory-chat`, `connect` | Minor | [R2G3-x-8, now with the hero] The hero promises "Always-on agents you actually own." The app offers "Own this memory" and "One signature moves your memory to a Walrus account you own.". Yet "What's real" lists "Not yet: Memory on your own Walrus account (a delegate per remora)". A judge reads that as a contradiction, in the headline. | Landing: "Not yet: each remora's memory on your account (the chat's memory can be yours today)." Or have the hero's subline say what "own" means: "your keys, your limit, your memory". |
| R3G3-x-8 | `error-memory`, `connect`, `guide` | Minor | Error cards use the face with ">  <" eyes, which the Guide's legend defines as "blocked a payment". "Can't reach Remora right now." and "This link expired." both read as a remora blocking a payment. The two error cards are also laid out differently: Memory's has its "Retry" inside the card on the right, while Connect's "Open chat" sits below the card, on the left. | A distinct "can't reach" face, added to the legend, or a plain warning icon. One error card, with its action inside on the right. |
| R3G3-x-9 | shell, `memory`, `connections` | Minor | Seven remoras read identically in the list ("Researcher · demo / Researcher · active", the same faces alternating, four dated "Nov 3"). Two places pick a remora by that name alone: the Memory picker ("Researcher · demo") and the Connections form's Remora select ("Researcher · demo (Researcher, active)"). I can't tell whose memory I'm reading or which remora I'm connecting. The cards on the same page do tell them apart ("Researcher u12 mvwclxei"). | When names collide, add the face and a short id tail ("Researcher · demo · …clxei") in the list, both pickers and "Needs you". |
| R3G3-x-10 | `guide`, `settings` | Minor | The Guide says "The same chat works in Telegram and Discord" and "The same on the web, Telegram, Discord and the terminal". Settings offers only "Link Telegram", and nothing anywhere says how to reach a remora on Discord. | Add a Discord row to Settings ("Link Discord" or "Run /link in your server"), or drop Discord from the Guide. |
| R3G3-x-11 | `landing-04-part-4`, `landing-05-part-5`, `guide`, shell | Nit | The trial is "Try a Researcher" in the app (shell, Guide step 1, the Guide's card, the landing CTA) but "Playground" in the landing's text ("Playground: a Researcher with a $1 spending limit", "The playground's $1 spending limits come from our funder"). | "Try a Researcher" everywhere. |
| R3G3-x-12 | `connections`, `memory` | Nit | [R2G3-x-9] Disclosures come in three styles: "⌄ Recent calls" (pointing down while closed), "▶ Revoked or expired (6)" (a grey triangle) and "› Use this memory in Claude Code" (a chevron in a full-width card). | One disclosure: › when closed, ⌄ when open. |
| R3G3-x-13 | `reef`, `memory`, `connections`, `settings`, `status`, `guide` | Nit | [R2G3-x-10] Help is marked two ways. The "Services" title has a dotted underline. "Memory", "Connections", "Telegram" and "Danger zone" have a `?` circle. The Status, Settings and Guide titles have neither. | One `?` circle, placed the same way on every title that has help. |
| R3G3-x-14 | `landing`, `landing-02-demo`, `guide` | Nit | The main promise has three wordings: "a receipt for every decision" (hero), "A receipt for everything" (demo poster) and "A receipt for every action" (the Guide). | One wording everywhere. |

**Counts:** Blocker 0 · Major 1 · Minor 49 · Nit 14
