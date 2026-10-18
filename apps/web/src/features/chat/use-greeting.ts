import { useEffect, useRef, useState } from "react";
import { greetingAt, greetingsFor } from "./greeting";

export const GREETING_ROTATE_MS = 5_000;

export function useGreeting(visit = 0, playing = true) {
  const [now, setNow] = useState(() => new Date());
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * greetingsFor(new Date()).length),
  );
  const visitSeen = useRef(visit);

  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setNow(new Date());
      setIndex((current) => current + 1);
    }, GREETING_ROTATE_MS);
    return () => window.clearInterval(id);
  }, [playing]);

  useEffect(() => {
    if (visitSeen.current === visit) return;
    visitSeen.current = visit;
    setNow(new Date());
    setIndex((current) => current + 1);
  }, [visit]);

  return greetingAt(now, index);
}
