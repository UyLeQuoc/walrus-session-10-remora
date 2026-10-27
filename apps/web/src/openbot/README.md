# `apps/web/src/openbot/`: openbot's UI, ported to React (PolyForm Noncommercial 1.0.0)

Everything in this folder is ported from [openbot](https://github.com/nightly-labs/openbot) by
Synthetify Labs, at upstream commit `aa3c498c73362aa13898771f20d212c704a16100` (Oct 27, 2026).

- **License:** [PolyForm Noncommercial 1.0.0](LICENSE), not Remora's MIT. Use it only for noncommercial
  purposes. Anyone who gets a copy of any part of this folder also gets `LICENSE`, including its two
  `Required Notice:` lines.
- **Why it's here:** [ADR-0069](../../../../docs/adr/0069-openbot-ui-ported-under-polyform.md).
- **How it was made:** read from a clone of the upstream source and rewritten for React, Radix and
  Tailwind 4. No upstream code was installed or run.
- **The boundary:** the code in this folder is presentational: tokens, CSS, and React components that take
  props and render markup.
  - Remora's pages, data, hooks, copy, logo and avatars live outside it and stay MIT.
  - **Ported code goes nowhere else.** Every file here starts with a header naming its upstream source.
- **Not taken:**
  - openbot's brand: the logo, wordmark, app icons, the bloub blob avatars and marketing art;
  - provider and Font Awesome marks;
  - its i18n copy;
  - the Electron and desktop-only pieces;
  - its stores and controllers.

## Files and their upstream sources

| File | Upstream (paths in `nightly-labs/openbot`) |
|---|---|
| `LICENSE` | `LICENSE` (verbatim) |
