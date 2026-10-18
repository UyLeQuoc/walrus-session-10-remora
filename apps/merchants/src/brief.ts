/**
 * E9 `brief`: a paid summary of a text or a public web page. The summarizer is injected (an LLM in
 * `main.ts`); without one, the first sentences stand in. Page fetches only reach public addresses.
 */
import {
  FetchRefused,
  fetchPage,
  type PaidContext,
  type X402Options,
  x402,
} from "@remora/merchant";
import { Hono } from "hono";

export type Summarize = (text: string) => Promise<string>;

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
      if (err instanceof FetchRefused)
        return c.json({ error: { code: err.code, message: err.message } }, 400);
      throw err;
    }
  });
  return app;
}
