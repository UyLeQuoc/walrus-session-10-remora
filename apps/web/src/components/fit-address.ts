const ELLIPSIS = "...";
const MIN_TAIL = 2;

function minHead(value: string): number {
  return value.startsWith("0x") ? 4 : 2;
}

/** Narrowest middle cut that still keeps both ends. */
export function addressFloor(value: string): number {
  return minHead(value) + ELLIPSIS.length + MIN_TAIL;
}

/**
 * Fit `value` into `maxChars`, cutting the middle with `...`.
 * A string that already fits is returned unchanged. Narrower than the floor
 * still keeps the floor, so a tiny box does not collapse to only the dots.
 */
export function fitAddress(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  const floor = addressFloor(value);
  if (value.length <= floor) return value;
  const chars = Math.max(maxChars, floor);
  const inner = chars - ELLIPSIS.length;
  let head = Math.ceil(inner / 2);
  let tail = inner - head;
  const headFloor = minHead(value);
  if (head < headFloor) {
    head = headFloor;
    tail = inner - head;
  }
  if (tail < MIN_TAIL) {
    tail = MIN_TAIL;
    head = inner - tail;
  }
  if (head + tail >= value.length) return value;
  return `${value.slice(0, head)}${ELLIPSIS}${value.slice(value.length - tail)}`;
}

/** A long id with no spaces, not a URL. Those are the strings the middle cut is for. */
export function isFlexibleId(value: string): boolean {
  if (value.length <= 16) return false;
  if (/\s/.test(value)) return false;
  return !/^https?:\/\//.test(value);
}
