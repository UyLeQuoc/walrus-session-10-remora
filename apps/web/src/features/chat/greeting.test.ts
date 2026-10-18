import { describe, expect, it } from "vitest";
import type { Greeting } from "./greeting";
import { GREETINGS, greetingAt, greetingsFor, greetingText } from "./greeting";

function atHour(hour: number, minute = 30): Date {
  return new Date(2026, 0, 15, hour, minute, 0);
}

function allGreetings(): Greeting[] {
  return [
    ...GREETINGS.morning,
    ...GREETINGS.afternoon,
    ...GREETINGS.evening,
    ...GREETINGS.night,
    ...GREETINGS.shared,
  ];
}

describe("greeting for the reader's local hour", () => {
  it("uses the morning, afternoon, evening, and night lines", () => {
    expect(greetingsFor(atHour(9)).slice(0, 6)).toEqual(GREETINGS.morning);
    expect(greetingsFor(atHour(14)).slice(0, 6)).toEqual(GREETINGS.afternoon);
    expect(greetingsFor(atHour(19)).slice(0, 6)).toEqual(GREETINGS.evening);
    expect(greetingsFor(atHour(23)).slice(0, 6)).toEqual(GREETINGS.night);
  });

  it("changes bank on the hour boundaries, including midnight", () => {
    expect(greetingsFor(atHour(0, 0)).slice(0, 6)).toEqual(GREETINGS.night);
    expect(greetingsFor(atHour(4, 59)).slice(0, 6)).toEqual(GREETINGS.night);
    expect(greetingsFor(atHour(5, 0)).slice(0, 6)).toEqual(GREETINGS.morning);
    expect(greetingsFor(atHour(11, 59)).slice(0, 6)).toEqual(GREETINGS.morning);
    expect(greetingsFor(atHour(12, 0)).slice(0, 6)).toEqual(GREETINGS.afternoon);
    expect(greetingsFor(atHour(16, 59)).slice(0, 6)).toEqual(GREETINGS.afternoon);
    expect(greetingsFor(atHour(17, 0)).slice(0, 6)).toEqual(GREETINGS.evening);
    expect(greetingsFor(atHour(20, 59)).slice(0, 6)).toEqual(GREETINGS.evening);
    expect(greetingsFor(atHour(21, 0)).slice(0, 6)).toEqual(GREETINGS.night);
  });

  it("reads the local hour, not UTC", () => {
    const local = new Date(2026, 5, 1, 9, 0, 0);
    expect(local.getHours()).toBe(9);
    expect(greetingsFor(local).slice(0, 6)).toEqual(GREETINGS.morning);
  });

  it("walks the hour's bank and wraps, instead of pinning one line to the day", () => {
    const morning = atHour(9, 0);
    const later = atHour(11, 45);
    expect(greetingAt(morning, 0)).toBe(GREETINGS.morning[0]);
    expect(greetingAt(later, 1)).toBe(GREETINGS.morning[1]);
    expect(greetingAt(morning, 0)).not.toBe(greetingAt(morning, 1));
    expect(greetingAt(morning, GREETINGS.morning.length)).toBe(GREETINGS.shared[0]);
    expect(greetingAt(morning, greetingsFor(morning).length)).toBe(greetingAt(morning, 0));
  });

  it("keeps forty distinct lines, with the jokes in the shared bank", () => {
    const all = allGreetings();
    expect(GREETINGS.morning).toHaveLength(6);
    expect(GREETINGS.afternoon).toHaveLength(6);
    expect(GREETINGS.evening).toHaveLength(6);
    expect(GREETINGS.night).toHaveLength(6);
    expect(GREETINGS.shared).toHaveLength(16);
    expect(new Set(all.map((line) => line.id)).size).toBe(all.length);
    expect(all.some((line) => /hippo/i.test(`${line.hello} ${line.invite}`))).toBe(false);
    expect(GREETINGS.night.some((line) => /good night/i.test(line.hello))).toBe(false);
    expect(all.filter((line) => line.accent).length).toBe(4);
    expect(all.every((line) => /[.!?]$/.test(line.invite))).toBe(true);
  });

  it("speaks the hello and the invitation, not the decorative mark", () => {
    const waved = GREETINGS.shared.find((line) => line.accent === "wave");
    if (!waved) throw new Error("wave greeting missing");
    const spoken = greetingText(waved);
    expect(spoken).toBe(`${waved.hello}. ${waved.invite}`);
    expect(spoken).not.toContain("👋");
    expect(greetingText(GREETINGS.morning[0])).toBe(
      `${GREETINGS.morning[0].hello} ${GREETINGS.morning[0].invite}`,
    );
  });
});
