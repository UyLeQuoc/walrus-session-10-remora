/**
 * The logo geometry, with no imports, so `scripts/logo-assets.ts` can read it outside Vite.
 * A block "R" on a 60-unit grid; every block is drawn clockwise so one path renders seamlessly.
 */

/** A 348-unit square around the glyph. */
export const LOGO_VIEWBOX = "276 96 348 348";

/** Stem, top bar, bowl, middle bar and the two-step leg. */
export const LOGO_PATH = [
  "M330 120H360V420H330A30 30 0 0 1 300 390V150A30 30 0 0 1 330 120Z",
  "M360 120H510A30 30 0 0 1 540 150V180H360Z",
  "M540 180H570A30 30 0 0 1 600 210V270A30 30 0 0 1 570 300H540Z",
  "M360 240H540V300H360Z",
  "M480 300H540V360H510A30 30 0 0 1 480 330Z",
  "M540 360H600V390A30 30 0 0 1 570 420H540Z",
].join("");
