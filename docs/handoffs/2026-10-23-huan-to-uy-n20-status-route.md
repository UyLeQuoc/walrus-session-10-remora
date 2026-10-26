# Request: route for the public status page (N20), contract line in routes.tsx

- **Date:** 2026-10-23 · **From:** Huấn · **To:** Uy · **Status:** open, waiting for a contract PR
- **Feature:** N20 "Public status page" (`docs/remora-features.md`, W3)

## What is ready
- `apps/web/src/features/status/status-page.tsx` exports `StatusPage`. It reads the public `GET /api/health/deep` (no sign-in) and refreshes every 60 seconds.
- It shows the overall status and one row per health item: name, status, detail. It does not show `fix` or `value`, which may be internal.
- Tests in `status-page.test.tsx`.

## What is needed
One route line in `apps/web/src/app/routes.tsx`, outside any sign-in guard:

```tsx
{ path: "status", element: <StatusPage /> },
```

plus `import { StatusPage } from "../features/status/status-page";`

`routes.tsx` is a shared contract file (`/apps/web/src/app/routes.tsx @UyLeQuoc @huanngdev` in `docs/team-split.md` §2), so this needs one PR approved by both. Huấn will open it with the line above once Uy agrees. Uy: reply here with "ok" or with a different path.

## Why it is safe
- Read-only, public data already served by `/api/health/deep`.
- No secret or internal field is shown on the page.
