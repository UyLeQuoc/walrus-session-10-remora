/**
 * Fetching a URL that untrusted text named (a remora's `web.fetch`, the `brief` merchant): http(s)
 * only, every resolved address public, no redirects, a timeout and a size cap. DNS can still change
 * between the lookup and the fetch; pin the address where that matters (ADR-0031).
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 200_000;

/** True for loopback, private, link-local, CGNAT and unique-local addresses. */
export function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const [a = 0, b = 0] = ip.split(".").map(Number);
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

export class FetchRefused extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type Resolve = (host: string) => Promise<string[]>;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

/** Every address `host` resolves to, or a refusal when there are none or one is private. */
async function publicAddresses(host: string, resolve: Resolve | undefined, refusal: string) {
  const lookupAll =
    resolve ?? (async (h: string) => (await lookup(h, { all: true })).map((a) => a.address));
  const addresses = isIP(host) ? [host] : await lookupAll(host).catch(() => []);
  if (!addresses.length) throw new FetchRefused("unreachable", "That host doesn't resolve.");
  if (addresses.some(isPrivateAddress)) throw new FetchRefused("private_address", refusal);
  return addresses;
}

/**
 * ADR-0143: one request to a URL an owner configured (an MCP server): https only, no credentials in
 * the URL, every resolved address public, no redirects. `allowLocal` (development only, never in
 * production) also lets it reach localhost, over http or https. The caller sets the timeout.
 */
export async function safeFetch(
  url: string,
  init: RequestInit,
  o: { fetch?: typeof fetch; resolve?: Resolve; allowLocal?: boolean } = {},
): Promise<Response> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new FetchRefused("bad_url", "That isn't a URL.");
  }
  if (u.username || u.password)
    throw new FetchRefused("bad_url", "Leave credentials out of the URL.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const local = !!o.allowLocal && LOOPBACK_HOSTS.has(host);
  if (u.protocol !== "https:" && !(local && u.protocol === "http:"))
    throw new FetchRefused("bad_url", "Only https URLs.");
  if (!local && (host === "localhost" || host.endsWith(".localhost")))
    throw new FetchRefused("private_address", "Only public servers can be reached.");
  if (!local) await publicAddresses(host, o.resolve, "Only public servers can be reached.");
  return (o.fetch ?? fetch)(u, { ...init, redirect: "manual" });
}

/** Fetches a public page as text: http(s) only, public addresses only, no redirects, size-capped. */
export async function fetchPage(
  url: string,
  o: { fetch?: typeof fetch; resolve?: Resolve } = {},
): Promise<string> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new FetchRefused("bad_url", "That isn't a URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new FetchRefused("bad_url", "Only http and https pages.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  await publicAddresses(host, o.resolve, "Only public pages can be summarized.");
  const res = await (o.fetch ?? fetch)(u, {
    redirect: "manual",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new FetchRefused("unreachable", `The page answered ${res.status}.`);
  const body = (await res.text()).slice(0, MAX_BYTES);
  return textOf(body);
}

/** Visible text of an HTML page (or the input when it isn't HTML). */
export function textOf(html: string): string {
  return html
    .replace(/<(script|style|noscript)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}
