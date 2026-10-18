/**
 * N12: human schedules. "weekdays at 8am", "every Sunday evening", "every day at 18:30",
 * "every 2 hours" → a five-field cron in UTC, with the next runs as a preview. Anything the parser
 * doesn't know is refused rather than guessed.
 */
import { human, nextRun } from "./cron.ts";

const DAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
const PARTS: Record<string, [number, number]> = {
  morning: [8, 0],
  noon: [12, 0],
  afternoon: [15, 0],
  evening: [18, 0],
  night: [21, 0],
  midnight: [0, 0],
};

function timeOf(text: string): [number, number] | null {
  const part = Object.keys(PARTS).find((p) => new RegExp(`\\b${p}\\b`).test(text));
  const m = /\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/.exec(
    text.replace(/\b\d+\s*(hours?|minutes?|h|m)\b/g, ""),
  );
  if (m) {
    let h = Number(m[1]);
    const min = Number(m[2] ?? 0);
    if (m[3] === "pm" && h < 12) h += 12;
    if (m[3] === "am" && h === 12) h = 0;
    if (h > 23 || min > 59) return null;
    return [h, min];
  }
  return part ? (PARTS[part] ?? null) : null;
}

/** A cron expression for the text, or null when it isn't a schedule we understand. */
export function parseSchedule(input: string): string | null {
  const text = input.toLowerCase().trim();
  if (/^([\d*/,-]+\s+){4}[\d*/,-]+$/.test(text)) return nextRun(text, new Date()) ? text : null;
  const every = /\bevery\s+(\d+)\s*(minutes?|mins?|hours?|h)\b/.exec(text);
  if (every) {
    const n = Number(every[1]);
    if (/^h/.test(every[2] ?? "")) return n >= 1 && n <= 23 ? `0 */${n} * * *` : null;
    return n >= 5 && n <= 59 ? `*/${n} * * * *` : null;
  }
  if (/\bevery hour\b|\bhourly\b/.test(text)) return "0 * * * *";
  const at = timeOf(text) ?? (/\b(daily|every day|each day)\b/.test(text) ? [9, 0] : null);
  let dow = "*";
  if (/\bweekdays?\b/.test(text)) dow = "1-5";
  else if (/\bweekends?\b/.test(text)) dow = "0,6";
  else {
    const days = DAYS.flatMap((d, i) =>
      new RegExp(`\\b${d}s?\\b|\\b${d.slice(0, 3)}\\b`).test(text) ? [i] : [],
    );
    if (days.length) dow = days.join(",");
  }
  if (!at) return dow === "*" ? null : `0 9 * * ${dow}`;
  return `${at[1]} ${at[0]} * * ${dow}`;
}

/** The parsed schedule with its next runs, for the "preview the next runs" step. */
export function previewSchedule(text: string, from = new Date(), count = 3) {
  const cron = parseSchedule(text);
  if (!cron) return null;
  const runs: string[] = [];
  let t: Date | null = from;
  for (let i = 0; i < count && t; i++) {
    t = nextRun(cron, t);
    if (t) runs.push(t.toISOString());
  }
  return { cron, human: human(cron), next: runs };
}
