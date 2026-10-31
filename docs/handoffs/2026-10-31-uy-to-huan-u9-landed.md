# Landed (backend): U9's no-deploy parts. What's yours to pick up

- **Date:** 2026-10-31
- **From:** Uy's agent
- **To:** Huấn
- **Status:** on `main`. The contract PR,
  [#17](https://github.com/UyLeQuoc/walrus-session-10-remora/pull/17), is merged too (`e7001fe`). Uy
  merged it before your review ([ADR-0083](../adr/0083-contract-pr-17-merged-before-review.md)).
- **See also:** [exit note](../spikes/2026-10-31-u9-backend-and-launch-docs.md)

## For your pages (H2–H6)
- **Endpoints and answers.** Every endpoint you asked for is on `main`
  ([ADR-0076](../adr/0076-u9-backend-for-huan-pages.md)). The item-by-item answers are in
  [2026-10-31-uy-to-huan-h2-h6-answers.md](2026-10-31-uy-to-huan-h2-h6-answers.md).
- **Contract PR #17.**
  - It moves your local shapes into `packages/schema`, unchanged.
  - Your files re-export them, so no other import changes.
  - It adds `status`, `reef` and `p/:token` to `routes.tsx`.
  - It's merged, so please review it on `main`. Ask for a change in a new contract PR.

## New things the web can show (optional)
- **A Sentinel `check` rule** ([ADR-0078](../adr/0078-sentinel-hands-off-to-scout.md)). "Check airdrops
  with Scout" pings and hands the event to Scout.
  - The remora page's teach hint could add it as a third example (your copy).
  - The handoff shows on Sentinel's feed as a `handoff` event, with `payload.auto: true`.
- **The reality check** ([ADR-0077](../adr/0077-reality-check-unexplained-payments.md)). An unexplained
  payment lands on the remora's feed as an `action` event with `payload.unexplained: true`.
  - It carries `digest`, `amount` and `payTo`.
  - It may deserve a warning style and a "Rotate key" button next to it.
- **`tatum.usage`** is a new health item, so it shows on `/status` by name and status
  ([ADR-0080](../adr/0080-tatum-usage-in-health-and-no-resubscribe-backfill.md)).
- **New error codes** use the server's sentences until you add copy keys:
  - `cost.bad_month`, `cost.no_price`;
  - `wake.not_found`, `wake.not_shared`;
  - `account.nothing_to_retire`, `account.nothing_to_sign`.

## A request for the e2e (your lane)
- **Retire or pause the Sentinels each run creates** (the follow-up from ADR-0058). Since ADR-0080 a
  watched-set change no longer backfills, but every live shadow Sentinel still keeps a filtered stream
  open. `POST /api/remoras/:id/retire` with no Disc retires on the confirm.

## Unchanged
- Copy, `lib/api.ts`, and every e2e spec and test id. `routes.tsx` changes only in PR #17.
