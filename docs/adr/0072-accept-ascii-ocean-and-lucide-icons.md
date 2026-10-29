# ADR-0072: Accept the ASCII ocean as built under U13; icons only from lucide-react

- **Status:** Accepted
- **Date:** 2026-10-29
- **Deciders:** Huấn

## Context
[ADR-0041](0041-ascii-ocean-empty-chat.md) (ASCII ocean behind the empty `/chat`) was left Proposed.
U13 ([ADR-0070](0070-u13-openbot-ui-implementation.md)) kept the ocean and recoloured it to openbot's
tokens. The owner reviewed the U13 UI and is happy with it. Separately, the review found icons from
three sources: lucide, text glyphs (check marks, arrows, emoji) and an unused `@tabler/icons-react`.

## Decision
- ADR-0041 stands as implemented: the ASCII ocean stays behind the empty `/chat`, in U13's colours.
  ADR-0041 itself is not edited.
- Icons come only from `lucide-react`. No emoji or text glyphs as icons. Decorative icons are
  `aria-hidden`; status icons carry screen-reader text.
- Kept as inline SVG because they are not icons: the Remora logo (brand mark), the generated wallet
  avatar and the morphing-text threshold filter.
- `@tabler/icons-react` is removed from `apps/web`.

## Consequences
- One icon family, one size and colour vocabulary. Greeting accents become Hand, Sparkles and Smile.
- New icons outside lucide need a new ADR.
- `docs/ux/README.md` carries the rule.

## Links
[ADR-0041](0041-ascii-ocean-empty-chat.md), [ADR-0069](0069-openbot-ui-ported-under-polyform.md),
[ADR-0070](0070-u13-openbot-ui-implementation.md)
