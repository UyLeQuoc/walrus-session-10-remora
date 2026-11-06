# ADR-0152: The video shows the replay; the blog's markers come from recorded runs

- **Status:** Accepted
- **Date:** 2026-11-06
- **Deciders:** Uy ("lam het", to: re-cut the video with the replay, fill the blog's markers, fix
  forget all, correct the rule with the wrong count), Uy's agent

## Context
- **The video predates U18 and U19.** It is the 179.6 s cut from Nov 5, 01:00
  ([ADR-0118](0118-video-network-scenes.md)). Since then:
  - the landing, the README, the blog draft and the submission draft all lead Best Walrus Memory with
    the replay ([ADR-0136](0136-replay-bench.md)): the same ten questions planned with no memory,
    memory as of T₀ and today's: 10, 10, then 4 services;
  - the video doesn't show the replay, and the U19 exit note left the scene out.
- **The form allows 2–3 minutes.** A new scene needs time cut somewhere else.
- **The replay already ran.** It is in the local database: "Researcher · u19" (`109603bd…`), Nov 5,
  10 → 10 → 4, 0.135 → 0.135 → 0.060 USDC planned, six differences each citing blobs. Filming it
  pays nothing.
- **Its rule carried a wrong count.** The `[rule]` memory (`Z_q7phq8…`) and `config.rules[0].reason`
  said "2 useful answers out of 25 calls". The model wrote that before the guard in
  [ADR-0137](0137-rule-proposals-narrow-only.md)'s heartbeat landed; the run had 5 odds calls.
- **The blog draft still had markers:** six `[deploy]`, two `[dogfood]` and a `[repo URL]`. Some lines
  were out of date: three Reef services, Walrus Sites, SuiNS and the Mini App "on the roadmap".

## Decision
- **The video, ≈175 s:**
  - "04 · It learns from you" (the Wallet watcher taught in plain words) gives way to
    **"04 · It gets better"**:
    - the rule row ("✓ you said yes · Nov 5 · Skip odds unless the question names a team");
    - the Replay tab and the past run;
    - the three totals;
    - the first difference, with the cursor on a cited blob.
  - Its captions say it is a plan: "No memory: 10 services. Today: 4. Planned, never paid."
  - **"09 · You stay in control" is cut** (`/funds`, Pause all). The network scenes become 09 and 10.
  - **Filming:** a new `replay` shot in `e2e/tests/demo.spec.ts` finds a "Researcher · u19" with a
    finished replay that planned fewer services today, and opens that run. It never starts a replay.
  - **The other shots are reused:** the earlier capture's folders are linked, the way `render.ts`
    already allows.
  - **The Briefer setup no longer runs on every capture.** It runs only when the brief is filmed, so a
    partial re-capture doesn't make a Briefer.
- **The rule's count, corrected through the app:**
  - The Memory Inspector's Correct (F4) wrote a `[correction]` naming `Z_q7phq8…`, with the line
    written from the counts: "You rated Odds's answers noise 3 times since Nov 5." Recall now skips
    the old blob.
  - `config.rules[0].reason` gets the same line through `saveConfig`, recorded as a config version
    with `source: correction`.
  - Both are in the local database of the test owner (the burner). Production never had this rule.
- **The blog's markers, filled from recorded runs:**
  - **Moment 1:** the deployed playground's first paid answer on Nov 6, 0.01 USDC to Sui risk check
    for package `0x2` (`ECNRUJqW…`). `/verify` on getremora.vercel.app says "Verified".
  - **Moment 4:** one key rotation on testnet from the local stack, on a throwaway Briefer
    (`EwmhZH9j…`). "What's real" says it didn't run on the deployed app.
  - **The inspector:** the index check before the Nov 5 deploy, "written 203 · on Walrus Memory 203 ·
    missing 0".
  - **`[dogfood]`:** the U19 run's numbers, next to the replay:
    - 0.135 USDC for ten answers, four rated useful, about 0.034 USDC per useful answer;
    - 0.060 USDC planned with today's memory, about 0.015 USDC per useful answer.

    It also says there's no daily noise rate yet.
  - **Stale lines brought up to date:** eight house services, a testnet Walrus Site, `.sui` names and
    the Mini App built, "Next" taken from the README's roadmap, and the public repo URL. The README's
    Walrus Sites line is updated too.

## Consequences
- **The video and the story now match.** The video shows the same before/after as the landing and
  the blog.
- **The cut scenes stay in the app and the README:** teaching a rule in plain words, and Pause all.
- **The landing still plays the old file until the next deploy.** `apps/landing/build.ts` copies
  `docs/launch/demo/out/remora-demo-web.mp4` at build time. That deploy is Uy's call.
- **Re-filming the replay needs the U19 run's database.** On a fresh database, run `U19=1` first. The
  full capture now expects the `replay` shot.
- **The correction can't erase the old blob.** It stays encrypted on Walrus until it expires, and the
  inspector shows it as corrected.
- **Nothing in production changed.** That covers both the rule fix and the blog's numbers. The
  playground answer is an ordinary visitor's paid answer, funded by the burner.

## Links
- [ADR-0136](0136-replay-bench.md) · [ADR-0137](0137-rule-proposals-narrow-only.md) ·
  [ADR-0118](0118-video-network-scenes.md) · [ADR-0081](0081-launch-story.md)
- [The demo's README](../launch/demo/README.md) · [the blog draft](../launch/blog-draft.md) ·
  [the U19 exit note](../spikes/2026-11-05-u19-exit.md)
