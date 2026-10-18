/**
 * The Remora mark (a placeholder until Huấn's design lands), in two arrangements.
 *
 * Drawn inline with `currentColor`, so it follows the theme without two files. The lockup sets the
 * mark taller than the word's font size so the two read as one piece; the aspect ratio stays fixed.
 */
import { cn } from "@/lib/utils";

/** Taller than the em, so the mark outweighs the word beside it. */
const SYMBOL_TO_EM = 1.45;
/** viewBox width / height of the mark. */
const MARK_RATIO = 64 / 32;

export function lockupMetrics(wordSize: number) {
  return {
    wordSize,
    symbol: wordSize * SYMBOL_TO_EM,
    gap: 0,
  };
}

/** A remora: a long, low fish with the sucker disc (the Disc) on its back. */
function Mark({ height, alt }: { height: number; alt: string }) {
  const width = Math.round(height * MARK_RATIO);
  return (
    <svg
      viewBox="0 0 64 32"
      width={width}
      height={height}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      className="shrink-0"
    >
      <path
        fill="currentColor"
        d="M4 18c6-7 17-10 30-10 9 0 15 2 20 5l8-6-2 10 2 10-8-6c-5 3-11 5-20 5-13 0-24-3-30-8z"
      />
      <rect x="14" y="5.5" width="20" height="4" rx="2" className="fill-primary" />
      <circle cx="12" cy="17" r="1.6" className="fill-background" />
    </svg>
  );
}

export function Logo({
  variant = "mark",
  wordSize = 16,
  className,
  alt = "remora",
}: {
  /** `mark` is the fish alone. `lockup` puts it left of the word remora. */
  variant?: "mark" | "lockup";
  /** Font size of the word, in px. The symbol height is derived from it. */
  wordSize?: number;
  className?: string;
  /** Set empty when the word is absent and the context already names the moment. */
  alt?: string;
}) {
  const { symbol, gap } = lockupMetrics(wordSize);
  const height = Math.round(symbol);

  if (variant === "mark") {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <Mark height={height} alt={alt} />
      </span>
    );
  }

  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap }}>
      <Mark height={height} alt="" />
      <span className="font-semibold tracking-tight" style={{ fontSize: wordSize, lineHeight: 1 }}>
        remora
      </span>
    </span>
  );
}
