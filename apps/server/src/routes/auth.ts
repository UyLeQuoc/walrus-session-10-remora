/**
 * Wallet sign-in endpoints. The address is always derived from the signature.
 */

import { createSuiClient } from "@remora/memory";
import { type Context, Hono } from "hono";
import { deleteCookie, setCookie } from "hono/cookie";
import { z } from "zod";
import { env } from "../env/load.ts";
import {
  createChallenge,
  personFromSession,
  SESSION_TTL_SECONDS,
  signInWithWallet,
  signOut,
} from "../identity/auth.ts";
import {
  GUEST_COOKIE,
  guestCookie,
  guestHeader,
  LEGACY_SESSION_COOKIE,
  SESSION_COOKIE,
  sessionCookie,
  sessionHeader,
} from "../identity/names.ts";
import { personByChannel } from "../identity/persons.ts";

const verifyBody = z.object({
  nonce: z.string().min(1),
  signature: z.string().min(1),
});

const sui = createSuiClient(env.SUI_NETWORK);

const cookieOptions = {
  httpOnly: true,
  sameSite: "Lax" as const,
  secure: env.WEB_BASE_URL.startsWith("https"),
  path: "/",
};

export const authRoutes = new Hono()
  /** Issue a nonce and the exact message the wallet should sign. */
  .post("/api/auth/challenge", async (c) => {
    const { nonce, message } = await createChallenge();
    return c.json({ nonce, message });
  })

  /**
   * Exchange a signature for a session. `address` is deliberately not accepted:
   * it is recovered from the signature, so a caller cannot nominate one.
   */
  .post("/api/auth/verify", async (c) => {
    const parsed = verifyBody.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) return c.json({ error: "nonce and signature are required" }, 400);
    const body = parsed.data;

    const guestCookie = readGuestId(c);
    const sessionId = readSessionId(c);
    const sessionPerson = sessionId ? await personFromSession(sessionId) : null;
    // The guest is who this browser was before a bad sign-in pointed the
    // session at an empty wallet person. Prefer that id so the memories win.
    const guestPerson = guestCookie ? await personByChannel("web", guestCookie) : null;
    const result = await signInWithWallet(
      body.nonce,
      body.signature,
      guestPerson?.id ?? sessionPerson?.id,
      sui,
    );
    if (!result.ok) {
      return c.json({ error: verifyFailure(result.reason) }, 401);
    }

    setCookie(c, SESSION_COOKIE, result.sessionId, {
      ...cookieOptions,
      maxAge: SESSION_TTL_SECONDS,
    });
    // The guest cookie is left in place; the session takes precedence, and the
    // guest identity stays usable if the person signs out.
    return c.json({
      ok: true,
      mode: result.person.mode,
      address: result.address,
      hadGuestCookie: Boolean(guestCookie),
      // A cross-origin page cannot read the cookie, so it keeps this instead.
      // Same-origin pages ignore it and use the HttpOnly cookie.
      sessionId: result.sessionId,
    });
  })

  .post("/api/auth/signout", async (c) => {
    const sessionId = sessionCookie(c) ?? sessionHeader(c);
    if (sessionId) await signOut(sessionId);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    deleteCookie(c, LEGACY_SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

function readGuestId(c: Context): string | undefined {
  const cookie = guestCookie(c);
  if (cookie) return cookie;
  const header = guestHeader(c);
  return header && /^[0-9a-f-]{36}$/i.test(header) ? header : undefined;
}

function readSessionId(c: Context): string | undefined {
  const cookie = sessionCookie(c);
  if (cookie) return cookie;
  const header = sessionHeader(c);
  return header && /^[0-9a-f]{64}$/i.test(header) ? header : undefined;
}

function verifyFailure(reason: "nonce" | "signature" | "no-account"): string {
  switch (reason) {
    case "signature":
      return "That signature does not match the challenge.";
    case "no-account":
      return "Sign-in could not be saved. Try again.";
    case "nonce":
      return "That sign-in link has expired. Ask for a new one.";
    default: {
      const unexpected: never = reason;
      return unexpected;
    }
  }
}

export { GUEST_COOKIE, SESSION_COOKIE };
