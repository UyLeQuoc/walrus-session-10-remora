/**
 * A remora's face: its initial on a tinted disc, the tint picked from its id so the same remora keeps
 * its colour everywhere (the roster, a room's cluster, its messages). Remora's own avatar: openbot's
 * blob faces are its brand and are not ported (ADR-0069).
 */
import { cn } from "@/lib/utils";

const TINTS = ["blue", "teal", "green", "orange", "pink", "yellow", "default"] as const;
export type RemoraTint = (typeof TINTS)[number];

/** A stable tint for an id: a small string hash over the seven hues. */
export function remoraTint(id: string): RemoraTint {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return TINTS[Math.abs(hash) % TINTS.length] as RemoraTint;
}

/** The tint's text colour, for a remora's name in a room. */
export function remoraTintText(id: string): string {
  return `var(--openbot-file-${remoraTint(id)})`;
}

export function RemoraAvatar({
  id,
  name,
  size = 36,
  className,
}: {
  id: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const tint = remoraTint(id);
  return (
    <span
      aria-hidden
      data-slot="remora-avatar"
      data-tint={tint}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-full font-semibold select-none",
        className,
      )}
      style={{
        width: size,
        height: size,
        fontSize: Math.max(9, Math.round(size * 0.42)),
        background: `var(--openbot-file-${tint}-soft)`,
        color: `var(--openbot-file-${tint})`,
      }}
    >
      {name.trim().slice(0, 1).toUpperCase() || "?"}
    </span>
  );
}
