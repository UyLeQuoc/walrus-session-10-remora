/**
 * U18 (ADR-0119): the goal's exits on testnet, against the local stack. Opt in with
 * `U18=1 bun run --filter @remora/e2e e2e -- --project=u18`. It spends well under 1 testnet USDC.
 *
 * - A1: a Researcher with a tight limit spends most of it, proposes a raise citing its memories, and
 *   the owner accepts with one signature; the new limit is read back from Sui.
 * - B1: an Errand pays a contact (burner2, as "Linh") with a memo; 3x the usual asks first and the
 *   owner's yes lets it pay; over its cap it asks the owner to pay once.
 * - B4: burner2, signed out, buys one answer from the Researcher's public page with its own wallet.
 *
 * What happened goes to `exit-results/u18.json` (gitignored), for the exit note.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { decodeSuiPrivateKey } from "@mysten/sui/cryptography";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { normalizeSuiAddress } from "@mysten/sui/utils";
import { expect, type Page, test } from "@playwright/test";
import { burner, testnet } from "../support/env";
import { connectAndSignIn, installTestWallet, WALLET_NAME } from "../support/test-wallet";

// Playwright clears test-results/ on every run; one test reads what an earlier run wrote.
const OUT = "exit-results/u18.json";
mkdirSync("exit-results", { recursive: true });
const SLUG = "u18-researcher";
const freshClient = () =>
  `10.18.${Math.floor(Math.random() * 250)}.${Math.floor(Math.random() * 250)}`;
const rotate = (page: Page) =>
  page.context().setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });

const prior = (): Record<string, unknown> => {
  try {
    return JSON.parse(readFileSync(OUT, "utf8"));
  } catch {
    return {};
  }
};
const save = (patch: Record<string, unknown>) =>
  writeFileSync(
    OUT,
    JSON.stringify({ ...prior(), ...patch, at: new Date().toISOString() }, null, 2),
  );

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

function burner2() {
  const raw = process.env.E2E_BURNER2_KEY;
  if (!raw) throw new Error("E2E_BURNER2_KEY is not set");
  return Ed25519Keypair.fromSecretKey(decodeSuiPrivateKey(raw).secretKey);
}

async function create(
  page: Page,
  o: { kind: RegExp; name: string; monthly: string; cap: string; people?: string },
) {
  await rotate(page);
  await page.goto("/remoras/new");
  await page.getByRole("radio", { name: o.kind }).click();
  await page.getByRole("textbox", { name: "Name" }).fill(o.name);
  await page.getByLabel("Monthly limit (USDC)").fill(o.monthly);
  await page.getByLabel("Most it pays at once (USDC)").fill(o.cap);
  if (o.people) await page.getByLabel("Who it may pay").fill(o.people);
  await page.getByRole("button", { name: /^Create / }).click();
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

async function retireLeftovers(page: Page, names: string[]) {
  await rotate(page);
  const { remoras } = await api<{ remoras: { id: string; name: string; status: string }[] }>(
    page,
    "/api/remoras",
  );
  for (const r of remoras ?? [])
    if (names.includes(r.name) && r.status !== "retired") await retire(page, r.id);
}

const verified = async (page: Page, digest: string) => {
  const v = await api<{ found: boolean; checks: { ok: boolean }[] }>(page, `/api/verify/${digest}`);
  return v.found && v.checks.every((c) => c.ok);
};

test.describe.configure({ mode: "serial" });

test("A1: a remora proposes its own budget, citing memories, and one signature accepts it", async ({
  page,
}) => {
  test.setTimeout(15 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  await retireLeftovers(page, ["Researcher · u18", "Errand · u18"]);
  const id = await create(page, {
    kind: /^Researcher/,
    name: "Researcher · u18",
    monthly: "0.03",
    cap: "0.01",
  });
  save({ researcher: id });
  // One question that buys three services spends about 0.025 of its 0.03.
  await rotate(page);
  await page.goto(`/remoras/${id}`);
  await page
    .getByLabel("Question")
    .first()
    .fill(
      "Is package 0x2 safe to depend on, what's SUI worth, and how healthy is https://github.com/MystenLabs/walrus?",
    );
  await page.getByRole("button", { name: "Ask", exact: true }).click();
  await expect(page.getByTestId("answer")).toBeVisible({ timeout: 240_000 });

  // Its Wakes land in Walrus Memory in about 24 s; then a check proposes, citing them.
  type Open = { summary: string; cites: { blobId: string; label: string }[]; id: string };
  let open = null as Open | null;
  let skipped = "";
  for (let i = 0; i < 16 && !open; i++) {
    await page.waitForTimeout(15_000);
    await rotate(page);
    const out: { open: Open | null; skipped?: string } = await api(
      page,
      `/api/remoras/${id}/proposals/check`,
      { method: "POST" },
    );
    open = out.open;
    skipped = out.skipped ?? "";
  }
  expect(open, `no proposal (last: ${skipped})`).toBeTruthy();
  expect(open?.summary).toMatch(/^Raise its monthly limit 0\.03 → /);
  expect(open?.cites.length).toBeGreaterThanOrEqual(1);

  await rotate(page);
  await page.goto(`/remoras/${id}?proposal=${open?.id}`);
  const card = page.getByTestId("proposal-card");
  await expect(card.getByTestId("proposal-summary")).toHaveText(open?.summary ?? "");
  await expect(card.getByTestId("proposal-cite").first()).toBeVisible();
  await card.getByTestId("proposal-accept").click();
  await expect(card.getByTestId("proposal-past").first()).toContainText("accepted", {
    timeout: 120_000,
  });
  const after = await api<{ recent: { digest?: string; to: { windowLimit: string } }[] }>(
    page,
    `/api/remoras/${id}/proposals`,
  );
  const accepted = after.recent[0];
  // The new limit, read back from the allowance on Sui.
  const { meter } = await api<{ meter: { window: { limit: string } | null } }>(
    page,
    `/api/remoras/${id}/budget`,
  );
  expect(meter.window?.limit).toBe(accepted?.to.windowLimit);
  save({
    a1: {
      proposal: open?.summary,
      cites: open?.cites,
      digest: accepted?.digest,
      newLimit: meter.window?.limit,
    },
  });
});

test("B1: an Errand pays a contact with a memo, asks before 3x the usual, and asks over its cap", async ({
  page,
}) => {
  test.setTimeout(15 * 60_000);
  const linh = burner2().toSuiAddress();
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  const id = await create(page, {
    kind: /^Errand/,
    name: "Errand · u18",
    monthly: "2",
    cap: "0.5",
    people: `Linh ${linh}`,
  });
  save({ errand: id });
  const pay = async (text: string) => {
    await rotate(page);
    return api<{ answer: string; outcome: string; digest?: string; approvalId?: string }>(
      page,
      `/api/remoras/${id}/ask`,
      { method: "POST", body: { question: text } },
    );
  };
  const client = testnet();
  const usdc = async () =>
    BigInt(
      (
        await client.core.getBalance({
          owner: linh,
          coinType:
            "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC",
        })
      ).balance.balance,
    );
  const before = await usdc();

  const lunch = await pay("pay Linh 0.10 USDC for lunch");
  expect(lunch.outcome, lunch.answer).toBe("paid");
  expect(lunch.answer).toBe("Paid Linh 0.10 USDC for lunch.");
  expect(await verified(page, lunch.digest as string)).toBe(true);

  const big = await pay("pay Linh 0.30 USDC for dinner");
  expect(big.outcome, big.answer).toBe("unusual");
  // The owner's yes in Approvals lets it pay from its own limit.
  await rotate(page);
  await page.goto("/approvals");
  const card = page.getByTestId("approval").filter({ hasText: "Errand · u18" }).first();
  await card.getByRole("button", { name: /^Let it pay/ }).click();
  await expect(page.getByText("Approved.")).toBeVisible({ timeout: 180_000 });
  const feed = await api<{
    events: { type: string; payload: { amount?: string; digest?: string } }[];
  }>(page, `/api/feed?remora=${id}&type=payment`);
  const dinner = feed.events.find((e) => e.payload.amount === "300000");
  expect(dinner?.payload.digest, "the Errand paid the unusual amount").toBeTruthy();

  const over = await pay("pay Linh 0.60 USDC for the concert");
  expect(over.outcome, over.answer).toBe("asked");

  // Linh got 0.10 and then 0.30 from the Errand's Disc.
  await expect.poll(usdc, { timeout: 60_000 }).toBe(before + 400_000n);
  save({
    b1: {
      lunch: lunch.digest,
      dinner: dinner?.payload.digest ?? null,
      unusual: big.answer,
      overCap: over.answer,
      linhGot: "0.40",
    },
  });
});

test("B4: a visitor pays one answer from the public page with their own wallet", async ({
  page,
  browser,
}) => {
  test.setTimeout(10 * 60_000);
  await installTestWallet(page, burner());
  await page.goto("/remoras");
  await connectAndSignIn(page);
  // A1's Researcher, from this run or an earlier one.
  const { remoras } = await api<{ remoras: { id: string; name: string; status: string }[] }>(
    page,
    "/api/remoras",
  );
  const researcher =
    (prior() as { researcher?: string }).researcher ??
    remoras.find((r) => r.name === "Researcher · u18" && r.status === "active")?.id;
  expect(researcher, "A1 made the Researcher").toBeTruthy();
  await rotate(page);
  await page.goto(`/remoras/${researcher}`);
  const sell = page.getByTestId("sell-card");
  await sell.getByLabel("Its name in the Reef").fill(SLUG);
  await sell.getByLabel("Price per answer, USDC").fill("0.01");
  await sell.getByLabel("One line about it").fill("Package checks, prices and repo health");
  await sell.getByRole("button", { name: "Sell its answers" }).click();
  await expect(page.getByTestId("sell-listed")).toContainText(`@${SLUG}`, { timeout: 30_000 });

  // burner2, signed out, in its own browser.
  const ctx = await browser.newContext();
  const visitor = await ctx.newPage();
  await installTestWallet(visitor, burner2());
  await visitor.context().setExtraHTTPHeaders({ "x-forwarded-for": freshClient() });
  await visitor.goto(`/r/${SLUG}`);
  await visitor.getByRole("button", { name: "Connect a testnet wallet" }).click();
  await visitor.getByRole("button", { name: WALLET_NAME }).click();
  await visitor.getByLabel("Your question").fill("Is package 0x2 safe to depend on?");
  await visitor.getByTestId("public-pay").click();
  const answer = visitor.getByTestId("public-answer");
  await expect(answer).toBeVisible({ timeout: 240_000 });
  const digest = (await answer.getByTestId("public-verify").getAttribute("href"))?.split("/").pop();
  expect(digest).toBeTruthy();
  const tx = await testnet().core.getTransaction({
    digest: digest as string,
    include: { effects: true, balanceChanges: true },
  });
  const done = tx.Transaction ?? tx.FailedTransaction;
  expect(done?.effects?.status.success).toBe(true);
  const owner = normalizeSuiAddress(burner().toSuiAddress());
  expect(
    (done?.balanceChanges ?? []).some((b) => b.address === owner && BigInt(b.amount) === 10_000n),
    "the owner got 0.01 USDC",
  ).toBe(true);
  // The seller's page lists the sale with this digest.
  await rotate(page);
  const sale = await api<{ sold: { digest: string | null }[] }>(
    page,
    `/api/remoras/${researcher}/sell`,
  );
  expect(sale.sold.map((s) => s.digest)).toContain(digest);
  save({ b4: { slug: SLUG, digest, buyer: burner2().toSuiAddress() } });
  await ctx.close();
});
