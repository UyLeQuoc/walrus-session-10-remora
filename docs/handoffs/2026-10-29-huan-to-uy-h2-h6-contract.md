# Requests: the contract PR for Huấn's H2–H6 pages

- **Date:** 2026-10-29 · **From:** Huấn (with agents) · **To:** Uy · **Status:** open
- **Context:** goals H2–H6 (`docs/goals/huan-0*.md`) are built on local fixtures in `apps/web`. Each local
  zod type has a TODO to move to `packages/schema` in this contract PR. Until the endpoints exist, every
  page degrades to a quiet "not available yet" state. No E2E ran ([ADR-0071](../adr/0071-huan-goals-without-e2e.md)).
- All amounts are micro-USDC integer strings (`/^\d+$/`), like the budget fields.

## 1. N20 `/status` (H2)
- `GET /api/status`, public: `{ status: HealthStatus, items: { name: string; status: HealthStatus }[] }`.
  Extra keys are stripped by the web; please send none.
- Route: `{ path: "status", element: <StatusPage /> }` (`features/status/status-page.tsx`), outside any
  sign-in guard, inside the query provider.

## 2. N15 cost card (H3)
- `GET /api/remoras/:id/cost?month=YYYY-MM` (UTC month, owner session) →
  `{ llmUsdc, gasUsdc, purchasesUsdc }`. No route needed (card on `/remoras/:id`).

## 3. E7 Reef directory (H4)
- `GET /api/reef/services` → bare array of `{ name, category, priceUsdc, payTo, docsUrl }`, `payTo` resolved
  per network like `reefFor()`. The web drops rows that fail the schema.
- **New fields on `ReefEntry`:** `category` and `docsUrl` (http(s) only).
- Route: `{ path: "reef", element: <ReefPage /> }` (`features/reef/reef-page.tsx`). After it lands, Huấn adds
  the rail/palette entry and links from the remora page.

## 4. G6 public proof links (H5)
- `POST /api/wakes/:id/share` → `{ token, url }`, owner only, idempotent. `:id` is the receipt id.
- `DELETE /api/wakes/:id/share` → `{ ok: true }`, owner only.
- `GET /api/public/wakes/:token`, no auth → `PublicWake`; 404 or 410 when revoked or unknown.
- **`PublicWake` allow-list** (`features/verify/public-wake.ts`): `v: 1`, `remora` (≤ 64), `network`, `ts`,
  `tx`, `agent`, `intentHash`, `anchored`, `checks[{ name ≤ 64, ok, detail ≤ 200 }]`, and `action`
  `{ kind: "pay", payee, payTo, amount }` or `{ kind: ping | digest | silent | answer }`.
  Never send the prompt or its hash, model, memories, trigger ref, inputs, Sonar reasons, the decision's
  `reason`, owner address or email, or the receipt id. `checks[].detail` must stay fixed-format (as in
  `runtime/verify.ts` today).
- **The server must enforce ownership;** the web's gating is UX only.
- Route: `/p/:token` → `<PublicWakePage />` (`features/verify/public-wake-page.tsx`), outside the sign-in
  guard, ideally without the roster.
- **Question:** should the decision's `reason` be public? The web leaves it out because model prose can
  quote private context.

## 5. A8 account export and exit (H6, if time allows)
- `GET /api/account/export` → `{ v: 1, exportedAt, memories: [], wakes: [] }`. Until it exists the web falls
  back to the F8 memory export and says Wakes aren't included.
- `POST /api/account/retire` → `{ transaction: base64, remoraIds: string[] }`: one transaction that
  revokes every non-retired remora's Disc.
- `POST /api/account/retire/confirm { digest }` → `{ retired: string[] }`, like B8's confirm.
- **Question:** should shadow and paused remoras be included? The web assumes yes.

## Reply needed
For each item: yes (with a date), no, or change. Items 1, 3 and 4 need route lines, so they need both of
our approvals on the contract PR.
