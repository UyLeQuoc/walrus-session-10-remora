/**
 * U17 A1 (ADR-0111, ADR-0112): a remora buys another owner's remora's answer, on testnet. Opt in
 * with `ECONOMY=1 bun run --filter @remora/e2e e2e -- --project=economy`. It spends a few cents of
 * testnet USDC.
 *
 * - The burner's Researcher goes on sale as @uy-researcher.
 * - The second test owner (`E2E_BURNER2_KEY`) makes a Researcher, lets it pay @uy-researcher with one
 *   signature, and asks it "ask @uy-researcher …".
 * - The buyer pays the seller's owner, and the seller pays its own source. Each receipt checks out
 *   against Sui.
 *
 * What happened goes to `test-results/economy.json`, for the exit note.
 */
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { expect, type Page, test } from "@playwright/test";
import { burner } from "../support/env";
import { connectAndSignIn, installTestWallet } from "../support/test-wallet";

const SLUG = "uy-researcher";
/** The local server allows 30 requests a minute per address; each step looks like a new client. */
const freshClient = () =>
  `10.33.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const rotate = (page: Page) =>
  page.context().setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });
const results: Record<string, unknown> = { slug: SLUG, at: new Date().toISOString() };

const api = <T>(page: Page, path: string, init: { method?: string; body?: unknown } = {}) =>
  page.evaluate(
    async ({ p, method, body }) => {
      const session = localStorage.getItem("remora.session");
      const res = await fetch(p, {
        method: method ?? "GET",
        credentials: "include",
        headers: {
          "content-type": "application/json",
          "x-remora-network": "testnet",
          ...(session ? { "x-remora-session": session } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      return res.json();
    },
    { p: path, method: init.method, body: init.body },
  ) as Promise<T>;

/** What an earlier test in this file wrote, if it ran. */
const prior = (): Record<string, unknown> => {
  try {
    return JSON.parse(readFileSync("test-results/economy.json", "utf8"));
  } catch {
    return {};
  }
};

function burner2() {
  const raw = process.env.E2E_BURNER2_KEY;
  if (!raw) throw new Error("E2E_BURNER2_KEY is not set (U17's second testnet test owner)");
  return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(raw).secretKey);
}

async function researcher(page: Page, name: string) {
  await rotate(page);
  await page.goto("/remoras/new");
  await page.getByRole("radio", { name: /^Researcher/ }).click();
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Monthly limit (USDC)").fill("0.5");
  await page.getByLabel("Most it pays at once (USDC)").fill("0.025");
  await page.getByRole("button", { name: "Create Researcher" }).click();
  await page.waitForURL(/\/remoras\/[0-9a-f-]{36}/, { timeout: 180_000 });
  const id = /\/remoras\/([0-9a-f-]{36})/.exec(page.url())?.[1] ?? "";
  await rotate(page);
  await page.getByRole("button", { name: "Go live" }).click();
  await expect(page.getByText("active").first()).toBeVisible({ timeout: 30_000 });
  return id;
}

async function retire(page: Page, id: string) {
  await rotate(page);
  await page.goto(`/remoras/${id}`);
  await page.getByRole("tab", { name: "Settings" }).click();
  await page.getByRole("button", { name: "Retire" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Retire" }).click();
  await expect(page.getByText("retired").first()).toBeVisible({ timeout: 90_000 });
}

/** Remoras an earlier run left behind (a stopped run doesn't reach its clean-up), retired first. */
async function retireLeftovers(page: Page, name: string) {
  await rotate(page);
  const { remoras } = await api<{ remoras: { id: string; name: string; status: string }[] }>(
    page,
    "/api/remoras",
  );
  for (const r of remoras ?? [])
    if (r.name === name && r.status !== "retired") await retire(page, r.id);
}

test("economy: a remora buys another owner's remora's answer, and every receipt verifies", async ({
  page,
  browser,
}) => {
  test.setTimeout(20 * 60_000);
  // The seller: the burner's Researcher, on sale.
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  await retireLeftovers(page, "Researcher · sells");
  const seller = await researcher(page, "Researcher · sells");
  results.seller = seller;
  await rotate(page);
  await page.goto(`/remoras/${seller}`);
  const sell = page.getByTestId("sell-card");
  await sell.getByLabel("Its name in the Reef").fill(SLUG);
  await sell.getByLabel("Price per answer, USDC").fill("0.01");
  await sell
    .getByLabel("One line about it")
    .fill("Sui package checks, from a Researcher that pays its own sources");
  await sell.getByRole("button", { name: "Sell its answers" }).click();
  await expect(page.getByTestId("sell-listed")).toContainText(`@${SLUG}`, { timeout: 30_000 });

  // The buyer: another owner, in its own browser.
  const ctx = await browser.newContext();
  const buyerPage = await ctx.newPage();
  await installTestWallet(buyerPage, burner2());
  await buyerPage.goto("/remoras");
  await connectAndSignIn(buyerPage);
  await retireLeftovers(buyerPage, "Researcher · buys");
  const buyer = await researcher(buyerPage, "Researcher · buys");
  results.buyer = buyer;
  await rotate(buyerPage);
  await buyerPage.goto(`/remoras/${buyer}`);
  const buy = buyerPage.getByTestId("buy-from-card");
  const row = buy.getByRole("listitem").filter({ hasText: `@${SLUG}` });
  await row.getByRole("button", { name: "Let it pay" }).click();
  await expect(row.getByText("may pay")).toBeVisible({ timeout: 120_000 });

  // The question, in the buyer's own thread.
  const since = new Date().toISOString();
  const question = `ask @${SLUG} is package 0x2 safe to depend on?`;
  await rotate(buyerPage);
  await buyerPage.goto(`/chat/r/${buyer}`);
  const box = buyerPage.getByLabel("Message");
  await box.fill(question);
  await box.press("Enter");
  const upstream = buyerPage.getByTestId("thread-upstream").first();
  await expect(upstream).toBeVisible({ timeout: 240_000 });

  await rotate(buyerPage);
  type Ev = { type: string; payload: Record<string, unknown>; createdAt: string };
  const { events } = await api<{ events: Ev[] }>(
    buyerPage,
    `/api/feed?remora=${buyer}&after=${encodeURIComponent(since)}&limit=50`,
  );
  const pay = events.find((e) => e.type === "payment");
  expect(pay, "the buyer paid the seller").toBeTruthy();
  const p = pay?.payload as {
    payee: string;
    amount: string;
    digest: string;
    upstream: { payee: string; amount: string; digest: string }[];
  };
  expect(p.payee).toBe(`reef:remora-${SLUG}`);
  expect(p.upstream.length, "the seller paid its own source").toBeGreaterThanOrEqual(1);
  results.question = question;
  results.buyerPaid = { payee: p.payee, amount: p.amount, digest: p.digest };
  results.sellerPaid = p.upstream;

  // Every receipt in the chain checks out against Sui: the buyer's, by its owner; the seller's, by
  // the seller's owner.
  const check = async (on: Page, digest: string) => {
    const v = await api<{ found: boolean; checks: { name: string; ok: boolean }[] }>(
      on,
      `/api/verify/${digest}`,
    );
    return v.found && v.checks.every((c) => c.ok);
  };
  expect(await check(buyerPage, p.digest), `buyer ${p.digest}`).toBe(true);
  for (const u of p.upstream) expect(await check(page, u.digest), `seller ${u.digest}`).toBe(true);

  // The seller's page shows the sale, with the buyer's digest.
  await rotate(page);
  await page.goto(`/remoras/${seller}`);
  await expect(page.getByTestId("sell-sold")).toContainText("1 sold", { timeout: 30_000 });
  const sale = await api<{ sold: { digest: string | null }[]; earned: string }>(
    page,
    `/api/remoras/${seller}/sell`,
  );
  expect(sale.sold[0]?.digest).toBe(p.digest);
  results.earned = sale.earned;

  // Leave nothing running: retire both (each owner signs its own revoke).
  if (process.env.ECONOMY_KEEP !== "1") {
    await retire(buyerPage, buyer);
    await retire(page, seller);
  }
  await ctx.close();
  writeFileSync("test-results/economy.json", JSON.stringify(results, null, 2));
});

test("economy: an owner lists an API, and a remora buys it once through the public facilitator", async ({
  page,
}) => {
  test.setTimeout(15 * 60_000);
  // examples/sell-an-api, paid to the second test owner, settling through this server's public
  // facilitator (/api/facilitator, ADR-0113).
  const payTo = burner2().toSuiAddress();
  const shop = spawn("npx", ["tsx", "examples/sell-an-api/src/main.ts"], {
    cwd: resolve(import.meta.dirname, "../.."),
    env: {
      ...process.env,
      PAY_TO: payTo,
      FACILITATOR_URL: "http://localhost:8797/api/facilitator",
      PORT: "8790",
    },
    stdio: "ignore",
  });
  try {
    await expect
      .poll(
        async () => (await fetch("http://localhost:8790/haiku").catch(() => null))?.status ?? 0,
        { timeout: 60_000 },
      )
      .toBe(402);
    await installTestWallet(page, burner());
    await page.goto("/remoras");
    await connectAndSignIn(page);
    await retireLeftovers(page, "Researcher · buys an API");
    const buyer = await researcher(page, "Researcher · buys an API");

    // List it: the server reads its 402, the owner signs what was found.
    await rotate(page);
    await page.goto("/reef/new");
    const form = page.getByTestId("list-api");
    await form.getByLabel("Its URL").fill("http://localhost:8790/haiku");
    await form.getByLabel("Its name in the Reef").fill("haiku");
    await form.getByLabel("One line about it").fill("A haiku about your question");
    await form.getByRole("button", { name: "Check it" }).click();
    await expect(page.getByTestId("list-api-found")).toContainText("0.005 USDC", {
      timeout: 30_000,
    });
    await form.getByRole("button", { name: "Sign and list" }).click();
    await expect(page.getByTestId("list-api-done")).toBeVisible({ timeout: 30_000 });

    // Let the Researcher pay it (one signature), then buy once.
    await rotate(page);
    await page.goto(`/remoras/${buyer}`);
    const row = page
      .getByTestId("buy-from-card")
      .getByRole("listitem")
      .filter({ hasText: "@haiku" });
    await row.getByRole("button", { name: "Let it pay" }).click();
    await expect(row.getByText("may pay")).toBeVisible({ timeout: 120_000 });
    const since = new Date().toISOString();
    await rotate(page);
    await page.goto(`/chat/r/${buyer}`);
    await page.getByLabel("Message").fill("ask @haiku walrus memory");
    await page.getByLabel("Message").press("Enter");
    type Ev = { type: string; payload: Record<string, unknown> };
    let pay: Ev | undefined;
    await expect
      .poll(
        async () => {
          await rotate(page);
          const { events } = await api<{ events: Ev[] }>(
            page,
            `/api/feed?remora=${buyer}&after=${encodeURIComponent(since)}&limit=50`,
          );
          pay = events.find((e) => e.type === "payment");
          return pay ? "paid" : (events.find((e) => e.type === "blocked")?.payload.code ?? "");
        },
        { timeout: 240_000, intervals: [4_000] },
      )
      .toBe("paid");
    const p = pay?.payload as { payee: string; amount: string; digest: string };
    expect(p.payee).toBe("reef:community-haiku");
    const v = await api<{ found: boolean; checks: { ok: boolean }[] }>(
      page,
      `/api/verify/${p.digest}`,
    );
    expect(v.found && v.checks.every((c) => c.ok), p.digest).toBe(true);
    const listed = prior();
    writeFileSync(
      "test-results/economy.json",
      JSON.stringify(
        { ...listed, api: { url: "http://localhost:8790/haiku", payTo, paid: p } },
        null,
        2,
      ),
    );
    if (process.env.ECONOMY_KEEP !== "1") await retire(page, buyer);
  } finally {
    shop.kill();
  }
});

test("economy: a crew's lead splits one question across three members, three receipts", async ({
  page,
}) => {
  test.setTimeout(20 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  for (const name of ["Crew lead", "Onchain", "Markets", "Code"]) await retireLeftovers(page, name);

  // One signature makes all four (ADR-0114).
  await rotate(page);
  await page.goto("/remoras/import");
  await page
    .getByRole("textbox", { name: "Team file" })
    .fill(
      readFileSync(resolve(import.meta.dirname, "../seed/templates/11-research-crew.md"), "utf8"),
    );
  await page.getByRole("button", { name: "Preview" }).click();
  await page.getByRole("button", { name: /Create the team/ }).click();
  await page.waitForURL(/\/chat\/room\//, { timeout: 240_000 });

  await rotate(page);
  const { remoras } = await api<{
    remoras: { id: string; name: string; status: string; config: { crew?: { leadId: string } } }[];
  }>(page, "/api/remoras");
  const crew = remoras.filter((r) => r.config.crew && r.status !== "retired");
  expect(crew.map((r) => r.name).sort()).toEqual(["Code", "Crew lead", "Markets", "Onchain"]);
  const lead = crew.find((r) => r.name === "Crew lead");
  for (const r of crew) {
    await rotate(page);
    await api(page, `/api/remoras/${r.id}/activate`, { method: "POST" });
  }

  const since = new Date().toISOString();
  const question =
    "Is package 0x2 safe, what's SUI worth, and how healthy is https://github.com/MystenLabs/walrus?";
  await rotate(page);
  await page.goto(`/chat/r/${lead?.id}`);
  await page.getByLabel("Message").fill(question);
  await page.getByLabel("Message").press("Enter");
  type Ev = { type: string; payload: Record<string, unknown> };
  let answer: Ev | undefined;
  await expect
    .poll(
      async () => {
        await rotate(page);
        const { events } = await api<{ events: Ev[] }>(
          page,
          `/api/feed?remora=${lead?.id}&after=${encodeURIComponent(since)}&limit=50`,
        );
        answer = events.find((e) => e.type === "answer");
        return Boolean(answer);
      },
      { timeout: 300_000, intervals: [5_000] },
    )
    .toBe(true);
  const receipts = (answer?.payload.crew ?? []) as {
    member: string;
    payee: string;
    amount: string;
    digest: string;
  }[];
  expect(receipts.map((r) => `${r.member} ${r.payee}`).sort()).toEqual([
    "Code reef:github",
    "Markets reef:price",
    "Onchain reef:sui-risk",
  ]);
  for (const r of receipts) {
    const v = await api<{ found: boolean; checks: { ok: boolean }[] }>(
      page,
      `/api/verify/${r.digest}`,
    );
    expect(v.found && v.checks.every((c) => c.ok), `${r.member} ${r.digest}`).toBe(true);
  }
  const listed = prior();
  writeFileSync(
    "test-results/economy.json",
    JSON.stringify({ ...listed, crew: { question, lead: lead?.id, receipts } }, null, 2),
  );

  // The crew page sums the spend; one signature retires all four.
  await rotate(page);
  await page.goto(`/remoras/${lead?.id}`);
  await expect(page.getByTestId("crew-card")).toContainText("Onchain", { timeout: 30_000 });
  if (process.env.ECONOMY_KEEP !== "1") {
    await page.getByRole("button", { name: /Retire the crew/ }).click();
    await expect(page.getByTestId("crew-card")).toContainText("retired", { timeout: 120_000 });
  }
});
