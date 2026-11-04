# ADR-0118: The video shows the network: two scenes replace "And more"

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy (asked for the scene and to render it only; he uploads), Uy's agent

## Context
U17 built remoras that sell to remoras, and crews ([ADR-0111](0111-scale-pass.md)), but the 175 s
video (ADR-0106) didn't show either. Its "10 · And more" scene (the template gallery, a room,
Telegram in Settings) took 12.1 s. The video must stay at 180 s or under, with captions of ten words
or fewer.

## Decision
- **Two new shots** in `demo.spec` (`DEMO_SHOTS=buy,crew`), filmed on testnet on Nov 5. Their
  setup isn't filmed.
  - `buy`: a second test owner's Researcher sees `@uy-researcher` (the burner's Researcher) on sale,
    and lets it pay with one signature. "ask @uy-researcher is package 0x2 safe to depend on?" then
    pays 0.01 USDC, and the chip shows the chain: "Paid 0.01 USDC to @uy-researcher → it paid Sui
    risk check 0.01".
  - `crew`: the Research crew, imported with one signature and live. Its lead answers one question,
    and the answer lists three members' receipts. The Crew card shows each member's spend.
- **The two scenes:** "10 · Remoras pay remoras" (9 s) and "11 · A crew of remoras" (8.6 s) replace
  "10 · And more". To fit, "Why Remora" goes from 7.2 to 6.8 s and the lockup from 7 to 6.6 s.
  **The video is 179.6 s.** The template gallery, rooms and Telegram stay in the README and on the
  landing page.
- **A re-cut can link shots:** `render.ts` reads a shot folder that's a symbolic link, so a
  checkout can film one new shot and link the rest from another checkout's capture.
- **Uy uploads it.** The agent renders it, checks it and hands over the file.

## Consequences
- **Captures must stay:** the old `more` capture is kept but no longer used, and the capture
  folders stay gitignored. A re-render needs them on the machine.

## Links
- [ADR-0106](0106-wow-pass-more-uses.md)
- [ADR-0111](0111-scale-pass.md)
- [docs/launch/demo/README.md](../launch/demo/README.md)
