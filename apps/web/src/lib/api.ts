/**
 * Where the API is, and how this page identifies itself to it.
 *
 * Same-origin is the good case: `apps/web/vercel.json` rewrites `/api/*` to the
 * server, and the session rides on an `HttpOnly` cookie. The stored session is
 * still sent, because sign-in writes the wallet onto the person before the
 * cookie is guaranteed to stick: a `Secure` cookie is dropped on http, and
 * `/api/me` would then show the address while `signedIn` stays false.
 *
 * Cross-origin is the case that makes the UI portable, Walrus Sites in
 * particular, where nothing can proxy. A `SameSite=Lax` cookie is not sent
 * cross-site, so the page keeps its own opaque id and sends it in a header. A
 * header is never attached by the browser on its own, so this cannot be abused
 * for CSRF, unlike loosening the cookie to `SameSite=None`. The cost is that
 * the id sits in `localStorage` instead of an `HttpOnly` cookie.
 */
export const API_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? "";

export const isSameOrigin = API_URL === "" || API_URL.startsWith(window.location.origin);

const GUEST_KEY = "hippo.guest";
const SESSION_KEY = "hippo.session";

function stored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Private browsing, or storage disabled. The session simply will not
    // persist across reloads, which is better than failing to answer at all.
  }
}

function guestId(): string {
  const existing = stored(GUEST_KEY);
  if (existing) return existing;
  const fresh = crypto.randomUUID();
  store(GUEST_KEY, fresh);
  return fresh;
}

export function rememberSession(sessionId: string): void {
  store(SESSION_KEY, sessionId);
}

export function forgetSession(): void {
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch {
    // Nothing to do; the server has already invalidated it.
  }
}

/** Headers that carry identity when the cookie cannot. The guest id is cross-origin only. */
export function identityHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (!isSameOrigin) headers["x-hippo-guest"] = guestId();
  const session = stored(SESSION_KEY);
  if (session) headers["x-hippo-session"] = session;
  return headers;
}

export function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  for (const [key, value] of Object.entries(identityHeaders())) {
    if (!headers.has(key)) headers.set(key, value);
  }
  return fetch(`${API_URL}${path}`, { ...init, credentials: "include", headers });
}

export async function errorMessage(res: Response, fallback: string): Promise<string> {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? fallback;
}
