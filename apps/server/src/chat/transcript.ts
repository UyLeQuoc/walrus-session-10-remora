/**
 * How much of a conversation the model is allowed to see, and when a silence
 * counts as a new session. No database: the tests import this file, and
 * importing the history module would load the environment and exit in CI.
 */

export const SESSION_GAP_MS = 6 * 60 * 60 * 1000;
export const MAX_CONTEXT_MESSAGES = 20;
export const MAX_CONTEXT_CHARS = 12_000;
export const TITLE_LIMIT = 48;
export const LIST_LIMIT = 30;
export const PAGE_SIZE = 50;

export type TranscriptRole = "user" | "assistant";
export type TranscriptKind = "turn" | "command";

export interface TranscriptLine {
  role: TranscriptRole;
  kind: TranscriptKind;
  text: string;
  seq: number;
}

export function conversationTitle(text: string): string {
  const line = text.split("\n")[0]?.trim() ?? "";
  if (!line) return "New chat";
  if (line.length <= TITLE_LIMIT) return line;
  return `${line.slice(0, TITLE_LIMIT)}…`;
}

/** True when the silence is long enough that the next turn is a new session. */
export function gapExpired(lastAt: number, now: number): boolean {
  return now - lastAt > SESSION_GAP_MS;
}

/**
 * First turn of a thread, or the first turn after a silence. A retry of a
 * message that already has prior turns is not a session start just because
 * the row was written earlier.
 */
export function sessionStartFor(
  priorTurns: number,
  previousAt: number | null,
  now: number,
): boolean {
  if (priorTurns === 0 || previousAt === null) return true;
  return gapExpired(previousAt, now);
}

/**
 * The lines the model should see, oldest first.
 *
 * Commands are shown in the transcript and then left out: they were never
 * part of the prompt, and putting `/help` back in would spend tokens on a
 * menu. The newest line is always kept, even if it alone is long, because
 * that line is the question being answered.
 */
export function contextWindow(lines: TranscriptLine[]): TranscriptLine[] {
  const turns = lines.filter((line) => line.kind === "turn");
  const picked: TranscriptLine[] = [];
  let chars = 0;
  for (let i = turns.length - 1; i >= 0; i--) {
    const line = turns[i];
    if (!line) continue;
    if (picked.length >= MAX_CONTEXT_MESSAGES) break;
    if (picked.length > 0 && chars + line.text.length > MAX_CONTEXT_CHARS) break;
    picked.push(line);
    chars += line.text.length;
  }
  return picked.reverse();
}
