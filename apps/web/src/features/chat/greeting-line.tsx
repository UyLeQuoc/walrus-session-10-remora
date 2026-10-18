import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Greeting, GreetingAccent } from "./greeting";
import { GREETING_ACCENT, greetingText } from "./greeting";

const EASE = [0.23, 1, 0.32, 1] as const;
const WORD_STAGGER = 0.04;

const helloClass = "font-greeting text-4xl font-normal leading-tight text-balance sm:text-5xl";
const inviteClass =
  "mx-auto max-w-md text-base leading-snug text-balance text-muted-foreground sm:text-lg";

function wordsOf(hello: string): string[] {
  return hello.split(/\s+/).filter((word) => word.length > 0);
}

function accentClass(accent: GreetingAccent): string {
  switch (accent) {
    case "wave":
      return "inline-block origin-[70%_70%] text-[0.55em]";
    case "spark":
      return "inline-block origin-center align-super text-[0.38em] text-muted-foreground";
    case "smile":
      return "inline-block text-[0.48em]";
    default: {
      const never: never = accent;
      return never;
    }
  }
}

function accentMotion(accent: GreetingAccent): {
  animate: { opacity: number; y: number; rotate?: number[]; scale?: number | number[] };
  duration: number;
} {
  switch (accent) {
    case "wave":
      return { animate: { opacity: 1, y: 0, rotate: [0, 14, -6, 10, 0] }, duration: 0.6 };
    case "spark":
      return {
        animate: { opacity: 1, y: 0, rotate: [0, 16, 0], scale: [0.86, 1] },
        duration: 0.45,
      };
    case "smile":
      return { animate: { opacity: 1, y: 0, scale: [0.92, 1] }, duration: 0.4 };
    default: {
      const never: never = accent;
      return never;
    }
  }
}

function AccentMark({
  accent,
  delay,
  reduced,
}: {
  accent: GreetingAccent;
  delay: number;
  reduced: boolean;
}) {
  const symbol = GREETING_ACCENT[accent];
  const className = accentClass(accent);
  if (reduced) return <span className={className}> {symbol}</span>;
  const motionProps = accentMotion(accent);
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, y: 6 }}
      animate={motionProps.animate}
      transition={{ duration: motionProps.duration, delay, ease: EASE }}
    >
      {" "}
      {symbol}
    </motion.span>
  );
}

function HelloLine({ greeting, reduced }: { greeting: Greeting; reduced: boolean }) {
  const words = wordsOf(greeting.hello);
  return (
    <p className={helloClass}>
      {words.map((word, index) => (
        <span key={`${greeting.id}-${index}`}>
          {index > 0 ? " " : null}
          {reduced ? (
            <span className="inline-block">{word}</span>
          ) : (
            <span className="inline-block overflow-hidden align-bottom pb-[0.14em] -mb-[0.14em]">
              <motion.span
                className="inline-block"
                initial={{ y: "110%" }}
                animate={{ y: "0%" }}
                transition={{ duration: 0.55, delay: index * WORD_STAGGER, ease: EASE }}
              >
                {word}
              </motion.span>
            </span>
          )}
        </span>
      ))}
      {greeting.accent ? (
        <AccentMark
          accent={greeting.accent}
          delay={words.length * WORD_STAGGER + 0.06}
          reduced={reduced}
        />
      ) : null}
    </p>
  );
}

function InviteLine({
  greeting,
  delay,
  reduced,
}: {
  greeting: Greeting;
  delay: number;
  reduced: boolean;
}) {
  if (reduced) return <p className={inviteClass}>{greeting.invite}</p>;
  return (
    <motion.p
      className={inviteClass}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay, ease: EASE }}
    >
      {greeting.invite}
    </motion.p>
  );
}

export function GreetingLine({ greeting }: { greeting: Greeting }) {
  const reduced = useReducedMotion();
  const still = reduced === true;
  const words = wordsOf(greeting.hello);
  const visual = (
    <div aria-hidden="true" className="flex flex-col gap-4">
      <HelloLine greeting={greeting} reduced={still} />
      <InviteLine greeting={greeting} delay={words.length * WORD_STAGGER + 0.14} reduced={still} />
    </div>
  );

  return (
    <div className="min-h-36 sm:min-h-44">
      <span className="sr-only">{greetingText(greeting)}</span>
      {still ? (
        visual
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={greeting.id}
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18, ease: EASE }}
          >
            {visual}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
