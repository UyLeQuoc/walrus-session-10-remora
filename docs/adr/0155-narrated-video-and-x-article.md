# ADR-0155: The demo video gets an ElevenLabs narration; the blog is Uy's X Article, corrected and illustrated

- **Status:** Accepted
- **Date:** 2026-11-10
- **Deciders:** Uy
- **Amends:** [ADR-0154](0154-submission-day-publish-and-redeploy.md) (which video goes on YouTube, and which text becomes the X Article)

## Context
- On submission day Uy asked for a voice on the demo video ("thêm voice elevenlab được không") and gave an ElevenLabs key. The 175 s video had music and on-screen captions, but no voice.
- ADR-0154 said the X Article would be built from `docs/launch/blog-draft.md`. X already held Uy's own Nov 7 draft, "I gave an agent a wallet it can't drain — and a memory that leaves the chat" (1,249 words). Uy chose to fix that draft instead.
  - The draft still said the repo was private.
  - It did not mention the live proof for moments 1 and 4.
  - It had no replay.
- Uy also asked for the article to carry visuals, and for the series name "Rails Before Robots" to be explained in the article itself.

## Decision
- **Narration.**
  - Sixteen lines, one per scene, in `docs/launch/demo/narration/script.json`. Each is timed to its scene's start and fits inside it.
  - Voice: ElevenLabs Eric, a premade voice, on `eleven_multilingual_v2`. It used 1,759 characters of the free plan, which asks for credit, so the YouTube description says "Voice: ElevenLabs".
  - The soundtrack is ducked under the voice, which runs 11–16 dB above the music. The mix is normalized to −14 LUFS and muxed onto the rendered video streams without re-encoding them (`narration/mix.py`).
  - The silent Nov 6 files are kept in `out/backup-nov6-175s-novoice/`.
- **YouTube.**
  - The narrated cut is public: <https://youtu.be/_ioDZcXperI>.
  - The silent cut (`6CgJ6HKZjDs`, published first that morning) is switched to Unlisted, not deleted.
  - The upload is a sub-10 MB HEVC encode of the 60 fps master, because Chrome's upload bridge takes at most 10 MB. Its text was checked against the master.
- **The web** was redeployed again so the landing plays the narrated copy (Vercel `getremora-j9z39i7bo`).
- **The X Article** is Uy's Nov 7 draft with these corrections. It was published by Uy's agent after Uy approved: <https://x.com/UyLeQuoc/status/2120049969600307237>.
  - **Opening.** It explains Rails Before Robots: Part 1 is the Oct 15 audit, <https://x.com/UyLeQuoc/status/2110740488223662114>, which found 7 of 12 building blocks live on mainnet. Its thesis is rails before smarter models.
  - **Moments 1 and 4.** Their live proof now cites the deployed playground's receipt `ECNRUJqW…` and the testnet key rotation `EwmhZH9j…`.
  - **New paragraph.** It adds the replay: 10 → 10 → 4 planned services, with every skip citing its blob.
  - **What's real.** That section now says 1,008 memories on mainnet and the 1,000-call load run, and that the Mini App and paying a `.sui` name are built.
  - **Try it.** It links the playground, the narrated video and the public repo.
  - **Visuals.** A 5:2 cover from the video's title frame, plus seven frames from the video:
    - an injected payment drained versus aborted onchain;
    - a verified receipt;
    - three paid services;
    - the replay;
    - the memory inspector;
    - Claude Code over MCP;
    - the attack card.
- **The README** gets a clickable video thumbnail, the article link, and the same frames, stored in `docs/assets/readme/`.
- `docs/launch/blog-draft.md` stays as the longer version.

## Consequences
- Every place that named the video or blog now has a real URL: the README, the submission draft and the social drafts.
- A later re-render needs `narration/mix.py` run again on the new silent master. The clips are in `out/narration/`, which is gitignored. `tts.py` can regenerate them with `ELEVENLABS_API_KEY` in `.env`. The key Uy pasted in chat should be rotated after the event.
- The video's captions and the narration say the same things. If a scene changes, update `script.json` with it.

## Links
- [ADR-0152](0152-video-leads-with-the-replay.md), [ADR-0154](0154-submission-day-publish-and-redeploy.md)
- [launch/demo/README.md](../launch/demo/README.md), [launch/submission-draft.md](../launch/submission-draft.md)
