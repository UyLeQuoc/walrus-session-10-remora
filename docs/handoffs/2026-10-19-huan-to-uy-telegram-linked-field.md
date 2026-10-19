# Handoff: Huấn → Uy, expose whether Telegram is linked

- **Date:** 2026-10-19 · **From:** Huấn · **To:** Uy · **Status:** open
- **Context:** `SetupChecklist` (plan C2) has an optional “Link Telegram” step. The web can create a
  link code (`POST /api/telegram/link`) but `GET /api/settings` (`OwnerSettings` in
  `packages/schema`) has no field that says whether an owner has completed the link.

**Ask:** add one boolean to `OwnerSettings`, e.g. `telegramLinked: boolean`, and return it from
`GET /api/settings` (set true after the bot consumes the code). Then the checklist can tick step 4
and `/settings` can show “Linked” instead of “Not linked”.

Until then the web keeps the step marked **(optional)**, unticked, and `/settings` reports “Code
ready” after generating one. It never claims the account is linked.

Not a blocker for the UI polish; no API shape change was made from the web side.
