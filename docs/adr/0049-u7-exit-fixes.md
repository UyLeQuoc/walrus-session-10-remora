# ADR-0049: What the U7 exit changed

- **Status:** Accepted
- **Date:** 2026-10-22
- **Deciders:** Uy (agent, goal U7 Phase C)

## Context
The U7 exit e2e ran the Hatchery, Proof of Learning and the memory controls on testnet, with the real OpenRouter key and the mainnet MemWal relayer. It found what the in-process tests couldn't:
1. **The model review flagged a clean template.** ADR-0048's review asked a yes/no "flag it?". Gemini 2.5 Flash flagged a plain Scout persona ("You are Scout. You check Sui packages…, and you say what each source cost.") as instructions that go beyond a role, in one call out of three. A clean share then showed "check before hatching".
2. **Expiry arrives minutes after a write.** The relayer's read API lists a new memory right away, but `end_epoch` and `expires_at` stay null for a few minutes. Measured: memories 3–4 minutes old had `2027-05-19` (about 210 days); the newest had none. The inspector showed "—", and the phone view said "no expiry".

3. **The inspector hid read failures.** Each inspector call listed the whole operator account page by page, plus one stats call per namespace, against the read API's 200 a minute. The exit polled it for minutes, a listing failed, and the inspector turned the failure into an empty list. The export then returned in 240 ms with no memories, as if nothing were stored.
4. **The operator account ran out of relayer budget.** Back-to-back W2, U6 and U7 runs reached the relayer's sustained limit for the operator account: "1000 weighted-requests/hour" (`account_sustained`, retry after 300 s). Recall then hung a Scout turn for over three minutes in the full suite, and a rule's memory didn't land within four minutes. A large share of the budget went to `/api/me/memories`. Every page calls it through `useMe`, and it listed the whole account each time just to show expiry dates.

## Decision
- **Model review (M7):**
  - the model answers a category (`none`, `injection`, `exfiltration` or `payment`) and a confidence from 0 to 1;
  - only a non-`none` answer at 0.7 or above becomes a warning (`REVIEW_THRESHOLD`);
  - the prompt says a persona is supposed to give the agent role instructions, and defines each category narrowly;
  - the model still only warns, and deterministic checks still decide blocks (ADR-0048 is unchanged on that).
- **Probe with the real key, 5 calls each:**
  - the clean persona was flagged 0/5;
  - a persona that quietly emails the conversation history to an outside mailbox was flagged 5/5. The deterministic patterns miss that one, since "email" isn't among their verbs.

- **Expiry (F5):**
  - the inspector says "pending" until the relayer fills the expiry, never "no expiry";
  - the exit waits for the relayer's value and checks that it's about 210 days out;
  - the under-30-days alert only counts rows whose expiry is known.
- **Inspector reads (F3, F8):**
  - one account listing is shared for 10 seconds across requests;
  - a failed listing is retried once, then becomes `relayer.slow` ("try again in a minute"), never an empty list;
  - per-namespace counts come from that listing instead of separate stats calls, so the F6 check compares our writes with what the read API lists.
- **Relayer budget:**
  - account listings are shared across requests: up to 30 s old for the inspector, and up to 5 minutes for the chat's expiry column;
  - a remora's recall gives up after 15 s per namespace, and the turn goes on without those memories (never block a reply on memory, tech-reference §1.11);
  - a write the owner waits on (a correction) gives up after 30 s with `relayer.slow`;
  - the exit waits up to 7 minutes for a rule's blob.
- **Burner gas:**
  - a U7 exit run costs about 0.07–0.08 testnet SUI, 0.05 of it the hatcher's gas;
  - the burner was topped up with 0.3 SUI from the spike test key, as ADR-0045 allows (`6V5c7QEd7HymNpzita52yfExaCLZE23zJ44Ynm2SQQQR`).

## Consequences
- A clean template passes the review, and a template that tries to exfiltrate in words the patterns don't know still gets a warning on the share and consent screens.

## Links
- ADR-0012, ADR-0046, ADR-0048; `apps/server/src/runtime/{brain,inspector,memory}.ts`, `apps/server/src/routes/chat.ts`, `apps/web/src/features/memory-inspector/memory-page.tsx`
