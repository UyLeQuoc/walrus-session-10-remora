/**
 * B4: which sidebar item is lit. Home is the dashboard, so it stays lit on `/` and on every
 * `/remoras*` route (there is no separate Remoras item) and nowhere else. Every other item matches
 * its own path and its subpaths, so exactly one item is active per route.
 */
export function navActive(to: string, pathname: string): boolean {
  if (to === "/")
    return pathname === "/" || pathname === "/remoras" || pathname.startsWith("/remoras/");
  return pathname === to || pathname.startsWith(`${to}/`);
}
