# Demo video review: still frames (judge's eye)

Basis: the 24 stills at `docs/launch/demo/out/still-*.png` and the contact sheet only. No source, storyboard or docs were read apart from the rubric. Captions and spotlights are judged as they appear **in the sampled frame**. Something that shows up between two samples could clear a finding marked "in the sampled frame".

Every caption in the stills has 10 words or fewer (the longest, at 52 s, has exactly 10).

## 3.5 s: title

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-1 | 3.5 | Minor | The subtitle ("A budget Sui enforces, a memory you can read on Walrus, and a receipt for every decision") repeats three of the four chips under it. The one chip that adds something, "Pays over x402", is jargon a judge may not know. | Keep either the subtitle or the chips, not both. Write "Pays per call in USDC" in place of "x402". |

## 10.4 s: without / with Remora

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-2 | 10.4 | Minor | The caption's second half, "or ask about every click", isn't on screen. The frame shows only the key-holding case, and the "With Remora" card is empty below its title. | Cut the caption to "Today's agents hold your key." Or add an "asks every click" line to the left card. |
| V-3 | 10.4, 17.3 | Minor | The footer shows the Move abort code "EPayeeNotAllowed" before anything has explained it. The parallel line "≤ 0.015 a payment" has no unit. | Write "Testnet tx 7NYf3QGE… · payee not allowed" and "≤ 0.015 USDC a payment". |

## 17.3 s: the injected sentence

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-4 | 17.3 | Minor | The corner label "REAL APP · SUI TESTNET" sits over a card whose only disclaimer is a small grey "Illustration" at the bottom. The two parallel rows also use different verbs ("transfer →" and "pay →") for the same act. | Hide the corner label on illustrated scenes, or put "ILLUSTRATION" in the left card's eyebrow. Use the same verb on both sides. |

## 24.3 s: 01 · Try it, no wallet: Meet

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-5 | 24.3–45.1 | Minor | The section stepper's pill touches the "REAL APP · SUI TESTNET · WALRUS MAINNET" label, with no gap. This happens in every frame of section 01, which has the widest stepper. | Shorten the stepper (drop "01 · TRY IT, NO WALLET" or the step words), or hide the corner label while a stepper shows. |

## 31.2 s: Start

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-6 | 31.2, 38.2 | Major | Two steppers on screen disagree. At 31.2 the overlay says "2 Start" while the app's own stepper shows Start done and "2 Ask". At 38.2 the overlay says "4 Pay" while the app says "4 Check the receipt". The same steps also go by different names (Pay / It pays, Verify / Check the receipt). | In section 01, drop the overlay stepper and let the app's stepper lead. Otherwise use the app's step names and keep the two in sync. |
| V-7 | 31.2 | Major | The spotlight frames the limit card with no caption. Its biggest text is "Questions left 2". The point, "0.00 of 1.00 USDC", is about 12 px. Two unlabelled long strings (an address and a digest) fill half the box. A judge can't tell what is being shown. | Add the caption "Its own 1 USDC limit, enforced on Sui." Zoom so the "of 1.00 USDC" meter reads. Crop the raw strings out of the spotlight. |

## 38.2 s: Pay

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-8 | 38.2 | Minor | After 0.01 of 1.00 USDC is spent, "Questions left" shows 1, so a judge would conclude each question costs about 0.5 USDC. A second limit appears next to the one the caption names, with nothing to explain it. | Hide "Questions left" in the video, or label it "2 free questions". |
| V-9 | 38.2, 100.6, 114.5, 149.2 | Minor | The zoomed shots cut the app's left rail into letter fragments ("vals", "ory", "tions", "ates") and clip right-side controls ("Get your o", "Teac", "Correc", "+ A"). It looks broken. | Zoom on a rectangle that excludes the rail and ends at whole elements, or fade the edges with a vignette. |
| V-10 | 38.2 | Nit | The cost appears three times at once: the answer text ("Cost: 0.01 USDC from …"), the receipt card and the caption. | Let the receipt card carry it. The caption can say "within its own limit" alone. |

## 45.1 s: Verify

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-11 | 45.1 | Blocker | The step meant to prove the payment shows a receipt that contradicts it. "Check: … no money moved in this step" and "Reason: answered after: paid 10000" (raw base units, no unit) appear right after a 0.01 USDC payment. "Verified · The receipt matches the chain" also sits next to "not saved onchain" and "The decision is saved onchain: not saved onchain yet". There is no caption to say what was verified. | Verify the payment's receipt (0.01 USDC to Sui risk check, with its tx), and show amounts as "0.01 USDC". Record after the decision is saved onchain. Add a caption, e.g. "Anyone can check it against Sui." |
| V-12 | 45.1, 72.8, 93.7, 107.5, 121.4, 142.2 | Major | Full-window app shots at about 2/3 scale leave the facts in 9–13 px text, with no zoom and no caption in these frames. In a 720p embed they can't be read, and the story stalls. | In each of these shots, zoom to the one fact that matters or add a caption. |

## 52 s: Where the money goes (explainer)

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-13 | 52 | Minor | Two of the four cards use jargon a judge won't know: "x402 facilitator", "Verify · simulate via Tatum · sponsor gas", and "cap". | Write, for example, "Payment relay: checks each payment first, pays the gas". For the limit, write "monthly limit · per payment · payees · end date". |
| V-14 | 52 | Minor | The scene doesn't match the app's own diagram at 24.3 (Your wallet → Spending limit → Remora → Paid service → Receipt). Here it's "Your address" and a different four-box chain. The connectors are faint dashes with no arrows on a scene titled "Where the money goes". | Reuse the app diagram's nodes and names, and add arrowheads so the direction of money reads at a glance. |

## 59 s: 02 · Your own remora: Limits

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-15 | 59 | Major | The caption says "0.50 USDC a month, 0.015 a payment", but the frame shows an empty monthly field and "Most it pays at once 0.05". The summary agrees: "Monthly limit — USDC", "Most at once 0.05 USDC". The caption contradicts the footage. | Bring the caption in once both fields read 0.50 and 0.015, or start from a prefilled form. |
| V-16 | 59 → 149.2 (every app frame after 59) | Major | The account is full of test leftovers. The sidebar has 8 identical "Researcher · demo" remoras dated Oct 31 to Nov 3, plus "Researcher u12 mw16…" and "Wallet watcher mw16…". Two old "wants your yes" approvals sit in Needs you, and "e2e-burner" appears at 149.2. The remora created in the video can't be told apart from the others, and "your own" looks like a test database. | Record on a clean demo account holding only the remoras the video creates or introduces. |

## 65.9 s: Sign

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-17 | 65.9 | Minor | The stepper is on "3 Sign", but the frame shows the remora already created ("Its spending limit is live"). The signature is never seen, and the URL bar still reads "/remoras/new". | Show the wallet's signing prompt for 1–2 s, or rename the step "Signed". Update the URL bar to the remora's page. |

## 72.8 s: 03 · Ask, pay, see why: Ask

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-18 | 72.8, 93.7 | Nit | The URL slugs "/remoras/scout-demo" and "/remoras/sentinel" don't match the names on screen ("Researcher · demo", "Wallet watcher"). | Use slugs that match the names, or show only the host in the URL bar. |

## 79.8 s: Pay

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-19 | 79.8 | Major | In the cost card the parts can't add up. The total is "$0.01", "Purchases $0.01" is 69% of it, and Model and Gas are each "< $0.01" (24% and 7%). The card also uses "$" where everything else says USDC. | Show enough decimals that the parts add up (for example 0.0145 USDC), in one unit, USDC. |

## 86.7 s: Why

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-20 | 86.7 | Blocker | The spotlit receipt contradicts both the caption and the story. Under the caption "what it read", it says "Read: 0 object(s) via Tatum". For a 0.01 USDC purchase it says "no money moved in this step" and "paid 10000" (no unit). It also shows a raw memory id and a 64-character intent hash. | Show a receipt that lists the purchase as "paid 0.01 USDC to Sui risk check" and what the remora read, or change the caption to "what it decided, and why". Shorten the hashes. |

## 93.7 s: 04 · It learns from you: Teach

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-21 | 93.7 | Major | The story switches without introduction to "Wallet watcher mw1642xw", a remora never created on screen. It carries a test suffix, is still in practice mode, and has no caption. A judge loses the thread ("whose agent is this?"). | Add a caption such as "A Wallet watcher learns from you too.", give it a clean name, or create it in section 02. |

## 100.6 s: Learned

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-22 | 100.6 | Blocker | The caption "It applies it" claims a rule just taught was applied. But the spotlit "Ignored: Received 0.001 SUI" is 43m old, while the new rule ("ignore incoming SUI under 0.002") was learned "just now". The older rule "Ignore incoming SUI under 0.01" (44m ago) already covers the transfer, so the new rule adds nothing. The footage shows no learning applied. | After teaching, send a fresh transfer and show it ignored "just now". Teach a rule the existing one doesn't already cover. |
| V-23 | 100.6 | Minor | The cursor sits on the key number in the spotlit row ("0.0▸1 SUI"). | Move the cursor off the row before the spotlight lands. |

## 107.5 s: Learning

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-24 | 107.5 | Major | The "Learning" step ends on an empty state: "Proof of Learning: No proof yet", "Noise rate 0% · too few to tell yet", and a chart with one data point. This undercuts "it learns", and there is no caption. | Record on a remora with rated history, or skip this tab and end the section on the applied rule. |

## 114.5 s: 05 · Memory you can read: Matched

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-25 | 114.5 | Major | The caption "A repeated write is shown, not dropped" contradicts the on-screen text "Skipped as already known… nothing new was written". The write *was* dropped, and the screen says so. | Change the caption to "A repeat isn't stored twice, and you see it." |
| V-26 | 114.5, 121.4 | Major | "Memory you can read" never shows a readable memory: only blob ids, namespaces, statuses, sizes and expiries. The jargon ("Blob", "Namespace", "wake", "Expires: pending") means nothing to a judge. | Open one memory and show its text for 2–3 s. Rename the columns in plain words, or crop to the readable part. |

## 121.4 s: Search

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-27 | 121.4 | Major | "sui-risk" is typed in the search box, but the table and counts are unchanged (the same 3 rows) and there is no caption. In the sampled frame, the Search step shows no result. | Hold on the filtered result, then add a caption such as "Search what it remembers." |

## 128.3 s: One injected sentence (explainer)

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-28 | 128.3 | Minor | The caption describes events that aren't on screen ("Bought data carried an injected instruction. The model obeyed."). The frame shows three layer cards and a red dot. | Show the injected line inside the frame, as at 17.3, or make the caption describe the layers. |
| V-29 | 128.3, 135.3 | Major | The attack the product survives is shown only as diagrams, here and at 10.4–17.3. The proof is a pasted digest and "28 attacks in CI · 0 overspends". No app or explorer footage shows the blocked payment. | Cut in 2–3 s of the real aborted transaction, either the explorer page or the app's receipt for it. |
| V-30 | 128.3 | Minor | "Gas station" is the box called "x402 facilitator" at 52, so the same thing has two names. "Every sponsored payment is simulated first" and "the caps" are jargon. | Use one name across scenes, for example "Payment relay: tries each payment before sending it". |

## 135.3 s: the three layers fire

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-31 | 135.3 | Minor | The badges show raw identifiers ("disc.payee_not_allowed", "EPayeeNotAllowed") and use three words (BLOCKED / FAILED / ABORTED) for one outcome. The digest is printed in full (44 characters), where 10.4 used the short form. | Use one plain badge per layer, for example "Stopped · payee not on its list", with the error code in small type at most. Shorten the digest to "7NYf3QGE…". |

## 142.2 s: 06 · Over the cap, it asks: You decide

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-32 | 142.2 | Major | The over-the-cap requests are 13 and 16 days old, from "Researcher mvi9nqpw" and "Researcher mvee216v", not the remora made in this video. There is no caption in the sampled frame. The request looks stale, and you can't tell which agent it came from. | Trigger a fresh over-cap request from the video's own Researcher, then add a caption such as "Over its cap, it asks you first." |
| V-33 | 142.2 | Minor | The cursor covers the amount on "Pay once (0.02 USDC)". | Hover the button's edge, or move the cursor away before the hold. |

## 149.2 s: 07 · You stay in control: Pause all

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-34 | 149.2 | Blocker | Funds contradicts the limit set on camera. "Researcher · demo" reads "0.01 / 6.00 USDC spent · ≤ 0.01 USDC a payment · 1 payee · ends in 372 days", against the 0.50 USDC a month, 0.015 a payment and 3 payees ("Can pay 3 sources") shown at 59–79.8. The other rows are named "remora-6af6feaf" and "e2e-burner". | Fix the display (per month versus total, 0.015 rounding to 0.01, payee count) before recording, or crop the shot to the Pause all control. |

## 156.1 s: Why Remora (recap)

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-35 | 156.1 | Minor | The recap claims things the video didn't show. "Learns: From your 👍 and 👎" comes after the Learning tab said "No proof yet. Rate … with 👍/👎". "Correct and export it. Use it in Claude Code" was never shown, and "it" doesn't say what it refers to. | Match the recap to the footage, for example "Learns: from rules you teach it, kept on Walrus" and "Yours: read and export its memory". |
| V-36 | 3.5, 156.1, 163 | Minor | Three hero frames carry three different taglines: "Always-on agents you actually own", "Agents you can trust with money" and "Give an agent a budget, not your wallet". | Pick one line and repeat it at the open and the close. |

## 163 s: close

| ID | at (s) | Sev | What's wrong | Suggested fix |
|---|---|---|---|---|
| V-37 | 163 | Major | The call to action gives "/playground" with no host, so a judge can't find the app from the video. | Show the full address (host + /playground), large, and hold it for 3 s or more. A QR code is optional. |
| V-38 | 163 | Minor | "$1 limit" uses dollars where the app says "1 USDC" (the cost card at 79.8 also uses "$"). | Write "1 USDC limit", and use USDC everywhere. |
| V-39 | all captions | Nit | The accent blue in the captions is the app's link and focus blue, so highlighted words read as links. | Use white bold or the brand violet for emphasis. |

## Story

A judge can follow the outline. The section steppers and captions give the order clearly: what it is, try it free, a diagram of the money flow, own one, ask, pay and see why, it learns, memory, the attack, over the cap it asks, pause, the close. The two explainer scenes match the app's dark cards. The weak point is the evidence. Each moment meant to prove a claim shows data that undercuts it:

- The receipts say "no money moved" and "paid 10000" (V-11, V-20).
- The learning example is a 43-minute-old event already covered by an older rule (V-22), and the Learning tab is empty (V-24).
- "Memory you can read" shows only hashes, and its caption contradicts the screen (V-25, V-26).
- The headline attack exists only as diagrams (V-29).
- The control screen lists limits that differ from the ones set on camera (V-34).

Around this, the test-account clutter (V-16), a remora that appears out of nowhere (V-21), stale approvals (V-32) and full-window shots with tiny text and no caption (V-12) make the middle hard to follow without sound. The close then gives no way to reach the app (V-37). Fix the four blockers and the evidence majors, and the story reads cleanly.

**Counts:** Blocker 4 · Major 14 · Minor 18 · Nit 3
