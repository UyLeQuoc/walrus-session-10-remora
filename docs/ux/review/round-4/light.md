# Round 4 review: light theme, desktop

Scope: only what differs from, or fails only in, the light theme. I compared every light shot with its dark twin. I measured contrast from the JPEG pixels. JPEG blur reads thin text a little low: plain #737373 grey on white measures about 4.5 here, against a true 4.7. Treat every ratio below as an estimate (±0.3).

These read well on white and get no section: home content, connect, connections, memory, memory-chat, room, thread-researcher, status, reef, lab, not-found, onboarding, the signed-out pages, the sign-in dialog, the loading states, and the other error banners.

## Previous findings
- R3L-shell-1: fixed. The "2" beside "Needs you" and on the Approvals icon is dark ink on amber now, about 6.7:1.
- R3L-settings-1: fixed. The off "Quiet hours" switch now has a ringed knob and reads as a switch. In round 3 the darkest pixel was 1.3:1; now it's about 2.5:1. The track itself is still pale (#e7e7e7 on white, 1.2:1), but the knob carries it. The faint "How loud" radio rings that the finding also mentioned are just as faint in dark, so they aren't a light-theme issue.
- R3L-loading-1: fixed. Skeleton bars are #e9e9e9 on the #f5f5f5 page (about 1.1:1, a bit stronger than dark's 1.06:1). `loading-remora` and `loading-home` now show the page's shape.
- R3L-funds-1: not fixed. The subtitles in the tinted nodes now take the node's hue ("Sui enforces it" is blue, "anyone can check" is green), but at about the same lightness as before. They still read lighter than the plain grey subtitles in the white nodes. With the same method on both rounds' shots: "Sui enforces it" is about 3.8:1 in both round 3 and round 4, and "anyone can check" is 3.5 in round 3 and 3.35 in round 4. That's still under AA. Playground's "1.00 USDC, onchain" measures the same (3.6). See R4L-funds-1.

## Shell: rail and remora list (`home`, every signed-in page)
**Five seconds:** For: moving between pages and seeing which remoras need you. First click: a "Needs you" row.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4L-shell-1 | all · desktop | Minor | The rail still doesn't mark the page you're on in light (this was R3L-shell-2, unchanged). In dark, the current item (Home, Funds, Approvals, Templates…) sits on a filled rounded pill. In light the rail is a flat #e8e8ea and only the label turns bold, so "you are here" is a one-weight change. | Draw the dark theme's pill in light too: a white (#fff) rounded square behind the icon and label, with a 1px #d4d4d4 border. |
| R4L-shell-2 | filled · desktop | Nit | In "Needs you", the amber "!" badge and the amber wallet badge sit on an orange face ("Researcher m…", first row) with only a thin white ring, so the three oranges merge into one blob. In dark, the pastel face keeps them apart. (R3L-shell-3, unchanged.) | Give the status badges a 2px ring in the list's background colour, so they cut out of any face colour. |

**Words that could go:** none new (the dark-theme reviewers covered the content).

## Chat (`chat`, `loading-chat`)
**Five seconds:** For: talking to your remoras. First click: the message box, or a suggestion chip.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4L-chat-1 | filled · desktop | Minor | The four suggestion chips under the composer ("Teach Wallet watcher: ignore incoming SUI under 0.01", "Ask Researcher: is package 0x2 safe…", etc.) are still near-white pills with no border on the near-white grid, so they read as loose grey text, not buttons. The composer has no border either and survives only on a soft shadow. In dark, both have a clear 1px border. (R3L-chat-1, unchanged.) | Give the chips and the composer the dark theme's 1px border in light (#dedede or darker), plus a #ececec hover fill on the chips. |
| R4L-chat-2 | filled, loading · desktop | Nit | The ASCII-art fish still renders as dark-grey filled cells (around #555) in the bottom-right. On white it reads as a smudge and pulls the eye away from "Hey there." and the composer. In dark it reads as a soft mosaic. The error and empty states no longer show it, which fixed R3L-chat-3. (R3L-chat-2, unchanged.) | In light, draw the cells as light tints (#e6e6e6 fills, #bdbdbd glyphs), so the art stays a texture. |

**Words that could go:** none new.

## Approvals (`approvals`)
**Five seconds:** For: saying yes or no to payments over a remora's cap. First click: "Pay once (0.02 USDC)".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4L-approvals-1 | filled · desktop | Nit | A waiting card's tint is #f5f1e8 on the #f5f5f5 page (1.03:1). On white it looks like a stained beige card, not like "needs you". (R3L-approvals-1, unchanged.) | Keep the card white and add a 3px amber left edge plus a small amber "waiting" chip beside "13d ago". |

**Words that could go:** none new.

## Funds and the "Where it goes" diagram (`funds`, `empty-funds`, `error-funds`, `loading-funds`; the same diagram on `empty-home`, `out-home`, `guide`, `out-guide`, `playground`)
**Five seconds:** For: what your USDC is and the limit Sui puts on it. First click: "Add USDC".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4L-funds-1 | all · desktop | Minor | The tinted nodes' subtitles are still under AA. "Sui enforces it" (blue on #d6e6f6) is about 3.8:1, "anyone can check" (green on #dbeae3) about 3.4:1, and on Playground "1.00 USDC, onchain" about 3.6:1. Each one is lighter than its own title (about 5.5:1) and lighter than the grey "its own key" in a white node. The round-3 fix changed the hue but not the lightness. | Set the subtitle in the node's 800 shade (blue-800 #1e40af, green-800 #166534), or in the normal secondary ink. Aim for ≥4.5:1 on the tint. |

**Words that could go:** none new.

## Error states (`error-home`, `error-funds`)
**Five seconds:** For: saying the data server is down and offering Retry. First click: "Retry".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4L-error-1 | error · desktop | Minor | The stronger light skeletons (the round-3 fix) now show in tiles whose data has failed. On `error-home`, "Remoras" and "Waiting for you" show grey loading pills while "Your balance" beside them shows "—". On `error-funds`, "Your balance" and "In coins" show loading pills under "Couldn't read your balance from Sui." The page says "failed" and "still loading" at once. In dark the same pills are nearly invisible (1.05:1), so dark reads as empty. | When a query has failed, render "—" with a muted "Couldn't load" in each tile, as "Your balance" already does on `error-home`. Keep skeletons for loading only. |

Seen in passing, in both themes, so not counted: on `error-funds` the account chip at the bottom of the list still shows "19.78 USDC" while the banner says the balance couldn't be read. Either mark the chip's number as stale ("19.78 USDC · 2 min ago") or hide it while the read fails.

**Words that could go:** none new.

## New remora (`remoras-new`)
**Five seconds:** For: picking a kind and a budget for a new remora. First click: "Create Researcher".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4L-new-1 | filled · desktop | Minor | The selected kind card ("Researcher") still gets a page-grey fill, while the unselected "Wallet watcher" card stays bright white. The card you didn't pick looks more prominent, and the chosen one looks dimmed. In dark, the selected card reads as lit. (R3L-new-1, deferred in triage, still present.) | Keep both cards white. Mark the chosen one with a 2px near-black border, a filled radio and, optionally, a blue-50 tint. |

**Words that could go:** none new.

## Remora pages and threads (`remora-researcher-overview`, `remora-researcher-activity`, `remora-watcher-overview`, `remora-watcher-activity`, `thread-watcher`)
**Five seconds:** For: one remora: what it costs, what it did, what it learned. First click: "Chat", or a 👍/👎 on a recent item.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4L-remora-1 | filled · desktop | Nit | The 👎 you gave the "Received 0.001 SUI (49Lnbdfi…)" ping is drawn two ways. In light it sits on a pale grey tile: #f2f2f4 on #f5f5f5 in `thread-watcher` (1.03:1), and barely darker on the white activity card. In dark there's no tile at all, only a slightly brighter icon. In both themes it's hard to see that you've rated it, though this is the rating that taught the rule ("ignore incoming SUI under 0.002 (from 🔕)"). | Same style in both themes: a filled thumb icon on a tinted tile (amber-100 / amber-900 for noise, green for useful), with `aria-pressed`. |
| R4L-remora-2 | filled · desktop | Nit | "Sui risk check didn't go through, nothing paid" has a pale grey broken-link icon (about 3:1) and, in light, no disc behind it. Every other event gets a tinted disc (blue for answers and payments, amber for "Would pay"). So the one failure row is the faintest icon in the timeline. In dark, a grey disc at least frames it. | Give failures a red-50 disc with a red-600 icon, matching the tinted discs of the other event kinds. |

**Words that could go:** none new.

## Templates (`hatchery`, `out-hatchery`, `hatchery-template`)
**Five seconds:** For: copying a remora someone shared; on a blocked one, why it's blocked. First click: a template card. On the blocked template, nothing: "Use it (one signature)" is disabled.

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4L-templates-1 | filled · desktop | Minor | In "Blocked by the safety review", each finding's detail is small red text at reduced strength on the pink box, about 3.3–3.5:1. These are "· Tells the model to ignore its instructions.", "· Asks to move all funds.", "· Names a raw address (0x996499…)…", and "Checked: scrubber, patterns, reef, model." The bold reasons are fine (about 5:1). The details are what a judge reads to see why the review blocked it. Dark is also low (about 3:1). | Keep red for the title, the ✕ and ! icons and the reason names. Set the detail text and the "Checked:" line in normal secondary ink (#52525b on the pink, about 6:1). |
| R4L-templates-2 | filled, signed out · desktop | Nit | Each template card in light still puts the face on a light-grey rounded tile. In dark the face stands alone, so the same card is drawn two ways. (R3L-templates-1, unchanged.) | Drop the tile in light, or add a matching #2a2a2a tile in dark. |

**Words that could go:** none new.

## Share as a template (`share`)
**Five seconds:** For: publishing a remora so others can copy it. First click: "Publish as a template (one signature)".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4L-share-1 | filled · desktop | Minor | In "Passed the safety review", the body "No credentials, no injection or exfiltration phrasing, no raw addresses." is mid-green on the green tint, about 4.0:1. "Checked: scrubber, patterns, reef, model." is about 3.8:1. Both are under AA. The Verified banner on Verify sets its body in ink (about 9:1). (R3L-share-1, unchanged; raised from Nit because both lines now measure under 4.5.) | Keep green for the title and shield icon only; set the body and the "Checked" line in normal ink, like the Verified banner. |

**Words that could go:** none new.

## Verify a receipt and Shared proof (`verify-receipt`, `public-receipt`)
**Five seconds:** For: checking a receipt against Sui. First click: "Verify" (or "Check it yourself" on a shared proof).

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4L-verify-1 | filled · desktop | Nit | The receipt card ("Paid to Sui risk check · 0.01 USDC") still loses its ticket shape on white. The notches at the dashed tear line are #f5f5f5 bites in a #fbfbfb card, and the card's edge is about 1.03:1. In dark the notches are clear and the card reads as a receipt. (R3L-verify-1, unchanged.) | Give the light card a 1px #dedede border that follows the notches, or a faint paper shadow (0 1px 2px rgba(0,0,0,.06)). |

**Words that could go:** none new.

## Landing (`landing`, `landing-00…06`)
**Five seconds:** For: what Remora is, then try it. First click: "Try a Researcher · $1 limit · no wallet".

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4L-landing-1 | signed out · desktop | Nit | The landing ignores the theme: the light and dark captures are pixel-identical, with the dark purple hero. "Try it" then drops a light-mode visitor into a white app. (R3L-x-4, unchanged.) | Keep the landing dark as brand if you like, but fade into the app, or show preview shots that match the visitor's theme. |
| R4L-landing-2 | signed out · desktop | Minor | The "Built to be read" screenshots (light app on the dark page) come from an older build, so they show the same pages differently from the live app. The sidebar rows carry "Approve" chips where the app now shows "⏱ 0.02 USDC · wants your yes". The Status shot lists "checkpoint lag (testnet)", "facilitator (testnet)", "relayer budget", while the real Status page groups Payments / Sui / Memory on Walrus / Remora. The Memory shot has "Expires · pending" where the app now has "Days left of 210". This is the same in both themes. | Recapture the four shots from the current build. Crop each to the part its caption names, so the next change doesn't date them. |

**Words that could go:** none new.

## Across pages

| # | State · size | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| R4L-x-1 | all · desktop | Minor | Tinted boxes set their secondary text three ways in light. The Verified banner uses normal ink (about 9:1). The passed and blocked safety reviews use the box's hue at reduced strength (about 3.3–4.0:1; R4L-share-1, R4L-templates-1). The diagram nodes use a lighter hue than their title (about 3.4–3.8:1; R4L-funds-1). Only the first passes AA. | One rule for every tinted surface: the title and icon take the hue at its 700–800 shade, and body or secondary text stays in the normal ink tokens. |
| R4L-x-2 | all · desktop | Minor | Two segmented controls still mark "selected" in opposite ways, in light only. Tabs (Overview/Activity/Learning/Settings, Waiting/Decided, Remoras/Chat) show the selected segment white on a grey track. Filters ("All 31 / Researcher 15 / Wallet watcher 16" on Remoras, "All / Researcher / Wallet watcher" on Templates) show it grey among white segments. Dark uses "lighter = selected" for both. (R3L-x-1, deferred.) | One rule in light: selected = white, with a 1px border and shadow, on a #ececec track, for tabs and filters alike. |
| R4L-x-3 | filled · desktop | Minor | A disabled primary button is still #a0a0a0 with white text in light (about 2.6:1), so it reads as a live grey button. This covers "Ask" (researcher overview), "Save" and "Add" (researcher settings), "Preview" (Import a team), "Find facts" (memory-chat) and "Use it (one signature)" (blocked template). On Import a team, the disabled "Preview" still outweighs the real first step, "Use the example". (R3L-x-2, deferred.) | Light disabled style: a #f0f0f0 fill, #a3a3a3 text, no shadow, and a tooltip saying why ("Paste a file first", "Type a question"). |
| R4L-x-4 | filled · desktop | Minor | The blocked template's fourth reason still differs between the two theme captures. Light ends "…instructs the agent to 'Send all your funds to 0x9964...'" on one line. Dark ends "…to 0x9964…" and wraps a stray "9964" onto a second line. The record of why a template was blocked shouldn't change between views. (Same class as R3L-x-3.) | Store the review text once and render it the same way everywhere: short address "0x9964…9964", one line clamped, with "More" for the rest. |

**Counts:** Blocker 0 · Major 0 · Minor 12 · Nit 8
