/**
 * The kit's motion rules (ADR-0103): an animation shows a change, interface transitions take 400 ms
 * or less, a loop runs only while it's on screen, and reduced motion shows the end state.
 */
import { useReducedMotion } from "motion/react";
import { type RefObject, useEffect, useState } from "react";

export const EASE = [0.22, 1, 0.36, 1] as const;
export const FAST = 0.24;
export const SLOW = 0.4;

/** True when the element is on screen; loops pause while it isn't. */
export function useOnScreen(ref: RefObject<Element | null>): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setOn(Boolean(entry?.isIntersecting)));
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return on;
}

/** `motion`'s reduced-motion flag, false when it can't tell (tests, no matchMedia). */
export function useCalm(): boolean {
  return useReducedMotion() ?? false;
}
