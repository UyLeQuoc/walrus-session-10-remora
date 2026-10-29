# Goal H6: account export and exit (A8·ui, Huấn, if time allows)

**Owner:** Huấn · **Runs in:** main checkout, on `main` · **Depends on:** U9 Phase A A8 (marked "if time
allows"); do this one last · **No E2E** ([ADR-0071](../adr/0071-huan-goals-without-e2e.md)).

The owner can leave cleanly: download everything Remora holds for them, and retire every remora in one
signed transaction. U9 may add:
- `GET /api/account/export` → memories + Wakes, one JSON;
- `POST /api/account/retire` → prepares one transaction that retires every remora.

If U9 drops A8, stop after step 1 and leave the page behind a flag.

## Read first
- [W3 backend requests](../handoffs/2026-10-23-huan-to-uy-w3-backend-requests.md) item 7
- `docs/remora-features.md` A8, F4 (forget is honest: memories can't be deleted from Walrus), F8, B8
- `apps/web/src/features/me/export-panel.tsx`, `use-export.ts` (F8 export, reuse it)
- `apps/web/src/features/settings/**`, `components/app/confirm-action.tsx`

## Allowed paths
`apps/web/src/features/settings/**`, `apps/web/src/features/me/**`, `apps/web/src/components/**`,
`apps/server/src/copy/**` (strings).

## Steps
1. **Settings → "Leave Remora"** section (Danger zone style), two actions:
   - **Export everything:** downloads `remora-export-<date>.json`; reuse the F8 export code, add Wakes.
   - **Retire all remoras:** lists the remoras that will be retired, then `ConfirmAction` (type the word),
     then the wallet signs the prepared transaction; show pending, the digest and a verify link.
2. **Honest copy:** retiring stops spending and revokes keys; memories stay on Walrus until they expire
   (link F4/F5). No "delete my data" promise.
3. **Order:** suggest exporting before retiring (one line, not a blocker).
4. **Tests:** the export downloads, the retire list matches the account's remoras, cancel leaves nothing
   changed, a rejected signature shows the N6 error.

## Done when
- [ ] typecheck, lint, test green
- [ ] Both actions work on fixtures at 1280 and 375, light and dark (retire signs only with a test
      account, never a real owner)
- [ ] Pushed to `main`

## Never
- Sign with a real owner account.
- Promise deletion of memories.
