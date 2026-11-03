# Round 0 · G3 · Memory, settings, info pages, landing (desktop)

Reviewer: fresh agent, screenshots only (persona: hackathon judge with three minutes).

## Shell, reviewed once (rail + remora list, every filled desktop shot)
**Five seconds:** For: getting around, plus a list of remoras with what needs you. First click: an orange "Approve" under "Needs you".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-shell-1 | filled · desktop | Minor | "Needs you" rows are cut to "Researcher mvi…" / "Researcher mv…" with "Asks you to approve a payment" under each. You can't tell which remora is asking or for how much. | Show the face, a name that fits, and an amount chip ("0.05 USDC"). Drop the repeated "Asks you to approve a payment" line: the orange Approve badge already says it. |
| R0G3-shell-2 | filled · desktop | Minor | A green or orange dot on each face carries meaning by colour alone, and the Guide's face legend ("watching, thinking, paid…") doesn't include the dots. | Add the dots to the Guide legend and give each one a tooltip or aria label. Or drop them, since the face already shows the state. |
| R0G3-shell-3 | filled · desktop | Minor | Row subtitles use two voices. Some are prompt-like second person ("You answer the owner's questi…", "You watch the owner's addres…", "You check Sui packages befor…"), others third person ("Answers questions by buying t…"). Names like "Checker mvjnb3km" and "Watcher mvj10ydl" read like kinds the product doesn't have (the Guide says there are two). | Show the kind as a small badge ("Researcher" / "Wallet watcher") apart from the name. Make the subtitle the last thing the remora did ("paid 0.01 USDC · 9h ago") rather than its prompt. |
| R0G3-shell-4 | all · desktop | Minor | A red "Pause all" sits in the top bar of every page. It is the loudest colour on each page, louder than each page's own main action (Memory's picker, Guide's "Open chat"). | Make it neutral (outline, red on hover), or red only while something is spending. |
| R0G3-shell-5 | loading, error · desktop | Blocker | While data loads, and when the server fails, the list shows no remoras ("Import a team…", empty Rooms). The "Set up 1/3 · Next: Add USDC" card sits right above a wallet showing **19.78 USDC**. A judge sees an empty, unfunded account that is really full and funded. | Show skeleton rows in the list while loading and one error line when it fails. Hide the Set up card until the account data has arrived. |

**Words that could go:** "Asks you to approve a payment" (×2)

## Memory · Remoras tab (`memory`)
**Five seconds:** For: what one remora has stored on Walrus. First click: the remora picker ("Researcher · demo") or "Search what it remembers".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-memory-1 | filled · desktop | Blocker | The orange banner reads "Index check: receipts has 2 of the 6 we wrote… if this stays, some writes didn't make it." Directly below, "Skipped as already known" lists **4** receipts writes, and 2 stored + 4 skipped = 6. The banner says data was lost when nothing was, and it is the loudest thing on the page. The same banner appears on the landing page's screenshot (see R0G3-screens-1). | Count skipped writes in the check. Replace the banner with a small stacked bar: "6 writes · 2 stored · 4 matched an existing memory". Warn only when stored + skipped < written after 30 s. |
| R0G3-memory-2 | filled · desktop | Major | The table shows blob ids, namespace, status, dates and sizes, but not **what the remora remembers**. The product's promise of "memory you can read" isn't visible on its own memory page. | Make the first column the memory itself, one line each (e.g. "[receipt] paid 0.01 USDC to sui-risk for 0x2"). Move the blob id to a small mono chip with copy and a Walrus explorer link. |
| R0G3-memory-3 | filled · desktop | Minor | The subtitle "Two kinds of memory, side by side: each remora's Walrus blobs and the chat's own facts." is wrong: the two kinds are tabs, not side by side. The tabs already name them. | Drop the subtitle and put a `?` on the tabs. |
| R0G3-memory-4 | filled · desktop | Minor | Five stacked control rows come before any data: tabs, picker + search, namespace chips, export buttons, banner. | Put the namespace counts in the table header as filter tabs, and the two Export buttons in a "⋯" menu beside the search. |
| R0G3-memory-5 | filled · desktop | Minor | "Expires 6/1/2027" is a numeric date (month/day order is ambiguous) with no relative form. "Status: active" is the same on every row and adds nothing. | Show "in 7 mo" with the full date on hover, plus a thin lifetime bar from stored to expires. Show status only when it isn't active. |
| R0G3-memory-6 | filled · desktop | Minor | The "Skipped as already known" list repeats what the table rows already say ("2 later writes matched this"): four near-identical rows, "receipts · wake · matched zL…Jo". "wake" is never explained. | Remove the separate list and make "2 later writes matched this" expand inline. Rename "wake" or give it a `?`. |
| R0G3-memory-7 | filled · desktop | Nit | Zero chips "sources · 0" and "feedback · 0" are noise. | Dim or hide namespaces with zero entries. |

**Words that could go:** "Two kinds of memory, side by side: each remora's Walrus blobs and the chat's own facts.", "New writes take about 30 s to land; if this stays, some writes didn't make it.", "These writes were close enough to a memory already stored that nothing new was written. If one was really new, correct the memory it matched."

## Memory · Chat tab (`memory-chat`)
**Five seconds:** For: what the chat remembers about me, and who owns that memory. First click: "Own this memory" (the full-width white button, the loudest thing), though the Search box competes.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-memchat-1 | filled · desktop | Major | Ownership is said four times in words: chip "Not owned yet", card "Owned by Remora, for now", line "Right now Remora keeps it under its own account. Own it with a wallet below.", and "Still Remora's own account.". Then an "Owner 0x3d4f5278…f79ea24" row reads as if someone already owns it. | Replace all of it with one picture: two nodes, "Remora's account → your wallet", with "Own this memory" on the arrow. Label the row "Owner (Remora)". |
| R0G3-memchat-2 | filled · desktop | Minor | Five full-length hex strings with no short form or explorer link: Account, Owner, and the keys "Web App", "remora-server" and "Tatum". | Short forms ("0x183c…7641") with copy and an explorer link. Keys as "Web App · 1fc7…9e56". |
| R0G3-memchat-3 | filled · desktop | Minor | "On Walrus **0 of 0**" with an empty progress bar is a meter with nothing to measure. | At zero, show a face and "Nothing on Walrus yet". Show the meter only once there is a total. |
| R0G3-memchat-4 | filled · desktop | Minor | The top-row chip "hippo-guest:4f3b71…-9233-5074a477b2cc" shows an internal name ("hippo") and a raw id. | Drop it, or move it into a `?` details popover. |
| R0G3-memchat-5 | filled · desktop | Minor | "Tatum" appears among "Keys that can read this memory (3)" with no explanation. A judge will wonder why a vendor can read their memory. | Add a one-line `?` per key saying what uses it and why. |
| R0G3-memchat-6 | filled · desktop | Minor | Five unrelated jobs are stacked on one page: meter, search, account, import, Claude Code. Claude Code step 1 says "connect a wallet such as Slush above", but nothing above says "connect a wallet"; the button says "Own this memory". | Make that step say "press Own this memory above". Collapse "Bring your memory from another assistant" and "Use the same memory in Claude Code" into closed disclosures, as the Remoras tab does. |
| R0G3-memchat-7 | filled · desktop | Nit | Key labels mix styles: "Web App", "remora-server", "Tatum". | One style, e.g. "Web app", "Remora server", "Tatum". |

**Words that could go:** "Right now Remora keeps it under its own account. Own it with a wallet below.", "Still Remora's own account.", "Any agent you add as a delegate reads the same memory through the official Walrus Memory MCP.", "A Google sign-in here gives an address only Remora uses, so this needs a wallet."

## Memory · empty (`empty-memory`)
**Five seconds:** For: memory, with nothing in it yet. First click: "Create a remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-memempty-1 | empty · desktop | Minor | The empty state uses a generic icon instead of a remora face, and its action is a blue text link ("Create a remora"). Connections' empty state uses a real button. | Use a sleepy remora face and a button labelled "Create a remora". |

**Words that could go:** "Create one to start." (the button says it)

## Memory · loading (`loading-memory`)
**Five seconds:** For: memory, still loading. First click: none (wait).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-memload-1 | loading · desktop | Minor | The skeleton is one bar and one grey block. The real page is picker + search, a chip row and a table, so the layout jumps when data lands. The sidebar problem is in R0G3-shell-5. | Draw a skeleton of the real layout: picker + search, the table header and three row bars. |

**Words that could go:** none

## Memory · error (`error-memory`)
**Five seconds:** For: can't tell. It looks like an empty memory table. First click: can't tell.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-memerr-1 | error · desktop | Blocker | When the data server fails, the page shows an empty table (headers only) and a "Remora" picker, with no message. It reads as "you have no memories", and the sidebar as "you have no remoras" (R0G3-shell-5). | An error card with a worried face: "Can't reach Remora's server." and a **Retry** button (12 words or fewer). |

**Words that could go:** none

## Connections (`connections`)
**Five seconds:** For: giving an outside agent (Claude Code, Cursor) a token to use one remora. First click: "Create token".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-conn-1 | filled · desktop | Minor | The create form fills the whole first screen. Below it, 16 connection cards each about 280 px tall make a ~5,200 px page, with the 6 revoked ones mixed in at the same weight as active ones. | Put the list first, as compact rows: name · remora face · scope icons · calls · spent · last used · Revoke. Fold revoked ones into "Revoked (6)". A "New connection" button opens the form. |
| R0G3-conn-2 | filled · desktop | Minor | Cards show scope codes "memory:read", "memory:write", "pay", "approve:request". The form above names the same four things "Read its memory", "Write to its memory", "Pay within its spending limit", "Ask you to approve". | Use the same four icons and plain labels in both places. |
| R0G3-conn-3 | filled · desktop | Minor | "Spent 0.01 USDC" has nothing to compare against: the remora's limit isn't shown. | Add a small meter: spent vs. the remora's monthly limit. |
| R0G3-conn-4 | filled · desktop | Minor | The card header "for Researcher u12 mvwdeb6v · mcp:read-only · rmcp_hj0s…" is mono codes plus a cut-off token prefix with no copy button. "Made 3d ago, last used 3d ago, expires Nov 30, 2026." is data written as a sentence. | Header: face + remora name. Dates: a three-dot timeline (made → last used → expires) or two chips. |
| R0G3-conn-5 | filled · desktop | Minor | Jargon in the form: "Its receipts say via mcp:claude-code.", "Episodes and sources, tagged as the agent's. A rule waits for your yes." | Drop the first line. Change the second to "Adds notes to its memory; new rules wait for your OK." |

**Words that could go:** "One token per agent, for one remora. You can revoke it any time.", "Its receipts say via mcp:claude-code.", "It acts within the remora's spending limit; anything over it comes back to you." (as a `?`)

## Connections · empty (`empty-connections`)
**Five seconds:** For: connecting an agent, which first needs a remora. First click: "Create a remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-connempty-1 | empty · desktop | Nit | The empty card uses an icon, not a face. "Your connections · No agent is connected yet." repeats the empty card above it. | Use a face, and hide "Your connections" while it's empty. |

**Words that could go:** "No agent is connected yet."

## Settings (`settings`)
**Five seconds:** For: notifications, Telegram, and the stop switches. First click: a "How loud" option, or "Link Telegram".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-settings-1 | filled · desktop | Major | "This retires 31 remoras:" is followed by a 31-line bullet list (the first seven all read "Researcher · demo"). The red "Retire all" button floats halfway down to the right of the list. It's a wall, and the button is easy to miss. | Show a big "31 remoras" with a strip of their faces, and the button directly under it. Offer "see list" as a disclosure. |
| R0G3-settings-2 | filled · desktop | Minor | "Export everything · Download", a safe action, sits inside the red "Leave Remora" box, so it looks dangerous. Three red controls compete on this page: top-bar "Pause all", "Pause everything" and "Retire all". | Move Export into its own neutral "Your data" section, and keep red for Retire only. |
| R0G3-settings-3 | filled · desktop | Minor | The "How loud" label sits in the right column, while every other section label (Notifications, Telegram, Danger zone, Leave Remora) sits in the left one. It breaks the grid. | Make it a row inside the Notifications card, or move its label to the left column. |

**Words that could go:** "When remoras may reach you, and how often." (repeats the page subtitle), "Off: remoras can reach you at any hour.", "Link it to talk to remoras where you are."

## Settings · empty (`empty-settings`)
**Five seconds:** For: same as filled. First click: a "How loud" option.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-setempty-1 | empty · desktop | Minor | "Pause everything" and the top-bar "Pause all" stay active with zero remoras, so there's nothing to pause. | Disable both, with the hint "No remoras to pause". |
| R0G3-setempty-2 | empty · desktop | Minor | The paragraph "Retiring stops all spending… Your memories stay on Walrus…" runs right up to the disabled "Retire all" button, with no gap. | Give the text a max width, or put the button under it. |

**Words that could go:** "You have no active remoras, so there is nothing to retire." (the disabled button says it)

## Guide (`guide`)
**Five seconds:** For: what Remora is, how to start, and what each page does. First click: "Open chat".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-guide-1 | filled · desktop | Minor | For a signed-in account with 31 remoras, "Start in five steps" shows no progress. Step 2, "Sign in · Connect a Sui wallet with Sign in, at the bottom left", looks undone. | Tick the steps already done (signed in ✓, remora created ✓), as the Set up card does. |
| R0G3-guide-2 | filled · desktop | Minor | The section titled "A receipt for every action" ("what was bought, what it cost, and why") contains six memory features (Answer without memory, /proof, Memory at work…) and no receipt. | Show one real receipt card (bought · cost · why · digest ↗) under this title, and move the six cards under a "Proof your memory works" heading. |
| R0G3-guide-3 | filled · desktop | Nit | Step titles 1, 3 and 5 are blue links; 2 and 4 are plain white. | Make all five tappable, or none. |
| R0G3-guide-4 | filled · desktop | Nit | The face legend ("watching, thinking, paid, needs you, blocked a payment, paused") uses faces about 24 px wide, too small to tell the expressions apart. | Draw them at 40 px or larger. |
| R0G3-guide-5 | filled · desktop | Nit | "Four parts: a key that acts, memory it can read, a budget it cannot exceed, and triggers that wake it." repeats the four cards right below it. | Drop the sentence. |

**Words that could go:** "What Remora is, how to start, what every page is for, and how it works underneath.", "The pages in the left rail, then three more.", "Four parts: a key that acts, memory it can read, a budget it cannot exceed, and triggers that wake it."

## Guide · signed out (`out-guide`)
**Five seconds:** For: the same explainer. First click: "Open chat", though for a visitor the right first click is "Try a Researcher, no wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-outguide-1 | signed out · desktop | Minor | Signed out, the header still offers "Open chat" (primary) and "Create a remora", which both need an account. The no-wallet path appears only as step 1's link and in the sidebar. The white "Sign in" button bottom left is as loud as "Open chat". | When signed out, make the primary "Try a Researcher · no wallet" and the secondary "Sign in". |

**Words that could go:** none beyond the Guide's

## Status (`status`, `out-status`)
**Five seconds:** For: whether Remora's services are up. First click: can't tell. Nothing looks clickable, and the orange "Degraded" row is the only thing I'd want to open.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-status-1 | filled, signed out · desktop | Major | The rows are internal component names in lowercase: "tatum (testnet)", "checkpoint lag (testnet)", "facilitator (testnet)", "sponsor gas (testnet)", "relayer budget", "job queue", "playground funder". A judge can't tell what "Degraded" breaks, whether they can still use the app, or since when. | Group rows by what a user does (Payments, Memory, Sui reads, Try a Researcher), with the component name in a `?`. The degraded row gets one impact line, e.g. "Sui reads are slower; payments still work · since 2 h". |
| R0G3-status-2 | filled · desktop | Minor | Ten identical green "Operational" pills drown the one that matters. The headline "Some systems are degraded" is text only. | Show a big "9 of 10 up" and pin the degraded row on top. Collapse the rest into a line of green dots, or give each row a 24 h uptime strip. |
| R0G3-status-3 | filled · desktop | Minor | "checkpoint lag" shows a status but not the lag. | Show the number with its unit ("2 s"). |
| R0G3-status-4 | filled · desktop | Nit | A "Systems" heading sits right above "Some systems are degraded": two headings for one list. | Drop "Systems". |

**Words that could go:** "Systems", "Whether Remora's services are up right now." (the title says it)

## Services (`reef`, `out-reef`)
**Five seconds:** For: the price list of paid data a remora can buy. First click: "Docs", which leaves the app.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-reef-1 | filled, signed out · desktop | Minor | The subtitle promises "what each one does", but the table has no description: only the slugs "sui-risk", "odds", "brief" and a category. | Replace the two-line subtitle with a one-line description under each name ("Risk report for a Sui package"). |
| R0G3-reef-2 | filled, signed out · desktop | Minor | No next step in the app: the only per-row action is an external "Docs" link. | Add "Ask a Researcher", which opens the playground with a sample question for that service. |
| R0G3-reef-3 | filled · desktop | Nit | The page title "Services" has a dotted underline, as if it were a term with a tooltip. No other page title has one. | Remove it, or use a visible `?`. |
| R0G3-reef-4 | filled · desktop | Nit | A search box and three category chips filter three rows. | Hide the filters until there are more than about eight services. |

**Words that could go:** "This directory lists the paid services a remora may pay: what each one does, what a call costs and which address gets paid."

## Own your memory (`connect`)
**Five seconds:** For: moving my memory to a Walrus account I own. First click: can't tell. The link has expired and there's no button.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-connect-1 | expired link · desktop | Major | A dead end. The only actionable line is red text, "This link has expired or was already used. Run /connect again in the chat for a new one." (19 words), with no button. Memory › Chat already has an "Own this memory" button that does the same job. | Put the error first, 12 words or fewer: "This link expired." Then buttons: **Own this memory** (primary) and "Open chat". |
| R0G3-connect-2 | expired link · desktop | Major | A three-line paragraph about sponsorship and gas: "Right now Remora keeps your memory under its own account. Walrus Memory normally sponsors the gas…". A wall of text, and the flow needs a picture. | Two-node diagram, "Remora's account → your wallet", with chips "Gas: sponsored (free)" and "Revoke any time". |
| R0G3-connect-3 | expired link · desktop | Nit | The breadcrumb says "Connect your wallet"; the title says "Own your memory". | One name in both places. |

**Words that could go:** "Right now Remora keeps your memory under its own account. Walrus Memory normally sponsors the gas, so it costs you nothing. If sponsorship is unavailable your wallet pays instead, which needs a small amount of SUI, and you will be told before you sign. You can take the access away again whenever you want."

## Not found (`not-found`)
**Five seconds:** For: telling me this address isn't a page. First click: "Go home".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-notfound-1 | 404 · desktop | Minor | A three-line, 33-word explanation of /connect and /disconnect link expiry on a generic 404 page. | "That page doesn't exist.", plus a small `?`: "From a /connect link? It expired; run it again in chat." |
| R0G3-notfound-2 | 404 · desktop | Nit | A compass icon, not a face. | A lost-looking remora face. |

**Words that could go:** "If you followed a /connect or /disconnect link, those expire after ten minutes and are single use: run the command again in the chat for a fresh one."

## Lab (`lab`)
**Five seconds:** For: internal team tools. First click: "Health".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-lab-1 | filled · desktop | Minor | An internal page judges can reach. It shows a team code "(U14)" and jargon ("Ops consoles", "every dependency's status"), and "Health" duplicates the public Status page. | Hide Lab behind a team-only flag, or drop "(U14)" and merge Health into Status. |

**Words that could go:** "Ops consoles for Remora.", "(U14)"

## Landing · hero (`landing`, `landing.full`)
**Five seconds:** For: AI agents that pay only within a budget Sui enforces, with memory you can read on Walrus. First click: "Try a Researcher · $1 limit · no wallet". It made me want to try it.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-landing-1 | signed out · desktop | Minor | The top pills "Tatum gRPC", "x402" and "Total Recall · Track 2" are jargon. "x402" is never explained anywhere on the page, though it appears again in How, Demo, Proof and Screens. | Drop "x402" from the hero pills, or give it a `?` ("x402: pay per call over HTTP"). Spell it out once in How. |
| R0G3-landing-2 | signed out · desktop | Minor | Verify: in `landing.full.jpg` the hero stretches to all 7,969 px and every section below it is blank. This is probably the capture (a hero sized to the viewport, sections that fade in on scroll), but if sections depend on a scroll reveal, fast scrolling, printing or reduced motion could leave them invisible. | Make sure each section's content is visible without the reveal firing. |
| R0G3-landing-3 | signed out · desktop | Nit | A floating face slides under the "Walrus Memory" / "Tatum gRPC" pills and cuts across them. | Keep the faces out of the text column. |

**Words that could go:** "Remora's agents run errands and pay for what they need." (the next section's headline says it)

## Landing · the problem (`landing-00-problem`)
**Five seconds:** For: why agents paying is unsafe, and Remora's fix for each case. First click: none needed (read on).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-problem-1 | signed out · desktop | Blocker | The spending-limit picture disagrees with itself. The meter says "spent this month **0.58 of 1.00 USDC**", but the bar is about 10 % full, the cap tick sits near 80 %, and the tag says `cap="0.05"`. This is the illustration meant to explain the spending limit. (It may be a mid-animation frame, but the still frame must agree.) | Fill the bar to 58 %, label the tick ("cap 0.80" or drop it), and make the tag's number match. The reduced-motion frame should be the final state. |
| R0G3-problem-2 | signed out · desktop | Minor | Each card ends with a 3–4 line "REMORA" paragraph full of jargon: "Sui's app-bound allowances", "the gas station", "28 attacks in CI". | One line per card, e.g. "A limit and a per-payment cap, enforced by Sui." / "Blocked twice, then aborted onchain." / "Memory you can read, a receipt per decision." |

**Words that could go:** "enforced by Sui's app-bound allowances. One signature.", "The safety check and the gas station each stop it."

## Landing · how it works (`landing-01-how`)
**Five seconds:** For: the four moments of a normal day with Remora. First click: none (read).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-how-1 | signed out · desktop | Major | Four cards of 4–5 line paragraphs, each ending in a cryptic chip: "402 → disc::pay → settled on Sui", "rbQ84ahd… · 25.3 s", "EPayeeNotAllowed · 7NYf3QGE…". A judge who has never heard of Disc or x402 learns nothing from the chips, and the sentences should be pictures. | One mini picture per card with a single line under it: token → watcher face → researcher face "−0.01 USDC"; 👎 → a "rule" chip landing on Walrus; red "pay this" bubble hitting a shield, "aborted onchain"; key + bell, "alert". |
| R0G3-how-2 | signed out · desktop | Minor | Card 03 ("The safety check blocks it. Forced past it, Sui aborts it onchain.") repeats the problem section's second card. | Keep it in one place only. |

**Words that could go:** "which pays 0.01 USDC over x402 for a risk report, within its own spending limit", "That decision's receipt cites the rule's blob."

## Landing · demo (`landing-02-demo`)
**Five seconds:** For: watching the real app. First click: play (2:48).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-demo-1 | signed out · desktop | Minor | The subtitle is a three-line comma list of six claims ("a $1 spending limit set onchain, a paid answer over x402, a receipt that verifies…"). | Six check chips: ✓ $1 limit onchain · ✓ paid answer · ✓ receipt verifies · ✓ one-signature Researcher · ✓ rule learned · ✓ blobs on Walrus. |
| R0G3-demo-2 | signed out · desktop | Minor | The video poster repeats the hero headline ("Always-on agents you actually own."). The section says "No mock-ups", but the poster is a title card, not the app. | Use a frame from the app showing a paid answer and its receipt as the poster. |

**Words that could go:** "No mock-ups:" (the poster can prove it)

## Landing · proof (`landing-03-proof`)
**Five seconds:** For: hard numbers from real runs. First click: a digest link.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-proof-1 | signed out · desktop | Minor | The digest "blob rbQ84ahd68FicrNgwK48mInCzlYb6-lzncPWs9auMXw" wraps to two lines with no short form and no ↗, while the "abort" card's digest has a ↗. | Use short forms with ↗ on both ("rbQ8…auMXw ↗"). |
| R0G3-proof-2 | signed out · desktop | Nit | "12 kinds of Tatum gRPC call, and no JSON-RPC" is inside baseball for most judges. "abort" in the numeral slot isn't a number. | Swap in a user-facing number (e.g. "1 signature to set a limit"). |

**Words that could go:** "generated from the code, checked in CI"

## Landing · screens (`landing-04-part-4`)
**Five seconds:** For: screenshots of the app. First click: can't tell whether the shots open.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0G3-screens-1 | signed out · desktop | Major | The shots advertise the app's faults. The Memory shot carries the orange "Index check: … some writes didn't make it" banner, and the Status shot leads with "Some systems are degraded" and an orange "Degraded". | Re-shoot from a clean state, or crop to the parts that sell: memory rows, a receipt, the spend meter, an approval. |
| R0G3-screens-2 | signed out · desktop | Minor | The heading says "Built to be read", but at 1440 the text in the shots is about 6 px and unreadable. They're also in a light theme on a dark page in front of a dark app, and their data is stale (Memory "Expires pending", list times like "15:51"). | Zoomed crops in the dark theme, each with one highlighted element, re-shot from today's app. |
| R0G3-screens-3 | signed out · desktop | Minor | Two of the four shots are back-office pages with jargon captions: "Services: … over x402", "Status: Tatum, the relayer and the facilitator". The product's best pictures (spend meter, approval, receipt) are missing. | Swap them for Funds (spent vs. limit) and a receipt. |
| R0G3-screens-4 | signed out · desktop | Nit | The top-left shot is shorter than its neighbour, leaving a gap under its caption. | Use one aspect ratio for all four. |

**Words that could go:** "Status: Tatum, the relayer and the facilitator"

## Landing · what's real (`landing-05-part-5`)
**Five seconds:** For: what is live, what is demo, and what is not built yet. First click: none. Clear and quick; the conflict with the app is listed in R0G3-x-8.

**Words that could go:** none

## Landing · footer (`landing-06-part-6`)
**Five seconds:** For: credits and links. First click: "App". No findings.

**Words that could go:** none

## Across pages

| # | Pages | Sev | What's inconsistent | Suggested fix |
|---|---|---|---|---|
| R0G3-x-1 | shell, `memory`, `connections`, `settings` | Major | Seven remoras are all called "Researcher · demo": in the sidebar, the Memory picker, the Connections "Remora" dropdown ("Researcher · demo (Researcher, active)") and the Settings retire list. You can't tell whose memory you're reading or which remora a token is for. | Wherever a remora is named, show its face and a short id ("Researcher · demo · 3f2a"). |
| R0G3-x-2 | `connections` vs shell, `settings` | Major | Connections shows "active" tokens for remoras that appear in neither the sidebar nor Settings' list of 31: "Researcher u12 mvwdeb6v" (Read only, HTTP script) and "Researcher u12 mvn9mtt4" (Read only, HTTP script). Either they're retired, and the tokens should say so and stop working, or the lists are wrong. | Mark tokens of retired remoras "remora retired" and revoke them. Otherwise, include those remoras in the lists. |
| R0G3-x-3 | `reef`, `landing` vs `connections`, shell, `landing-03-proof` | Minor | Money is written two ways: "$0.01" (Services; landing "$1 limit") and "0.01 USDC" (Connections, the sidebar's "19.78 USDC", proof). | Use one format everywhere: "0.01 USDC". |
| R0G3-x-4 | top bar, `guide` vs `settings` | Minor | The same action has two names: "Pause all" (top bar, Guide) and "Pause everything" (Settings). | Pick one ("Pause all"). |
| R0G3-x-5 | `empty-memory`, `empty-connections`, `not-found`, `connect`, `error-memory` | Minor | Empty and error states are drawn five ways: icon + text link (Memory), icon + button (Connections), compass + two buttons (404), red text with no button (expired connect link), nothing at all (Memory error). The expired /connect link is handled differently on `connect` and on the 404. | One state component everywhere: face, one line, one button. |
| R0G3-x-6 | `memory`, `memory-chat`, `guide`, `landing-00-problem` | Minor | Memory types have different names: the app's chips are "me / sources / feedback / receipts", the landing card's tags are "rule / receipt / me", the Guide's sample is "[correction]", and the Claude Code command uses namespace "remora". | One list of names, used on every page. |
| R0G3-x-7 | `memory-chat` vs `guide` | Minor | "Use the same memory in Claude Code" is drawn two ways. Memory › Chat has three prose steps with three commands. The Guide has four numbered rows, and row 3 ("Log in to Walrus Memory with the same wallet") is a sentence with a copy button. | One shared component; no copy button on prose. |
| R0G3-x-8 | `landing-05-part-5` vs `memory-chat`, `connect` | Minor | The landing lists "Not yet: Memory on your own Walrus account (a delegate per remora)", while the app offers "Own this memory" and an "Own your memory" page. A judge reads this as a contradiction. | Landing: "Not yet: each remora's memory on your account. The chat's memory can be yours today." |
| R0G3-x-9 | `memory`, `connections`, shell | Minor | Dates come in three formats: "6/1/2027" (Memory), "Nov 30, 2026" (Connections), "Oct 22" (sidebar), next to relative times like "9h ago". | Relative time first, with "Jun 1, 2027" on hover, everywhere. |
| R0G3-x-10 | `settings` vs `guide` | Minor | Settings' Telegram section advertises "/scout, /teach, /budget". The Guide's Commands list (/memory, /proof, /connect, /link…) contains none of them. | List the same commands in both places. |

**Counts:** Blocker 4 · Major 10 · Minor 50 · Nit 14
