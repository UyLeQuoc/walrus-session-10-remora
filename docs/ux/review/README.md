# UX review rounds (goal U14, ADR-0103)

Each round screenshots every route, tab and state, counts the interface words, and has a fresh
reviewer judge the pictures against the rubric below. Only these notes are committed; the screenshots
(`r<N>/`) are gitignored.

```bash
# Capture round N (local stack, the burner; it reads and never pays)
UX=1 UX_ROUND=N bun run --filter @remora/e2e e2e -- --project=ux-desktop --project=ux-phone
UX=1 UX_ROUND=N UX_THEME=light bun run --filter @remora/e2e e2e -- --project=ux-desktop   # round 3
python3 docs/ux/review/sheet.py N        # contact sheets and the word table
```

**What the capture writes, per device (`desktop` at 1440×900, `phone` a Pixel 7), dark:**
- `<page>.jpg`: above the fold;
- `<page>.full.jpg`: the whole page, when it's taller than the screen;
- `words.json`: the interface words in the main pane, above the fold and in total. It skips user and
  agent content (`[data-ux-skip]`, chat bubbles, rendered Markdown) and numbers, amounts, addresses and
  digests.

**States:** filled (the burner's account), `empty-*` (a fresh key), `out-*` (signed out),
`loading-*` and `error-*` (the API slowed or failing), `landing-*` (the landing page, by section).

## The reviewer
- **A new agent each round.** It gets only:
  - the round's screenshots;
  - this rubric;
  - from round 2 on, the previous round's findings, so it can confirm each one is fixed.

  It never sees the code, the diff or the fixer's notes.
- **Persona:** a hackathon judge with three minutes, who knows crypto a little and has never heard of
  Remora, Disc or x402.
- **Per page:**
  1. **The five-second answers:** what the page is for, and what you'd click first. If it can't say both,
     that's a major finding.
  2. **Findings:** the page, the state, the size, the severity, what's wrong and a suggested fix.
  3. **Words that could go,** quoted.
- **Then cross-page consistency:** the same thing shown differently on two pages (an amount, a
  receipt, a remora's kind, a face, a status, an address).

## The rubric
| # | Check | What fails it |
|---|---|---|
| 1 | Purpose | No one-line purpose, or two things compete as the main action |
| 2 | Words | A block of prose longer than two lines (the guide and chat content are exempt); a sentence that repeats what a label or a picture already says; jargon outside ADR-0094 and ADR-0101's words |
| 3 | Data | A number that matters shown as a sentence; no unit, or nothing to compare it with; the key number not the biggest thing; a raw address or digest with no short form, copy or explorer link; a date with no relative form |
| 4 | Hierarchy | More than three visual weights; a secondary action as loud as the main one |
| 5 | States | An empty state without a face, a line and a button; a spinner where a skeleton of the final shape fits; an error that doesn't say what happened and what to do, in 12 words or fewer |
| 6 | Consistency | The same thing looks different on two pages |
| 7 | Layout | Off the page column's grid; uneven rhythm; horizontal scroll at 412 px; a tap target under 40 px; something that matters hidden on a phone |
| 8 | Motion | Animation that shows nothing changing on an app page; a transition over 400 ms; motion that ignores reduced motion |
| 9 | Access | A visual-only fact with no text alternative; contrast below AA; no visible focus |

**Severity:**
- **Blocker:** wrong or misleading data, a broken layout, something unreadable.
- **Major:** fails the five-second test; a wall of text; the main action unclear; a sentence where a
  picture would be clearer.
- **Minor:** spacing, an inconsistency, a sentence that can go.
- **Nit:** taste. Nits never block the freeze.

**Triage:** the fixer marks every finding *fix* or *decline*. A decline needs a reason the next
reviewer can check, for example "an e2e label", "data the API doesn't return" or "ADR-0094
vocabulary".

## Rounds
| Round | Focus | Notes |
|---|---|---|
| 0 | The baseline | [round-0.md](round-0.md) |
| 1 | Structure and words: purpose, one action, cut and move words, data sentences into the kit, empty states | [round-1.md](round-1.md) |
| 2 | Data and flows: numbers, meters, timelines, receipts; new remora, playground, approval, verify; phone | [round-2.md](round-2.md) |
| 3 | Polish and consistency: spacing, alignment, motion, the light theme, accessibility, the landing | [round-3.md](round-3.md) |
