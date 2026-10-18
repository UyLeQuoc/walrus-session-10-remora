/**
 * Pure helpers, kept apart from `turn.ts` so they can be imported without
 * pulling in the environment check and the database. The tests import from
 * here; `turn.ts` importing them would validate env at import time, which
 * exits the process when there is no `.env` — as there is not in CI.
 */

/**
 * The longest message hippo will take, about a thousand words.
 *
 * Refused rather than truncated. Truncating looks kinder and is worse: the
 * person believes the whole thing was read, and hippo may answer confidently
 * about a part it never saw. Telegram caps a single message at 4096 characters
 * anyway, so this only really binds on the web, where pasting a whole file is
 * easy to do by accident.
 */
export const MAX_INBOUND_CHARS = 4000;

export function tooLong(text: string): string | null {
  if (text.length <= MAX_INBOUND_CHARS) return null;
  return `That message is ${text.length.toLocaleString()} characters and I cap it at ${MAX_INBOUND_CHARS.toLocaleString()}, which is about a thousand words. Send the part you want me to read, or split it across a couple of messages. I would rather say this than answer as if I had read all of it.`;
}
