/**
 * Every example the app suggests, run once on testnet (ADR-0105). Opt in with
 * `EXAMPLES=1 bun run --filter @remora/e2e e2e -- --project=examples`. It spends a few cents of
 * testnet USDC: two playground sessions and the Researcher's paid questions.
 *
 * - **Chat:** each card is clicked where a person would click it. A memory or command card fills
 *   `/chat`'s box and gets an answer. A Researcher or Wallet watcher card opens that remora's own
 *   thread, filled in, and does what it says there: a Researcher pays (or asks first, over its
 *   cap), and a Wallet watcher learns the rule.
 * - **Playground:** each suggestion is asked, and pays the service it names, or nothing.
 *
 * What each example did goes to `test-results/examples.json`, for the exit note.
 */
import { writeFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";
import { burner } from "../support/env";
import { connectAndSignIn, installTestWallet } from "../support/test-wallet";

type Event = { type: string; payload: Record<string, unknown> | null; createdAt: string };
const results: Record<string, unknown> = {};
const freshClient = () =>
  `10.32.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;

const api = <T>(page: Page, path: string): Promise<T> =>
  page.evaluate(async (p) => {
    const session = localStorage.getItem("remora.session");
    const res = await fetch(p, {
      credentials: "include",
      headers: {
        "x-remora-network": "testnet",
        ...(session ? { "x-remora-session": session } : {}),
      },
    });
    return res.json();
  }, path) as Promise<T>;

/** Polls the remora's feed until an event of one of `types` lands after `since`. */
async function next(page: Page, remoraId: string, since: string, types: string[], ms = 180_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const { events } = await api<{ events: Event[] }>(
      page,
      `/api/feed?remora=${remoraId}&after=${encodeURIComponent(since)}&limit=50`,
    );
    const hit = (events ?? []).find((e) => types.includes(e.type));
    if (hit) return hit;
    await page.waitForTimeout(4_000);
  }
  throw new Error(`no ${types.join("/")} event from ${remoraId} after ${since}`);
}

/** An empty chat: `/chat` reopens the last conversation, so start a new one when it does. */
async function emptyChat(page: Page) {
  await page.goto("/chat");
  const list = page.getByRole("list", { name: "Examples" });
  const shown = await list
    .waitFor({ state: "visible", timeout: 5_000 })
    .then(() => true)
    .catch(() => false);
  if (!shown) await page.getByRole("button", { name: "New chat" }).first().click();
  await expect(list).toBeVisible({ timeout: 30_000 });
  return list;
}

/** Every card the empty chat deals, with its kind, read the way a person sees them. */
async function deck(page: Page) {
  const list = await emptyChat(page);
  const seen = new Map<string, string>();
  for (let round = 0; round < 6; round++) {
    const cards = list.locator("[data-slot=example]");
    for (const c of await cards.all())
      seen.set(
        (await c.locator("span.text-sm").textContent()) ?? "",
        (await c.getAttribute("data-kind")) ?? "",
      );
    const more = page.getByRole("button", { name: /More ideas/ });
    if (!(await more.count())) break;
    await more.click();
  }
  return [...seen].map(([text, kind]) => ({ text, kind }));
}

/**
 * Deals until the card with this text shows, and returns it. Each example counts as its own client
 * (`x-forwarded-for`), as demo.spec's and u13's shots do, so the feed polling never trips the local
 * server's per-address limit (30 a minute).
 */
async function card(page: Page, text: string) {
  await page.context().setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });
  const list = await emptyChat(page);
  for (let round = 0; round < 6; round++) {
    const hit = list.locator("[data-slot=example]").filter({ hasText: text });
    if (await hit.count()) return hit.first();
    await page.getByRole("button", { name: /More ideas/ }).click();
  }
  throw new Error(`no example card "${text}"`);
}

/** lib/payee.ts's names, back to the Reef refs a payment records. */
const SERVICE: Record<string, string> = {
  "Sui risk check": "reef:sui-risk",
  Odds: "reef:odds",
  Brief: "reef:brief",
};

test("examples: every suggestion in the chat and the playground does what it says", async ({
  page,
  browser,
}) => {
  test.setTimeout(40 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/chat");
  await connectAndSignIn(page);

  // 0. A Researcher with a live limit for the cards to open. The suite's global setup revokes the
  // burner's leftover limits, so an older Researcher reads "can't spend" (as demo.spec does).
  await page.goto("/remoras/new");
  await page.getByRole("radio", { name: /^Researcher/ }).click();
  await page.getByLabel("Name").fill("Researcher · examples");
  await page.getByLabel("Monthly limit (USDC)").fill("0.5");
  await page.getByLabel("Most it pays at once (USDC)").fill("0.025");
  await page.getByRole("button", { name: "Create Researcher" }).click();
  await page.waitForURL(/\/remoras\/[0-9a-f-]{36}/, { timeout: 180_000 });
  results.researcher = /\/remoras\/([0-9a-f-]{36})/.exec(page.url())?.[1];
  await page.getByRole("button", { name: "Go live" }).click();
  await expect(page.getByText("active").first()).toBeVisible({ timeout: 30_000 });

  // 1. The chat's cards. The burner has a live Researcher and a Wallet watcher, so all four kinds deal.
  const pool = await deck(page);
  results.chatCards = pool;
  expect(new Set(pool.map((e) => e.kind))).toEqual(
    new Set(["pays", "learns", "remembers", "proves"]),
  );
  for (const e of pool) {
    const since = new Date(Date.now() - 1_000).toISOString();
    const chatReply = () =>
      page.waitForResponse(
        (r) => r.url().endsWith("/api/chat") && r.request().method() === "POST",
        { timeout: 120_000 },
      );
    if (e.text.startsWith("Reload")) {
      // The page reloads with the question in the box; sent from a page with no history, the
      // answer has to come back from Walrus.
      await (await card(page, e.text)).click();
      await page.waitForLoadState("load");
      const box = page.getByLabel("Ask your remora");
      await expect(box).toHaveValue("What do you remember about me?", { timeout: 30_000 });
      const reply = chatReply();
      await box.press("Enter");
      const res = await reply;
      expect(res.status(), e.text).toBe(200);
      await res.finished();
      results[e.text] = { answered: true };
      continue;
    }
    if (e.kind === "proves") {
      // A command card runs its command at once.
      const reply = chatReply();
      await (await card(page, e.text)).click();
      const res = await reply;
      expect(res.status(), e.text).toBe(200);
      await res.finished();
      results[e.text] = { answered: true, sent: JSON.parse(res.request().postData() ?? "{}") };
      continue;
    }
    await (await card(page, e.text)).click();
    if (e.kind === "remembers") {
      const box = page.getByLabel("Ask your remora");
      const sent = await box.inputValue();
      expect(sent, e.text).toBe(e.text);
      const reply = chatReply();
      await box.press("Enter");
      const res = await reply;
      expect(res.status(), e.text).toBe(200);
      await res.finished();
      results[e.text] = { answered: true, sent };
      continue;
    }
    // A remora's card opens its thread, filled in; Enter sends it there.
    await page.waitForURL(/\/chat\/r\/[0-9a-f-]{36}/, { timeout: 30_000 });
    const remoraId = /\/chat\/r\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
    if (e.kind === "pays") expect(remoraId, "the newest live Researcher").toBe(results.researcher);
    const box = page.getByLabel("Message");
    await expect(box).toHaveValue(e.text);
    await expect(box).toBeEnabled({ timeout: 30_000 });
    await box.press("Enter");
    if (e.kind === "learns") {
      const learned = await next(page, remoraId, since, ["rule_learned"]);
      results[e.text] = { remora: remoraId, rule: learned.payload };
      continue;
    }
    // A Researcher pays within its cap, or asks you first over it; both are what the card says.
    const ev = await next(page, remoraId, since, ["payment", "approval_needed"]);
    results[e.text] = {
      remora: remoraId,
      event: ev.type,
      payee: ev.payload?.payee ?? null,
      amount: ev.payload?.amount ?? null,
    };
  }

  // 2. The playground's suggestions, two questions a session (as a fresh visitor each time).
  const session = async () => {
    const ctx = await browser.newContext();
    await ctx.setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });
    const visitor = await ctx.newPage();
    await visitor.goto("/playground");
    await visitor.getByRole("button", { name: /Start my Researcher/ }).click();
    await expect(visitor.getByTestId("playground-spent")).toHaveText("0.00 of 1.00 USDC", {
      timeout: 120_000,
    });
    return { ctx, visitor };
  };
  let open = await session();
  const suggestions = await Promise.all(
    (
      await open.visitor.getByRole("list", { name: "Questions to try" }).getByRole("button").all()
    ).map(async (b) => ({
      label: (await b.locator("span.text-xs").textContent()) ?? "",
      text: (await b.locator("span.text-sm").textContent()) ?? "",
    })),
  );
  results.playgroundCards = suggestions;
  expect(suggestions.length).toBeGreaterThanOrEqual(4);
  for (let i = 0; i < suggestions.length; i += 2) {
    if (i > 0) open = await session();
    const { ctx, visitor } = open;
    for (const q of suggestions.slice(i, i + 2)) {
      await visitor
        .getByRole("list", { name: "Questions to try" })
        .getByRole("button")
        .filter({ hasText: q.text })
        .click();
      await expect(visitor.getByLabel("Your question")).toHaveValue(q.text);
      const answered = visitor.waitForResponse(
        (r) => r.url().endsWith("/api/playground/ask") && r.request().method() === "POST",
        { timeout: 240_000 },
      );
      await visitor.getByRole("button", { name: /Ask Researcher/ }).click();
      const res = await answered;
      expect(res.status(), q.text).toBe(200);
      const body = (await res.json()) as {
        session: { answers: { question: string; paid: { payee: string; amountUsdc: string }[] }[] };
      };
      const paid = body.session.answers.find((a) => a.question === q.text)?.paid ?? [];
      results[`playground: ${q.text}`] = { label: q.label, paid };
      const service = Object.entries(SERVICE).find(([name]) => q.label.startsWith(name))?.[1];
      if (service)
        expect(
          paid.map((p) => p.payee),
          q.text,
        ).toContain(service);
      else expect(paid, q.text).toEqual([]);
    }
    await ctx.close();
  }
  // Clean up: retire the Researcher this run made (the owner signs its revoke), so runs don't pile up.
  await page.goto(`/remoras/${results.researcher}`);
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Retire" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Retire" }).click();
  await expect(page.getByText("retired").first()).toBeVisible({ timeout: 90_000 });
  writeFileSync("test-results/examples.json", JSON.stringify(results, null, 2));
});
