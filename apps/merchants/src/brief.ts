/**
 * E9 `brief`: a paid summary of a text or a public web page. The summarizer is injected (an LLM in
 * `main.ts`); without one, the first sentences stand in. Page fetches only reach public addresses.
 */
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { type PaidContext, type X402Options, x402 } from "@remora/merchant";
import { Hono } from "hono";

export type Summarize = (text: string) => Promise<string>;

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

export class BriefError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Fetches a public page as text: http(s) only, public addresses only, no redirects, size-capped. */
export async function fetchPage(
  url: string,
  o: { fetch?: typeof fetch; resolve?: (host: string) => Promise<string[]> } = {},
): Promise<string> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new BriefError("bad_url", "That isn't a URL.");
  }
  if (u.protocol !== "http:" && u.protocol !== "https:")
    throw new BriefError("bad_url", "Only http and https pages.");
  const host = u.hostname.replace(/^\[|\]$/g, "");
  const resolve =
    o.resolve ?? (async (h: string) => (await lookup(h, { all: true })).map((a) => a.address));
  const addresses = isIP(host) ? [host] : await resolve(host).catch(() => []);
  if (!addresses.length) throw new BriefError("unreachable", "That host doesn't resolve.");
  if (addresses.some(isPrivateAddress))
    throw new BriefError("private_address", "Only public pages can be summarized.");
  const res = await (o.fetch ?? fetch)(u, {
    redirect: "manual",
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new BriefError("unreachable", `The page answered ${res.status}.`);
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

/** The fallback summary: the first three sentences. */
export const firstSentences = async (text: string) =>
  (text.match(/[^.!?]+[.!?]+/g) ?? [text])
    .slice(0, 3)
    .map((x) => x.trim())
    .join(" ")
    .slice(0, 600);

export function createBriefApp(o: {
  pay: X402Options;
  summarize?: Summarize;
  fetch?: typeof fetch;
  resolve?: (host: string) => Promise<string[]>;
}) {
  const summarize = o.summarize ?? firstSentences;
  const app = new Hono<{ Variables: { x402: PaidContext } }>();
  // Cheap checks before the payment, so a bad request costs nothing.
  app.use("/brief", async (c, next) => {
    const url = c.req.query("url");
    if (!url && !c.req.query("text")?.trim())
      return c.json({ error: { code: "empty", message: "Pass ?url= or ?text=." } }, 400);
    if (url && !/^https?:\/\//i.test(url))
      return c.json({ error: { code: "bad_url", message: "Only http and https pages." } }, 400);
    await next();
  });
  app.get("/brief", x402(o.pay), async (c) => {
    const url = c.req.query("url");
    const given = c.req.query("text");
    try {
      const text = url
        ? await fetchPage(url, {
            ...(o.fetch ? { fetch: o.fetch } : {}),
            ...(o.resolve ? { resolve: o.resolve } : {}),
          })
        : (given ?? "");
      if (!text.trim())
        return c.json({ error: { code: "empty", message: "Nothing to summarize." } }, 400);
      const summary = await summarize(text.slice(0, 20_000)).catch(() => firstSentences(text));
      return c.json({ summary, source: url ?? "text", paid: c.get("x402") });
    } catch (err) {
      if (err instanceof BriefError)
        return c.json({ error: { code: err.code, message: err.message } }, 400);
      throw err;
    }
  });
  return app;
}
