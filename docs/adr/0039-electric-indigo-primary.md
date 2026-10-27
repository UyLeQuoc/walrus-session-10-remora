# ADR-0039: Primary colour — electric indigo

- **Status:** Accepted; the visual design is superseded by ADR-0069 (openbot's UI)
- **Date:** 2026-10-19
- **Deciders:** Huấn

## Context
ADR-0036 chose a single softened teal (`oklch(0.5 0.07 195)` light, `oklch(0.68 0.07 195)` dark) on
warm neutrals. On the finished pages the accent reads dated and low-energy: selected cards, the
active "How loud" option, the setup checklist's current step, progress bars and `secondary` badges
all inherit it, so the whole UI feels washed out. Huấn asked for a fresh, saturated accent while
keeping the warm paper (cool accent on warm paper is the established look).

## Decision
- **Electric indigo** becomes `--primary`:

  | Token | Light | Dark |
  |---|---|---|
  | `--primary` | `oklch(0.55 0.22 280)` | `oklch(0.72 0.16 280)` |
  | `--primary-foreground` | `oklch(0.99 0 0)` | `oklch(0.18 0.04 280)` |
  | `--ring` | same as `--primary` | same as `--primary` |
  | `--sidebar-primary` / `--sidebar-ring` | same as `--primary` | same as `--primary` |
  | `--accent` (hover/selected tint) | `oklch(0.95 0.03 280)` | `oklch(0.30 0.05 280)` |

- `chart-1` is `--primary`; `chart-2`–`chart-5` stay distinct (green, amber, red, pink). The chart
  tokens now exist in `index.css` and are registered in `@theme inline`.
- `--success` (hue 155), `--warning` (hue 75) and `--destructive` (hue 28) keep their values. At hue
  280 the primary is far from all three.
- Everything that used the teal tint keeps using the token (`primary`, `accent`, `ring`,
  `sidebar-*`), so no screen needs a colour of its own. The fish mark's fin already uses
  `fill-primary`/`currentColor`.
- Contrast checked with an OKLCH → sRGB script: white on the light primary **5.13:1**, dark
  primary text on the dark primary **7.26:1**, both above 4.5:1. Light primary on the warm
  background is 5.05:1 and dark primary on the dark background 5.79:1.

This supersedes the "keep teal, softened" answer (Q2) in ADR-0036; the rest of ADR-0036 stands.

## Consequences
- Selection, focus and progress states now read as one indigo family in both themes.
- The accent tint tokens (`--accent`, `--sidebar-accent`) stay warm-neutral; only the primary,
  ring and selected surfaces carry hue 280.
- `docs/ux/README.md` names the new primary; new screens must use the tokens, never a teal.
- No dependency, API or behaviour change.

## Links
- `apps/web/src/index.css` · [ADR-0036](0036-ui-foundation.md) (superseded for Q2 only) ·
  `docs/ux/ui-refresh-brief.md` §1 · `docs/ux/ui-polish-progress.md` Phase 6
