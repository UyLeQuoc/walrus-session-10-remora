/** A same-origin absolute URL as a router path. A foreign origin stays a full navigation. */
export function appPath(url: string, origin: string): string | null {
  let next: URL;
  try {
    next = new URL(url, origin);
  } catch {
    return null;
  }
  if (next.origin !== origin) return null;
  return `${next.pathname}${next.search}${next.hash}`;
}
