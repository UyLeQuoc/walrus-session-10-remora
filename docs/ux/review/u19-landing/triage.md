# U19 landing review: triage

The review ([review.md](review.md)) saw only screenshots of the new sections at 1440 and on a Pixel 7.
**Blocker 0, Major 4, Minor 14, Nit 8.**

## Fixed
- **u19-1 (Major):** the intro now says the rule check runs daily and was run on demand at 07:23 UTC.
- **u19-2 (Major):** "Check it yourself" names the same Researcher and its numbers: 29 decisions by
  then, 14 of them payments; the anchor batch is "31 such records of the same Researcher".
- **u19-3 (Major):** "Verify one yourself" links the verify page; the CLI line says "from the repo".
- **u19-4 (Major):** retitled "Other AI agents can find our paid services", with x402 and the Reef
  glossed and "our payment client" for `disc.fetch`.
- **Minors and nits:** "Memory at the start" in the same neutral colour, with why it matches no
  memory (u19-5); "would buy N" values and a caption that nothing was paid (u19-6); the rule's next
  answer was to a question it hadn't seen (u19-7); the Memory Inspector line in words (u19-8); a
  legend for "✍ you signed" and "✓ you said yes" (u19-9); 14 of 29 were payments and Seal glossed
  (u19-10); the anchor card leads with the one-byte line (u19-11); "Every payment carries its reason"
  (u19-12); the photo card shows the tap (u19-13); "gRPC" dropped (u19-14); the Treasurer's paid row
  shows 0.01 USDC and "checkpoint stream" is gone (u19-15); the catalog card says the service was in
  its list and limit (u19-16); "you said yes to the rule" (u19-20); "take access back" (u19-23);
  short receipt ids on the new rows (u19-24); a scroll margin under the sticky header (u19-26).

## Not changed
- **u19-17, u19-18 (phone nav, tap targets):** the whole page's phone header and inline links, not
  this round's sections; on touch screens the chain links already get a 44 px hit area.
- **u19-19 (nav names), u19-21 (bar scale, labelled "count purchases"), u19-22, u19-25:** left as
  they are.
- **u19-14 (show a moved name):** the stop on a moved name is unit-tested, not run live, so the card
  doesn't show it as a run.
