/**
 * The Remora logo (ADR-0040): a block "R" drawn on a 60-unit grid, alone or with the word.
 *
 * One inline SVG path in `currentColor`, so every colour comes from a token and follows the theme
 * without separate files. The six blocks share one winding direction inside a single path, so
 * their shared edges never show a hairline seam when rasterised. `public/logo-*.svg` and the
 * favicons are generated from the same path by `bun run --filter @remora/web logo:assets`.
 */
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

import { LOGO_PATH, LOGO_VIEWBOX } from "./logo-path";

export { LOGO_PATH, LOGO_VIEWBOX };

const SIZE = { xs: 16, sm: 20, md: 24, lg: 32, xl: 48 } as const;

export type LogoSize = keyof typeof SIZE | number;

/**
 * - `auto`: the text colour of the theme (black on light, white on dark).
 * - `primary`: the brand indigo.
 * - `black` / `white`: fixed, for a surface whose colour you already know (an OG image, a photo).
 */
export type LogoTone = "auto" | "primary" | "black" | "white";

/** The glyph colour without a tile, and the tile + glyph colours with one. */
const TONE: Record<LogoTone, { bare: string; tile: string; onTile: string }> = {
  auto: { bare: "text-foreground", tile: "bg-foreground", onTile: "text-background" },
  primary: { bare: "text-primary", tile: "bg-primary", onTile: "text-primary-foreground" },
  black: { bare: "text-black", tile: "bg-black", onTile: "text-white" },
  white: { bare: "text-white", tile: "bg-white", onTile: "text-black" },
};

/** The word sits a little smaller than the mark, so the mark leads the lockup. */
const WORD_TO_MARK = 0.78;
const GAP_TO_MARK = 0.3;
/** On a tile the glyph keeps this much padding, and the tile's corners follow app icons. */
const TILE_PADDING = 0.2;
const TILE_RADIUS = 0.24;

export function logoPx(size: LogoSize): number {
  return typeof size === "number" ? size : SIZE[size];
}

/** The bare SVG mark. Decorative: the `Logo` wrapper carries the accessible name. */
export function LogoMark({ size, className }: { size: number; className?: string }) {
  return (
    <svg
      viewBox={LOGO_VIEWBOX}
      width={size}
      height={size}
      aria-hidden
      focusable="false"
      className={cn("shrink-0", className)}
    >
      <path fill="currentColor" d={LOGO_PATH} />
    </svg>
  );
}

export function Logo({
  size = "md",
  tone = "auto",
  background = false,
  withText = false,
  label = "Remora",
  decorative = false,
  className,
}: {
  /** Height of the mark (or of its tile) in px, or a named step: xs 16 · sm 20 · md 24 · lg 32 · xl 48. */
  size?: LogoSize;
  tone?: LogoTone;
  /** Put the mark on a rounded tile, like an app icon. */
  background?: boolean;
  /** Add the word "remora" to the right of the mark. */
  withText?: boolean;
  /** The accessible name. */
  label?: string;
  /** Hide it from assistive tech when the text next to it already names Remora. */
  decorative?: boolean;
  className?: string;
}) {
  const px = logoPx(size);
  const colors = TONE[tone];
  const glyph = background ? Math.round(px * (1 - TILE_PADDING * 2)) : px;

  const mark = background ? (
    <span
      data-slot="logo-tile"
      className={cn("inline-flex shrink-0 items-center justify-center", colors.tile)}
      style={{ width: px, height: px, borderRadius: px * TILE_RADIUS }}
    >
      <LogoMark size={glyph} className={colors.onTile} />
    </span>
  ) : (
    <LogoMark size={glyph} className={colors.bare} />
  );

  const a11y = decorative
    ? ({ "aria-hidden": true } as const)
    : ({ role: "img", "aria-label": label } as const);

  if (!withText) {
    return (
      <span data-slot="logo" className={cn("inline-flex", className)} {...a11y}>
        {mark}
      </span>
    );
  }

  const word: CSSProperties = { fontSize: Math.round(px * WORD_TO_MARK), lineHeight: 1 };
  return (
    <span
      data-slot="logo"
      className={cn("inline-flex items-center", className)}
      style={{ gap: Math.round(px * GAP_TO_MARK) }}
      {...a11y}
    >
      {mark}
      <span
        aria-hidden
        className={cn(
          "font-semibold tracking-tight",
          tone === "black" || tone === "white" ? colors.bare : "text-foreground",
        )}
        style={word}
      >
        remora
      </span>
    </span>
  );
}
