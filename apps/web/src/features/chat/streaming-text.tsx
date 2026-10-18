/**
 * Streaming text that arrives by the word, not by the character.
 *
 * The catch-up maths and the word-boundary cut are taken from React Bits Pro's
 * `ai-chat-3`, which is the one genuinely reusable thing in that block; the
 * rest of it is a mockup of somebody else's product. Two changes were needed to
 * wire it to real data.
 *
 * The original is fed deltas through a `push(chunk)` callback. The Vercel AI
 * SDK hands us the whole text so far on every render, so this takes the target
 * string directly and derives the rest.
 *
 * Why it is worth having at all: without it, a token boundary lands mid-word
 * and a reader watches "Vietnam" become "Vietnames" become "Vietnamese". The
 * buffer runs behind the stream and only ever reveals whole words, which reads
 * as typing rather than as a machine.
 */
import { motion, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { Spinner } from "@/components/ui/spinner";

/** How fast the buffer closes a gap, and the floor so it never stalls. */
const CATCH_UP_MS = 180;
const FLOOR_CPS = 45;

function lastWordBoundary(source: string, cut: number): number {
  if (cut >= source.length) return source.length;
  const i = source.lastIndexOf(" ", cut);
  return i === -1 ? 0 : i;
}

export function useSmoothedText(target: string, ended: boolean): string {
  const [shown, setShown] = useState("");
  const targetRef = useRef(target);
  const endedRef = useRef(ended);
  const cursorRef = useRef(0);
  const reduced = useReducedMotion();

  targetRef.current = target;
  endedRef.current = ended;

  useEffect(() => {
    if (reduced) {
      setShown(target);
      return;
    }
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      // Clamped, so a backgrounded tab does not jump the whole message at once.
      const dt = Math.min(now - last, 64);
      last = now;
      const full = targetRef.current;
      const behind = full.length - cursorRef.current;
      if (behind > 0) {
        cursorRef.current = Math.min(
          full.length,
          cursorRef.current + behind * (1 - Math.exp(-dt / CATCH_UP_MS)) + (FLOOR_CPS * dt) / 1000,
        );
        const cut = Math.floor(cursorRef.current);
        const finished = endedRef.current && cut >= full.length;
        setShown(full.slice(0, finished ? full.length : lastWordBoundary(full, cut)));
      } else if (endedRef.current && cursorRef.current < full.length) {
        setShown(full);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduced, target]);

  // A finished message must never be left truncated by a dropped frame.
  return ended && !reduced
    ? shown.length >= target.length
      ? target
      : shown
    : reduced
      ? target
      : shown;
}

/** Each word fades in as it lands. Collapses to plain text under reduced motion. */
export function StreamingWords({ text }: { text: string }) {
  const reduced = useReducedMotion();
  if (reduced) return <>{text}</>;
  const words = text.match(/\S+\s*/g) ?? [];
  return (
    <>
      {words.map((word, i) => (
        <motion.span
          // Index is the identity here: word N is always word N, and the list
          // only ever grows at the end.
          key={i}
          initial={{ opacity: 0, filter: "blur(4px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
          className="inline-block whitespace-pre-wrap"
        >
          {word}
        </motion.span>
      ))}
    </>
  );
}

/** A spinner and a sentence, before the first token arrives. */
export function Thinking({ label = "Thinking" }: { label?: string }) {
  return (
    // role="status" so the label is announced and is valid on the element; a
    // bare span supports no aria-label at all.
    <span
      role="status"
      aria-label={label === "Thinking" ? "hippo is thinking" : label}
      className="inline-flex items-center gap-2 text-sm text-muted-foreground"
    >
      <Spinner aria-hidden className="size-4" />
      {label}
    </span>
  );
}
