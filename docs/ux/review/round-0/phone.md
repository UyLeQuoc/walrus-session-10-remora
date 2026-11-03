# Round 0, phone review (Pixel 7, 412 px)

Only phone-specific findings. Sizes are CSS px (the shots are 2x). The usable screen is about 740 px between the top bar and the bottom bar.

## Shell: top bar and bottom bar, every page (`*`)
**Five seconds:** For: moving between pages. First click: can't tell ("Remoras"? "Page"?).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-shell-1 | all · phone | Major | The bottom bar has two items, "Remoras (2)" and "Page" (a chat-bubble icon, highlighted on every page). No shot shows a way to reach Funds, Approvals, Memory, Connections, Settings, Templates, Services, Verify, Status or the guide. "Page" names nothing, and its bubble icon reads as "Chat". | A tab bar of 4–5 items, each with an icon and a label: Home · Chat · Approvals (badge) · Funds · More (a sheet with the rest). Show which tab is active. |
| R0P-shell-2 | all · phone | Major | The red octagon at the top right (Pause everything, going by Settings) is icon only, about 36×28 px, and sits about 8 px from the "Test ▾" network picker. A newcomer can't tell what it does, and a stray tap starts "pause every remora". | Label it "Pause all", make it 44 px, and give it its own spot, or move it into More/Settings on phones. |
| R0P-shell-3 | all · phone | Minor | The "2" badge sits on "Remoras", but it counts approvals (Home says "2 approvals waiting"). It reads as "2 remoras". | Put the badge on an Approvals tab (see shell-1). |
| R0P-shell-4 | all · phone | Minor | The top bar title repeats the page H1 directly under it ("Approvals"/"Approvals", "Funds"/"Funds", "Memory"/"Memory", "Settings"/"Settings"), which costs about 45 px of every first screen. | On phones, drop the H1 or merge it into the bar. |
| R0P-shell-5 | out · phone | Minor | Signed out, the "Sign in" button touches the top edge of the bar instead of sitting centred. The bar title also switches between "Remora" and lowercase "remora" (`out-remoras`). | Centre the button vertically and use one spelling. |
| R0P-shell-6 | all · phone | Major | Many tap targets are under 40 px. "Why?" is about 32×14 of text. Thumbs up/down are about 26 px. Copy icons are about 20 px. "⋯" menus, "Hide"/"Correct" (Memory), "Revoke" (about 31 px tall), "See all", filter chips (about 32 px), the "×" in "Choose a wallet" (about 24 px) and most secondary buttons (32–36 px tall) are also too small. The thumbs are how a remora learns, so a missed tap loses a signal. | Give every control a hit area of at least 44 px. Pad the icon buttons, and turn "Why?" into a chip with a receipt icon. |

**Words that could go:** the repeated page title (the H1 under the bar).

## Activity feed, shared (`home`, `remoras`, `remora-researcher-overview`, `remora-researcher-activity`, `thread-researcher`)
**Five seconds:** For: what each remora did, with receipts. First click: "Why?".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-feed-1 | filled · phone | Blocker | The full package address in the question, "Is the package 0xcc05642d8f85d0ba4a229677c67a2a56214888dda38f3d95…", runs past the card and off the right edge of the screen. The address is cut and the page may scroll sideways. It happens in Home › Activity, Remoras › Activity, Researcher › Recent activity and the Activity tab, and in the quoted question at the top of `thread-researcher`. | Shorten it to `0xcc05…3c6` with copy and an explorer link, and add `overflow-wrap:anywhere` as a fallback for any long token. |
| R0P-feed-2 | filled · phone | Minor | Each row puts the tag, remora name, time and event on one wrapping line ("Answer Researcher · demo · 9h ago · Is package 0x2 / safe to depend on?"). At 412 px the name and time fill the first line, and the event wraps to 2–3 lines. | On phones, put the tag and event on line 1 and "name · 9h ago" small on line 2, or draw a vertical timeline with the remora's face as the dot. |

## Home (`home`, `empty-home`, `loading-home`, `error-home`)
**Five seconds:** For: my remoras and what needs me. First click: "Review" on the orange "2 approvals waiting" banner.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-home-1 | filled · phone | Major | "Your remoras" shows all 31 remora cards (about 115 px each) before "Activity", which starts about 4,300 px down, six screens. "See all" sits above a list that is already complete. | Show the 3–5 that need you first, then "See all 31". Or show a horizontal strip of faces. |
| R0P-home-2 | filled · phone | Minor | The three number cards (Remoras 31 / Waiting 2 / Ready $0.00) stack full width at about 115 px each. That is 350 px for three numbers. | Put them in one row of three compact tiles. |
| R0P-home-3 | empty · phone | Major | On a brand-new account the first screen is all explainer ("What's a remora?" plus the legend of six faces). The first setup action, "Add funds", sits about 870 px down, below the fold. | Put the "Set up Remora" checklist first, with the active step's button. Collapse "What's a remora?" to one line with a `?`. |
| R0P-home-4 | filled · phone | Minor | The banner "2 approvals waiting" and the tile "Waiting for you 2 / approvals need a yes" say the same thing one above the other. Together they take about 330 px of the first screen. | Keep the banner and drop the tile. |

**Words that could go:** "Your remoras, what needs you, and what they did lately:", "on this network", "approvals need a yes".

## Chat (`chat`, `empty-chat`, `error-chat`)
**Five seconds:** For: talking to my remoras. First click: a suggestion chip.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-chat-1 | all · phone | Minor | The composer has four unlabelled icons (toggle, chevron, ⓘ, list). A phone has no hover, so there is no way to learn what they do. The box doesn't show which remora you are talking to ("Message your remora…"). | Show the target as a chip ("To: Researcher ▾") and give the toggle a short label. |
| R0P-chat-2 | all · phone | Minor | At this width the ASCII animation draws over the text: glyphs sit on "Hey there." and "solving?", and behind the chips ("…under 0.01", "at once"). | Keep the animation out of the text column on phones, or fade it under the text. |

## Chat thread and room (`thread-researcher`, `thread-watcher`, `room`)
**Five seconds:** For: one remora's conversation, with its payments inline. First click: the message box.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-thread-1 | filled · phone | Minor | The top bar packs face, name, chevron, "Details", "Test ▾" and the red pause icon into 412 px. "Details" is plain text about 30 px tall. The room has a stray double-chevron next to "# Team". | On chat screens, move the network picker and pause into More, and make Details a 44 px ⓘ button. |
| R0P-thread-2 | filled · phone | Minor | The message box (about 100 px) plus the bottom bar (about 64 px) cover about 22% of the screen. On the retired watcher the box is a dead input that reads "Watcher mvwcctl7 is retired." | Shrink the box to one line until it is focused. For a retired remora, show a slim "Retired" bar instead of an input. |

## Memory (`memory`, `memory-chat`, `empty-memory`)
**Five seconds:** For: what a remora remembers on Walrus. First click: can't tell (Export? a blob id?).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-memory-1 | filled · phone | Major | The first memory starts about 500 px down. Above it: the title, a 2-line intro, the tabs, a remora picker, search, 4 count chips, 2 export buttons and a 3-line orange "Index check" warning. Even the first memory shows only a blob id ("zLTcs1jALRLa2AnLj8R3…"), so the first screen contains no memory at all. | Move both exports into a "⋯" menu and make the warning a one-line chip. Lead each item with what it remembers, and put the id small underneath. |
| R0P-memory-2 | all · phone | Minor | The intro says "side by side", but on a phone the two kinds of memory are tabs. | "Each remora's memory, and the chat's." |
| R0P-memory-3 | memory-chat · phone | Minor | The search placeholder is cut off: "Read them back: what do you". The command boxes break inside words: "MystenLabs/Me / mWal", "Use m / emwal_recall". | Use a short placeholder ("Search memories") and wrap code only at spaces, as the guide already does. |
| R0P-memory-4 | memory-chat · phone | Minor | "Use the same memory in Claude Code" (3 steps, plugin commands) takes about a third of the Chat tab. Claude Code doesn't run on a phone. | Collapse it on phones to one row, "Use in Claude Code ›". |

**Words that could go:** "Two kinds of memory, side by side:", "New writes take about 30 s to land; if this stays, some writes didn't make it." (make it a chip: "2 of 6 indexed").

## Connections (`connections`)
**Five seconds:** For: giving an outside agent (Claude Code, Cursor) a token for one remora. First click: "Create token".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-conn-1 | filled · phone | Major | The page is about 6,600 px tall with about 16 connection cards of about 340 px each. Every card has the status pill alone on its own row, the scope chips, three number columns, a sentence of dates, "Recent calls" and "Revoke". Revoked cards are as tall as active ones. Finding the token you want to revoke takes a long scroll. | Make each a compact row (name · remora · status pill · ⋯ with Revoke) that expands on tap. Put active ones first and collapse "Revoked (n)". |
| R0P-conn-2 | filled · phone | Minor | The create form (about 600 px) comes before your existing connections. On a phone you see a form before you see what you have. | Put "Your connections" first, with a "New connection" button that opens the form. |

**Words that could go:** "One token per agent, for one remora. You can revoke it any time.", "Made 3d ago, last used 3d ago, expires Nov 30, 2026." (shorten to "expires in 26d").

## Remoras (`remoras`, `empty-remoras`)
**Five seconds:** For: all my remoras. First click: "+ New remora".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-remoras-1 | filled · phone | Minor | The header buttons wrap. "Export team" and "Import a team" take row 1, and the main "+ New remora" drops alone to row 2. The empty state orders the same buttons differently, beside the title. | One row: "+ New remora" plus "⋯" (Import, Export). |
| R0P-remoras-2 | filled · phone | Major | 31 cards with no search or filter, followed by the same activity feed as Home: more than 9,000 px. While scrolling, the Researcher cards are hard to tell apart ("Researcher · demo / Budget not readable just now." repeated). | Add search and kind/status chips, and use compact rows (face, name, status). Leave the feed to Home. |

**Words that could go:** "Budget not readable just now." on every card (one notice at the top is enough).

## Remora page (`remora-researcher-*`, `remora-watcher-*`)
**Five seconds:** For: one remora: ask it, see its budget, what it did and what it learned. First click: "Ask".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-remora-1 | all tabs · phone | Minor | The header (face, name, persona sentence, Chat/Pause/⋯, tabs) is about 260 px and repeats on every tab. On the retired watcher the "Retired" card pushes the tabs down to about 385 px, so Activity starts below the middle of the screen. The tab bar also sits at a different height for the two remoras. | On every tab except Overview, collapse the header to one line (face · name · status pill) and show "retired" as the pill. |
| R0P-remora-2 | settings · phone | Major | The "Brain" picker draws as a lone chevron under "Remora default", with no visible field. It looks broken, and you can't see or change the model. Seen on both the Researcher and the Watcher. | Use a full-width select that shows the current model. |
| R0P-remora-3 | all tabs · phone | Minor | "Chat" (small text and an icon) and "Pause" (bigger text) sit side by side at different sizes, and "⋯" is about 30 px. | Make them one size, each at least 44 px. |

**Words that could go:** the persona sentence under the name on every tab except Overview.

## Settings (`settings`, `empty-settings`)
**Five seconds:** For: when remoras may ping me, Telegram, pause all, leave. First click: can't tell.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-settings-1 | filled · phone | Minor | "Retire all remoras" lists all 31 names as bullets (about 500 px) before the "Retire all" button. | "This retires 31 remoras" with a "Show list" toggle. |

**Words that could go:** the 31-name list.

## New remora (`remoras-new`)
**Five seconds:** For: making a remora. First click: pick "Researcher", then "Create Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-new-1 | form · phone | Minor | "Create Researcher" is about 1,160 px down, after the form and a Summary card that repeats the five fields just filled in. | Drop the Summary on phones, or turn it into a sticky footer: "1 USDC/mo · 0.05 max · Create". |

**Words that could go:** "Sui enforces this budget onchain, not us. It pays only these sources; anything over 0.05 USDC asks you first." (it repeats the two hints above it), the Summary card.

## Import a team (`remoras-import`)
**Five seconds:** For: setting up several remoras from one file. First click: can't tell ("Preview" looks disabled).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-import-1 | form · phone | Minor | At 412 px the YAML example wraps, and the continuation lines start at column 0 ("0.015 }", "on?", "Researcher }"). In a format where indentation matters, that looks broken. | No wrapping, with sideways scroll and an edge fade, or a smaller monospace size on phones. |
| R0P-import-2 | form · phone | Minor | Under the box, "Preview" (looks disabled), "Open a .md file" and "Use the example" spread over two rows as mostly borderless text. It isn't clear which is the main action. | Make "Preview" a full-width primary button and put the other two on one secondary row. |

## Share as a template (`share`)
**Five seconds:** For: publishing a remora as a template others can copy. First click: "Publish as a template (one signature)".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-share-1 | filled · phone | Major | "The file" promises "Exactly what goes to Walrus", but the description line is clipped at the right edge: "description: Answers questions by buying the best" / "are worth it." The middle of the sentence is hidden, with no hint that the box scrolls. | Wrap long values with a hanging indent, or show an edge fade plus "↔ scroll". |

## Guide (`guide`, `out-guide`)
**Five seconds:** For: how Remora works, page by page. First click: "Open chat".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-guide-1 | all · phone | Major | The directions point at desktop-only places. Step 2 says "Connect a Sui wallet with Sign in, at the bottom left", but the bottom left of a phone is the "Remoras" tab and Sign in is at the top right. "Every page" says "The pages in the left rail, then three more", and a phone has no left rail. | Phone wording: "tap Sign in at the top", "the pages in the menu". |
| R0P-guide-2 | all · phone | Minor | The page is about 6,500 px with no contents or jump links. Reaching "A receipt for every action" or "Commands" is a long scroll. | Add a sticky row of section chips at the top. |

## Sign in (`out-sign-in`, `out-remoras`)
**Five seconds:** For: connecting a wallet. First click: "Sign in with your wallet", which leads to a dead end on a phone.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-signin-1 | out · phone | Major | On a phone browser the dialog says "No wallet found. Install Slush or another Sui wallet, then reload this page." Mobile browsers have no wallet extension, so a judge on a phone can't sign in at all, and the only way forward is the no-wallet playground. | Offer "Open in Slush" (a deep link that opens the page in the wallet's browser) and a QR code to continue on desktop. At least say "On a phone, open this page in the Slush app." |

## Landing (`landing`, `landing-00-problem` … `landing-06-part-6`)
**Five seconds:** For: what Remora is, with a way to try it. First click: "Try a Researcher · $1 limit · no wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-landing-1 | out · phone | Major | The "real app" gallery (`landing-04`) shows desktop screenshots shrunk to 412 px. Their text is about 4 px and unreadable, so the section proves nothing on a phone. | Use phone captures, or crop each shot to one zoomed piece (the receipt, the budget meter, the memory row). |
| R0P-landing-2 | out · phone | Major | The section shots have tall black voids. "How" has about 735 px of black above card "02", and card 01 and the section title are not in the shot. "Proof" shows two numbers and then about 860 px of black. "Problem" has about 300 px above its cards and 500 px below. If these are reveal-on-scroll blocks, they hadn't appeared, and on a phone a quick scroll shows empty screens. | Trigger reveals earlier on phones, or skip them there, and trim the section padding. |
| R0P-landing-3 | out · phone | Minor | The hero stacks five tech chips on two rows ("Sui", "Walrus Memory", "Tatum gRPC", "x402", "Total Recall · Track 2"), about 80 px above the headline, using words a newcomer doesn't know. | On phones, keep two chips (Sui, Walrus) or move them under the CTA. |
| R0P-landing-4 | out · phone | Minor | The footer links "GitHub  App  Proof" are bare text about 20 px tall with about 20 px gaps between them. | 44 px targets. |
| R0P-landing-5 | out · phone | Nit | A swimming face sits on the logo in the top bar (the blue face over "remora"). | Keep the faces out of the top 80 px. |

**Words that could go:** "x402", "Tatum gRPC" (chips), "money on Sui testnet · memory on Walrus mainnet · every Sui call through Tatum".

## Connect your wallet (`connect`)
**Five seconds:** For: moving my memory to an account I own. First click: can't tell (there is no button).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-connect-1 | error · phone | Minor | The only useful line, "This link has expired… Run /connect again in the chat", sits under 6 lines of prose and has no button. On a phone, reaching the chat means hunting through the two-item nav (shell-1). | Lead with an error card that has an "Open chat" button, and collapse the explanation behind `?`. |

**Words that could go:** "Right now Remora keeps your memory under its own account. Walrus Memory normally sponsors the gas…" (the whole paragraph).

## Get started (`onboarding`, `empty-onboarding`)
**Five seconds:** For: the setup checklist. First click: "Add funds".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-onboard-1 | all · phone | Minor | Each step puts its number or check circle on its own row above the title, so 4 steps take about 420 px. | Put the circle to the left of the title, on the same row. |

## Across pages
| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R0P-x-1 | filled · phone | Blocker | The same amount has two values in one account: Home says "Ready to spend $0.00 / in your address balance", Funds says "Ready to spend $19.78". | Read both from one source, and show "$—" until it is known. |
| R0P-x-2 | loading · phone | Blocker | Loading is drawn two ways. Funds shows "$—" while it loads. Home shows real-looking zeros: "0 remoras on testnet", "Remoras 0", "Waiting 0 / nothing needs you", "$0.00". | Use skeletons for every number on Home, as Funds does. |
| R0P-x-3 | error · phone | Blocker | A failing data server is drawn five ways. The remora page shows a red card ("Couldn't read this remora / down / Try again"). Funds and Approvals show a lone red word "down" above normal content: Approvals then says "You're all caught up", and Funds shows "✓ Nothing to move" under "$—". Memory is blank. Chat and Home show no error at all, and Home falls back to the brand-new-account setup ("1 of 3 done") for an account with 31 remoras. | Use one error card everywhere: what failed, plus "Try again", in 12 words or fewer. Never show "all caught up" or "nothing to move" under an error. |
| R0P-x-4 | all · phone | Minor | Code blocks wrap in four ways. The guide wraps at spaces; Memory › Chat breaks inside words; Share clips the line; Import wraps to column 0. | One code style: wrap at spaces with a hanging indent, plus a copy button. |
| R0P-x-5 | all · phone | Minor | Search fields stop about 60 px short of the right edge (Memory, Templates, Services) and the Memory remora picker is half width, while Verify's input and button run full width. | Full-width inputs on phones. |
| R0P-x-6 | all · phone | Minor | Some hints rely on hover (dotted underline): the "Services" heading, "Gas (sponsored)" in Cost, "Spending limit" in Keys. A phone has no hover, and nothing shows that they can be tapped. | Add a `?` icon that opens the hint on tap. |
| R0P-x-7 | filled · phone | Minor | Home and Remoras both show the full list of 31 cards and then the same activity feed. On a phone, after the first screen the two pages look the same. | Feed on Home only; Remoras is the searchable list. |

**Counts:** Blocker 4 · Major 14 · Minor 30 · Nit 1
