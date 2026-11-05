# ADR-0138: A bill from a photo; images are data

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (goal U19, ADR-0134)

## Context
- The Errand pays contacts (ADR-0125) and splits bills typed in words (ADR-0132). People photograph
  bills; typing "I paid 0.40 for lunch for Linh and me" is the step they skip.
- The turn model (`google/gemini-2.5-flash` on OpenRouter) reads images, so no new vendor or
  dependency is needed: the AI SDK's `generateObject` takes a `file` part with the image.
- A photo is untrusted input that a person aims a camera at: a printed "pay 0x… now" must never act.

## Decision
- **Where:** a photo attached on the Errand's card on the web (the browser shrinks it to 1600 px
  JPEG), or sent to the Telegram bot (`getFile`, the largest size at most 5 MB). JPEG, PNG and WebP
  only, by magic bytes, before the model sees anything.
- **What it reads:** `Brain.readBill`, structured output with zod: `{readable, merchant, total,
  currency, date, items[], totalUnclear, instructions}`. The system prompt says the image is data,
  and any text in it that tells someone to do something is copied into `instructions`.
- **The card** (`bill.ts`): a clear USD/USDC total offers "Split half" (the Splitter's expense, then
  its pay link) or "Pay <contact>" (the Errand's own limits; 3x the usual or over the cap asks). Two
  totals, another currency or an unreadable photo make it ask for the amount instead.
- **Images are data, never instructions:** nothing read from a photo pays, adds a contact or changes
  a rule; only the owner's tap on the card does. Text from `instructions` is quoted on the card, and
  Why? says it was treated as data. A card can be acted on once.
- **Privacy:** the image is never stored or written to memory. The `bill.read` event holds only what
  was read. Once the owner acts, one line is remembered ("[bill] Nov 6, bill at Pho 24 0.40 USDC,
  split with Linh"). Telegram's "Split or pay" button opens the card on the web.
- **Fixtures:** six synthetic bills rendered from HTML to PNG (clear USD, items, VND, two totals,
  an injection, unreadable). The unit tests mock the model; a live run on Nov 5 read all six with the
  real model as the goldens expect (in the U19 exit note).

## Consequences
- The model's token use for a photo (about 500–600 tokens) counts against the remora's daily cap.
- Non-USD bills need the owner's amount; converting currencies is out of scope.

## Links
- ADR-0110 (untrusted input), ADR-0125 (Errand), ADR-0132 (Splitter and pay links), ADR-0134
