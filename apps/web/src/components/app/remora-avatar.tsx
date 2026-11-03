/**
 * A remora's face (ADR-0098): a soft shape in its tint with two eyes that show what it's doing. The
 * shape and tint come from its id, so the same remora keeps its face everywhere (the roster, a room,
 * its page, its messages). The style follows Dots Lab's agent characters (dots-lab.pages.dev); the
 * shapes and faces are drawn here, not exported from it. openbot's blob faces (bloub) are its brand
 * and are not used (ADR-0069). The motion lives in remora-face.css and stops for reduced motion.
 */
import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

const TINTS = ["blue", "teal", "green", "orange", "pink", "yellow", "default"] as const;
export type RemoraTint = (typeof TINTS)[number];

/** What the face shows: at rest, watching, thinking, paid, needs you, blocked, paused, retired. */
export type RemoraMood =
  | "idle"
  | "listening"
  | "thinking"
  | "success"
  | "alert"
  | "error"
  | "asleep"
  | "off";

/** A small string hash; the tint, the shape and the blink's timing all come from it. */
function hashOf(id: string): number {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

/** A stable tint for an id, over the seven hues. */
export function remoraTint(id: string): RemoraTint {
  return TINTS[hashOf(id) % TINTS.length] as RemoraTint;
}

/** The tint's text colour, for a remora's name in a room. */
export function remoraTintText(id: string): string {
  return `var(--openbot-file-${remoraTint(id)})`;
}

/**
 * The face for where a remora stands: it waits for your approval, it's paused, retired or being
 * created, or it watches (a Sentinel, or any remora in practice mode). Otherwise it's at rest.
 */
export function remoraMood(r: { status: string; template?: string }, waiting = 0): RemoraMood {
  if (r.status === "retired") return "off";
  if (waiting > 0) return "alert";
  if (r.status === "paused") return "asleep";
  if (r.status === "creating") return "thinking";
  if (r.status === "shadow" || r.template === "sentinel") return "listening";
  return "idle";
}

/** The bodies, in a 100×100 box, with where the eyes sit and how far apart. */
const SHAPES = [
  {
    name: "pebble",
    d: "M50 10C76 10 93 28 92 54C91 78 73 91 50 91C27 91 8 79 8 55C8 29 24 10 50 10Z",
    eyes: [50, 52],
    gap: 10,
  },
  {
    name: "drop",
    d: "M50 6C58 20 90 38 90 62C90 81 72 94 50 94C28 94 10 81 10 62C10 38 42 20 50 6Z",
    eyes: [50, 64],
    gap: 10,
  },
  {
    name: "squircle",
    d: "M50 9C80 9 91 20 91 50C91 80 80 91 50 91C20 91 9 80 9 50C9 20 20 9 50 9Z",
    eyes: [50, 50],
    gap: 11,
  },
  {
    name: "dome",
    d: "M50 10C77 10 91 31 91 58V79C91 87 86 92 78 92H22C14 92 9 87 9 79V58C9 31 23 10 50 10Z",
    eyes: [50, 55],
    gap: 11,
  },
  {
    name: "peak",
    d: "M50 9C55 9 59 12 63 19L91 71C96 81 90 91 78 91H22C10 91 4 81 9 71L37 19C41 12 45 9 50 9Z",
    eyes: [50, 66],
    gap: 9,
  },
] as const;

function Eyes({ mood, cx, cy, gap }: { mood: RemoraMood; cx: number; cy: number; gap: number }) {
  const xs = [cx - gap, cx + gap];
  const pills = (h: number) =>
    xs.map((x) => (
      <rect key={x} className="rf-eye" x={x - 3.5} y={cy - h / 2} width={7} height={h} rx={3.5} />
    ));
  const lines = (d: (x: number) => string) =>
    xs.map((x) => <path key={x} className="rf-line" d={d(x)} />);
  switch (mood) {
    case "listening":
      return (
        <g className="rf-glance">
          {xs.map((x) => (
            <circle key={x} className="rf-eye" cx={x} cy={cy} r={5.5} />
          ))}
        </g>
      );
    case "thinking":
      return (
        <g transform="translate(4 -6)">
          <g className="rf-blink">{pills(11)}</g>
        </g>
      );
    case "success":
      return <g>{lines((x) => `M${x - 7} ${cy + 3}Q${x} ${cy - 8} ${x + 7} ${cy + 3}`)}</g>;
    case "alert":
      return (
        <g>
          {xs.map((x) => (
            <circle key={x} className="rf-eye" cx={x} cy={cy} r={6.5} />
          ))}
        </g>
      );
    case "error":
      // "> <": the eyes squeeze shut at what it refused.
      return (
        <g>
          {xs.map((x, i) => {
            const s = i === 0 ? 1 : -1;
            return (
              <path
                key={x}
                className="rf-line"
                d={`M${x - 4 * s} ${cy - 7}L${x + 3 * s} ${cy}L${x - 4 * s} ${cy + 7}`}
              />
            );
          })}
        </g>
      );
    case "asleep":
      return <g>{lines((x) => `M${x - 7} ${cy - 1}Q${x} ${cy + 7} ${x + 7} ${cy - 1}`)}</g>;
    case "off":
      return <g>{lines((x) => `M${x - 6} ${cy}H${x + 6}`)}</g>;
    default:
      return <g className="rf-blink">{pills(14)}</g>;
  }
}

/** What floats beside a big enough face: a thought, or the z's of sleep. */
function Extras({ mood }: { mood: RemoraMood }) {
  const z = (d: string) => (
    <g className="rf-zz">
      <path className="rf-z-under" d={d} />
      <path className="rf-z" d={d} />
    </g>
  );
  switch (mood) {
    case "thinking":
      return (
        <g>
          <circle className="rf-puff" cx={78} cy={18} r={4.5} />
          <circle className="rf-puff" cx={89} cy={6} r={6.5} />
        </g>
      );
    case "asleep":
      return (
        <g>
          {z("M68 14h9l-9 9h9")}
          {z("M84 2h6l-6 6h6")}
        </g>
      );
    default:
      return null;
  }
}

export function RemoraAvatar({
  id,
  size = 36,
  mood = "idle",
  still = false,
  className,
}: {
  id: string;
  size?: number;
  mood?: RemoraMood;
  /** No motion: for faces repeated down a list, like a room's messages. */
  still?: boolean;
  className?: string;
}) {
  const hash = hashOf(id);
  const tint = TINTS[hash % TINTS.length] as RemoraTint;
  const shape = SHAPES[(hash >> 5) % SHAPES.length] ?? SHAPES[0];
  const [cx, cy] = shape.eyes;
  const style = {
    width: size,
    height: size,
    "--rf-body": mood === "off" ? "var(--openbot-text-muted)" : `var(--rf-${tint})`,
    // Each face blinks on its own beat, so a roster doesn't blink in step.
    "--rf-delay": `-${(hash % 50) / 10}s`,
  } as CSSProperties;
  return (
    <span
      aria-hidden
      data-slot="remora-avatar"
      data-tint={tint}
      data-shape={shape.name}
      data-mood={mood}
      className={cn("remora-face", still && "remora-face-still", className)}
      style={style}
    >
      <svg aria-hidden viewBox="0 0 100 100" width={size} height={size} focusable="false">
        <g className={mood === "success" ? "rf-hop" : mood === "error" ? "rf-shake" : undefined}>
          <path className="rf-body" d={shape.d} />
          <Eyes mood={mood} cx={cx} cy={cy} gap={shape.gap} />
        </g>
        {mood === "alert" ? (
          <g className="rf-badge-group">
            <circle className="rf-badge" cx={83} cy={17} r={14} />
            {size >= 28 ? (
              <>
                <rect className="rf-badge-ink" x={81} y={8} width={4} height={11} rx={2} />
                <circle className="rf-badge-ink" cx={83} cy={24.5} r={2.4} />
              </>
            ) : null}
          </g>
        ) : null}
        {size >= 28 ? <Extras mood={mood} /> : null}
      </svg>
    </span>
  );
}
