/**
 * The public mark, in two arrangements.
 *
 * The silhouette is wider than it is tall, so a cap-height mark disappears
 * next to the word. The lockup draws it taller than the word's font size and
 * sets the gap to zero so the two read as one piece. Aspect ratio stays the
 * file's; the mark is never stretched.
 */
import { cn } from "@/lib/utils";

/** Taller than the em, so the silhouette outweighs the word beside it. */
const SYMBOL_TO_EM = 1.45;
/** viewBox width / height of logo-black.svg and logo-white.svg. */
const MARK_RATIO = 1190 / 685;

export function lockupMetrics(wordSize: number) {
  return {
    wordSize,
    symbol: wordSize * SYMBOL_TO_EM,
    gap: 0,
  };
}

export function Logo({
  variant = "mark",
  wordSize = 16,
  className,
  alt = "hippo",
}: {
  /** `mark` is the silhouette alone. `lockup` puts it left of the word hippo. */
  variant?: "mark" | "lockup";
  /** Font size of the word, in px. The symbol height is derived from it. */
  wordSize?: number;
  className?: string;
  /** Set empty when the greeting already names the moment and the word is absent. */
  alt?: string;
}) {
  const { symbol, gap } = lockupMetrics(wordSize);
  const height = Math.round(symbol);
  const width = Math.round(symbol * MARK_RATIO);
  const frame = "w-auto max-w-none object-contain";
  const mark = (
    <span className="inline-flex shrink-0 items-center" style={{ height }}>
      <img
        src="/logo-black.svg"
        alt={alt}
        width={width}
        height={height}
        style={{ height, width: "auto" }}
        className={cn(frame, "dark:hidden")}
      />
      <img
        src="/logo-white.svg"
        alt=""
        width={width}
        height={height}
        style={{ height, width: "auto" }}
        className={cn(frame, "hidden dark:block")}
      />
    </span>
  );

  if (variant === "mark") return <span className={className}>{mark}</span>;

  return (
    <span className={cn("inline-flex items-center", className)} style={{ gap }}>
      {mark}
      <span className="font-semibold tracking-tight" style={{ fontSize: wordSize, lineHeight: 1 }}>
        hippo
      </span>
    </span>
  );
}
