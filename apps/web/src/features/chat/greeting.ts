/**
 * What hippo says before the first message.
 *
 * `getHours` is local, so a machine in the evening is not greeted as morning
 * just because the server is on UTC. The hour only picks the bank. A reload
 * must not keep showing the same line: pinning the pick to the calendar day
 * made every refresh look frozen.
 */
export const GREETING_ACCENT = {
  wave: "👋",
  spark: "✦",
  smile: ":)",
} as const;

export type GreetingAccent = keyof typeof GREETING_ACCENT;

export type Greeting = {
  id: string;
  hello: string;
  invite: string;
  accent?: GreetingAccent;
};

const morning: readonly Greeting[] = [
  { id: "morning-mind", hello: "Good morning.", invite: "What's on your mind?" },
  { id: "morning-ease", hello: "Morning.", invite: "Let's ease into it." },
  { id: "morning-fresh", hello: "A fresh start.", invite: "Where shall we begin?" },
  { id: "morning-page", hello: "Hey.", invite: "A new page, whenever you're ready." },
  { id: "morning-first", hello: "Good morning.", invite: "What's the first thought?" },
  { id: "morning-small", hello: "Morning.", invite: "We can start small." },
];

const afternoon: readonly Greeting[] = [
  { id: "afternoon-untangle", hello: "Good afternoon.", invite: "Got something to untangle?" },
  { id: "afternoon-working", hello: "Hey there.", invite: "What are we working on?" },
  {
    id: "afternoon-break",
    hello: "A little thinking break?",
    invite: "Bring whatever's on your mind.",
  },
  { id: "afternoon-pickup", hello: "Afternoon.", invite: "Where should we pick up?" },
  { id: "afternoon-messy", hello: "Good afternoon.", invite: "The messy version counts." },
  { id: "afternoon-look", hello: "Hey.", invite: "What needs a second look?" },
];

const evening: readonly Greeting[] = [
  { id: "evening-through", hello: "Good evening.", invite: "Let's think it through." },
  { id: "evening-start", hello: "Evening.", invite: "Where would you like to start?" },
  { id: "evening-minute", hello: "Hey there.", invite: "The day can wait a minute." },
  { id: "evening-still", hello: "Good evening.", invite: "What's still on your mind?" },
  { id: "evening-question", hello: "Evening.", invite: "One question is a fine start." },
  { id: "evening-sort", hello: "Quiet hour.", invite: "What shall we sort out?" },
];

const night: readonly Greeting[] = [
  { id: "night-quiet", hello: "A quiet moment.", invite: "Room for a thought or two." },
  { id: "night-time", hello: "Hey there.", invite: "Take your time." },
  { id: "night-here", hello: "Still at it?", invite: "I'm here." },
  { id: "night-worth", hello: "Late hours.", invite: "What's worth thinking through?" },
  { id: "night-rush", hello: "Hey.", invite: "No rush." },
  { id: "night-small", hello: "A quiet night.", invite: "Start with the small thing." },
];

const shared: readonly Greeting[] = [
  {
    id: "shared-oh-hello",
    hello: "Oh, hello",
    invite: "What are we figuring out today?",
    accent: "spark",
  },
  { id: "shared-ready", hello: "Ready when you are.", invite: "Start wherever you like." },
  {
    id: "shared-sitting",
    hello: "Something on your mind?",
    invite: "The rough version is welcome.",
  },
  { id: "shared-sense", hello: "Let's make sense of it.", invite: "One thought at a time." },
  { id: "shared-start", hello: "Hey there.", invite: "Where shall we start?" },
  { id: "shared-with", hello: "Hello.", invite: "Tell me what you're sitting with." },
  { id: "shared-thread", hello: "Come on in.", invite: "What's the first thread?" },
  { id: "shared-messy", hello: "Hi.", invite: "We can start messy." },
  { id: "play-either", hello: "Big idea? Tiny question?", invite: "Either works." },
  { id: "play-half", hello: "Half a thought?", invite: "That's plenty to start with." },
  { id: "play-what-if", hello: "Plan, puzzle, or what-if?", invite: "Pick a starting point." },
  {
    id: "play-smile",
    hello: "Hey there",
    invite: "What shall we untangle?",
    accent: "smile",
  },
  {
    id: "play-wave",
    hello: "Oh, hello",
    invite: "Got something to untangle?",
    accent: "wave",
  },
  {
    id: "play-curiosity",
    hello: "Hello, curiosity",
    invite: "Where shall we start?",
    accent: "spark",
  },
  { id: "play-twist", hello: "Plot twist.", invite: "What are we actually solving?" },
  { id: "play-spill", hello: "Spill it.", invite: "The half-formed version counts." },
];

export const GREETINGS = {
  morning,
  afternoon,
  evening,
  night,
  shared,
} as const;

type GreetingPeriod = keyof Omit<typeof GREETINGS, "shared">;

function greetingPeriod(date: Date): GreetingPeriod {
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

export function greetingsFor(date: Date): readonly Greeting[] {
  return [...GREETINGS[greetingPeriod(date)], ...GREETINGS.shared];
}

export function greetingAt(date: Date, index: number): Greeting {
  const lines = greetingsFor(date);
  const slot = ((index % lines.length) + lines.length) % lines.length;
  const line = lines[slot];
  if (!line) throw new Error("greeting bank is empty");
  return line;
}

export function greetingText(greeting: Greeting): string {
  const hello = /[.!?]$/.test(greeting.hello) ? greeting.hello : `${greeting.hello}.`;
  return `${hello} ${greeting.invite}`;
}
