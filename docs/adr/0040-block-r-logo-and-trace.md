# ADR-0040: Block "R" logo component, shadcn Trace for agent steps, full-width forms

- **Status:** Accepted
- **Date:** 2026-10-19
- **Deciders:** Huấn

## Context
- The fish mark was a placeholder (ADR-0036). Huấn delivered the final logo as two flat SVGs
  (`logo-black.svg`, `logo-white.svg`): a block "R" on a 60-unit grid, drawn as six separate paths.
  Rendered as six paths, the shared edges show hairline seams.
- Chat showed the remora's work as loose lines ("recalled 2 memories", "⟶ recalled", "remembering
  …", a spinner). shadcn/ui shipped **Trace** in October 2026: one component for agent steps
  (icon, title, description, running/error/pending status, collapsible detail).
- ADR-0039's Phase 6 kept form fields at `max-w-2xl` inside full-width pages. On wide screens New
  remora, Settings, Verify and Connect looked half-empty and left-heavy next to full-width pages.

## Decision
- **One `Logo` component** (`components/logo.tsx`) with props `size` (xs–xl or px), `tone`
  (`auto` follows the theme text colour, `primary`, `black`, `white`), `background` (an app-icon
  tile; the glyph takes the tone's contrast colour), `withText` (adds the word "remora"), `label`
  and `decorative`. The geometry lives in `components/logo-path.ts`: six clockwise blocks in **one**
  path, so there are no seams. Colours come from tokens, so light/dark need no second file.
- The sidebar uses `<Logo tone="primary" background withText />`.
- `public/logo-black.svg`, `public/logo-white.svg`, `favicon.svg` and the PNG icons are generated
  from the same path by `bun run --filter @remora/web logo:assets` (Playwright from the e2e package
  renders the PNGs). The favicon is the indigo tile; Apple/Android icons are full-bleed squares
  because the OS masks the corners.
- **Trace** is vendored as `components/ui/trace.tsx` from the shadcn `radix-nova` registry item,
  adapted to this kit (our `Collapsible`, lucide chevron, Radix `data-state` animations from
  `tw-animate-css`) plus a `shimmer` utility in `index.css`. Chat renders a turn's steps through
  `features/chat/turn-trace.tsx`; `Thinking` is a running Trace line. No new npm dependency.
- **Forms use the full width instead of a narrow column:** `Section layout="split"` puts the heading
  in a left column on `lg+` (Settings); New remora is two columns with a sticky Summary card that
  holds the signature note and the Create button; Verify and Connect span the page.

## Consequences
- The old fish mark and `lockupMetrics` are gone. `og.png` (it still showed hippo) is now rendered
  by the same script: the indigo tile, the word and the hero line on warm dark paper.
- Any future brand surface (Mini App, docs site) imports `Logo`/`LOGO_PATH` rather than copying SVGs.
- Agent UI (tool calls, plans, subagents) should be built on Trace so every step has one shape.
