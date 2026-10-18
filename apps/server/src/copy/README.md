# apps/server/src/copy

Bot and error **copy**: every sentence and button label the channels send, keyed by `packages/schema` copy keys. Backend code renders it; only Huấn edits the text.

- **Owner:** Huấn (`@huanngdev`) (see `docs/team-split.md` §2)
- **Features:** N4, N6 (text), H1 copy
- **Status:** copy v1 in `keys.ts` (first drafts under ADR-0027, U4): every copy key, `render(key, vars)` with `{placeholders}`. `index.ts` keeps the ported channel welcome and privacy text.
