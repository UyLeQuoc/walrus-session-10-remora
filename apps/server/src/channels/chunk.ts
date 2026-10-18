/** Telegram caps a message at 4096 characters; this leaves room for markup. */
const MAX_LEN = 3900;

/**
 * Telegram rejects a message over 4096 characters, and `/memory` listings run
 * long. Split on a newline where there is one in the back half of the window so
 * a list is not cut mid-entry. Its own module so the test can import it
 * without `telegram.ts` validating the environment at import time.
 */
export function chunk(text: string, maxLen = MAX_LEN): string[] {
  if (text.length <= maxLen) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    const cut = rest.lastIndexOf("\n", maxLen);
    const at = cut > maxLen * 0.5 ? cut : maxLen;
    out.push(rest.slice(0, at));
    rest = rest.slice(at).trimStart();
  }
  if (rest) out.push(rest);
  return out;
}
