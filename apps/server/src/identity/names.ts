/**
 * Cookie and header names for identity (Huấn's handoff, ADR-0044). Remora names are written; the
 * hippo names are still read for one release so existing sessions and cross-origin clients keep
 * working, then they go.
 */
import type { Context } from "hono";
import { getCookie } from "hono/cookie";

export const SESSION_COOKIE = "remora_session";
export const GUEST_COOKIE = "remora_guest";
export const LEGACY_SESSION_COOKIE = "hippo_session";
export const LEGACY_GUEST_COOKIE = "hippo_guest";
export const SESSION_HEADER = "x-remora-session";
export const GUEST_HEADER = "x-remora-guest";
export const CHANNEL_HEADER = "x-remora-channel";

/** CORS: the Remora headers and, for one release, the hippo ones. */
export const IDENTITY_HEADERS = [
  CHANNEL_HEADER,
  GUEST_HEADER,
  SESSION_HEADER,
  "x-hippo-channel",
  "x-hippo-guest",
  "x-hippo-session",
];

export const sessionCookie = (c: Context) =>
  getCookie(c, SESSION_COOKIE) ?? getCookie(c, LEGACY_SESSION_COOKIE);
export const guestCookie = (c: Context) =>
  getCookie(c, GUEST_COOKIE) ?? getCookie(c, LEGACY_GUEST_COOKIE);
/** True when the guest id still rides on the old cookie and should be re-set under the new name. */
export const legacyGuestOnly = (c: Context) =>
  !getCookie(c, GUEST_COOKIE) && !!getCookie(c, LEGACY_GUEST_COOKIE);
export const sessionHeader = (c: Context) =>
  c.req.header(SESSION_HEADER) ?? c.req.header("x-hippo-session");
export const guestHeader = (c: Context) =>
  c.req.header(GUEST_HEADER) ?? c.req.header("x-hippo-guest");
export const channelHeader = (c: Context) =>
  c.req.header(CHANNEL_HEADER) ?? c.req.header("x-hippo-channel");
