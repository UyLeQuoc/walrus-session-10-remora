# ADR-0154: Submission day: the video on YouTube, the blog as an X Article, a web and API redeploy

- **Status:** Accepted
- **Date:** 2026-11-10
- **Deciders:** Uy

## Context
- The deadline is Nov 10, 17:00 UTC. On the morning of Nov 10, four required things were still open: the demo video link, the published blog, the Tatum ID and the form itself.
- The live landing's demo section showed a placeholder ("The demo video is rendered from the repo") instead of the video. The U19 deploy built the web from a clean worktree, and `docs/launch/demo/out/remora-demo-web.mp4` is gitignored, so `apps/landing/build.ts` had no video to copy. `/media/remora-demo.mp4` fell through to the app's HTML.
- Production also lacked the forget fix ([ADR-0153](0153-forget-after-writes-settle.md)), and the landing still showed 360 memories. `diagnose:memory` counts 1,008 on Nov 10.
- Production's `/api/health/deep` was `degraded` only because Tatum answered 402. The public-fullnode fallback was serving ([ADR-0097](0097-public-fullnode-fallback-when-tatum-is-out-of-credits.md)).

## Decision
- **Redeploy web and API from `main`.** No schema change since U19, so no push is needed.
  - The web is built with `vercel build --prod` from a checkout that has the rendered video, so the landing plays it.
  - The API is built with `railway up` from a clean worktree of `main`.
  - Rollback: Railway `a4c4f658` and Vercel `getremora-ees2zpdq5` (the U19 deploy).
- **The demo video goes on YouTube.** It is the 175.0 s share copy (`remora-demo-web.mp4`, 17 MB) with `thumbnail-youtube.jpg`.
- **The blog is published as an X Article** on Uy's account. It comes from `docs/launch/blog-draft.md`, without the draft note, with absolute links, and with the video link in Try it.
- **Uy's agent publishes both through Chrome** on Uy's logged-in accounts. It asks Uy before each final Publish.
- **The agent pre-fills the submission form** with the values in `docs/launch/submission-draft.md`. Uy adds the personal fields and the Tatum ID, ticks the terms box and submits.

## Consequences
- The README's For judges table, the social drafts and the submission draft get the real video and blog URLs once they exist.
- The landing serves the video from Vercel (17 MB per full view). That is fine at judging traffic.
- Tatum stays on the fallback unless Uy buys a plan. That is his call, and the README and the submission say why.

## Links
- [ADR-0097](0097-public-fullnode-fallback-when-tatum-is-out-of-credits.md), [ADR-0099](0099-first-deploy-one-railway-service.md), [ADR-0151](0151-repo-public-nov-6.md), [ADR-0152](0152-video-leads-with-the-replay.md), [ADR-0153](0153-forget-after-writes-settle.md)
- [docs/deploy.md](../deploy.md), [launch/submission-draft.md](../launch/submission-draft.md)
