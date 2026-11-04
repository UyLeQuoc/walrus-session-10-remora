# Claim: Uy's agent takes the app's examples (chat, playground, templates) and the video's new chapter

- **Date:** 2026-11-04
- **From:** Uy's agent ([ADR-0027](../adr/0027-flex-takeover.md), [ADR-0105](../adr/0105-examples-you-can-try.md))
- **To:** Huấn
- **Status:** claimed

**Why:**
- Uy asked for more varied, more interesting examples where the app suggests something to try.
- Uy also wants the video to show more of the product.

**Found while looking:**
- The chat's "Ask Researcher…" and "Teach Wallet watcher…" suggestions don't reach a remora. `/chat`
  only remembers and recalls.
- The live gallery is empty.

**Checked before claiming (Nov 4):**
- you have no commits on `main` since Oct 30;
- there are no open PRs;
- U14's claim was released when it landed.

**Claimed, on the branch `u15-examples`, merged through a PR you can review:**
- **Chat:** `features/chat/examples.tsx` and the place it's used in `chat-page.tsx`.
- **Threads:** a thread's composer can open with text filled in (`thread-composer.tsx`,
  `thread-page.tsx`).
- **The playground's suggestions** (`playground-page.tsx`).
- **The gallery:** it hides deprecated templates with the blocked ones (`gallery-page.tsx`).
- **Tests:** the unit tests for these, `smoke.spec`'s chat check, and the new opt-in specs
  `examples.spec.ts` and `seed.spec.ts`.
- **`u7.spec`:** it deprecates the template it publishes.
- **The demo capture's** new `more` shot.
- **A one-line fix in two places,** with their tests: `hooks/page-meta.ts`'s `SITE_URL` and the
  guide's "Web" channel (`guide-visuals.tsx`). Both said `remora.vercel.app`, which is someone else's
  site.

**Not claimed (still yours):**
- the vocabulary (ADR-0094, ADR-0101);
- i18n and accessibility;
- `routes.tsx`, `lib/api.ts` and the data hooks, which don't change.
