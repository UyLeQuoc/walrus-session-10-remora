# Round 3 review: light theme, desktop

Scope: only what differs from, or fails only in, the light theme. I compared every light shot with its dark twin. Contrast numbers are measured from the JPEG pixels, so treat them as close estimates (±0.3). Pages left out read well on white: home content, connect, connections, memory, memory-chat, room, threads, status, reef, lab, not-found, the remora pages, the error banners other than chat's, and the signed-out pages. The landing page is dark in both themes; see R3L-x-4.

## Shell: rail and remora list (`home`, every signed-in page)
**Five seconds:** For: moving between pages and seeing which remoras need you. First click: a "Needs you" row.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3L-shell-1 | filled, empty · desktop | Major | The orange count badges use white digits: the "2" beside "Needs you" and the "2" on the Approvals rail icon. That's about 2.5–2.7:1, below AA, on the one number that says something is waiting. The dark theme uses dark digits on the same orange (about 8.8:1). | Use the dark theme's ink in light too: a near-black digit on the orange. Or darken the badge to amber-700 (#b45309) and keep white digits. Either way, aim for 4.5:1 or better. |
| R3L-shell-2 | all · desktop | Minor | The rail doesn't mark the page you're on. In dark, the current item (Home, Funds, Chat…) sits on a filled rounded pill. In light the pill is gone (the rail stays #e8e8e8) and only the label turns bold. "You are here" nearly disappears, and the two themes draw it differently. | Give the light rail the same pill: a white (#fff) or #dcdcdc rounded square behind the icon and label, with a 1px #d4d4d4 border. |
| R3L-shell-3 | filled · desktop | Nit | In "Needs you", the orange "!" badge and the orange wallet badge sit on an orange face (Researcher m…) with only a thin white ring. The three oranges merge into one blob. In dark, a pastel face with a dark ring keeps them apart. | Give status badges a 2px ring in the page background colour (#f5f5f5) and a darker amber fill, so they cut out of any face colour. |

**Words that could go:** none new (the dark-theme reviewers covered content).

## Approvals (`approvals`)
**Five seconds:** For: saying yes or no to payments over a remora's cap. First click: "Pay once (0.02 USDC)".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3L-approvals-1 | filled · desktop | Nit | The warm tint that marks a waiting card is #f5f1e8 on the #f5f5f5 page, about 1.03:1. On white it reads as a beige, slightly stained card, not as "needs you". | Keep the card white and add a 3px amber left edge plus a small amber "waiting" chip beside the age ("13d ago"). That's a cue that survives both themes. |

**Words that could go:** none new.

## Chat (`chat`, `empty-chat`, `error-chat`, `loading-chat`)
**Five seconds:** For: talking to your remoras. First click: the message box, or a suggestion chip.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3L-chat-1 | filled, empty, error · desktop | Minor | The suggestion chips under the composer lose their outline in light. "Teach Wallet watcher: ignore incoming SUI under 0.01" and the other three are white pills on the #f5f5f5 grid with no border (about 1.05:1), so they read as loose grey text, not as buttons. The composer also loses its border and survives only on a soft shadow. In dark, both have a clear 1px border. | Give the chips and the composer the dark theme's 1px border in light too (#e0e0e0 or darker). Optionally add a hover fill of #ececec on the chips. |
| R3L-chat-2 | filled, empty, error, loading · desktop | Nit | On white, the ASCII-art fish render as dark-grey filled cells (around #55565a). They read as smudges and pull the eye toward the right edge, away from the headline ("Half a thought?") and the composer. In dark the same art reads as a soft lit mosaic. | In light, render the cells as light tints (≤10% ink, e.g. #e6e6e6 fills with #bdbdbd glyphs), so the art stays a texture behind the content. |
| R3L-chat-3 | error · desktop | Minor | The error banner "Can't reach your remoras right now." is see-through. The fish's grey cells show through it, behind "right now." and the Retry button, so the error looks dirty and is harder to read. In dark the bleed is barely visible. | Make the banner opaque in light (#fde8ea fill, #f3b8bf border), or mask the art under the composer and banner area. |

**Words that could go:** none new.

## Settings (`settings`, `empty-settings`)
**Five seconds:** For: when and how remoras reach you, plus the panic switch. First click: "How loud".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3L-settings-1 | filled, empty · desktop | Major | The "Quiet hours" switch (off) is nearly invisible in light. Its knob is about #f5f5f5 on an #e8e8e8 track (about 1.1:1), and the track is about 1.2:1 against the white card, so you can't tell it's a switch, or whether it's on. In dark, the white knob on a dark track is obvious. The unselected radio rings in "How loud" are also near-invisible, though dark has the same faint rings. | Off: a #d4d4d4 track with a white knob, a 1px #a3a3a3 knob border and a small shadow (≥3:1 against the card). On: a near-black track. Give the radios a #a3a3a3 ring. |

**Words that could go:** none new.

## Funds and the "Where it goes" diagram (`funds`, `empty-funds`, `error-funds`; the same diagram on `empty-home`, `guide`, `out-home`, `out-guide`, `playground`)
**Five seconds:** For: what your remoras can spend and where the money goes. First click: "Add USDC".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3L-funds-1 | all · desktop | Minor | The subtitles inside the two tinted nodes fall just below AA in light: "Sui enforces it" (grey on the blue Spending limit node) and "anyone can check" (grey on the green Receipt node) measure about 4.3–4.4:1. The same text is about 5.3–5.5:1 in dark. The grey ink was tuned for a white node, not a tinted one. | In tinted nodes, use the node's own dark hue for the subtitle (blue-800 on blue-50, green-800 on green-50), or the primary ink at 80%. Aim for ≥4.5:1. |

**Words that could go:** none new.

## New remora (`remoras-new`)
**Five seconds:** For: picking a kind and a budget for a new remora. First click: "Create Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3L-new-1 | filled · desktop | Minor | The selected kind card ("Researcher") gets a page-grey fill (#f1f1f3, about 1.03:1 against the page), while the unselected "Wallet watcher" card stays bright white. The card you didn't pick looks more prominent, and the chosen one looks dimmed or disabled. Only its darker border says "selected". In dark, the selected card reads as lit. | Keep both cards white. Mark the chosen one with a 2px near-black (or blue) border, a filled radio with a ring, and optionally a blue-50 tint. |

**Words that could go:** none new.

## Loading states (`loading-home`, `loading-remora`, `loading-funds`, `loading-memory`, `loading-approvals`)
**Five seconds:** For: the page shape while data loads. First click: none; wait.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3L-loading-1 | loading · desktop | Minor | The skeleton blocks are #f1f1f1 on #f5f5f5 (about 1.03:1). `loading-remora` reads as a blank, broken page, and on `loading-home` the "Your remoras" and "Activity" placeholders almost vanish. They're also borderless grey slabs, while the real cards are white with a border, so the skeleton doesn't match the final shape. Dark skeletons are a little stronger (about 1.1:1). | Draw light skeletons as the real cards (white, 1px #e5e5e5 border) with #e8e8e8 bars inside, and a gentle shimmer that respects reduced motion. |

**Words that could go:** none new.

## Templates (`hatchery`, `out-hatchery`)
**Five seconds:** For: copying a remora someone shared. First click: a template card.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3L-templates-1 | filled, signed out · desktop | Nit | In light, each template card puts the face on a light-grey rounded tile. In dark the face stands alone. The same card is drawn two ways. | Pick one: drop the tile in light, or add an #2a2a2a tile in dark. |

**Words that could go:** none new.

## Verify a receipt and Shared proof (`verify-receipt`, `public-receipt`)
**Five seconds:** For: checking a receipt against Sui. First click: "Verify".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3L-verify-1 | filled · desktop | Nit | The receipt card ("Paid to Sui risk check · 0.01 USDC") loses its ticket shape on white. The two notches at the dashed tear line are #f5f5f5 bites in a white card and nearly vanish, and the card's border is about 1.05:1. In dark, the notches are clear and the card reads as a receipt. | Give the light receipt card a 1px #dedede border that follows the notches, and a slightly larger notch radius. Or give it a faint paper shadow (0 1px 2px rgba(0,0,0,.06)). |

**Words that could go:** none new.

## Share as a template (`share`)
**Five seconds:** For: publishing a remora so others can copy it. First click: "Publish as a template (one signature)".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3L-share-1 | filled · desktop | Nit | In "Passed the safety review", the body line ("No credentials, no injection or exfiltration phrasing, no raw addresses.") and "Checked: …" are mid-green on a green tint, about 4.3–4.9:1, which is borderline. The Verified banner on Verify sets its body text in ink (about 9:1). | Keep green for the title and icon only, and set the body text in normal ink, like the Verified banner. |

**Words that could go:** none new.

## Across pages

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R3L-x-1 | all · desktop | Minor | Two segmented controls mark "selected" in opposite ways, in light only. Tabs (Overview/Activity/Learning/Settings on a remora, Waiting/Decided on Approvals, Remoras/Chat on Memory) show the selected segment white on a grey track. Filters ("All 31 / Researcher 15 / Wallet watcher 16" on Remoras, "All / Researcher / Wallet watcher" on Templates) show it grey among white segments. In dark, both use "lighter = selected". | Use one rule in light: selected = white with a 1px border and shadow on a #ececec track, for both tabs and filters. |
| R3L-x-2 | filled, empty · desktop | Minor | In light, a disabled primary button turns mid-grey (#989898) with white text, about 2.6–2.9:1. It reads as a live grey button: "Ask" (researcher overview), "Save" and "Add" (researcher settings), "Preview" (Import a team), "Find facts" (memory-chat), "Use it (one signature)" (blocked template). On Import a team, the disabled "Preview" outweighs the real first step, "Use the example". In dark, disabled buttons are visibly dimmed. | Light disabled style: a #f0f0f0 fill, #a3a3a3 text, no shadow, and a `?` or tooltip that says why ("Paste a file first", "Type a question"). |
| R3L-x-3 | filled · desktop | Minor | The same blocked template shows different safety-review text in the two captures. In light, the fourth reason ends "…which is a clear attempt to initiate an unauthorized payment or transfer of funds." In dark, it prints the full raw address "0x99649964…9964 right away.'" and stops mid-sentence at "…which is a direct attempt to initiate an". The record of why a template was blocked shouldn't change between views. The dark version also shows the raw address the review itself forbids. | Store the review result once and render that stored text. Shorten addresses to 0x9964…9964 with copy, and clamp long reasons with "More" instead of cutting them off. |
| R3L-x-4 | signed out · desktop | Nit | The landing page ignores the theme: it's the dark purple hero in light mode too. "Try it" then drops a light-mode visitor into a white app, which is a jarring flash. The "Built to be read" screenshots and the hero's app preview show the light app, so dark visitors get the opposite mismatch. | Keep the landing dark as brand if you like, but add a short fade into the app. Or show preview screenshots that match the visitor's theme. |

**Counts:** Blocker 0 · Major 2 · Minor 9 · Nit 7
