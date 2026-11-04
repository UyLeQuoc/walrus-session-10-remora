# ADR-0131: Starter memory packs: public lines a template's author picks, imported line by line

- **Status:** Accepted
- **Date:** 2026-11-05
- **Deciders:** Uy's agent (U18 A5, [ADR-0119](0119-u18-learning-loop-everyday-money.md))

## Context
A template carried no memories (`starterMemories` was always empty), so every hatched remora started
from nothing, even when its author's remora had already learned which sources are worth paying. The
catalog's M2 asks for an opt-in pack in public plaintext, scrubbed and approved line by line.

## Decision
- **The pack:**
  - a team file may carry `pack`: up to 20 lines of at most 240 characters (an optional
    `TeamFile` field);
  - it's public plaintext in the template's Walrus blob, like the rest of the file.
- **Sharing:**
  - the share review offers candidates from the remora's own memory: a recall in `sources` and
    `feedback` (or a Wallet watcher's `rules`), with hippo's tags stripped;
  - each candidate is checked by `privateReason`: a contact line, an email, a handle, a phone
    number, a link with parameters or a raw address can't go in;
  - the author ticks lines one by one, and the server rebuilds the file with only ticked lines
    that passed.
- **The safety review checks the pack too:** its lines run through the injection, exfiltration and
  raw-address patterns, and any private line blocks the publish (a new finding code,
  `private_memory`).
- **Hatching:**
  - whoever hatches sees the lines and ticks the ones to start with;
  - only lines from the template's own stored pack are accepted;
  - they're written to the first remora's `sources` (or `rules`), each ending
    `· SOURCE: pack <template id>`, so facts skip dedupe for them (ADR-0074) and the Memory
    Inspector shows where they came from;
  - the feed records how many were imported.

## Consequences
- A new owner's Researcher can start knowing which sources were worth it, without any private memory
  leaving the author.
- The pack is the author's word, not verified data. It's labelled as coming from the pack, and the
  remora's own feedback outweighs it over time.

## Links
- `apps/server/src/hatchery/{service,safety}.ts`, `apps/web/src/features/hatchery/{share,template}-page.tsx`.
- [ADR-0046](0046-hatchery-team-files-and-learning-shapes.md), [ADR-0074](0074-memory-facts-and-admission.md).
