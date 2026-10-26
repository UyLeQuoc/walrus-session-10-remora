# Requests: backend and contract needed for the remaining W3 web items

- **Date:** 2026-10-23 · **From:** Huấn · **To:** Uy · **Status:** open
- **Why now:** these W3 items have web work ready to start, but each one needs data or a route that only the backend or a contract PR can add. Nothing here changes `packages/schema` or `routes.tsx` without a PR both of us approve.

## 1. N8: remora health badges (green / yellow / red)
The badge needs five signals per remora. The web app has `status` (`creating | shadow | active | paused | retired`) and nothing else.

Requested in the remora list or detail response (new optional fields, contract PR):
- `budgetLow: boolean` (remaining budget under a threshold you choose)
- `delegateRevoked: boolean`
- `streamLagMs: number | null` (checkpoint lag for the remora's watcher)
- `keyRotatedAt: string | null`

Web side will show the badge from these fields, with a tooltip per signal (N14 glossary).

## 2. N11: config history and rollback
Needs versioned remora configs: `GET /api/remoras/:id/config/versions` returning `{ version, createdAt, config }[]`, and `POST /api/remoras/:id/config/restore { version }`. The web side shows a diff between two versions and a "Restore" button.

## 3. E6: spend analytics
`GET /api/spend?remoraId=&groupBy=remora|merchant|day&from=&to=` returning totals and per-row rows, plus `format=csv`. Web side: a table, a chart, and a CSV download link.

## 4. E7: Reef directory page
`GET /api/reef/services` returning `{ name, category, priceUsdc, payTo, docsUrl }[]`. Web side: a searchable directory at `/reef` (needs a route line in `routes.tsx`).

## 5. F10: weekly review
`GET /api/remoras/:id/weekly-review` returning the summary memory, the chart series, and the Telegram post text. Web side: a card on the remora page.

## 6. F7: memory import
`POST /api/memory/import` accepting a file (Claude Code, Codex, Cursor, ChatGPT export, Markdown) and returning a preview `{ entries[], skipped[] }`, then `POST /api/memory/import/confirm`. Web side: upload, preview, confirm.

## 7. A8: account export and exit
`GET /api/account/export` (all memories and Wakes, a zip or one JSON) and `POST /api/account/retire` (retire every remora in one signed flow). Web side: one page with two actions and a confirm step.

## 8. B5: SuiNS subname per remora
Confirm the subname API and return `{ subname }` on each remora. Web side: show the name on the remora page.

## 9. N15: cost card
`GET /api/remoras/:id/cost?month=YYYY-MM` returning `{ llmUsdc, gasUsdc, purchasesUsdc }`. Web side: a card on the remora page.

## 10. G6: public proof links
`POST /api/wakes/:id/share` returning a public URL, and `GET /api/public/wakes/:token` (redacted, no auth). Web side: a public page and a "Share" button on a Wake.

## 11. B2: create from a plain-language job
`POST /api/remoras/draft { job }` returning a draft config (persona, tools, triggers, budget suggestion) that the owner reviews before creating. Web side: a text box and a review screen.

## 12. N16: personalization
Add optional `avatar`, `tone`, and `language` to the remora config (contract PR). Web side: a picker on the remora settings page.

## 13. Deploy items (Uy owns deploys)
- **H6:** Walrus Sites landing and docs. Huấn can build the static site; Uy publishes it and gives the URL.
- **J4:** docs site. Same split.
- **H3:** Telegram Mini App. Needs a backend endpoint for the Mini App session and one-tap approval, then the web page.

## Reply needed
For each numbered item, reply with: "yes, I will add it" (with the expected date), "no, not in W3", or "change it to …". Contract PRs for items 1, 2, 9, 12 need both of us.
